/**
 * Webhooks REST Controller
 */
import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { QZPayWebhookService } from '../qzpay-webhook.service.js';

/**
 * Webhooks REST Controller
 *
 * Provides REST endpoints for receiving webhooks from payment providers.
 * Requires proper webhook secrets to be configured.
 *
 * @example
 * ```typescript
 * // In your module
 * @Module({
 *   imports: [
 *     QZPayModule.forRoot({
 *       // ... other options
 *       webhookSecrets: {
 *         stripe: process.env.STRIPE_WEBHOOK_SECRET,
 *         mercadopago: process.env.MP_WEBHOOK_SECRET,
 *       },
 *     }),
 *   ],
 *   controllers: [QZPayWebhooksController],
 * })
 * export class BillingModule {}
 *
 * // Configure raw body parsing for webhooks
 * // In main.ts:
 * app.use('/billing/webhooks', express.raw({ type: 'application/json' }));
 * ```
 */
@Controller('billing/webhooks')
export class QZPayWebhooksController {
    constructor(private readonly webhookService: QZPayWebhookService) {}

    /**
     * Handle Stripe webhooks
     * POST /billing/webhooks/stripe
     *
     * Requires raw body middleware for signature verification.
     */
    @Post('stripe')
    @HttpCode(HttpStatus.OK)
    async handleStripeWebhook(@Headers('stripe-signature') signature: string, @Body() rawBody: Buffer | string) {
        if (!rawBody) {
            return { received: false, error: 'Raw body not available' };
        }

        try {
            const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString();
            const event = this.webhookService.constructEvent(payload, signature);
            await this.webhookService.handleWebhook(event);
            return { received: true };
        } catch (error) {
            return {
                received: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Handle MercadoPago webhooks
     * POST /billing/webhooks/mercadopago
     */
    @Post('mercadopago')
    @HttpCode(HttpStatus.OK)
    async handleMercadoPagoWebhook(@Headers('x-signature') signature: string, @Body() body: Record<string, unknown>) {
        try {
            // MercadoPago sends JSON body, construct event from it
            const payload = JSON.stringify(body);
            const event = this.webhookService.constructEvent(payload, signature);
            await this.webhookService.handleWebhook(event);
            return { received: true };
        } catch (error) {
            return {
                received: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generic webhook endpoint
     * POST /billing/webhooks/generic
     *
     * For custom providers or testing.
     */
    @Post('generic')
    @HttpCode(HttpStatus.OK)
    async handleGenericWebhook(@Headers('x-webhook-signature') signature: string, @Body() body: Record<string, unknown>) {
        try {
            const payload = JSON.stringify(body);
            const event = this.webhookService.constructEvent(payload, signature);
            await this.webhookService.handleWebhook(event);
            return { received: true };
        } catch (error) {
            return {
                received: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
