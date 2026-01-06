/**
 * Invoices REST Controller
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { QZPayCreateInvoiceServiceInput } from '@qazuor/qzpay-core';
import type { QZPayService } from '../qzpay.service.js';

/**
 * DTO for creating an invoice line item
 */
export interface CreateInvoiceLineDto {
    description: string;
    quantity: number;
    unitAmount: number;
    priceId?: string;
}

/**
 * DTO for creating an invoice
 */
export interface CreateInvoiceDto {
    customerId: string;
    subscriptionId?: string;
    lines: CreateInvoiceLineDto[];
    dueDate?: string;
    metadata?: Record<string, unknown>;
}

/**
 * DTO for marking an invoice as paid
 */
export interface MarkPaidDto {
    paymentId: string;
}

/**
 * Invoices REST Controller
 *
 * Provides REST endpoints for invoice management.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [QZPayModule.forRoot(options)],
 *   controllers: [QZPayInvoicesController],
 * })
 * export class BillingModule {}
 * ```
 */
@Controller('billing/invoices')
export class QZPayInvoicesController {
    constructor(private readonly qzpay: QZPayService) {}

    /**
     * Create a new invoice
     * POST /billing/invoices
     */
    @Post()
    async create(@Body() dto: CreateInvoiceDto) {
        const input: QZPayCreateInvoiceServiceInput = {
            customerId: dto.customerId,
            lines: dto.lines
        };
        if (dto.subscriptionId !== undefined) {
            input.subscriptionId = dto.subscriptionId;
        }
        if (dto.dueDate !== undefined) {
            input.dueDate = new Date(dto.dueDate);
        }
        if (dto.metadata !== undefined) {
            input.metadata = dto.metadata;
        }
        return this.qzpay.createInvoice(input);
    }

    /**
     * Get an invoice by ID
     * GET /billing/invoices/:id
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.qzpay.getInvoice(id);
    }

    /**
     * Mark an invoice as paid
     * POST /billing/invoices/:id/paid
     */
    @Post(':id/paid')
    async markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
        return this.qzpay.markInvoicePaid(id, dto.paymentId);
    }
}
