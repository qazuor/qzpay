/**
 * Entitlement Gate Component
 *
 * Conditionally renders content based on customer entitlements
 */
import type { ReactNode } from 'react';
import { useQZPayContext } from '../context/QZPayContext.js';
import { useEntitlements } from '../hooks/useEntitlements.js';
import type { EntitlementGateProps } from '../types.js';

/**
 * Gate component that renders children only if customer has the specified entitlement
 *
 * @example
 * ```tsx
 * // Using with current customer from context
 * <EntitlementGate entitlementKey="premium_features">
 *   <PremiumDashboard />
 * </EntitlementGate>
 *
 * // With fallback
 * <EntitlementGate
 *   entitlementKey="advanced_analytics"
 *   fallback={<UpgradePrompt />}
 * >
 *   <AdvancedAnalytics />
 * </EntitlementGate>
 *
 * // With specific customer
 * <EntitlementGate
 *   entitlementKey="api_access"
 *   customerId="cus_123"
 *   loading={<Spinner />}
 * >
 *   <ApiPanel />
 * </EntitlementGate>
 * ```
 */
export function EntitlementGate({
    entitlementKey,
    customerId,
    children,
    fallback = null,
    loading = null
}: EntitlementGateProps): ReactNode {
    const { customer } = useQZPayContext();
    const effectiveCustomerId = customerId ?? customer?.id;

    const { hasEntitlement, isLoading } = useEntitlements({
        customerId: effectiveCustomerId ?? ''
    });

    // No customer ID available
    if (!effectiveCustomerId) {
        return fallback;
    }

    // Show loading state
    if (isLoading) {
        return loading;
    }

    // Check entitlement and render accordingly
    if (hasEntitlement(entitlementKey)) {
        return children;
    }

    return fallback;
}
