import type { QZPayCustomerEntitlement } from '@qazuor/qzpay-core';
/**
 * Entitlements Hook
 *
 * Hook for checking customer entitlements
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQZPay } from '../context/QZPayContext.js';
import type { UseEntitlementsOptions, UseEntitlementsReturn } from '../types.js';

/**
 * Hook to manage customer entitlements
 *
 * @param options - Options including customerId
 *
 * @example
 * ```tsx
 * function FeatureAccess({ customerId }) {
 *   const { hasEntitlement, checkEntitlement, isLoading } = useEntitlements({ customerId });
 *
 *   // Synchronous check (uses cached data)
 *   if (hasEntitlement('premium_features')) {
 *     return <PremiumFeatures />;
 *   }
 *
 *   // Async check (fresh from server)
 *   const handleCheck = async () => {
 *     const hasPremium = await checkEntitlement('premium_features');
 *     console.log('Has premium:', hasPremium);
 *   };
 *
 *   return <BasicFeatures />;
 * }
 * ```
 */
export function useEntitlements(options: UseEntitlementsOptions): UseEntitlementsReturn {
    const billing = useQZPay();
    const { customerId } = options;

    const [data, setData] = useState<QZPayCustomerEntitlement[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchEntitlements = useCallback(async () => {
        if (!customerId) {
            setData(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const entitlements = await billing.entitlements.getByCustomerId(customerId);
            setData(entitlements);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch entitlements'));
        } finally {
            setIsLoading(false);
        }
    }, [billing, customerId]);

    useEffect(() => {
        void fetchEntitlements();
    }, [fetchEntitlements]);

    // Create a set of entitlement keys for fast lookup
    const entitlementKeys = useMemo(() => {
        if (!data) return new Set<string>();
        const now = new Date();
        return new Set(data.filter((e) => e.expiresAt === null || new Date(e.expiresAt) > now).map((e) => e.entitlementKey));
    }, [data]);

    const hasEntitlement = useCallback(
        (key: string): boolean => {
            return entitlementKeys.has(key);
        },
        [entitlementKeys]
    );

    const checkEntitlement = useCallback(
        async (key: string): Promise<boolean> => {
            if (!customerId) return false;
            return billing.entitlements.check(customerId, key);
        },
        [billing, customerId]
    );

    return {
        data,
        isLoading,
        error,
        refetch: fetchEntitlements,
        hasEntitlement,
        checkEntitlement
    };
}
