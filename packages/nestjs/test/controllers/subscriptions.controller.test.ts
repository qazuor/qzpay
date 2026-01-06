/**
 * Subscriptions Controller Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPaySubscriptionsController } from '../../src/controllers/subscriptions.controller.js';
import type { QZPayService } from '../../src/qzpay.service.js';
import { createMockBilling, createMockSubscription } from '../helpers/nestjs-mocks.js';

describe('QZPaySubscriptionsController', () => {
    let controller: QZPaySubscriptionsController;
    let mockQZPayService: QZPayService;
    let mockBilling: ReturnType<typeof createMockBilling>;

    beforeEach(() => {
        mockBilling = createMockBilling();
        mockQZPayService = {
            getBilling: vi.fn().mockReturnValue(mockBilling),
            createSubscription: vi.fn(),
            getSubscription: vi.fn(),
            updateSubscription: vi.fn(),
            cancelSubscription: vi.fn(),
            pauseSubscription: vi.fn(),
            resumeSubscription: vi.fn()
        } as unknown as QZPayService;

        controller = new QZPaySubscriptionsController(mockQZPayService);
    });

    describe('create', () => {
        it('should create a subscription with all fields', async () => {
            const mockSubscription = createMockSubscription({
                customerId: 'cus_123',
                planId: 'plan_123',
                priceId: 'price_123',
                quantity: 2,
                metadata: { source: 'api' }
            });

            vi.mocked(mockQZPayService.createSubscription).mockResolvedValue(mockSubscription);

            const dto = {
                customerId: 'cus_123',
                planId: 'plan_123',
                priceId: 'price_123',
                quantity: 2,
                trialDays: 7,
                promoCodeId: 'promo_123',
                metadata: { source: 'api' }
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.createSubscription).toHaveBeenCalledWith({
                customerId: 'cus_123',
                planId: 'plan_123',
                priceId: 'price_123',
                quantity: 2,
                trialDays: 7,
                promoCodeId: 'promo_123',
                metadata: { source: 'api' }
            });
        });

        it('should create a subscription with required fields only', async () => {
            const mockSubscription = createMockSubscription({
                customerId: 'cus_123',
                planId: 'plan_123'
            });

            vi.mocked(mockQZPayService.createSubscription).mockResolvedValue(mockSubscription);

            const dto = {
                customerId: 'cus_123',
                planId: 'plan_123'
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.createSubscription).toHaveBeenCalledWith({
                customerId: 'cus_123',
                planId: 'plan_123'
            });
        });

        it('should handle quantity = 0', async () => {
            const mockSubscription = createMockSubscription({ quantity: 0 });
            vi.mocked(mockQZPayService.createSubscription).mockResolvedValue(mockSubscription);

            const dto = {
                customerId: 'cus_123',
                planId: 'plan_123',
                quantity: 0
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.createSubscription).toHaveBeenCalledWith({
                customerId: 'cus_123',
                planId: 'plan_123',
                quantity: 0
            });
        });

        it('should handle trial days', async () => {
            const mockSubscription = createMockSubscription({
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            });
            vi.mocked(mockQZPayService.createSubscription).mockResolvedValue(mockSubscription);

            const dto = {
                customerId: 'cus_123',
                planId: 'plan_123',
                trialDays: 14
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.createSubscription).toHaveBeenCalledWith({
                customerId: 'cus_123',
                planId: 'plan_123',
                trialDays: 14
            });
        });

        it('should handle promo codes', async () => {
            const mockSubscription = createMockSubscription({
                promoCodeId: 'promo_123'
            });
            vi.mocked(mockQZPayService.createSubscription).mockResolvedValue(mockSubscription);

            const dto = {
                customerId: 'cus_123',
                planId: 'plan_123',
                promoCodeId: 'promo_123'
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.createSubscription).toHaveBeenCalledWith({
                customerId: 'cus_123',
                planId: 'plan_123',
                promoCodeId: 'promo_123'
            });
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.createSubscription).mockRejectedValue(new Error('Subscription creation failed'));

            const dto = {
                customerId: 'cus_123',
                planId: 'plan_123'
            };

            await expect(controller.create(dto)).rejects.toThrow('Subscription creation failed');
        });

        it('should handle invalid customer ID', async () => {
            vi.mocked(mockQZPayService.createSubscription).mockRejectedValue(new Error('Customer not found'));

            const dto = {
                customerId: 'cus_invalid',
                planId: 'plan_123'
            };

            await expect(controller.create(dto)).rejects.toThrow('Customer not found');
        });

        it('should handle invalid plan ID', async () => {
            vi.mocked(mockQZPayService.createSubscription).mockRejectedValue(new Error('Plan not found'));

            const dto = {
                customerId: 'cus_123',
                planId: 'plan_invalid'
            };

            await expect(controller.create(dto)).rejects.toThrow('Plan not found');
        });
    });

    describe('findOne', () => {
        it('should get a subscription by ID', async () => {
            const mockSubscription = createMockSubscription();
            vi.mocked(mockQZPayService.getSubscription).mockResolvedValue(mockSubscription);

            const result = await controller.findOne('sub_123');

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.getSubscription).toHaveBeenCalledWith('sub_123');
        });

        it('should handle subscription not found', async () => {
            vi.mocked(mockQZPayService.getSubscription).mockResolvedValue(null);

            const result = await controller.findOne('sub_nonexistent');

            expect(result).toBeNull();
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getSubscription).mockRejectedValue(new Error('Database error'));

            await expect(controller.findOne('sub_123')).rejects.toThrow('Database error');
        });
    });

    describe('update', () => {
        it('should update subscription with all fields', async () => {
            const updatedSubscription = createMockSubscription({
                planId: 'plan_456',
                priceId: 'price_456',
                quantity: 5,
                metadata: { updated: true }
            });
            vi.mocked(mockQZPayService.updateSubscription).mockResolvedValue(updatedSubscription);

            const dto = {
                planId: 'plan_456',
                priceId: 'price_456',
                quantity: 5,
                metadata: { updated: true }
            };

            const result = await controller.update('sub_123', dto);

            expect(result).toEqual(updatedSubscription);
            expect(mockQZPayService.updateSubscription).toHaveBeenCalledWith('sub_123', dto);
        });

        it('should update subscription with partial fields', async () => {
            const updatedSubscription = createMockSubscription({ quantity: 3 });
            vi.mocked(mockQZPayService.updateSubscription).mockResolvedValue(updatedSubscription);

            const dto = { quantity: 3 };

            const result = await controller.update('sub_123', dto);

            expect(result).toEqual(updatedSubscription);
            expect(mockQZPayService.updateSubscription).toHaveBeenCalledWith('sub_123', dto);
        });

        it('should handle plan upgrade', async () => {
            const upgradedSubscription = createMockSubscription({
                planId: 'plan_premium'
            });
            vi.mocked(mockQZPayService.updateSubscription).mockResolvedValue(upgradedSubscription);

            const dto = { planId: 'plan_premium' };

            const result = await controller.update('sub_123', dto);

            expect(result).toEqual(upgradedSubscription);
            expect(mockQZPayService.updateSubscription).toHaveBeenCalledWith('sub_123', dto);
        });

        it('should handle plan downgrade', async () => {
            const downgradedSubscription = createMockSubscription({
                planId: 'plan_basic'
            });
            vi.mocked(mockQZPayService.updateSubscription).mockResolvedValue(downgradedSubscription);

            const dto = { planId: 'plan_basic' };

            const result = await controller.update('sub_123', dto);

            expect(result).toEqual(downgradedSubscription);
            expect(mockQZPayService.updateSubscription).toHaveBeenCalledWith('sub_123', dto);
        });

        it('should handle empty update', async () => {
            const mockSubscription = createMockSubscription();
            vi.mocked(mockQZPayService.updateSubscription).mockResolvedValue(mockSubscription);

            const result = await controller.update('sub_123', {});

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.updateSubscription).toHaveBeenCalledWith('sub_123', {});
        });

        it('should handle update errors', async () => {
            vi.mocked(mockQZPayService.updateSubscription).mockRejectedValue(new Error('Update failed'));

            await expect(controller.update('sub_123', { quantity: 2 })).rejects.toThrow('Update failed');
        });
    });

    describe('cancel', () => {
        it('should cancel subscription immediately', async () => {
            const cancelledSubscription = createMockSubscription({
                status: 'cancelled',
                cancelledAt: new Date()
            });
            vi.mocked(mockQZPayService.cancelSubscription).mockResolvedValue(cancelledSubscription);

            const dto = {
                cancelAtPeriodEnd: false,
                reason: 'Customer request'
            };

            const result = await controller.cancel('sub_123', dto);

            expect(result).toEqual(cancelledSubscription);
            expect(mockQZPayService.cancelSubscription).toHaveBeenCalledWith('sub_123', {
                cancelAtPeriodEnd: false,
                reason: 'Customer request'
            });
        });

        it('should cancel subscription at period end', async () => {
            const cancellingSubscription = createMockSubscription({
                status: 'active',
                cancelAtPeriodEnd: true
            });
            vi.mocked(mockQZPayService.cancelSubscription).mockResolvedValue(cancellingSubscription);

            const dto = {
                cancelAtPeriodEnd: true,
                reason: 'Switching plans'
            };

            const result = await controller.cancel('sub_123', dto);

            expect(result).toEqual(cancellingSubscription);
            expect(mockQZPayService.cancelSubscription).toHaveBeenCalledWith('sub_123', {
                cancelAtPeriodEnd: true,
                reason: 'Switching plans'
            });
        });

        it('should cancel subscription without reason', async () => {
            const cancelledSubscription = createMockSubscription({
                status: 'cancelled'
            });
            vi.mocked(mockQZPayService.cancelSubscription).mockResolvedValue(cancelledSubscription);

            const dto = {};

            const result = await controller.cancel('sub_123', dto);

            expect(result).toEqual(cancelledSubscription);
            expect(mockQZPayService.cancelSubscription).toHaveBeenCalledWith('sub_123', {});
        });

        it('should handle cancel errors', async () => {
            vi.mocked(mockQZPayService.cancelSubscription).mockRejectedValue(new Error('Cancel failed'));

            await expect(controller.cancel('sub_123', {})).rejects.toThrow('Cancel failed');
        });

        it('should handle already cancelled subscription', async () => {
            vi.mocked(mockQZPayService.cancelSubscription).mockRejectedValue(new Error('Subscription already cancelled'));

            await expect(controller.cancel('sub_123', {})).rejects.toThrow('Subscription already cancelled');
        });
    });

    describe('pause', () => {
        it('should pause a subscription', async () => {
            const pausedSubscription = createMockSubscription({
                status: 'paused',
                pausedAt: new Date()
            });
            vi.mocked(mockQZPayService.pauseSubscription).mockResolvedValue(pausedSubscription);

            const result = await controller.pause('sub_123');

            expect(result).toEqual(pausedSubscription);
            expect(mockQZPayService.pauseSubscription).toHaveBeenCalledWith('sub_123');
        });

        it('should handle pause errors', async () => {
            vi.mocked(mockQZPayService.pauseSubscription).mockRejectedValue(new Error('Pause failed'));

            await expect(controller.pause('sub_123')).rejects.toThrow('Pause failed');
        });

        it('should handle already paused subscription', async () => {
            vi.mocked(mockQZPayService.pauseSubscription).mockRejectedValue(new Error('Subscription already paused'));

            await expect(controller.pause('sub_123')).rejects.toThrow('Subscription already paused');
        });

        it('should handle cancelled subscription', async () => {
            vi.mocked(mockQZPayService.pauseSubscription).mockRejectedValue(new Error('Cannot pause cancelled subscription'));

            await expect(controller.pause('sub_123')).rejects.toThrow('Cannot pause cancelled subscription');
        });
    });

    describe('resume', () => {
        it('should resume a paused subscription', async () => {
            const resumedSubscription = createMockSubscription({
                status: 'active',
                resumedAt: new Date()
            });
            vi.mocked(mockQZPayService.resumeSubscription).mockResolvedValue(resumedSubscription);

            const result = await controller.resume('sub_123');

            expect(result).toEqual(resumedSubscription);
            expect(mockQZPayService.resumeSubscription).toHaveBeenCalledWith('sub_123');
        });

        it('should handle resume errors', async () => {
            vi.mocked(mockQZPayService.resumeSubscription).mockRejectedValue(new Error('Resume failed'));

            await expect(controller.resume('sub_123')).rejects.toThrow('Resume failed');
        });

        it('should handle already active subscription', async () => {
            vi.mocked(mockQZPayService.resumeSubscription).mockRejectedValue(new Error('Subscription is already active'));

            await expect(controller.resume('sub_123')).rejects.toThrow('Subscription is already active');
        });

        it('should handle cancelled subscription', async () => {
            vi.mocked(mockQZPayService.resumeSubscription).mockRejectedValue(new Error('Cannot resume cancelled subscription'));

            await expect(controller.resume('sub_123')).rejects.toThrow('Cannot resume cancelled subscription');
        });
    });
});
