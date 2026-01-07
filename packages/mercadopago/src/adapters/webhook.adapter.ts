/**
 * MercadoPago Webhook Adapter
 */
import * as crypto from 'node:crypto';
import type { QZPayPaymentWebhookAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import {
    MERCADOPAGO_WEBHOOK_EVENTS,
    MERCADOPAGO_WEBHOOK_EVENTS_EXTENDED,
    type MercadoPagoWebhookPayload,
    type QZPayMP3DSResult,
    type QZPayMPIPNAction,
    type QZPayMPIPNHandler,
    type QZPayMPIPNHandlerMap,
    type QZPayMPIPNNotification,
    type QZPayMPIPNResult,
    type QZPayMPIPNType,
    extractMP3DSResult,
    isMP3DSRequired
} from '../types.js';

export class QZPayMercadoPagoWebhookAdapter implements QZPayPaymentWebhookAdapter {
    private readonly webhookSecret: string | undefined;

    constructor(webhookSecret?: string) {
        this.webhookSecret = webhookSecret;
    }

    constructEvent(payload: string | Buffer, signature: string): QZPayWebhookEvent {
        const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

        // Verify signature if secret is configured
        if (this.webhookSecret && !this.verifySignature(payload, signature)) {
            throw new Error('Invalid MercadoPago webhook signature');
        }

        const mpEvent = JSON.parse(payloadString) as MercadoPagoWebhookPayload;

        return this.mapToQZPayEvent(mpEvent);
    }

    verifySignature(payload: string | Buffer, signature: string): boolean {
        if (!this.webhookSecret) {
            return true; // No secret configured, skip verification
        }

        try {
            const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

            // MercadoPago signature format: ts=timestamp,v1=signature
            const parts = signature.split(',');
            const timestamp = parts.find((p) => p.startsWith('ts='))?.slice(3);
            const sig = parts.find((p) => p.startsWith('v1='))?.slice(3);

            if (!timestamp || !sig) {
                return false;
            }

            // Create expected signature
            const signedPayload = `id:${this.extractId(payloadString)};request-id:${timestamp};ts:${timestamp};`;
            const expectedSignature = crypto.createHmac('sha256', this.webhookSecret).update(signedPayload).digest('hex');

            return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature));
        } catch {
            return false;
        }
    }

    private extractId(payload: string): string {
        try {
            const parsed = JSON.parse(payload) as MercadoPagoWebhookPayload;
            return parsed.data?.id ?? String(parsed.id);
        } catch {
            return '';
        }
    }

    private mapToQZPayEvent(mpEvent: MercadoPagoWebhookPayload): QZPayWebhookEvent {
        // Build event type from action and type
        const eventKey = mpEvent.action ? `${mpEvent.type}.${mpEvent.action}` : mpEvent.type;

        const mappedType = this.mapEventType(eventKey);

        return {
            id: String(mpEvent.id),
            type: mappedType,
            data: mpEvent.data,
            created: new Date(mpEvent.date_created)
        };
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Event type mapping requires multiple fallback strategies
    private mapEventType(mpEventType: string): string {
        // Try extended map first
        const extendedMap: Record<string, string> = MERCADOPAGO_WEBHOOK_EVENTS_EXTENDED;
        if (extendedMap[mpEventType]) {
            return extendedMap[mpEventType];
        }

        const eventMap: Record<string, string> = MERCADOPAGO_WEBHOOK_EVENTS;

        // Try exact match
        if (eventMap[mpEventType]) {
            return eventMap[mpEventType];
        }

        // Try without action
        const typeOnly = mpEventType.split('.')[0] ?? mpEventType;
        if (typeOnly && eventMap[typeOnly]) {
            return eventMap[typeOnly];
        }

        // Map common patterns
        if (mpEventType.includes('payment')) {
            if (mpEventType.includes('created')) return 'payment.created';
            if (mpEventType.includes('updated')) return 'payment.updated';
            return 'payment.updated';
        }

        if (mpEventType.includes('subscription') || mpEventType.includes('preapproval')) {
            if (mpEventType.includes('created')) return 'subscription.created';
            if (mpEventType.includes('updated')) return 'subscription.updated';
            return 'subscription.updated';
        }

        if (mpEventType.includes('chargeback')) {
            if (mpEventType.includes('created')) return 'dispute.created';
            return 'dispute.updated';
        }

        // Return original if no mapping found
        return mpEventType;
    }
}

