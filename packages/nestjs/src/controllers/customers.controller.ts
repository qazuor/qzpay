/**
 * Customers REST Controller
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import type { QZPayMetadata } from '@qazuor/qzpay-core';
import type { CreateCustomerDto } from '../dto/create-customer.dto.js';
import type { UpdateCustomerDto } from '../dto/update-customer.dto.js';
import type { QZPayService } from '../qzpay.service.js';

/**
 * Legacy DTO exports for backwards compatibility
 * @deprecated Use DTOs from ../dto instead
 */
export type { CreateCustomerDto, UpdateCustomerDto };

/**
 * Customers REST Controller
 *
 * Provides REST endpoints for customer management.
 * Register with your module to expose these routes.
 *
 * @example
 * ```typescript
 * // In your module
 * import { Module } from '@nestjs/common';
 * import { QZPayModule, QZPayCustomersController } from '@qazuor/qzpay-nestjs';
 *
 * @Module({
 *   imports: [QZPayModule.forRoot(options)],
 *   controllers: [QZPayCustomersController],
 * })
 * export class BillingModule {}
 * ```
 */
@Controller('billing/customers')
export class QZPayCustomersController {
    constructor(private readonly qzpay: QZPayService) {}

    /**
     * Create a new customer
     * POST /billing/customers
     */
    @Post()
    async create(@Body() dto: CreateCustomerDto) {
        const input: {
            email: string;
            externalId: string;
            name?: string | null;
            metadata?: QZPayMetadata;
        } = {
            email: dto.email,
            externalId: dto.externalId
        };
        if (dto.name !== undefined) {
            input.name = dto.name;
        }
        if (dto.metadata !== undefined) {
            input.metadata = dto.metadata as QZPayMetadata;
        }
        return this.qzpay.createCustomer(input);
    }

    /**
     * Get a customer by ID
     * GET /billing/customers/:id
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.qzpay.getCustomer(id);
    }

    /**
     * Get a customer by external ID
     * GET /billing/customers/external/:externalId
     */
    @Get('external/:externalId')
    async findByExternalId(@Param('externalId') externalId: string) {
        return this.qzpay.getCustomerByExternalId(externalId);
    }

    /**
     * Update a customer
     * PATCH /billing/customers/:id
     */
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        const updates: { name?: string | null; metadata?: QZPayMetadata } = {};
        if (dto.name !== undefined) {
            updates.name = dto.name;
        }
        if (dto.metadata !== undefined) {
            updates.metadata = dto.metadata as QZPayMetadata;
        }
        return this.qzpay.updateCustomer(id, updates);
    }

    /**
     * Delete a customer
     * DELETE /billing/customers/:id
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string) {
        await this.qzpay.deleteCustomer(id);
    }

    /**
     * Get customer's subscriptions
     * GET /billing/customers/:id/subscriptions
     */
    @Get(':id/subscriptions')
    async getSubscriptions(@Param('id') customerId: string) {
        return this.qzpay.getSubscriptionsByCustomerId(customerId);
    }

    /**
     * Get customer's active subscription
     * GET /billing/customers/:id/subscriptions/active
     */
    @Get(':id/subscriptions/active')
    async getActiveSubscription(@Param('id') customerId: string) {
        return this.qzpay.getActiveSubscription(customerId);
    }

    /**
     * Get customer's payments
     * GET /billing/customers/:id/payments
     */
    @Get(':id/payments')
    async getPayments(@Param('id') customerId: string) {
        return this.qzpay.getPaymentsByCustomerId(customerId);
    }

    /**
     * Get customer's invoices
     * GET /billing/customers/:id/invoices
     */
    @Get(':id/invoices')
    async getInvoices(@Param('id') customerId: string) {
        return this.qzpay.getInvoicesByCustomerId(customerId);
    }

    /**
     * Get customer's entitlements
     * GET /billing/customers/:id/entitlements
     */
    @Get(':id/entitlements')
    async getEntitlements(@Param('id') customerId: string) {
        return this.qzpay.getEntitlements(customerId);
    }

    /**
     * Check if customer has a specific entitlement
     * GET /billing/customers/:id/entitlements/:key/check
     */
    @Get(':id/entitlements/:key/check')
    async checkEntitlement(@Param('id') customerId: string, @Param('key') key: string) {
        const hasEntitlement = await this.qzpay.checkEntitlement(customerId, key);
        return { entitled: hasEntitlement };
    }

    /**
     * Get customer's limits
     * GET /billing/customers/:id/limits
     */
    @Get(':id/limits')
    async getLimits(@Param('id') customerId: string) {
        return this.qzpay.getLimits(customerId);
    }

    /**
     * Check a specific limit for customer
     * GET /billing/customers/:id/limits/:key/check
     */
    @Get(':id/limits/:key/check')
    async checkLimit(@Param('id') customerId: string, @Param('key') key: string) {
        return this.qzpay.checkLimit(customerId, key);
    }
}
