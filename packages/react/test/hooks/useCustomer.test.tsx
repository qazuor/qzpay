/**
 * useCustomer Hook Tests
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCustomer } from '../../src/hooks/useCustomer.js';
import { createMockBilling, createMockCustomer, createWrapper } from '../helpers/react-mocks.js';

describe('useCustomer', () => {
    describe('fetching', () => {
        it('should fetch customer on mount', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(mockCustomer);

            const { result } = renderHook(() => useCustomer('cus_123'), {
                wrapper: createWrapper(mockBilling)
            });

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockCustomer);
            expect(mockBilling.customers.get).toHaveBeenCalledWith('cus_123');
        });

        it('should set data to null when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useCustomer(undefined), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeNull();
            expect(mockBilling.customers.get).not.toHaveBeenCalled();
        });

        it('should handle fetch error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.get).mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => useCustomer('cus_123'), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBeDefined();
            expect(result.current.error?.message).toBe('Fetch failed');
        });

        it('should handle non-Error throw', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.get).mockRejectedValue('String error');

            const { result } = renderHook(() => useCustomer('cus_123'), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.error).toBeDefined();
            });

            expect(result.current.error?.message).toBe('Failed to fetch customer');
        });
    });

    describe('refetch', () => {
        it('should refetch customer when called', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(mockCustomer);

            const { result } = renderHook(() => useCustomer('cus_123'), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const updatedCustomer = createMockCustomer({ name: 'Updated Name' });
            vi.mocked(mockBilling.customers.get).mockResolvedValue(updatedCustomer);

            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.data?.name).toBe('Updated Name');
            });
        });
    });

    describe('update', () => {
        it('should update customer', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(mockCustomer);

            const updatedCustomer = createMockCustomer({ name: 'Updated Name' });
            vi.mocked(mockBilling.customers.update).mockResolvedValue(updatedCustomer);

            const { result } = renderHook(() => useCustomer('cus_123'), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const returnedCustomer = await result.current.update({ name: 'Updated Name' });

            expect(returnedCustomer?.name).toBe('Updated Name');

            await waitFor(() => {
                expect(result.current.data?.name).toBe('Updated Name');
            });
        });

        it('should throw error when customerId is not provided', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useCustomer(undefined), {
                wrapper: createWrapper(mockBilling)
            });

            await expect(result.current.update({ name: 'New Name' })).rejects.toThrow('Customer ID is required to update');
        });

        it('should handle update error', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(mockCustomer);
            vi.mocked(mockBilling.customers.update).mockRejectedValue(new Error('Update failed'));

            const { result } = renderHook(() => useCustomer('cus_123'), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await expect(result.current.update({ name: 'New Name' })).rejects.toThrow('Update failed');

            await waitFor(() => {
                expect(result.current.error?.message).toBe('Update failed');
            });
        });
    });
});
