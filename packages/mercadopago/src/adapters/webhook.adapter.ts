/**
 * MercadoPago Webhook Adapter
 */
import * as crypto from 'node:crypto';
import type { QZPayLogger, QZPayPaymentWebhookAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
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

/**
 * Default timestamp tolerance in seconds (5 minutes)
 * This prevents replay attacks by rejecting webhooks with old timestamps
 */
const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;

export interface QZPayMercadoPagoWebhookConfig {
    /**
     * Webhook secret for signature verification
     */
    webhookSecret?: string | undefined;

    /**
     * Timestamp tolerance in seconds for replay attack prevention
     * @default 300 (5 minutes)
     */
    timestampToleranceSeconds?: number | undefined;

    /**
     * When `true`, calling `verifySignature()` or `constructEvent()` while
     * `webhookSecret` is unset throws an error instead of silently accepting
     * the payload as valid.
     *
     * Production deployments should set this to `true` (defense in depth)
     * to prevent accidentally accepting unverified webhooks if the secret
     * was not configured.
     *
     * The default is `false` to preserve backwards compatibility for
     * existing consumers and to keep local-development experience smooth
     * when billing is not yet configured.
     *
     * @default false
     */
    failClosedWhenSecretMissing?: boolean | undefined;

    /**
     * Optional structured logger. When provided, the adapter routes its
     * debug/warn/error output through it instead of `console.*`. Use this
     * to integrate with your application's logging pipeline (pino, winston,
     * etc.) so webhook signature failures are captured with the rest of
     * your structured logs.
     *
     * If omitted, the adapter is silent (it does not write to console).
     */
    logger?: QZPayLogger | undefined;
}

export class QZPayMercadoPagoWebhookAdapter implements QZPayPaymentWebhookAdapter {
    private readonly webhookSecret: string | undefined;
    private readonly timestampToleranceSeconds: number;
    private readonly failClosedWhenSecretMissing: boolean;
    private readonly logger: QZPayLogger | undefined;

    constructor(webhookSecret?: string);
    constructor(config: QZPayMercadoPagoWebhookConfig);
    constructor(webhookSecretOrConfig?: string | QZPayMercadoPagoWebhookConfig) {
        if (typeof webhookSecretOrConfig === 'string') {
            this.webhookSecret = webhookSecretOrConfig;
            this.timestampToleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;
            this.failClosedWhenSecretMissing = false;
            this.logger = undefined;
        } else if (webhookSecretOrConfig) {
            this.webhookSecret = webhookSecretOrConfig.webhookSecret;
            this.timestampToleranceSeconds = webhookSecretOrConfig.timestampToleranceSeconds ?? DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;
            this.failClosedWhenSecretMissing = webhookSecretOrConfig.failClosedWhenSecretMissing ?? false;
            this.logger = webhookSecretOrConfig.logger;
        } else {
            this.webhookSecret = undefined;
            this.timestampToleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;
            this.failClosedWhenSecretMissing = false;
            this.logger = undefined;
        }
    }

    /**
     * Construct a normalized webhook event from a MercadoPago payload.
     *
     * Per the MercadoPago Webhooks v2 specification, the HMAC manifest is
     * `id:{dataId};request-id:{x-request-id};ts:{ts};` — the `dataId` is
     * canonicalized from the URL query string (`?data.id=<id>` or legacy
     * `?id=<id>`), NOT the JSON body. When the host extracts and passes
     * the `dataId` argument explicitly, the adapter uses it directly. When
     * omitted, the adapter falls back to reading `data.id` from the JSON
     * body — best-effort only, since real MP webhooks routinely arrive
     * with the id only in the URL. The `request-id` value MUST come from
     * the `x-request-id` header sent by MercadoPago, NOT from the `ts`
     * field (earlier 1.x versions had this bug).
     */
    constructEvent(payload: string | Buffer, signature: string, requestId?: string, dataId?: string): QZPayWebhookEvent {
        const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

        // Fail closed when configured and no secret is set (defense in depth).
        if (!this.webhookSecret && this.failClosedWhenSecretMissing) {
            throw new Error(
                'QZPay MercadoPago webhook secret is not configured — refusing to accept unverified webhook (failClosedWhenSecretMissing=true)'
            );
        }

        // Verify signature if secret is configured
        if (this.webhookSecret && !this.verifySignature(payload, signature, requestId, dataId)) {
            // Check if the failure is due to timestamp being too old
            const parts = signature.split(',');
            const timestamp = parts.find((p) => p.startsWith('ts='))?.slice(3);

            if (timestamp) {
                const timestampSeconds = Number.parseInt(timestamp, 10);
                if (!Number.isNaN(timestampSeconds)) {
                    const currentTimeSeconds = Math.floor(Date.now() / 1000);
                    const timeDifference = Math.abs(currentTimeSeconds - timestampSeconds);

                    if (timeDifference > this.timestampToleranceSeconds) {
                        throw new Error('Webhook timestamp too old, possible replay attack');
                    }
                }
            }

            throw new Error('Invalid MercadoPago webhook signature');
        }

        const mpEvent = JSON.parse(payloadString) as MercadoPagoWebhookPayload;
        const qzpayEvent = this.mapToQZPayEvent(mpEvent);

        this.logger?.debug('MercadoPago webhook event constructed', {
            provider: 'mercadopago',
            operation: 'constructEvent',
            mpId: String(mpEvent.id),
            mpType: mpEvent.type,
            mpAction: mpEvent.action,
            qzpayType: qzpayEvent.type
        });

        return qzpayEvent;
    }

    /**
     * Verify a MercadoPago webhook signature against the HMAC-SHA256 manifest
     * `id:{dataId};request-id:{x-request-id};ts:{ts};`.
     *
     * `requestId` must be the verbatim value of the `x-request-id` header
     * received from MercadoPago. When a secret is configured and `requestId`
     * is empty/missing, verification fails (returns `false`) and a warning
     * is logged — this is intentional defense-in-depth, since silently
     * substituting `ts` would mask integration bugs.
     *
     * `dataId` should be extracted from the URL query string (`?data.id=`
     * or legacy `?id=`) — this is the source MercadoPago itself uses when
     * computing the manifest. When omitted, the adapter falls back to
     * reading `data.id` from the JSON body, which is best-effort only and
     * will fail HMAC verification whenever the body lacks the field or
     * carries a different value.
     *
     * The `dataId` is lowercased before hashing to match the canonicalization
     * the MercadoPago server performs when computing the signature.
     */
    verifySignature(payload: string | Buffer, signature: string, requestId?: string, dataId?: string): boolean {
        if (!this.webhookSecret) {
            if (this.failClosedWhenSecretMissing) {
                throw new Error(
                    'QZPay MercadoPago webhook secret is not configured — refusing to accept unverified webhook (failClosedWhenSecretMissing=true)'
                );
            }
            return true; // No secret configured, skip verification (backwards-compat default)
        }

        try {
            const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

            // MercadoPago signature format: ts=timestamp,v1=signature
            const parts = signature.split(',');
            const timestamp = parts.find((p) => p.startsWith('ts='))?.slice(3);
            const sig = parts.find((p) => p.startsWith('v1='))?.slice(3);

            if (!timestamp || !sig) {
                this.logger?.warn('MercadoPago webhook signature missing ts or v1 component', {
                    provider: 'mercadopago',
                    operation: 'verifySignature'
                });
                return false;
            }

            // Validate timestamp to prevent replay attacks
            const timestampSeconds = Number.parseInt(timestamp, 10);
            if (Number.isNaN(timestampSeconds)) {
                this.logger?.warn('MercadoPago webhook signature has non-numeric ts component', {
                    provider: 'mercadopago',
                    operation: 'verifySignature',
                    ts: timestamp
                });
                return false;
            }

            const currentTimeSeconds = Math.floor(Date.now() / 1000);
            const timeDifference = Math.abs(currentTimeSeconds - timestampSeconds);

            if (timeDifference > this.timestampToleranceSeconds) {
                this.logger?.warn('MercadoPago webhook signature timestamp outside tolerance window', {
                    provider: 'mercadopago',
                    operation: 'verifySignature',
                    timeDifferenceSeconds: timeDifference,
                    toleranceSeconds: this.timestampToleranceSeconds
                });
                return false;
            }

            // When secret is configured, requestId is REQUIRED — MercadoPago
            // includes the x-request-id header in the HMAC manifest, so
            // verifying without it cannot succeed against a real webhook.
            // Fail loudly so integration bugs surface immediately.
            if (!requestId) {
                this.logger?.warn(
                    'MercadoPago webhook signature verification was called without requestId — the x-request-id header must be passed to verifySignature/constructEvent. Verification will fail.',
                    {
                        provider: 'mercadopago',
                        operation: 'verifySignature'
                    }
                );
                return false;
            }

            // Build the canonical signed payload exactly as the MercadoPago
            // server does. Prefer the explicit `dataId` (from URL query)
            // over body extraction — MP signs against the URL value. The
            // `dataId` is lowercased before hashing because the server
            // canonicalizes it that way; passing it verbatim would mismatch
            // for any non-numeric ID.
            const bodyDataId = this.extractId(payloadString);
            const effectiveDataId = (dataId ?? bodyDataId).toLowerCase();
            const dataIdSource = dataId !== undefined ? 'url' : 'body';
            const signedPayload = `id:${effectiveDataId};request-id:${requestId};ts:${timestamp};`;
            const expectedSignature = crypto.createHmac('sha256', this.webhookSecret).update(signedPayload).digest('hex');

            const sigBuffer = Buffer.from(sig);
            const expectedBuffer = Buffer.from(expectedSignature);
            if (sigBuffer.length !== expectedBuffer.length) {
                this.logger?.warn('MercadoPago webhook signature length mismatch', {
                    provider: 'mercadopago',
                    operation: 'verifySignature',
                    receivedLength: sigBuffer.length,
                    expectedLength: expectedBuffer.length,
                    dataIdSource,
                    effectiveDataId,
                    bodyDataId: bodyDataId || '<missing>',
                    requestId,
                    ts: timestamp
                });
                return false;
            }

            const matches = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
            if (matches) {
                this.logger?.debug('MercadoPago webhook signature verified', {
                    provider: 'mercadopago',
                    operation: 'verifySignature',
                    dataIdSource,
                    effectiveDataId,
                    requestId,
                    ts: timestamp
                });
            } else {
                // On HMAC mismatch, dump enough context to diagnose without
                // leaking the secret: the canonical manifest computed, the
                // first/last bytes of the received signature, source of dataId
                // (url vs body), and the body-side data.id (so the host can
                // tell if body and URL diverged).
                this.logger?.warn('MercadoPago webhook signature HMAC mismatch', {
                    provider: 'mercadopago',
                    operation: 'verifySignature',
                    dataIdSource,
                    effectiveDataId,
                    bodyDataId: bodyDataId || '<missing>',
                    requestId,
                    ts: timestamp,
                    manifest: signedPayload,
                    receivedSigPrefix: `${sig.slice(0, 8)}...${sig.slice(-8)}`,
                    expectedSigPrefix: `${expectedSignature.slice(0, 8)}...${expectedSignature.slice(-8)}`,
                    payloadBytes: payloadString.length
                });
            }
            return matches;
        } catch (error) {
            this.logger?.error('MercadoPago webhook signature verification threw', {
                provider: 'mercadopago',
                operation: 'verifySignature',
                error
            });
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
    private readonly logger: QZPayLogger | undefined;

    constructor(options?: { logger?: QZPayLogger }) {
        this.logger = options?.logger;
    }

    /**
     * Register a handler for a specific IPN type
     */
    on(type: QZPayMPIPNType, handler: QZPayMPIPNHandler): void {
        this.handlers[type] = handler;
        this.logger?.debug('MercadoPago IPN handler registered', {
            provider: 'mercadopago',
            operation: 'ipnHandler.on',
            type
        });
    }

    /**
     * Remove a handler for a specific IPN type
     */
    off(type: QZPayMPIPNType): void {
        delete this.handlers[type];
        this.logger?.debug('MercadoPago IPN handler removed', {
            provider: 'mercadopago',
            operation: 'ipnHandler.off',
            type
        });
    }

    /**
     * Process an IPN notification
     */
    async process(notification: QZPayMPIPNNotification): Promise<QZPayMPIPNResult> {
        const handler = this.handlers[notification.type];

        if (!handler) {
            this.logger?.warn('MercadoPago IPN received with no registered handler', {
                provider: 'mercadopago',
                operation: 'ipnHandler.process',
                type: notification.type,
                action: notification.action,
                resourceId: notification.data.id
            });
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
            this.logger?.debug('MercadoPago IPN handled', {
                provider: 'mercadopago',
                operation: 'ipnHandler.process',
                type: notification.type,
                action: notification.action,
                resourceId: notification.data.id
            });
            return {
                processed: true,
                eventType: notification.type,
                action: notification.action,
                resourceId: notification.data.id
            };
        } catch (error) {
            this.logger?.error('MercadoPago IPN handler threw', {
                provider: 'mercadopago',
                operation: 'ipnHandler.process',
                type: notification.type,
                action: notification.action,
                resourceId: notification.data.id,
                error
            });
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