// ==================== IPN (Instant Payment Notification) Handler ====================

/**
 * MercadoPago IPN Handler
 *
 * Handles Instant Payment Notifications from MercadoPago.
 * Use this class to process IPN notifications with custom handlers.
 *
 * @example
 * ```typescript
 * const ipnHandler = new QZPayMercadoPagoIPNHandler();
 *
 * // Register handlers
 * ipnHandler.on('payment', async (notification) => {
 *   const paymentId = notification.data.id;
 *   // Fetch payment details and update your system
 * });
 *
 * ipnHandler.on('chargebacks', async (notification) => {
 *   // Handle chargeback
 * });
 *
 * // Process incoming notification
 * const result = await ipnHandler.process(notification);
 * ```
 */
export class QZPayMercadoPagoIPNHandler {
    private readonly handlers: QZPayMPIPNHandlerMap = {};

    /**
     * Register a handler for a specific IPN type
     */
    on(type: QZPayMPIPNType, handler: QZPayMPIPNHandler): void {
        this.handlers[type] = handler;
    }

    /**
     * Remove a handler for a specific IPN type
     */
    off(type: QZPayMPIPNType): void {
        delete this.handlers[type];
    }

    /**
     * Process an IPN notification
     */
    async process(notification: QZPayMPIPNNotification): Promise<QZPayMPIPNResult> {
        const handler = this.handlers[notification.type];

        if (!handler) {
            return {
                processed: false,
                eventType: notification.type,
                action: notification.action,
                resourceId: notification.data.id,
                error: `No handler registered for type: ${notification.type}`
            };
        }

        try {
            await handler(notification);
            return {
                processed: true,
                eventType: notification.type,
                action: notification.action,
                resourceId: notification.data.id
            };
        } catch (error) {
            return {
                processed: false,
                eventType: notification.type,
                action: notification.action,
                resourceId: notification.data.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Parse raw IPN payload into structured notification
     */
    static parseNotification(payload: string | Record<string, unknown>): QZPayMPIPNNotification {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

        return {
            id: data.id as number,
            liveMode: data.live_mode as boolean,
            type: data.type as QZPayMPIPNType,
            dateCreated: new Date(data.date_created as string),
            applicationId: (data.application_id as string) ?? '',
            userId: data.user_id as string,
            version: (data.version as number) ?? 1,
            apiVersion: data.api_version as string,
            action: data.action as QZPayMPIPNAction,
            data: data.data as { id: string; [key: string]: unknown }
        };
    }
}

// ==================== Webhook Event Data Extractors ====================

/**
 * Extract payment data from MercadoPago webhook event
 */
export function extractMPPaymentEventData(event: QZPayWebhookEvent): {
    paymentId: string;
    status?: string;
    statusDetail?: string;
    externalReference?: string;
    customerId?: string;
} {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const id = data['id'] as string | undefined;

    const result: {
        paymentId: string;
        status?: string;
        statusDetail?: string;
        externalReference?: string;
        customerId?: string;
    } = {
        paymentId: id ?? ''
    };

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const status = data['status'] as string | undefined;
    if (status) {
        result.status = status;
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const statusDetail = data['status_detail'] as string | undefined;
    if (statusDetail) {
        result.statusDetail = statusDetail;
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const externalRef = data['external_reference'] as string | undefined;
    if (externalRef) {
        result.externalReference = externalRef;
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const payer = data['payer'] as { id?: string } | undefined;
    if (payer?.id) {
        result.customerId = payer.id;
    }

    return result;
}

/**
 * Extract subscription data from MercadoPago webhook event
 */
export function extractMPSubscriptionEventData(event: QZPayWebhookEvent): {
    subscriptionId: string;
    status?: string;
    payerId?: string;
    planId?: string;
} {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const id = data['id'] as string | undefined;

    const result: {
        subscriptionId: string;
        status?: string;
        payerId?: string;
        planId?: string;
    } = {
        subscriptionId: id ?? ''
    };

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const status = data['status'] as string | undefined;
    if (status) {
        result.status = status;
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const payerId = data['payer_id'] as string | undefined;
    if (payerId) {
        result.payerId = payerId;
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const planId = data['preapproval_plan_id'] as string | undefined;
    if (planId) {
        result.planId = planId;
    }

    return result;
}

/**
 * Extract chargeback data from MercadoPago webhook event
 */
export function extractMPChargebackEventData(event: QZPayWebhookEvent): {
    chargebackId: string;
    paymentId?: string;
    status?: string;
    amount?: number;
    reason?: string;
} {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const id = data['id'] as string | undefined;

    const result: {
        chargebackId: string;
        paymentId?: string;
        status?: string;
        amount?: number;
        reason?: string;
    } = {
        chargebackId: id ?? ''
    };

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const paymentId = data['payment_id'] as string | number | undefined;
    if (paymentId) {
        result.paymentId = String(paymentId);
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const status = data['status'] as string | undefined;
    if (status) {
        result.status = status;
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const amount = data['amount'] as number | undefined;
    if (amount !== undefined) {
        result.amount = Math.round(amount * 100); // Convert to cents
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const reason = data['reason'] as string | undefined;
    if (reason) {
        result.reason = reason;
    }

    return result;
}

/**
 * Classify MercadoPago event type
 */
export function classifyMPEvent(eventType: string): 'payment' | 'subscription' | 'chargeback' | 'order' | 'other' {
    if (eventType.includes('payment')) return 'payment';
    if (eventType.includes('subscription') || eventType.includes('preapproval')) return 'subscription';
    if (eventType.includes('chargeback')) return 'chargeback';
    if (eventType.includes('order') || eventType.includes('merchant_order')) return 'order';
    return 'other';
}

/**
 * Check if event requires immediate action
 */
export function mpRequiresImmediateAction(event: QZPayWebhookEvent): boolean {
    const urgentTypes = ['chargebacks.created', 'chargebacks', 'payment.updated'];
    return urgentTypes.some((t) => event.type.includes(t));
}

// ==================== 3D Secure Helpers ====================

/**
 * Extract 3D Secure information from a payment webhook event
 */
export function extractMP3DSFromPaymentEvent(event: QZPayWebhookEvent): QZPayMP3DSResult | null {
    const data = event.data as Record<string, unknown>;

    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const threeDSecureInfo = data['three_ds_info'] as
        | {
              version?: string;
              authentication_status?: string;
              cavv?: string;
              eci?: string;
              xid?: string;
          }
        | undefined;

    return extractMP3DSResult(threeDSecureInfo);
}

/**
 * Check if a payment event indicates 3DS is required
 */
export function isPaymentEventRequires3DS(event: QZPayWebhookEvent): boolean {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const status = data['status'] as string | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const statusDetail = data['status_detail'] as string | undefined;

    if (!status || !statusDetail) {
        return false;
    }

    return isMP3DSRequired(status, statusDetail);
}

/**
 * Get 3DS challenge URL from payment event if available
 */
export function getMP3DSChallengeUrl(event: QZPayWebhookEvent): string | null {
    const data = event.data as Record<string, unknown>;

    // MercadoPago may provide the challenge URL in various locations
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const initPoint = data['init_point'] as string | undefined;
    if (initPoint) {
        return initPoint;
    }

    // Check in three_d_secure_info
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const threeDSInfo = data['three_ds_info'] as { external_resource_url?: string } | undefined;
    if (threeDSInfo?.external_resource_url) {
        return threeDSInfo.external_resource_url;
    }

    // Check point_of_interaction for QR/redirect
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const poi = data['point_of_interaction'] as
        | {
              transaction_data?: { ticket_url?: string };
          }
        | undefined;
    if (poi?.transaction_data?.ticket_url) {
        return poi.transaction_data.ticket_url;
    }

    return null;
}

/**
 * Extract complete 3DS payment information
 */
export function extractMP3DSPaymentInfo(event: QZPayWebhookEvent): {
    paymentId: string;
    status: string;
    requires3DS: boolean;
    challengeUrl: string | null;
    threeDSecure: QZPayMP3DSResult | null;
} {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const id = data['id'] as string | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature
    const status = (data['status'] as string) ?? 'unknown';

    return {
        paymentId: id ?? '',
        status,
        requires3DS: isPaymentEventRequires3DS(event),
        challengeUrl: getMP3DSChallengeUrl(event),
        threeDSecure: extractMP3DSFromPaymentEvent(event)
    };
}
