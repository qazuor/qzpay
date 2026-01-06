/**
 * usePayment Hook Tests
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePayment } from '../../src/hooks/usePayment.js';
import { createMockBilling, createMockPayment, createWrapper } from '../helpers/react-mocks.js';

describe('usePayment', () => {
    describe('fetching', () => {
        it('should fetch payments on mount', async () => {
            const mockBilling = createMockBilling();
            const mockPayments = [createMockPayment()];
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(mockPayments);

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toEqual(mockPayments);
            expect(mockBilling.payments.getByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should set data to null when no customerId', async () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => usePayment({}), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data).toBeNull();
            expect(mockBilling.payments.getByCustomerId).not.toHaveBeenCalled();
        });

        it('should handle fetch error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.getByCustomerId).mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.error).toBeDefined();
            });

            expect(result.current.error?.message).toBe('Fetch failed');
        });
    });

    describe('process', () => {
        it('should process payment', async () => {
            const mockBilling = createMockBilling();
            const mockPayments = [createMockPayment()];
            const newPayment = createMockPayment({ id: 'pay_new', amount: 4999 });
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(mockPayments);
            vi.mocked(mockBilling.payments.process).mockResolvedValue(newPayment);

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const payment = await result.current.process({
                customerId: 'cus_123',
                amount: 4999,
                currency: 'USD'
            });

            expect(payment.amount).toBe(4999);
            expect(mockBilling.payments.process).toHaveBeenCalledWith({
                customerId: 'cus_123',
                amount: 4999,
                currency: 'USD'
            });
        });

        it('should process payment with optional params', async () => {
            const mockBilling = createMockBilling();
            const newPayment = createMockPayment({ id: 'pay_new' });
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.payments.process).mockResolvedValue(newPayment);

            const { result } = renderHook(() => usePayment({}), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await result.current.process({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'USD',
                invoiceId: 'inv_123',
                paymentMethodId: 'pm_123'
            });

            expect(mockBilling.payments.process).toHaveBeenCalledWith({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'USD',
                invoiceId: 'inv_123',
                paymentMethodId: 'pm_123'
            });
        });

        it('should handle process error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.payments.process).mockRejectedValue(new Error('Payment failed'));

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await expect(
                result.current.process({
                    customerId: 'cus_123',
                    amount: 1000,
                    currency: 'USD'
                })
            ).rejects.toThrow('Payment failed');

            await waitFor(() => {
                expect(result.current.error?.message).toBe('Payment failed');
            });
        });
    });

    describe('refund', () => {
        it('should refund payment', async () => {
            const mockBilling = createMockBilling();
            const mockPayments = [createMockPayment()];
            const refundedPayment = createMockPayment({ status: 'refunded' });
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(mockPayments);
            vi.mocked(mockBilling.payments.refund).mockResolvedValue(refundedPayment);

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const payment = await result.current.refund('pay_123');

            expect(payment.status).toBe('refunded');
            expect(mockBilling.payments.refund).toHaveBeenCalledWith({ paymentId: 'pay_123' });
        });

        it('should refund partial amount', async () => {
            const mockBilling = createMockBilling();
            const mockPayments = [createMockPayment()];
            const refundedPayment = createMockPayment({ status: 'partially_refunded' });
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(mockPayments);
            vi.mocked(mockBilling.payments.refund).mockResolvedValue(refundedPayment);

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await result.current.refund('pay_123', 1000);

            expect(mockBilling.payments.refund).toHaveBeenCalledWith({
                paymentId: 'pay_123',
                amount: 1000
            });
        });

        it('should handle refund error', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.payments.refund).mockRejectedValue(new Error('Refund failed'));

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await expect(result.current.refund('pay_123')).rejects.toThrow('Refund failed');

            await waitFor(() => {
                expect(result.current.error?.message).toBe('Refund failed');
            });
        });
    });

    describe('refetch', () => {
        it('should refetch payments', async () => {
            const mockBilling = createMockBilling();
            const mockPayments = [createMockPayment()];
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(mockPayments);

            const { result } = renderHook(() => usePayment({ customerId: 'cus_123' }), {
                wrapper: createWrapper(mockBilling)
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const newPayments = [createMockPayment({ id: 'pay_new' })];
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(newPayments);

            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.data?.[0]?.id).toBe('pay_new');
            });
        });
    });
});
