/**
 * Webhook Controller for MercadoPago IPN
 *
 * Handles incoming webhooks from MercadoPago with signature verification.
 */
import {
    BadRequestException,
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Logger,
    Post,
    type RawBodyRequest,
    Req,
    UnauthorizedException
} from '@nestjs/common';
import type { Request } from 'express';
import type { BillingService } from './billing.service';

@Controller('webhooks')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(private readonly billing: BillingService) {}

    /**
     * Handle MercadoPago IPN webhook
     *
     * MercadoPago sends webhooks (IPN - Instant Payment Notification) for:
     * - payment.created
     * - payment.updated
     * - subscription_preapproval.created
     * - subscription_preapproval.updated
     * - subscription_authorized_payment.created
     */
    @Post('mercadopago')
    @HttpCode(HttpStatus.OK)
    async handleMercadoPagoWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-signature') signature?: string,
        @Headers('x-request-id') requestId?: string,
        @Body() body?: unknown
    ) {
        this.logger.log('Received MercadoPago webhook');

        // Get raw body for signature verification
        const rawBody = req.rawBody?.toString() ?? JSON.stringify(body);

        if (!rawBody) {
            throw new BadRequestException('Empty request body');
        }

        try {
            const result = await this.billing.processWebhook(rawBody, signature, requestId);

            if (!result.processed) {
                throw new UnauthorizedException('Invalid webhook signature');
            }

            this.logger.log(`Webhook processed: ${result.event?.type}`);

            return { received: true };
        } catch (error) {
            this.logger.error('Webhook processing failed', error);

            if (error instanceof UnauthorizedException) {
                throw error;
            }

            // MercadoPago expects 200 even on processing errors to prevent retries
            // Log the error but return success
            return { received: true, error: 'Processing failed' };
        }
    }

    /**
     * Health check endpoint for webhook verification
     *
     * MercadoPago may ping this endpoint to verify it's accessible
     */
    @Post('mercadopago/verify')
    @HttpCode(HttpStatus.OK)
    verifyEndpoint() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}
