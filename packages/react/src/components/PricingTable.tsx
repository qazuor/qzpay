import type { QZPayPlan, QZPayPrice } from '@qazuor/qzpay-core';
/**
 * Pricing Table Component
 *
 * Displays available plans with their prices
 */
import { type ReactNode, useEffect, useState } from 'react';
import { usePlans } from '../hooks/usePlans.js';
import type { PricingTableProps } from '../types.js';

/**
 * Format price for display
 */
function formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount / 100);
}

/**
 * Pricing table component that displays available plans
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PricingTable onSelectPlan={(plan, price) => handleSelect(plan, price)} />
 *
 * // With selected plan highlighted
 * <PricingTable
 *   selectedPlanId={currentPlanId}
 *   onSelectPlan={handleUpgrade}
 * />
 *
 * // Filter by interval
 * <PricingTable
 *   interval="year"
 *   currency="USD"
 * />
 * ```
 */
export function PricingTable({
    plans: providedPlans,
    currency = 'USD',
    interval = 'month',
    selectedPlanId,
    onSelectPlan,
    className
}: PricingTableProps): ReactNode {
    const { data: fetchedPlans, getPrices, isLoading } = usePlans();
    const plans = providedPlans ?? fetchedPlans;

    const [planPrices, setPlanPrices] = useState<Map<string, QZPayPrice[]>>(new Map());
    const [loadingPrices, setLoadingPrices] = useState(true);

    // Fetch prices for all plans
    useEffect(() => {
        const fetchPrices = async () => {
            if (!plans) return;

            setLoadingPrices(true);
            const pricesMap = new Map<string, QZPayPrice[]>();

            await Promise.all(
                plans.map(async (plan) => {
                    try {
                        const prices = await getPrices(plan.id);
                        pricesMap.set(plan.id, prices);
                    } catch {
                        pricesMap.set(plan.id, []);
                    }
                })
            );

            setPlanPrices(pricesMap);
            setLoadingPrices(false);
        };

        void fetchPrices();
    }, [plans, getPrices]);

    if (isLoading || loadingPrices) {
        return <div className={className}>Loading pricing...</div>;
    }

    if (!plans || plans.length === 0) {
        return <div className={className}>No plans available</div>;
    }

    const getFilteredPrice = (plan: QZPayPlan): QZPayPrice | undefined => {
        const prices = planPrices.get(plan.id) ?? [];
        return prices.find(
            (p: QZPayPrice) => p.currency.toLowerCase() === currency.toLowerCase() && p.billingInterval === interval && p.active
        );
    };

    const handleSelect = (plan: QZPayPlan) => {
        const price = getFilteredPrice(plan);
        if (price && onSelectPlan) {
            onSelectPlan(plan, price);
        }
    };

    return (
        <div className={className} data-testid="pricing-table">
            {plans.map((plan) => {
                const price = getFilteredPrice(plan);
                const isSelected = plan.id === selectedPlanId;

                return (
                    <button
                        type="button"
                        key={plan.id}
                        data-testid={`plan-${plan.id}`}
                        data-selected={isSelected}
                        onClick={() => handleSelect(plan)}
                        style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            cursor: onSelectPlan ? 'pointer' : 'default',
                            border: isSelected ? '2px solid #0066cc' : '1px solid #ccc',
                            padding: '16px',
                            marginBottom: '8px',
                            borderRadius: '8px',
                            background: 'transparent',
                            font: 'inherit'
                        }}
                    >
                        <h3>{plan.name}</h3>
                        {plan.description && <p>{plan.description}</p>}
                        {price ? (
                            <div data-testid={`price-${price.id}`}>
                                <strong>{formatPrice(price.unitAmount, price.currency)}</strong>
                                <span> / {price.billingInterval}</span>
                            </div>
                        ) : (
                            <div>Contact for pricing</div>
                        )}
                        {plan.features && plan.features.length > 0 && (
                            <ul>
                                {plan.features.map((feature) => (
                                    <li key={feature.name}>{feature.name}</li>
                                ))}
                            </ul>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
