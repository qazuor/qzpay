import type { QZPayPlan, QZPayPrice } from '@qazuor/qzpay-core';
/**
 * Plans Hook
 *
 * Hook for accessing plans and prices
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQZPay } from '../context/QZPayContext.js';
import type { UsePlansReturn } from '../types.js';

/**
 * Hook to access available plans
 *
 * @param activeOnly - Only fetch active plans (default: true)
 *
 * @example
 * ```tsx
 * function PricingPage() {
 *   const { data: plans, isLoading, getPlan, getPrices } = usePlans();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {plans?.map(plan => (
 *         <PlanCard key={plan.id} plan={plan} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlans(activeOnly = true): UsePlansReturn {
    const billing = useQZPay();
    const [data, setData] = useState<QZPayPlan[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchPlans = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const plans = activeOnly ? await billing.plans.getActive() : billing.getPlans();
            setData(plans);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch plans'));
        } finally {
            setIsLoading(false);
        }
    }, [billing, activeOnly]);

    useEffect(() => {
        void fetchPlans();
    }, [fetchPlans]);

    const planMap = useMemo(() => {
        if (!data) return new Map<string, QZPayPlan>();
        return new Map(data.map((plan) => [plan.id, plan]));
    }, [data]);

    const getPlan = useCallback(
        (planId: string): QZPayPlan | undefined => {
            return planMap.get(planId);
        },
        [planMap]
    );

    const getPrices = useCallback(
        async (planId: string): Promise<QZPayPrice[]> => {
            return billing.plans.getPrices(planId);
        },
        [billing]
    );

    return {
        data,
        isLoading,
        error,
        refetch: fetchPlans,
        getPlan,
        getPrices
    };
}
