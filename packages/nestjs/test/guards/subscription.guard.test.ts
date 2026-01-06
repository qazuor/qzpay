/**
 * Subscription Guard Tests
 */
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_SUBSCRIPTION_KEY } from '../../src/constants.js';
import { SubscriptionGuard } from '../../src/guards/subscription.guard.js';
import { createMockBilling, createMockExecutionContext, createMockReflector, createMockSubscription } from '../helpers/nestjs-mocks.js';

describe('SubscriptionGuard', () => {
    describe('canActivate', () => {
        it('should allow access when no subscription required', async () => {
            const mockBilling = createMockBilling();
            const mockReflector = createMockReflector({});
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });

        it('should allow access when customer has active subscription', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([createMockSubscription({ status: 'active' })]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: {}
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });

        it('should deny access when no active subscription', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([createMockSubscription({ status: 'canceled' })]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: {}
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(ForbiddenException);
            await expect(guard.canActivate(mockContext as never)).rejects.toThrow('Active subscription required');
        });

        it('should allow access for trialing subscription when allowed', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([createMockSubscription({ status: 'trialing' })]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: { statuses: ['active', 'trialing'] }
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });

        it('should deny access for trialing subscription when not allowed', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([createMockSubscription({ status: 'trialing' })]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: { statuses: ['active'] }
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(ForbiddenException);
        });

        it('should allow access when subscription matches plan ID', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                createMockSubscription({ status: 'active', planId: 'plan_premium' })
            ]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: { planIds: ['plan_premium', 'plan_enterprise'] }
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });

        it('should deny access when subscription does not match plan ID', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                createMockSubscription({ status: 'active', planId: 'plan_basic' })
            ]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: { planIds: ['plan_premium', 'plan_enterprise'] }
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(
                'Active subscription required for plans: plan_premium, plan_enterprise'
            );
        });

        it('should throw when no customer context', async () => {
            const mockBilling = createMockBilling();
            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: {}
            });
            const mockContext = createMockExecutionContext({
                customer: undefined,
                user: undefined
            });

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(ForbiddenException);
            await expect(guard.canActivate(mockContext as never)).rejects.toThrow('Customer context required');
        });

        it('should attach subscription to request', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription({ status: 'active' });
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([mockSubscription]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: {}
            });

            const request: Record<string, unknown> = {
                customer: { id: 'cus_123' },
                user: { customerId: 'cus_123' }
            };
            const mockContext = {
                switchToHttp: () => ({
                    getRequest: () => request
                }),
                getHandler: () => () => {}
            };

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);
            await guard.canActivate(mockContext as never);

            expect(request.subscription).toEqual(mockSubscription);
        });

        it('should handle multiple subscriptions and find valid one', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([
                createMockSubscription({ id: 'sub_1', status: 'canceled' }),
                createMockSubscription({ id: 'sub_2', status: 'active' })
            ]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: {}
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });

        it('should allow past_due subscription when allowed in statuses', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([createMockSubscription({ status: 'past_due' })]);

            const mockReflector = createMockReflector({
                [REQUIRED_SUBSCRIPTION_KEY]: { statuses: ['active', 'past_due'] }
            });
            const mockContext = createMockExecutionContext();

            const guard = new SubscriptionGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });
    });
});
