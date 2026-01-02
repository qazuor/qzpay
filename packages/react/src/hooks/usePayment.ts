import type { QZPayCurrency, QZPayPayment } from '@qazuor/qzpay-core';
/**
 * Payment Hook
 *
 * Hook for processing and managing payments
 */
import { useCallback, useEffect, useState } from 'react';
import { useQZPay } from '../context/QZPayContext.js';
import type { UsePaymentOptions, UsePaymentReturn } from '../types.js';

/**
 * Hook to manage payments
 *
 * @param options - Options including customerId
 *
 * @example
 * ```tsx
 * function PaymentForm({ customerId }) {
 *   const { process, isLoading, error } = usePayment({ customerId });
 *
 *   const handlePayment = async () => {
 *     try {
 *       const payment = await process({
 *         customerId,
 *         amount: 1999,
 *         currency: 'USD',
 *       });
 *       console.log('Payment successful:', payment.id);
 *     } catch (err) {
 *       console.error('Payment failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handlePayment} disabled={isLoading}>
 *       {isLoading ? 'Processing...' : 'Pay $19.99'}
 *     </button>
 *   );
 * }
 * ```
 */
export function usePayment(options: UsePaymentOptions = {}): UsePaymentReturn {
    const billing = useQZPay();
    const { customerId } = options;

    const [data, setData] = useState<QZPayPayment[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchPayments = useCallback(async () => {
        if (!customerId) {
            setData(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const payments = await billing.payments.getByCustomerId(customerId);
            setData(payments);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch payments'));
        } finally {
            setIsLoading(false);
        }
    }, [billing, customerId]);

    useEffect(() => {
        void fetchPayments();
    }, [fetchPayments]);

    const process = useCallback(
        async (input: {
            customerId: string;
            amount: number;
            currency: QZPayCurrency;
            invoiceId?: string | undefined;
            paymentMethodId?: string | undefined;
        }): Promise<QZPayPayment> => {
            setIsLoading(true);
            setError(null);

            try {
                const processInput = {
                    customerId: input.customerId,
                    amount: input.amount,
                    currency: input.currency,
                    ...(input.invoiceId !== undefined && { invoiceId: input.invoiceId }),
                    ...(input.paymentMethodId !== undefined && { paymentMethodId: input.paymentMethodId })
                };
                const payment = await billing.payments.process(processInput);

                // Update local state if we're tracking this customer
                if (customerId === input.customerId && Array.isArray(data)) {
                    setData([payment, ...data]);
                }

                return payment;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to process payment');
                setError(error);
                throw error;
            } finally {
                setIsLoading(false);
            }
        },
        [billing, customerId, data]
    );

    const refund = useCallback(
        async (paymentId: string, amount?: number): Promise<QZPayPayment> => {
            setIsLoading(true);
            setError(null);

            try {
                const refundInput = {
                    paymentId,
                    ...(amount !== undefined && { amount })
                };
                const payment = await billing.payments.refund(refundInput);

                // Update local state
                if (Array.isArray(data)) {
                    setData(data.map((p) => (p.id === paymentId ? payment : p)));
                }

                return payment;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to refund payment');
                setError(error);
                throw error;
            } finally {
                setIsLoading(false);
            }
        },
        [billing, data]
    );

    return {
        data,
        isLoading,
        error,
        refetch: fetchPayments,
        process,
        refund
    };
}
