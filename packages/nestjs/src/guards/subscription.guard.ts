/**
 * Subscription Guard
 * Protects routes based on subscription status
 */
import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { QZPayBilling, QZPaySubscription } from '@qazuor/qzpay-core';
import { QZPAY_BILLING_TOKEN, REQUIRED_SUBSCRIPTION_KEY } from '../constants.js';
import type { RequireSubscriptionOptions } from '../decorators/require-subscription.decorator.js';

/**
 * Request interface with customer context
 */
interface RequestWithCustomer {
    customer?: { id: string };
    user?: { customerId?: string };
    subscription?: QZPaySubscription;
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
    constructor(
        @Inject(QZPAY_BILLING_TOKEN)
        private readonly billing: QZPayBilling,
        private readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const config = this.reflector.get<RequireSubscriptionOptions>(REQUIRED_SUBSCRIPTION_KEY, context.getHandler());

        // If no subscription requirement, allow access
        if (!config) {
            return true;
        }

        const request = context.switchToHttp().getRequest<RequestWithCustomer>();
        const customerId = request.customer?.id ?? request.user?.customerId;

        if (!customerId) {
            throw new ForbiddenException('Customer context required');
        }

        const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);
        const allowedStatuses = config.statuses ?? ['active'];

        // Find a valid subscription
        const validSubscription = subscriptions.find((sub) => {
            // Check status
            if (!allowedStatuses.includes(sub.status as 'active' | 'trialing' | 'past_due')) {
                return false;
            }

            // Check plan IDs if specified
            if (config.planIds && config.planIds.length > 0) {
                return config.planIds.includes(sub.planId);
            }

            return true;
        });

        if (!validSubscription) {
            const message = config.planIds
                ? `Active subscription required for plans: ${config.planIds.join(', ')}`
                : 'Active subscription required';
            throw new ForbiddenException(message);
        }

        // Attach subscription to request for use in handlers
        request.subscription = validSubscription;

        return true;
    }
}
