import type { QZPayCustomerLimit } from '@qazuor/qzpay-core';
/**
 * Limits Hook
 *
 * Hook for checking and managing customer limits
 */
import { useCallback, useEffect, useState } from 'react';
import { useQZPay } from '../context/QZPayContext.js';
import type { QZPayLimitCheckResult, UseLimitsOptions, UseLimitsReturn } from '../types.js';

/**
 * Hook to manage customer limits
 *
 * @param options - Options including customerId
 *
 * @example
 * ```tsx
 * function FeatureUsage({ customerId }) {
 *   const { checkLimit, increment, isLoading } = useLimits({ customerId });
 *
 *   const handleAction = async () => {
 *     const result = await checkLimit('api_calls');
 *     if (result.allowed) {
 *       await increment('api_calls');
 *       // Perform action
 *     } else {
 *       alert('Limit exceeded');
 *     }
 *   };
 *
 *   return <button onClick={handleAction}>Use API</button>;
 * }
 * ```
 */
export function useLimits(options: UseLimitsOptions): UseLimitsReturn {
    const billing = useQZPay();
    const { customerId } = options;

    const [data, setData] = useState<QZPayCustomerLimit[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchLimits = useCallback(async () => {
        if (!customerId) {
            setData(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const limits = await billing.limits.getByCustomerId(customerId);
            setData(limits);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch limits'));
        } finally {
            setIsLoading(false);
        }
    }, [billing, customerId]);

    useEffect(() => {
        void fetchLimits();
    }, [fetchLimits]);

    const checkLimit = useCallback(
        async (key: string): Promise<QZPayLimitCheckResult> => {
            if (!customerId) {
                return {
                    allowed: false,
                    currentValue: 0,
                    maxValue: 0,
                    remaining: 0
                };
            }

            const result = await billing.limits.check(customerId, key);
            return {
                allowed: result.allowed,
                currentValue: result.currentValue,
                maxValue: result.maxValue,
                remaining: result.remaining
            };
        },
        [billing, customerId]
    );

    const increment = useCallback(
        async (key: string, amount = 1): Promise<QZPayCustomerLimit> => {
            if (!customerId) {
                throw new Error('Customer ID is required to increment limit');
            }

            const limit = await billing.limits.increment(customerId, key, amount);

            // Update local state
            if (data) {
                setData(data.map((l) => (l.limitKey === key ? limit : l)));
            }

            return limit;
        },
        [billing, customerId, data]
    );

    const recordUsage = useCallback(
        async (key: string, quantity: number): Promise<void> => {
            if (!customerId) {
                throw new Error('Customer ID is required to record usage');
            }

            await billing.limits.recordUsage(customerId, key, quantity);
            // Refetch to get updated values
            await fetchLimits();
        },
        [billing, customerId, fetchLimits]
    );

    return {
        data,
        isLoading,
        error,
        refetch: fetchLimits,
        checkLimit,
        increment,
        recordUsage
    };
}
