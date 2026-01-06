/**
 * useSubscription Hook Tests
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSubscription } from '../../src/hooks/useSubscription.js';
import { createMockBilling, createMockSubscription, createWrapper } from '../helpers/react-mocks.js';

describe('useSubscription', () => {
    describe('fetching by subscriptionId', () => {
        it('should fetch subscription on mount', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(mockSubscription);

            const { result } = renderHook(() => useSubscription({ subscriptionId: 'sub_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockSubscription);
        });
    });

    describe('fetching by customerId', () => {
        it('should fetch subscriptions by customerId', async () => {
            const mockBilling = createMockBilling();
            const mockSubscriptions = [createMockSubscription(), createMockSubscription({ id: 'sub_456' })];
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue(mockSubscriptions);

            const { result } = renderHook(() => useSubscription({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toHaveLength(2);
        });
    });

    describe('create', () => {
        it('should create subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.subscriptions.create).mockResolvedValue(mockSubscription);

            const { result } = renderHook(() => useSubscription({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let created: ReturnType<typeof createMockSubscription> | undefined;
            await waitFor(async () => {
                created = await result.current.create({
                    customerId: 'cus_123',
                    planId: 'plan_123'
                });
            });

            expect(created).toEqual(mockSubscription);
        });
    });

    describe('cancel', () => {
        it('should cancel subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            const canceledSubscription = createMockSubscription({ status: 'canceled' });
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.subscriptions.cancel).mockResolvedValue(canceledSubscription);

            const { result } = renderHook(() => useSubscription({ subscriptionId: 'sub_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let canceled: ReturnType<typeof createMockSubscription> | undefined;
            await waitFor(async () => {
                canceled = await result.current.cancel('sub_123');
            });

            expect(canceled?.status).toBe('canceled');
        });

        it('should cancel with cancelAtPeriodEnd option', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            const canceledSubscription = createMockSubscription({ cancelAtPeriodEnd: true });
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.subscriptions.cancel).mockResolvedValue(canceledSubscription);

            const { result } = renderHook(() => useSubscription({ subscriptionId: 'sub_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await waitFor(async () => {
                await result.current.cancel('sub_123', { cancelAtPeriodEnd: true });
            });

            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith('sub_123', { cancelAtPeriodEnd: true });
        });
    });

    describe('pause', () => {
        it('should pause subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            const pausedSubscription = createMockSubscription({ status: 'paused' });
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.subscriptions.pause).mockResolvedValue(pausedSubscription);

            const { result } = renderHook(() => useSubscription({ subscriptionId: 'sub_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let paused: ReturnType<typeof createMockSubscription> | undefined;
            await waitFor(async () => {
                paused = await result.current.pause('sub_123');
            });

            expect(paused?.status).toBe('paused');
        });
    });

    describe('resume', () => {
        it('should resume subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription({ status: 'paused' });
            const resumedSubscription = createMockSubscription({ status: 'active' });
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(mockSubscription);
            vi.mocked(mockBilling.subscriptions.resume).mockResolvedValue(resumedSubscription);

            const { result } = renderHook(() => useSubscription({ subscriptionId: 'sub_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let resumed: ReturnType<typeof createMockSubscription> | undefined;
            await waitFor(async () => {
                resumed = await result.current.resume('sub_123');
            });

            expect(resumed?.status).toBe('active');
        });
    });

    describe('error handling', () => {
        it('should handle fetch error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.get).mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => useSubscription({ subscriptionId: 'sub_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.error).toBeDefined();
            });

            expect(result.current.error?.message).toBe('Fetch failed');
        });

        it('should handle create error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.subscriptions.create).mockRejectedValue(new Error('Create failed'));

            const { result } = renderHook(() => useSubscription({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await expect(result.current.create({ customerId: 'cus_123', planId: 'plan_123' })).rejects.toThrow('Create failed');
        });
    });

    describe('no options', () => {
        it('should set data to null when no options provided', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useSubscription(), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeNull();
        });
    });
});
