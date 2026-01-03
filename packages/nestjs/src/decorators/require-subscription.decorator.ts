/**
 * RequireSubscription Decorator
 * Marks a route as requiring an active subscription
 */
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { REQUIRED_SUBSCRIPTION_KEY } from '../constants.js';
import { SubscriptionGuard } from '../guards/subscription.guard.js';

export interface RequireSubscriptionOptions {
    /**
     * Allowed subscription statuses (default: ['active'])
     */
    statuses?: Array<'active' | 'trialing' | 'past_due'>;

    /**
     * Specific plan IDs to require (optional)
     */
    planIds?: string[];
}

/**
 * Decorator to require an active subscription for a route
 *
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * @Controller('dashboard')
 * export class DashboardController {
 *   @Get('/')
 *   @RequireSubscription()
 *   getDashboard() {
 *     return { data: 'protected' };
 *   }
 *
 *   @Get('/premium')
 *   @RequireSubscription({ planIds: ['pro', 'enterprise'] })
 *   getPremiumDashboard() {
 *     return { data: 'premium-only' };
 *   }
 * }
 * ```
 */
export function RequireSubscription(options: RequireSubscriptionOptions = {}) {
    const config = {
        statuses: options.statuses ?? ['active'],
        planIds: options.planIds
    };

    return applyDecorators(SetMetadata(REQUIRED_SUBSCRIPTION_KEY, config), UseGuards(SubscriptionGuard));
}
