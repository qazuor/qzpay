/**
 * PricingTable Component Tests
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PricingTable } from '../../src/components/PricingTable.js';
import { QZPayProvider } from '../../src/context/QZPayContext.js';
import { createMockBilling, createMockPlan } from '../helpers/react-mocks.js';

function createMockPrice(overrides: Record<string, unknown> = {}) {
    return {
        id: 'price_123',
        planId: 'plan_123',
        unitAmount: 2999,
        currency: 'USD',
        billingInterval: 'month',
        active: true,
        ...overrides
    };
}

function TestWrapper({
    children,
    billing
}: {
    children: ReactNode;
    billing: ReturnType<typeof createMockBilling>;
}) {
    return <QZPayProvider billing={billing}>{children}</QZPayProvider>;
}

describe('PricingTable', () => {
    describe('rendering', () => {
        it('should render loading state', async () => {
            const mockBilling = createMockBilling();
            let resolvePromise: (value: unknown) => void;
            const promise = new Promise((resolve) => {
                resolvePromise = resolve;
            });
            vi.mocked(mockBilling.plans.getActive).mockReturnValue(promise as never);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable />
                </TestWrapper>
            );

            expect(screen.getByText('Loading pricing...')).toBeInTheDocument();

            resolvePromise?.([]);
        });

        it('should render empty state when no plans', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue([]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('No plans available')).toBeInTheDocument();
            });
        });

        it('should render plans with prices', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [
                createMockPlan({ id: 'plan_basic', name: 'Basic Plan' }),
                createMockPlan({ id: 'plan_pro', name: 'Pro Plan' })
            ];
            const basicPrice = createMockPrice({ planId: 'plan_basic', unitAmount: 999 });
            const proPrice = createMockPrice({ id: 'price_pro', planId: 'plan_pro', unitAmount: 2999 });

            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockImplementation((planId) => {
                if (planId === 'plan_basic') return Promise.resolve([basicPrice]);
                if (planId === 'plan_pro') return Promise.resolve([proPrice]);
                return Promise.resolve([]);
            });

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('pricing-table')).toBeInTheDocument();
            });

            expect(screen.getByText('Basic Plan')).toBeInTheDocument();
            expect(screen.getByText('Pro Plan')).toBeInTheDocument();
        });

        it('should render contact for pricing when no matching price', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Contact for pricing')).toBeInTheDocument();
            });
        });

        it('should apply custom className', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([createMockPrice()]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable className="custom-class" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('pricing-table')).toHaveClass('custom-class');
            });
        });
    });

    describe('provided plans', () => {
        it('should use provided plans instead of fetching', async () => {
            const mockBilling = createMockBilling();
            const providedPlans = [createMockPlan({ id: 'provided_plan', name: 'Provided Plan' })];
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([createMockPrice({ planId: 'provided_plan' })]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable plans={providedPlans} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Provided Plan')).toBeInTheDocument();
            });
        });
    });

    describe('filtering', () => {
        it('should filter by currency', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            const usdPrice = createMockPrice({ currency: 'USD', unitAmount: 2999 });
            const eurPrice = createMockPrice({ id: 'price_eur', currency: 'EUR', unitAmount: 2599 });

            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([usdPrice, eurPrice]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable currency="EUR" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('price-price_eur')).toBeInTheDocument();
            });
        });

        it('should filter by interval', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            const monthlyPrice = createMockPrice({ billingInterval: 'month', unitAmount: 2999 });
            const yearlyPrice = createMockPrice({ id: 'price_yearly', billingInterval: 'year', unitAmount: 29990 });

            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([monthlyPrice, yearlyPrice]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable interval="year" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('price-price_yearly')).toBeInTheDocument();
            });
        });
    });

    describe('selection', () => {
        it('should highlight selected plan', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan({ id: 'plan_1', name: 'Plan 1' }), createMockPlan({ id: 'plan_2', name: 'Plan 2' })];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([createMockPrice()]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable selectedPlanId="plan_2" />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('plan-plan_2')).toHaveAttribute('data-selected', 'true');
            });

            expect(screen.getByTestId('plan-plan_1')).toHaveAttribute('data-selected', 'false');
        });

        it('should call onSelectPlan when plan clicked', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan({ id: 'plan_1', name: 'Plan 1' })];
            const price = createMockPrice({ planId: 'plan_1' });
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([price]);

            const onSelectPlan = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable onSelectPlan={onSelectPlan} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('plan-plan_1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('plan-plan_1'));

            expect(onSelectPlan).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'plan_1' }),
                expect.objectContaining({ planId: 'plan_1' })
            );
        });

        it('should not call onSelectPlan when no matching price', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([]);

            const onSelectPlan = vi.fn();

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable onSelectPlan={onSelectPlan} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('plan-plan_123')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('plan-plan_123'));

            expect(onSelectPlan).not.toHaveBeenCalled();
        });
    });

    describe('features', () => {
        it('should render plan features', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [
                createMockPlan({
                    features: [
                        { name: 'Feature 1', description: 'Description 1' },
                        { name: 'Feature 2', description: 'Description 2' }
                    ]
                })
            ];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([createMockPrice()]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Feature 1')).toBeInTheDocument();
            });

            expect(screen.getByText('Feature 2')).toBeInTheDocument();
        });

        it('should render plan description', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan({ description: 'This is a great plan' })];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue([createMockPrice()]);

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('This is a great plan')).toBeInTheDocument();
            });
        });
    });

    describe('error handling', () => {
        it('should handle price fetch errors gracefully', async () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(mockPlans);
            vi.mocked(mockBilling.plans.getPrices).mockRejectedValue(new Error('Price fetch failed'));

            render(
                <TestWrapper billing={mockBilling}>
                    <PricingTable />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText('Contact for pricing')).toBeInTheDocument();
            });
        });
    });
});
