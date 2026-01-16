/**
 * useLimits Hook Tests
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLimits } from '../../src/hooks/useLimits.js';
import { createMockBilling, createMockLimit, createWrapper } from '../helpers/react-mocks.js';

describe('useLimits', () => {
    describe('fetching', () => {
        it('should fetch limits on mount', async () => {
            const mockBilling = createMockBilling();
            const mockLimits = [createMockLimit()];
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(mockLimits);

            const { result } = renderHook(() => useLimits({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockLimits);
            expect(mockBilling.limits.getByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should set data to null when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useLimits({ customerId: '' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeNull();
        });

        it('should handle fetch error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.getByCustomerId).mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => useLimits({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.error).toBeDefined();
                expect(result.current.error?.message).toBe('Fetch failed');
            });
        });
    });

    describe('checkLimit', () => {
        it('should check limit and return result', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.limits.check).mockResolvedValue({
                allowed: true,
                currentValue: 50,
                maxValue: 100,
                remaining: 50
            });

            const { result } = renderHook(() => useLimits({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const checkResult = await result.current.checkLimit('api_calls');

            expect(checkResult.allowed).toBe(true);
            expect(checkResult.remaining).toBe(50);
            expect(mockBilling.limits.check).toHaveBeenCalledWith('cus_123', 'api_calls');
        });

        it('should return false when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useLimits({ customerId: '' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const checkResult = await result.current.checkLimit('api_calls');

            expect(checkResult.allowed).toBe(false);
            expect(checkResult.currentValue).toBe(0);
            expect(checkResult.maxValue).toBe(0);
            expect(checkResult.remaining).toBe(0);
        });
    });

    describe('increment', () => {
        it('should increment limit', async () => {
            const mockBilling = createMockBilling();
            const mockLimits = [createMockLimit()];
            const updatedLimit = createMockLimit({ currentValue: 51 });
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(mockLimits);
            vi.mocked(mockBilling.limits.increment).mockResolvedValue(updatedLimit);

            const { result } = renderHook(() => useLimits({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const limit = await result.current.increment('api_calls');

            expect(limit.currentValue).toBe(51);
            expect(mockBilling.limits.increment).toHaveBeenCalledWith('cus_123', 'api_calls', 1);
        });

        it('should increment by custom amount', async () => {
            const mockBilling = createMockBilling();
            const mockLimits = [createMockLimit()];
            const updatedLimit = createMockLimit({ currentValue: 55 });
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(mockLimits);
            vi.mocked(mockBilling.limits.increment).mockResolvedValue(updatedLimit);

            const { result } = renderHook(() => useLimits({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await result.current.increment('api_calls', 5);

            expect(mockBilling.limits.increment).toHaveBeenCalledWith('cus_123', 'api_calls', 5);
        });

        it('should throw when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useLimits({ customerId: '' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await expect(result.current.increment('api_calls')).rejects.toThrow('Customer ID is required to increment limit');
        });
    });

    describe('recordUsage', () => {
        it('should record usage', async () => {
            const mockBilling = createMockBilling();
            const mockLimits = [createMockLimit()];
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(mockLimits);
            vi.mocked(mockBilling.limits.recordUsage).mockResolvedValue(undefined);

            const { result } = renderHook(() => useLimits({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await result.current.recordUsage('api_calls', 10);

            expect(mockBilling.limits.recordUsage).toHaveBeenCalledWith('cus_123', 'api_calls', 10);
        });

        it('should throw when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useLimits({ customerId: '' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await expect(result.current.recordUsage('api_calls', 10)).rejects.toThrow('Customer ID is required to record usage');
        });
    });

    describe('refetch', () => {
        it('should refetch limits', async () => {
            const mockBilling = createMockBilling();
            const mockLimits = [createMockLimit()];
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(mockLimits);

            const { result } = renderHook(() => useLimits({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const newLimits = [createMockLimit({ currentValue: 75 })];
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(newLimits);

            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.data?.[0]?.currentValue).toBe(75);
            });
        });
    });
});
