/**
 * Subscriptions REST Controller
 */
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { QZPayCancelSubscriptionOptions, QZPayCreateSubscriptionServiceInput } from '@qazuor/qzpay-core';
import type { QZPayService } from '../qzpay.service.js';

/**
 * DTO for creating a subscription
 */
export interface CreateSubscriptionDto {
    customerId: string;
    planId: string;
    priceId?: string;
    quantity?: number;
    trialDays?: number;
    promoCodeId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a subscription
 */
export interface UpdateSubscriptionDto {
    planId?: string;
    priceId?: string;
    quantity?: number;
    metadata?: Record<string, unknown>;
}

/**
 * DTO for cancelling a subscription
 */
export interface CancelSubscriptionDto {
    cancelAtPeriodEnd?: boolean;
    reason?: string;
}

/**
 * Subscriptions REST Controller
 *
 * Provides REST endpoints for subscription management.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [QZPayModule.forRoot(options)],
 *   controllers: [QZPaySubscriptionsController],
 * })
 * export class BillingModule {}
 * ```
 */
@Controller('billing/subscriptions')
export class QZPaySubscriptionsController {
    constructor(private readonly qzpay: QZPayService) {}

    /**
     * Create a new subscription
     * POST /billing/subscriptions
     */
    @Post()
    async create(@Body() dto: CreateSubscriptionDto) {
        const input: QZPayCreateSubscriptionServiceInput = {
            customerId: dto.customerId,
            planId: dto.planId
        };
        if (dto.priceId !== undefined) {
            input.priceId = dto.priceId;
        }
        if (dto.quantity !== undefined) {
            input.quantity = dto.quantity;
        }
        if (dto.trialDays !== undefined) {
            input.trialDays = dto.trialDays;
        }
        if (dto.promoCodeId !== undefined) {
            input.promoCodeId = dto.promoCodeId;
        }
        if (dto.metadata !== undefined) {
            input.metadata = dto.metadata;
        }
        return this.qzpay.createSubscription(input);
    }

    /**
     * Get a subscription by ID
     * GET /billing/subscriptions/:id
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.qzpay.getSubscription(id);
    }

    /**
     * Update a subscription
     * PATCH /billing/subscriptions/:id
     */
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
        return this.qzpay.updateSubscription(id, dto);
    }

    /**
     * Cancel a subscription
     * POST /billing/subscriptions/:id/cancel
     */
    @Post(':id/cancel')
    async cancel(@Param('id') id: string, @Body() dto: CancelSubscriptionDto) {
        const options: QZPayCancelSubscriptionOptions = {};
        if (dto.cancelAtPeriodEnd !== undefined) {
            options.cancelAtPeriodEnd = dto.cancelAtPeriodEnd;
        }
        if (dto.reason !== undefined) {
            options.reason = dto.reason;
        }
        return this.qzpay.cancelSubscription(id, options);
    }

    /**
     * Pause a subscription
     * POST /billing/subscriptions/:id/pause
     */
    @Post(':id/pause')
    async pause(@Param('id') id: string) {
        return this.qzpay.pauseSubscription(id);
    }

    /**
     * Resume a subscription
     * POST /billing/subscriptions/:id/resume
     */
    @Post(':id/resume')
    async resume(@Param('id') id: string) {
        return this.qzpay.resumeSubscription(id);
    }
}
