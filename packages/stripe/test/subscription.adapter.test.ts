/**
 * Stripe Subscription Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeSubscriptionAdapter } from '../src/adapters/subscription.adapter.js';
import { createMockStripeClient, createMockStripeSubscription } from './helpers/stripe-mocks.js';

describe('QZPayStripeSubscriptionAdapter', () => {
    let adapter: QZPayStripeSubscriptionAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripeSubscriptionAdapter(mockStripe);
        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should create a subscription', async () => {
            const mockSub = createMockStripeSubscription({ id: 'sub_new123' });
            vi.mocked(mockStripe.subscriptions.create).mockResolvedValue(mockSub);

            const result = await adapter.create('cus_123', { planId: 'plan_123' }, 'price_123');

            expect(result.id).toBe('sub_new123');
            expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
                customer: 'cus_123',
                items: [{ price: 'price_123', quantity: 1 }],
                metadata: {}
            });
        });

        it('should create a subscription with quantity', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.create).mockResolvedValue(mockSub);

            await adapter.create('cus_123', { planId: 'plan_123', quantity: 5 }, 'price_123');

            expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    items: [{ price: 'price_123', quantity: 5 }]
                })
            );
        });

        it('should create a subscription with trial days', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.create).mockResolvedValue(mockSub);

            await adapter.create('cus_123', { planId: 'plan_123', trialDays: 14 }, 'price_123');

            expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    trial_period_days: 14
                })
            );
        });

        it('should skip trial when trialDays is 0', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.create).mockResolvedValue(mockSub);

            await adapter.create('cus_123', { planId: 'plan_123', trialDays: 0 }, 'price_123');

            expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    trial_period_days: expect.anything()
                })
            );
        });

        it('should create a subscription with metadata', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.create).mockResolvedValue(mockSub);

            await adapter.create('cus_123', { planId: 'plan_123', metadata: { source: 'web' } }, 'price_123');

            expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { source: 'web' }
                })
            );
        });

        it('should map subscription response correctly', async () => {
            const now = Math.floor(Date.now() / 1000);
            const mockSub = createMockStripeSubscription({
                id: 'sub_123',
                status: 'trialing',
                current_period_start: now,
                current_period_end: now + 2592000,
                cancel_at_period_end: true,
                canceled_at: now - 86400,
                trial_start: now - 604800,
                trial_end: now + 604800,
                metadata: { key: 'value' }
            });
            vi.mocked(mockStripe.subscriptions.create).mockResolvedValue(mockSub);

            const result = await adapter.create('cus_123', { planId: 'plan_123' }, 'price_123');

            expect(result).toEqual({
                id: 'sub_123',
                status: 'trialing',
                currentPeriodStart: new Date(now * 1000),
                currentPeriodEnd: new Date((now + 2592000) * 1000),
                cancelAtPeriodEnd: true,
                canceledAt: new Date((now - 86400) * 1000),
                trialStart: new Date((now - 604800) * 1000),
                trialEnd: new Date((now + 604800) * 1000),
                metadata: { key: 'value' }
            });
        });
    });

    describe('update', () => {
        it('should update subscription metadata', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockSub);

            await adapter.update('sub_123', { metadata: { updated: 'true' } });

            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
                metadata: { updated: 'true' }
            });
        });

        it('should update proration behavior', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockSub);

            await adapter.update('sub_123', { prorationBehavior: 'create_prorations' });

            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
                proration_behavior: 'create_prorations'
            });
        });

        it('should update cancel at date', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockSub);
            const cancelAt = new Date('2025-12-31');

            await adapter.update('sub_123', { cancelAt });

            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
                cancel_at: Math.floor(cancelAt.getTime() / 1000)
            });
        });

        it('should update plan with quantity', async () => {
            const mockSub = createMockStripeSubscription({
                items: {
                    object: 'list',
                    data: [{ id: 'si_123', price: { id: 'price_old' }, quantity: 1 }]
                }
            } as never);
            vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue(mockSub);
            vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockSub);

            await adapter.update('sub_123', { planId: 'price_new', quantity: 3 });

            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
                items: [{ id: 'si_123', price: 'price_new', quantity: 3 }]
            });
        });
    });

    describe('cancel', () => {
        it('should cancel at period end', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockSub);

            await adapter.cancel('sub_123', true);

            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
                cancel_at_period_end: true
            });
        });

        it('should cancel immediately', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.cancel).mockResolvedValue(mockSub);

            await adapter.cancel('sub_123', false);

            expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
        });
    });

    describe('pause', () => {
        it('should pause a subscription', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockSub);

            await adapter.pause('sub_123');

            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
                pause_collection: { behavior: 'void' }
            });
        });
    });

    describe('resume', () => {
        it('should resume a paused subscription', async () => {
            const mockSub = createMockStripeSubscription();
            vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockSub);

            await adapter.resume('sub_123');

            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
                pause_collection: ''
            });
        });
    });

    describe('retrieve', () => {
        it('should retrieve a subscription', async () => {
            const mockSub = createMockStripeSubscription({ id: 'sub_123', status: 'active' });
            vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue(mockSub);

            const result = await adapter.retrieve('sub_123');

            expect(result.id).toBe('sub_123');
            expect(result.status).toBe('active');
        });
    });
});
