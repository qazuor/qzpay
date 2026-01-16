import type { QZPaySubscription } from '@qazuor/qzpay-core';
/**
 * Subscription Hook
 *
 * Hook for managing subscriptions
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQZPay } from '../context/QZPayContext.js';
import type { UseSubscriptionOptions, UseSubscriptionReturn } from '../types.js';

/**
 * Hook to manage subscriptions
 *
 * @param options - Options for fetching subscriptions
 *
 * @example
 * ```tsx
 * // Get all subscriptions for a customer
 * function CustomerSubscriptions({ customerId }) {
 *   const { data: subscriptions, isLoading, create, cancel } = useSubscription({ customerId });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {subscriptions?.map(sub => (
 *         <div key={sub.id}>
 *           <span>{sub.status}</span>
 *           <button onClick={() => cancel(sub.id)}>Cancel</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 *
 * // Get a specific subscription
 * function SubscriptionDetails({ subscriptionId }) {
 *   const { data: subscription, pause, resume } = useSubscription({ subscriptionId });
 *   // ...
 * }
 * ```
 */
export function useSubscription(options: UseSubscriptionOptions = {}): UseSubscriptionReturn {
    const billing = useQZPay();
    const { customerId, subscriptionId } = options;

    const [data, setData] = useState<QZPaySubscription | QZPaySubscription[] | null>(null);
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

    const fetchData = useCallback(async () => {
        if (!customerId && !subscriptionId) {
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
            if (subscriptionId) {
                const subscription = await billing.subscriptions.get(subscriptionId);

                // Only update if this is still the most recent request
                if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                    setData(subscription);
                }
            } else if (customerId) {
                const subscriptions = await billing.subscriptions.getByCustomerId(customerId);

                // Only update if this is still the most recent request
                if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                    setData(subscriptions);
                }
            }
        } catch (err) {
            if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                setError(err instanceof Error ? err : new Error('Failed to fetch subscriptions'));
            }
        } finally {
            if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [billing, customerId, subscriptionId]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const create = useCallback(
        async (input: {
            customerId: string;
            planId: string;
            priceId?: string | undefined;
            quantity?: number | undefined;
            trialDays?: number | undefined;
            promoCodeId?: string | undefined;
        }): Promise<QZPaySubscription> => {
            if (isMountedRef.current) {
                setIsLoading(true);
                setError(null);
            }

            try {
                const createInput = {
                    customerId: input.customerId,
                    planId: input.planId,
                    ...(input.priceId !== undefined && { priceId: input.priceId }),
                    ...(input.quantity !== undefined && { quantity: input.quantity }),
                    ...(input.trialDays !== undefined && { trialDays: input.trialDays }),
                    ...(input.promoCodeId !== undefined && { promoCodeId: input.promoCodeId })
                };
                const subscription = await billing.subscriptions.create(createInput);

                // Update local state if we're tracking this customer
                if (isMountedRef.current && customerId === input.customerId && Array.isArray(data)) {
                    setData([...data, subscription]);
                }

                return subscription;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to create subscription');
                if (isMountedRef.current) {
                    setError(error);
                }
                throw error;
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [billing, customerId, data]
    );

    const cancel = useCallback(
        async (subId: string, cancelOptions?: { cancelAtPeriodEnd?: boolean | undefined }): Promise<QZPaySubscription> => {
            if (isMountedRef.current) {
                setIsLoading(true);
                setError(null);
            }

            try {
                const options =
                    cancelOptions?.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: cancelOptions.cancelAtPeriodEnd } : undefined;
                const subscription = await billing.subscriptions.cancel(subId, options);

                // Update local state
                if (isMountedRef.current) {
                    if (subscriptionId === subId) {
                        setData(subscription);
                    } else if (Array.isArray(data)) {
                        setData(data.map((s) => (s.id === subId ? subscription : s)));
                    }
                }

                return subscription;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to cancel subscription');
                if (isMountedRef.current) {
                    setError(error);
                }
                throw error;
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [billing, subscriptionId, data]
    );

    const pause = useCallback(
        async (subId: string): Promise<QZPaySubscription> => {
            if (isMountedRef.current) {
                setIsLoading(true);
                setError(null);
            }

            try {
                const subscription = await billing.subscriptions.pause(subId);

                // Update local state
                if (isMountedRef.current) {
                    if (subscriptionId === subId) {
                        setData(subscription);
                    } else if (Array.isArray(data)) {
                        setData(data.map((s) => (s.id === subId ? subscription : s)));
                    }
                }

                return subscription;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to pause subscription');
                if (isMountedRef.current) {
                    setError(error);
                }
                throw error;
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [billing, subscriptionId, data]
    );

    const resume = useCallback(
        async (subId: string): Promise<QZPaySubscription> => {
            if (isMountedRef.current) {
                setIsLoading(true);
                setError(null);
            }

            try {
                const subscription = await billing.subscriptions.resume(subId);

                // Update local state
                if (isMountedRef.current) {
                    if (subscriptionId === subId) {
                        setData(subscription);
                    } else if (Array.isArray(data)) {
                        setData(data.map((s) => (s.id === subId ? subscription : s)));
                    }
                }

                return subscription;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to resume subscription');
                if (isMountedRef.current) {
                    setError(error);
                }
                throw error;
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [billing, subscriptionId, data]
    );

    return {
        data,
        isLoading,
        error,
        refetch: fetchData,
        create,
        cancel,
        pause,
        resume
    };
}
