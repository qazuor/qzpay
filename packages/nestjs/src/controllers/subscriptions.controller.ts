/**
 * Subscriptions REST Controller
 */
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { QZPayCancelSubscriptionOptions, QZPayCreateSubscriptionServiceInput, QZPayMetadata } from '@qazuor/qzpay-core';
import type { CancelSubscriptionDto } from '../dto/cancel-subscription.dto.js';
import type { CreateSubscriptionDto } from '../dto/create-subscription.dto.js';
import type { UpdateSubscriptionDto } from '../dto/update-subscription.dto.js';
import type { QZPayService } from '../qzpay.service.js';

/**
 * Legacy DTO exports for backwards compatibility
 * @deprecated Use DTOs from ../dto instead
 */
export type { CreateSubscriptionDto, UpdateSubscriptionDto, CancelSubscriptionDto };

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
            input.metadata = dto.metadata as QZPayMetadata;
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
        const updates: { quantity?: number; metadata?: QZPayMetadata } = {};
        if (dto.quantity !== undefined) {
            updates.quantity = dto.quantity;
        }
        if (dto.metadata !== undefined) {
            updates.metadata = dto.metadata as QZPayMetadata;
        }
        return this.qzpay.updateSubscription(id, updates);
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
