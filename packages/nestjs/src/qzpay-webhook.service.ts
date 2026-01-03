/**
 * QZPay Webhook Service
 * Handles webhook processing and verification
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { QZPayBilling, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { QZPAY_BILLING_TOKEN } from './constants.js';
import type { WebhookEventHandler, WebhookHandlersMap } from './types.js';

@Injectable()
export class QZPayWebhookService {
    private readonly logger = new Logger(QZPayWebhookService.name);
    private readonly handlers: WebhookHandlersMap = {};

    constructor(
        @Inject(QZPAY_BILLING_TOKEN)
        private readonly billing: QZPayBilling
    ) {
        this.registerDefaultHandlers();
    }

    /**
     * Register default webhook handlers
     */
    private registerDefaultHandlers(): void {
        this.handlers['customer.created'] = async (event) => {
            this.logger.log(`Customer created: ${String(event.data)}`);
        };

        this.handlers['customer.updated'] = async (event) => {
            this.logger.log(`Customer updated: ${String(event.data)}`);
        };

        this.handlers['subscription.created'] = async (event) => {
            this.logger.log(`Subscription created: ${String(event.data)}`);
        };

        this.handlers['subscription.updated'] = async (event) => {
            this.logger.log(`Subscription updated: ${String(event.data)}`);
        };

        this.handlers['subscription.cancelled'] = async (event) => {
            this.logger.log(`Subscription cancelled: ${String(event.data)}`);
        };

        this.handlers['payment.succeeded'] = async (event) => {
            this.logger.log(`Payment succeeded: ${String(event.data)}`);
        };

        this.handlers['payment.failed'] = async (event) => {
            this.logger.warn(`Payment failed: ${String(event.data)}`);
        };

        this.handlers['invoice.created'] = async (event) => {
            this.logger.log(`Invoice created: ${String(event.data)}`);
        };

        this.handlers['invoice.paid'] = async (event) => {
            this.logger.log(`Invoice paid: ${String(event.data)}`);
        };
    }

    /**
     * Register a custom webhook handler
     */
    registerHandler(eventType: string, handler: WebhookEventHandler): void {
        this.handlers[eventType] = handler;
        this.logger.debug(`Registered handler for event: ${eventType}`);
    }

    /**
     * Unregister a webhook handler
     */
    unregisterHandler(eventType: string): void {
        delete this.handlers[eventType];
        this.logger.debug(`Unregistered handler for event: ${eventType}`);
    }

    /**
     * Process a webhook event
     */
    async handleWebhook(event: QZPayWebhookEvent): Promise<void> {
        const handler = this.handlers[event.type];

        if (!handler) {
            this.logger.debug(`No handler registered for event: ${event.type}`);
            return;
        }

        try {
            await handler(event);
            this.logger.debug(`Successfully processed event: ${event.type}`);
        } catch (error) {
            this.logger.error(`Error processing webhook event ${event.type}: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Verify webhook signature and construct event
     */
    constructEvent(payload: string | Buffer, signature: string): QZPayWebhookEvent {
        const paymentAdapter = this.billing.getPaymentAdapter();

        if (!paymentAdapter) {
            throw new Error('Payment adapter not configured');
        }

        return paymentAdapter.webhooks.constructEvent(payload, signature);
    }

    /**
     * Verify webhook signature
     */
    verifySignature(payload: string | Buffer, signature: string): boolean {
        const paymentAdapter = this.billing.getPaymentAdapter();

        if (!paymentAdapter) {
            throw new Error('Payment adapter not configured');
        }

        return paymentAdapter.webhooks.verifySignature(payload, signature);
    }
}
