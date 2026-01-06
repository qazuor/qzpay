/**
 * Payments REST Controller
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { QZPayCurrency, QZPayProcessPaymentInput, QZPayRefundPaymentInput } from '@qazuor/qzpay-core';
import type { QZPayService } from '../qzpay.service.js';

/**
 * DTO for processing a payment
 */
export interface ProcessPaymentDto {
    customerId: string;
    amount: number;
    currency: QZPayCurrency;
    invoiceId?: string;
    subscriptionId?: string;
    paymentMethodId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * DTO for refunding a payment
 */
export interface RefundPaymentDto {
    amount?: number;
    reason?: string;
}

/**
 * Payments REST Controller
 *
 * Provides REST endpoints for payment operations.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [QZPayModule.forRoot(options)],
 *   controllers: [QZPayPaymentsController],
 * })
 * export class BillingModule {}
 * ```
 */
@Controller('billing/payments')
export class QZPayPaymentsController {
    constructor(private readonly qzpay: QZPayService) {}

    /**
     * Process a new payment
     * POST /billing/payments
     */
    @Post()
    async process(@Body() dto: ProcessPaymentDto) {
        const input: QZPayProcessPaymentInput = {
            customerId: dto.customerId,
            amount: dto.amount,
            currency: dto.currency
        };
        if (dto.invoiceId !== undefined) {
            input.invoiceId = dto.invoiceId;
        }
        if (dto.subscriptionId !== undefined) {
            input.subscriptionId = dto.subscriptionId;
        }
        if (dto.paymentMethodId !== undefined) {
            input.paymentMethodId = dto.paymentMethodId;
        }
        if (dto.metadata !== undefined) {
            input.metadata = dto.metadata;
        }
        return this.qzpay.processPayment(input);
    }

    /**
     * Get a payment by ID
     * GET /billing/payments/:id
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.qzpay.getPayment(id);
    }

    /**
     * Refund a payment
     * POST /billing/payments/:id/refund
     */
    @Post(':id/refund')
    async refund(@Param('id') paymentId: string, @Body() dto: RefundPaymentDto) {
        const input: QZPayRefundPaymentInput = {
            paymentId
        };
        if (dto.amount !== undefined) {
            input.amount = dto.amount;
        }
        if (dto.reason !== undefined) {
            input.reason = dto.reason;
        }
        return this.qzpay.refundPayment(input);
    }
}
