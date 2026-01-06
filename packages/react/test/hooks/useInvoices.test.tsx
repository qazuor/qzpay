/**
 * useInvoices Hook Tests
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInvoices } from '../../src/hooks/useInvoices.js';
import { createMockBilling, createMockInvoice, createWrapper } from '../helpers/react-mocks.js';

describe('useInvoices', () => {
    describe('fetching', () => {
        it('should fetch invoices on mount', async () => {
            const mockBilling = createMockBilling();
            const mockInvoices = [createMockInvoice()];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(mockInvoices);

            const { result } = renderHook(() => useInvoices({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockInvoices);
            expect(mockBilling.invoices.getByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should set data to null when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useInvoices({}), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeNull();
            expect(mockBilling.invoices.getByCustomerId).not.toHaveBeenCalled();
        });

        it('should handle fetch error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.getByCustomerId).mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => useInvoices({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.error).toBeDefined();
            });

            expect(result.current.error?.message).toBe('Fetch failed');
        });
    });

    describe('getInvoice', () => {
        it('should get invoice by id', async () => {
            const mockBilling = createMockBilling();
            const mockInvoices = [createMockInvoice()];
            const specificInvoice = createMockInvoice({ id: 'inv_456', amount: 5999 });
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(mockInvoices);
            vi.mocked(mockBilling.invoices.get).mockResolvedValue(specificInvoice);

            const { result } = renderHook(() => useInvoices({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const invoice = await result.current.getInvoice('inv_456');
            expect(invoice?.amount).toBe(5999);
        });

        it('should return null when invoice not found', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.invoices.get).mockRejectedValue(new Error('Not found'));

            const { result } = renderHook(() => useInvoices({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const invoice = await result.current.getInvoice('inv_unknown');
            expect(invoice).toBeNull();
        });
    });

    describe('refetch', () => {
        it('should refetch invoices', async () => {
            const mockBilling = createMockBilling();
            const mockInvoices = [createMockInvoice()];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(mockInvoices);

            const { result } = renderHook(() => useInvoices({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const newInvoices = [createMockInvoice({ id: 'inv_new', amount: 9999 })];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(newInvoices);

            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.data?.[0]?.id).toBe('inv_new');
            });
        });
    });
});
