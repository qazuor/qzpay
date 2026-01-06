/**
 * Plans Controller Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayPlansController } from '../../src/controllers/plans.controller.js';
import type { QZPayService } from '../../src/qzpay.service.js';
import { createMockBilling, createMockPlan } from '../helpers/nestjs-mocks.js';

describe('QZPayPlansController', () => {
    let controller: QZPayPlansController;
    let mockQZPayService: QZPayService;
    let mockBilling: ReturnType<typeof createMockBilling>;

    beforeEach(() => {
        mockBilling = createMockBilling();
        mockQZPayService = {
            getBilling: vi.fn().mockReturnValue(mockBilling),
            getPlans: vi.fn(),
            getPlan: vi.fn()
        } as unknown as QZPayService;

        controller = new QZPayPlansController(mockQZPayService);
    });

    describe('findAll', () => {
        it('should get all plans', () => {
            const mockPlans = [
                createMockPlan({ id: 'plan_1', name: 'Basic', active: true }),
                createMockPlan({ id: 'plan_2', name: 'Pro', active: true }),
                createMockPlan({ id: 'plan_3', name: 'Enterprise', active: false })
            ];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            const result = controller.findAll();

            expect(result).toEqual(mockPlans);
            expect(result).toHaveLength(3);
            expect(mockQZPayService.getPlans).toHaveBeenCalledWith();
        });

        it('should filter active plans when active=true', () => {
            const mockPlans = [
                createMockPlan({ id: 'plan_1', name: 'Basic', active: true }),
                createMockPlan({ id: 'plan_2', name: 'Pro', active: true }),
                createMockPlan({ id: 'plan_3', name: 'Archived', active: false })
            ];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            const result = controller.findAll('true');

            expect(result).toHaveLength(2);
            expect(result.every((p) => p.active)).toBe(true);
            expect(result.find((p) => p.id === 'plan_3')).toBeUndefined();
        });

        it('should not filter when active is not "true"', () => {
            const mockPlans = [createMockPlan({ id: 'plan_1', active: true }), createMockPlan({ id: 'plan_2', active: false })];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            const result = controller.findAll('false');

            expect(result).toHaveLength(2);
        });

        it('should return all plans when active is undefined', () => {
            const mockPlans = [createMockPlan({ id: 'plan_1', active: true }), createMockPlan({ id: 'plan_2', active: false })];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            const result = controller.findAll();

            expect(result).toHaveLength(2);
        });

        it('should return empty array when no plans exist', () => {
            vi.mocked(mockQZPayService.getPlans).mockReturnValue([]);

            const result = controller.findAll();

            expect(result).toEqual([]);
        });

        it('should return empty array when no active plans exist', () => {
            const mockPlans = [createMockPlan({ id: 'plan_1', active: false }), createMockPlan({ id: 'plan_2', active: false })];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            const result = controller.findAll('true');

            expect(result).toEqual([]);
        });

        it('should handle plans with different properties', () => {
            const mockPlans = [
                createMockPlan({
                    id: 'plan_1',
                    name: 'Starter',
                    description: 'For individuals',
                    active: true,
                    metadata: { tier: 'basic' }
                }),
                createMockPlan({
                    id: 'plan_2',
                    name: 'Business',
                    description: 'For teams',
                    active: true,
                    metadata: { tier: 'professional' }
                })
            ];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            const result = controller.findAll();

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Starter');
            expect(result[1].name).toBe('Business');
        });

        it('should preserve plan order', () => {
            const mockPlans = [
                createMockPlan({ id: 'plan_3', name: 'Enterprise' }),
                createMockPlan({ id: 'plan_1', name: 'Basic' }),
                createMockPlan({ id: 'plan_2', name: 'Pro' })
            ];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            const result = controller.findAll();

            expect(result[0].id).toBe('plan_3');
            expect(result[1].id).toBe('plan_1');
            expect(result[2].id).toBe('plan_2');
        });

        it('should handle case-sensitive active parameter', () => {
            const mockPlans = [createMockPlan({ id: 'plan_1', active: true }), createMockPlan({ id: 'plan_2', active: false })];

            vi.mocked(mockQZPayService.getPlans).mockReturnValue(mockPlans);

            // Case variations
            expect(controller.findAll('True')).toHaveLength(2); // Not "true"
            expect(controller.findAll('TRUE')).toHaveLength(2); // Not "true"
            expect(controller.findAll('true')).toHaveLength(1); // Exact match
        });
    });

    describe('findOne', () => {
        it('should get a plan by ID', () => {
            const mockPlan = createMockPlan({
                id: 'plan_123',
                name: 'Premium Plan',
                description: 'Premium features'
            });

            vi.mocked(mockQZPayService.getPlan).mockReturnValue(mockPlan);

            const result = controller.findOne('plan_123');

            expect(result).toEqual(mockPlan);
            expect(mockQZPayService.getPlan).toHaveBeenCalledWith('plan_123');
        });

        it('should handle plan not found', () => {
            vi.mocked(mockQZPayService.getPlan).mockReturnValue(null);

            const result = controller.findOne('plan_nonexistent');

            expect(result).toBeNull();
            expect(mockQZPayService.getPlan).toHaveBeenCalledWith('plan_nonexistent');
        });

        it('should get inactive plan', () => {
            const mockPlan = createMockPlan({
                id: 'plan_archived',
                name: 'Archived Plan',
                active: false
            });

            vi.mocked(mockQZPayService.getPlan).mockReturnValue(mockPlan);

            const result = controller.findOne('plan_archived');

            expect(result).toEqual(mockPlan);
            expect(result?.active).toBe(false);
        });

        it('should get plan with all properties', () => {
            const mockPlan = createMockPlan({
                id: 'plan_123',
                name: 'Complete Plan',
                description: 'Full featured plan',
                prices: [{ id: 'price_1', amount: 2999, currency: 'usd', interval: 'month' }],
                features: [
                    { id: 'feat_1', key: 'api_access', name: 'API Access' },
                    { id: 'feat_2', key: 'storage', name: '100GB Storage' }
                ],
                metadata: { category: 'premium', featured: true },
                active: true
            });

            vi.mocked(mockQZPayService.getPlan).mockReturnValue(mockPlan);

            const result = controller.findOne('plan_123');

            expect(result).toEqual(mockPlan);
            expect(result?.prices).toHaveLength(1);
            expect(result?.features).toHaveLength(2);
            expect(result?.metadata).toEqual({ category: 'premium', featured: true });
        });

        it('should handle empty plan ID', () => {
            vi.mocked(mockQZPayService.getPlan).mockReturnValue(null);

            const result = controller.findOne('');

            expect(result).toBeNull();
            expect(mockQZPayService.getPlan).toHaveBeenCalledWith('');
        });

        it('should handle special characters in plan ID', () => {
            const planId = 'plan_test-123_v2';
            const mockPlan = createMockPlan({ id: planId });

            vi.mocked(mockQZPayService.getPlan).mockReturnValue(mockPlan);

            const result = controller.findOne(planId);

            expect(result).toEqual(mockPlan);
            expect(mockQZPayService.getPlan).toHaveBeenCalledWith(planId);
        });

        it('should return plan without prices', () => {
            const mockPlan = createMockPlan({
                id: 'plan_123',
                name: 'No Prices Plan',
                prices: []
            });

            vi.mocked(mockQZPayService.getPlan).mockReturnValue(mockPlan);

            const result = controller.findOne('plan_123');

            expect(result).toEqual(mockPlan);
            expect(result?.prices).toEqual([]);
        });

        it('should return plan without features', () => {
            const mockPlan = createMockPlan({
                id: 'plan_123',
                name: 'No Features Plan',
                features: []
            });

            vi.mocked(mockQZPayService.getPlan).mockReturnValue(mockPlan);

            const result = controller.findOne('plan_123');

            expect(result).toEqual(mockPlan);
            expect(result?.features).toEqual([]);
        });

        it('should return plan without metadata', () => {
            const mockPlan = createMockPlan({
                id: 'plan_123',
                name: 'No Metadata Plan',
                metadata: {}
            });

            vi.mocked(mockQZPayService.getPlan).mockReturnValue(mockPlan);

            const result = controller.findOne('plan_123');

            expect(result).toEqual(mockPlan);
            expect(result?.metadata).toEqual({});
        });
    });
});
