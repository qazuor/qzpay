import type { QZPayInvoice } from '@qazuor/qzpay-core';
/**
 * Invoices Hook
 *
 * Hook for accessing customer invoices
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQZPay } from '../context/QZPayContext.js';
import type { UseInvoicesOptions, UseInvoicesReturn } from '../types.js';

/**
 * Hook to access customer invoices
 *
 * @param options - Options including customerId
 *
 * @example
 * ```tsx
 * function InvoiceList({ customerId }) {
 *   const { data: invoices, isLoading, getInvoice } = useInvoices({ customerId });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {invoices?.map(invoice => (
 *         <InvoiceRow key={invoice.id} invoice={invoice} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useInvoices(options: UseInvoicesOptions = {}): UseInvoicesReturn {
    const billing = useQZPay();
    const { customerId } = options;

    const [data, setData] = useState<QZPayInvoice[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const isMountedRef = useRef(true);
    const requestIdRef = useRef(0);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchInvoices = useCallback(async () => {
        if (!customerId) {
            if (isMountedRef.current) {
                setData(null);
            }
            return;
        }

        // Increment request ID to track this specific request
        const currentRequestId = ++requestIdRef.current;

        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
        }

        try {
            const invoices = await billing.invoices.getByCustomerId(customerId);

            // Only update if this is still the most recent request
            if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                setData(invoices);
            }
        } catch (err) {
            if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                setError(err instanceof Error ? err : new Error('Failed to fetch invoices'));
            }
        } finally {
            if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [billing, customerId]);

    useEffect(() => {
        void fetchInvoices();
    }, [fetchInvoices]);

    const getInvoice = useCallback(
        async (invoiceId: string): Promise<QZPayInvoice | null> => {
            try {
                return await billing.invoices.get(invoiceId);
            } catch {
                return null;
            }
        },
        [billing]
    );

    return {
        data,
        isLoading,
        error,
        refetch: fetchInvoices,
        getInvoice
    };
}
