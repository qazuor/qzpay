import type { QZPayCustomer } from '@qazuor/qzpay-core';
/**
 * Customer Hook
 *
 * Hook for managing customer data
 */
import { useCallback, useEffect, useState } from 'react';
import { useQZPay } from '../context/QZPayContext.js';
import type { UseCustomerReturn } from '../types.js';

/**
 * Hook to manage a customer
 *
 * @param customerId - Customer ID to fetch
 *
 * @example
 * ```tsx
 * function CustomerProfile({ customerId }) {
 *   const { data: customer, isLoading, error, update } = useCustomer(customerId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!customer) return <div>Customer not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{customer.name}</h1>
 *       <p>{customer.email}</p>
 *       <button onClick={() => update({ name: 'New Name' })}>
 *         Update Name
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCustomer(customerId: string | undefined): UseCustomerReturn {
    const billing = useQZPay();
    const [data, setData] = useState<QZPayCustomer | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchCustomer = useCallback(async () => {
        if (!customerId) {
            setData(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const customer = await billing.customers.get(customerId);
            setData(customer);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch customer'));
        } finally {
            setIsLoading(false);
        }
    }, [billing, customerId]);

    useEffect(() => {
        void fetchCustomer();
    }, [fetchCustomer]);

    const update = useCallback(
        async (updateData: Partial<QZPayCustomer>): Promise<QZPayCustomer | null> => {
            if (!customerId) {
                throw new Error('Customer ID is required to update');
            }

            setIsLoading(true);
            setError(null);

            try {
                const updated = await billing.customers.update(customerId, updateData);
                setData(updated);
                return updated;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to update customer');
                setError(error);
                throw error;
            } finally {
                setIsLoading(false);
            }
        },
        [billing, customerId]
    );

    return {
        data,
        isLoading,
        error,
        refetch: fetchCustomer,
        update
    };
}
