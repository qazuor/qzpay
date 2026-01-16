/**
 * Invoices REST Controller
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { QZPayCreateInvoiceServiceInput, QZPayMetadata } from '@qazuor/qzpay-core';
import type { CreateInvoiceDto, CreateInvoiceLineDto } from '../dto/create-invoice.dto.js';
import type { MarkPaidDto } from '../dto/mark-paid.dto.js';
import type { QZPayService } from '../qzpay.service.js';

/**
 * Legacy DTO exports for backwards compatibility
 * @deprecated Use DTOs from ../dto instead
 */
export type { CreateInvoiceDto, CreateInvoiceLineDto, MarkPaidDto };

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
            input.metadata = dto.metadata as QZPayMetadata;
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
