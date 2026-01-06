/**
 * useEntitlements Hook Tests
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEntitlements } from '../../src/hooks/useEntitlements.js';
import { createMockBilling, createMockEntitlement, createWrapper } from '../helpers/react-mocks.js';

describe('useEntitlements', () => {
    describe('fetching', () => {
        it('should fetch entitlements on mount', async () => {
            const mockBilling = createMockBilling();
            const mockEntitlements = [createMockEntitlement()];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockEntitlements);
        });

        it('should set data to null when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useEntitlements({ customerId: '' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeNull();
        });

        it('should handle fetch error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.error).toBeDefined();
            });

            expect(result.current.error?.message).toBe('Fetch failed');
        });
    });

    describe('hasEntitlement', () => {
        it('should return true when customer has entitlement', async () => {
            const mockBilling = createMockBilling();
            const mockEntitlements = [
                createMockEntitlement({ entitlementKey: 'feature_api' }),
                createMockEntitlement({ entitlementKey: 'feature_premium' })
            ];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasEntitlement('feature_api')).toBe(true);
            expect(result.current.hasEntitlement('feature_premium')).toBe(true);
        });

        it('should return false when customer lacks entitlement', async () => {
            const mockBilling = createMockBilling();
            const mockEntitlements = [createMockEntitlement({ entitlementKey: 'feature_basic' })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasEntitlement('feature_premium')).toBe(false);
        });

        it('should exclude expired entitlements', async () => {
            const mockBilling = createMockBilling();
            const expiredDate = new Date(Date.now() - 1000).toISOString();
            const mockEntitlements = [createMockEntitlement({ entitlementKey: 'feature_expired', expiresAt: expiredDate })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasEntitlement('feature_expired')).toBe(false);
        });

        it('should include non-expired entitlements', async () => {
            const mockBilling = createMockBilling();
            const futureDate = new Date(Date.now() + 86400000).toISOString();
            const mockEntitlements = [createMockEntitlement({ entitlementKey: 'feature_active', expiresAt: futureDate })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasEntitlement('feature_active')).toBe(true);
        });

        it('should include entitlements with null expiresAt', async () => {
            const mockBilling = createMockBilling();
            const mockEntitlements = [createMockEntitlement({ entitlementKey: 'feature_permanent', expiresAt: null })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasEntitlement('feature_permanent')).toBe(true);
        });
    });

    describe('checkEntitlement', () => {
        it('should check entitlement from server', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.entitlements.check).mockResolvedValue(true);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const hasEntitlement = await result.current.checkEntitlement('feature_api');

            expect(hasEntitlement).toBe(true);
            expect(mockBilling.entitlements.check).toHaveBeenCalledWith('cus_123', 'feature_api');
        });

        it('should return false when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useEntitlements({ customerId: '' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const hasEntitlement = await result.current.checkEntitlement('feature_api');

            expect(hasEntitlement).toBe(false);
        });
    });

    describe('refetch', () => {
        it('should refetch entitlements', async () => {
            const mockBilling = createMockBilling();
            const mockEntitlements = [createMockEntitlement()];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const { result } = renderHook(() => useEntitlements({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const newEntitlements = [createMockEntitlement({ entitlementKey: 'new_feature' })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(newEntitlements);

            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.hasEntitlement('new_feature')).toBe(true);
            });
        });
    });
});
