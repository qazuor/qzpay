/**
 * Rate Limit Guard
 * Enforces rate limiting based on customer limits
 */
import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { QZPAY_BILLING_TOKEN, RATE_LIMIT_KEY } from '../constants.js';
import type { RateLimitConfig } from '../types.js';

/**
 * Request interface with customer context
 */
interface RequestWithCustomer {
    customer?: { id: string };
    user?: { customerId?: string };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger(RateLimitGuard.name);

    constructor(
        @Inject(QZPAY_BILLING_TOKEN)
        private readonly billing: QZPayBilling,
        private readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const config = this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, context.getHandler());

        // If no rate limit configured, allow access
        if (!config) {
            return true;
        }

        const request = context.switchToHttp().getRequest<RequestWithCustomer>();
        const response = context.switchToHttp().getResponse();
        const customerId = request.customer?.id ?? request.user?.customerId;

        if (!customerId) {
            throw new ForbiddenException('Customer context required for rate limiting');
        }

        // Check if the limit is reached
        const limitCheck = await this.billing.limits.check(customerId, config.limitKey);

        // Add rate limit headers
        response.setHeader('X-RateLimit-Limit', limitCheck.maxValue.toString());
        response.setHeader('X-RateLimit-Remaining', Math.max(0, limitCheck.remaining).toString());
        response.setHeader('X-RateLimit-Current', limitCheck.currentValue.toString());

        if (!limitCheck.allowed) {
            this.logger.warn(`Rate limit exceeded for customer ${customerId} on limit ${config.limitKey}`);
            throw new ForbiddenException(`Rate limit exceeded: ${config.limitKey}`);
        }

        // Increment the limit
        try {
            await this.billing.limits.increment(customerId, config.limitKey, config.increment ?? 1);
        } catch (error) {
            this.logger.error(`Failed to increment limit ${config.limitKey}: ${(error as Error).message}`);
            // Still allow the request if increment fails
        }

        return true;
    }
}
