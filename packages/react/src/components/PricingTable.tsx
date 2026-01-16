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
        return (
            <output className={className} aria-live="polite" aria-busy="true" style={{ display: 'block' }}>
                Loading pricing...
            </output>
        );
    }

    if (!plans || plans.length === 0) {
        return (
            <output className={className} aria-live="polite" style={{ display: 'block' }}>
                No plans available
            </output>
        );
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

    const handleKeyDown = (event: React.KeyboardEvent, plan: QZPayPlan) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleSelect(plan);
        }
    };

    return (
        <ul
            className={className}
            data-testid="pricing-table"
            aria-label="Available pricing plans"
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                listStyle: 'none',
                margin: 0,
                padding: 0
            }}
        >
            {plans.map((plan) => {
                const price = getFilteredPrice(plan);
                const isSelected = plan.id === selectedPlanId;

                return (
                    <li key={plan.id} style={{ listStyle: 'none' }}>
                        <button
                            type="button"
                            data-testid={`plan-${plan.id}`}
                            data-selected={isSelected}
                            onClick={() => handleSelect(plan)}
                            onKeyDown={(e) => handleKeyDown(e, plan)}
                            aria-label={`${plan.name} plan${isSelected ? ', currently selected' : ''}`}
                            aria-pressed={isSelected}
                            tabIndex={0}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                textAlign: 'left',
                                cursor: onSelectPlan ? 'pointer' : 'default',
                                border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                                padding: '24px',
                                borderRadius: '12px',
                                background: isSelected
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.1))'
                                    : 'rgba(255, 255, 255, 0.03)',
                                font: 'inherit',
                                color: 'inherit',
                                transition: 'all 0.2s ease',
                                boxShadow: isSelected ? '0 8px 32px rgba(59, 130, 246, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <h3
                                style={{
                                    margin: '0 0 8px 0',
                                    fontSize: '1.25rem',
                                    fontWeight: 600,
                                    color: isSelected ? '#3b82f6' : 'inherit'
                                }}
                            >
                                {plan.name}
                            </h3>
                            {plan.description && (
                                <p
                                    style={{
                                        margin: '0 0 16px 0',
                                        fontSize: '0.875rem',
                                        opacity: 0.7,
                                        lineHeight: 1.5
                                    }}
                                >
                                    {plan.description}
                                </p>
                            )}
                            {price ? (
                                <div data-testid={`price-${price.id}`} style={{ marginBottom: '16px' }}>
                                    <strong
                                        style={{
                                            fontSize: '2rem',
                                            fontWeight: 700,
                                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text'
                                        }}
                                    >
                                        {formatPrice(price.unitAmount, price.currency)}
                                    </strong>
                                    <span
                                        style={{
                                            fontSize: '0.875rem',
                                            opacity: 0.6,
                                            marginLeft: '4px'
                                        }}
                                    >
                                        / {price.billingInterval}
                                    </span>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        fontSize: '1rem',
                                        fontWeight: 500,
                                        marginBottom: '16px',
                                        opacity: 0.7
                                    }}
                                >
                                    Contact for pricing
                                </div>
                            )}
                            {plan.features && plan.features.length > 0 && (
                                <ul
                                    style={{
                                        margin: 0,
                                        padding: 0,
                                        listStyle: 'none',
                                        marginTop: 'auto'
                                    }}
                                >
                                    {plan.features.map((feature: { name: string; value?: unknown }) => (
                                        <li
                                            key={feature.name}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '0.875rem',
                                                padding: '6px 0',
                                                opacity: 0.85
                                            }}
                                        >
                                            <span style={{ color: '#22c55e' }}>✓</span>
                                            {feature.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
