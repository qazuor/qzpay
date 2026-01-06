/**
 * usePlans Hook Tests
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePlans } from '../../src/hooks/usePlans.js';
import { createMockBilling, createMockPlan, createWrapper } from '../helpers/react-mocks.js';

describe('usePlans', () => {
    describe('fetching', () => {
        it('should fetch active plans on mount', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);

            const { result } = renderHook(() => usePlans(), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockPlans);
            expect(mockBilling.plans.getActive).toHaveBeenCalled();
        });

        it('should fetch all plans when activeOnly is false', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan(), createMockPlan({ id: 'plan_456', active: false })];
            vi.mocked(mockBilling.getPlans).mockReturnValue(mockPlans);

            const { result } = renderHook(() => usePlans(false), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockPlans);
            expect(mockBilling.getPlans).toHaveBeenCalled();
        });

        it('should handle fetch error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.getActive).mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => usePlans(), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.error).toBeDefined();
            });

            expect(result.current.error?.message).toBe('Fetch failed');
        });
    });

    describe('getPlan', () => {
        it('should return plan by id', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan({ id: 'plan_1', name: 'Basic' }), createMockPlan({ id: 'plan_2', name: 'Premium' })];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);

            const { result } = renderHook(() => usePlans(), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const plan = result.current.getPlan('plan_2');
            expect(plan?.name).toBe('Premium');
        });

        it('should return undefined for unknown plan id', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);

            const { result } = renderHook(() => usePlans(), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const plan = result.current.getPlan('unknown_plan');
            expect(plan).toBeUndefined();
        });
    });

    describe('getPrices', () => {
        it('should fetch prices for a plan', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            const mockPrices = [
                { id: 'price_1', amount: 999, currency: 'usd', interval: 'month' },
                { id: 'price_2', amount: 9990, currency: 'usd', interval: 'year' }
            ];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue(mockPrices);

            const { result } = renderHook(() => usePlans(), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const prices = await result.current.getPrices('plan_123');
            expect(prices).toEqual(mockPrices);
            expect(mockBilling.plans.getPrices).toHaveBeenCalledWith('plan_123');
        });
    });

    describe('refetch', () => {
        it('should refetch plans', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);

            const { result } = renderHook(() => usePlans(), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const newPlans = [createMockPlan({ name: 'Updated Plan' })];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(newPlans);

            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.data?.[0]?.name).toBe('Updated Plan');
            });
        });
    });
});
