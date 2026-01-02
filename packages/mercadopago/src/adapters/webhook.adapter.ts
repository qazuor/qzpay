/**
 * MercadoPago Webhook Adapter
 */
import * as crypto from 'node:crypto';
import type { QZPayPaymentWebhookAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { MERCADOPAGO_WEBHOOK_EVENTS, type MercadoPagoWebhookPayload } from '../types.js';

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

    private mapEventType(mpEventType: string): string {
        const eventMap: Record<string, string> = MERCADOPAGO_WEBHOOK_EVENTS;

        // Try exact match first
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

        // Return original if no mapping found
        return mpEventType;
    }
}
