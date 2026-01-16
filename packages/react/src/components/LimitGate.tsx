/**
 * Limit Gate Component
 *
 * Conditionally renders content based on customer usage limits
 */
import { type ReactNode, useEffect, useState } from 'react';
import { useQZPayContext } from '../context/QZPayContext.js';
import { useLimits } from '../hooks/useLimits.js';
import type { LimitGateProps } from '../types.js';

/**
 * Gate component that renders children only if customer is within the specified limit
 *
 * @example
 * ```tsx
 * // Using with current customer from context
 * <LimitGate limitKey="api_calls">
 *   <ApiCallButton />
 * </LimitGate>
 *
 * // With fallback when limit exceeded
 * <LimitGate
 *   limitKey="team_members"
 *   fallback={<UpgradeToAddMore />}
 * >
 *   <AddTeamMemberButton />
 * </LimitGate>
 *
 * // With specific customer
 * <LimitGate
 *   limitKey="storage_gb"
 *   customerId="cus_123"
 *   loading={<Spinner />}
 * >
 *   <UploadButton />
 * </LimitGate>
 * ```
 */
export function LimitGate({ limitKey, customerId, children, fallback = null, loading = null }: LimitGateProps): ReactNode {
    const { customer } = useQZPayContext();
    const effectiveCustomerId = customerId ?? customer?.id;

    const { checkLimit, isLoading } = useLimits({
        customerId: effectiveCustomerId ?? ''
    });

    const [withinLimit, setWithinLimit] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            if (!effectiveCustomerId) {
                if (!cancelled) {
                    setWithinLimit(false);
                    setChecking(false);
                }
                return;
            }

            try {
                const result = await checkLimit(limitKey);
                if (!cancelled) {
                    setWithinLimit(result.allowed);
                }
            } catch {
                if (!cancelled) {
                    setWithinLimit(false);
                }
            } finally {
                if (!cancelled) {
                    setChecking(false);
                }
            }
        };

        void check();

        // Cleanup function to prevent race conditions
        return () => {
            cancelled = true;
        };
    }, [effectiveCustomerId, limitKey, checkLimit]);

    // No customer ID available
    if (!effectiveCustomerId) {
        return (
            <div role="alert" aria-live="polite">
                {fallback}
            </div>
        );
    }

    // Show loading state
    if (isLoading || checking) {
        return (
            <div aria-live="polite" aria-busy="true" aria-hidden={!loading}>
                {loading}
            </div>
        );
    }

    // Check limit and render accordingly
    if (withinLimit) {
        return children;
    }

    return (
        <div role="alert" aria-live="polite">
            {fallback}
        </div>
    );
}
