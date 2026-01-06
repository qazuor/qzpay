/**
 * EntitlementGate Component Tests
 */
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EntitlementGate } from '../../src/components/EntitlementGate.js';
import { QZPayProvider } from '../../src/context/QZPayContext.js';
import { createMockBilling, createMockCustomer, createMockEntitlement } from '../helpers/react-mocks.js';

function TestWrapper({
    children,
    billing,
    initialCustomer
}: {
    children: ReactNode;
    billing: ReturnType<typeof createMockBilling>;
    initialCustomer?: ReturnType<typeof createMockCustomer>;
}) {
    return (
        <QZPayProvider billing={billing} initialCustomer={initialCustomer}>
            {children}
        </QZPayProvider>
    );
}

describe('EntitlementGate', () => {
    describe('rendering', () => {
        it('should render children when customer has entitlement', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            const mockEntitlements = [createMockEntitlement({ entitlementKey: 'premium_features' })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <EntitlementGate entitlementKey="premium_features">
                        <div data-testid="premium-content">Premium Content</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('premium-content')).toBeInTheDocument();
            });
        });

        it('should render fallback when customer lacks entitlement', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue([]);

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <EntitlementGate entitlementKey="premium_features" fallback={<div data-testid="upgrade-prompt">Upgrade Required</div>}>
                        <div data-testid="premium-content">Premium Content</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument();
        });

        it('should render null fallback by default', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue([]);

            const { container } = render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <EntitlementGate entitlementKey="premium_features">
                        <div data-testid="premium-content">Premium Content</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mockBilling.entitlements.getByCustomerId).toHaveBeenCalled();
            });

            expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument();
            expect(container.innerHTML).toBe('');
        });

        it('should render loading state while fetching', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();

            // Create a promise that never resolves to keep loading state
            let resolvePromise: (value: unknown) => void;
            const promise = new Promise((resolve) => {
                resolvePromise = resolve;
            });
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockReturnValue(promise as never);

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <EntitlementGate entitlementKey="premium_features" loading={<div data-testid="loading">Loading...</div>}>
                        <div data-testid="premium-content">Premium Content</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            expect(screen.getByTestId('loading')).toBeInTheDocument();

            // Resolve the promise to clean up
            resolvePromise?.([]);
        });
    });

    describe('customerId handling', () => {
        it('should use customerId prop when provided', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer({ id: 'cus_context' });
            const mockEntitlements = [createMockEntitlement({ entitlementKey: 'feature' })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <EntitlementGate entitlementKey="feature" customerId="cus_override">
                        <div data-testid="content">Content</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mockBilling.entitlements.getByCustomerId).toHaveBeenCalledWith('cus_override');
            });
        });

        it('should use customer from context when customerId not provided', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer({ id: 'cus_context' });
            const mockEntitlements = [createMockEntitlement({ entitlementKey: 'feature' })];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <EntitlementGate entitlementKey="feature">
                        <div data-testid="content">Content</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mockBilling.entitlements.getByCustomerId).toHaveBeenCalledWith('cus_context');
            });
        });

        it('should render fallback when no customer context', async () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <EntitlementGate entitlementKey="feature" fallback={<div data-testid="no-customer">No Customer</div>}>
                        <div data-testid="content">Content</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            expect(screen.getByTestId('no-customer')).toBeInTheDocument();
            expect(screen.queryByTestId('content')).not.toBeInTheDocument();
        });
    });

    describe('multiple entitlements', () => {
        it('should work with multiple gates', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            const mockEntitlements = [
                createMockEntitlement({ entitlementKey: 'feature_a' }),
                createMockEntitlement({ entitlementKey: 'feature_c' })
            ];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <EntitlementGate entitlementKey="feature_a">
                        <div data-testid="feature-a">Feature A</div>
                    </EntitlementGate>
                    <EntitlementGate entitlementKey="feature_b">
                        <div data-testid="feature-b">Feature B</div>
                    </EntitlementGate>
                    <EntitlementGate entitlementKey="feature_c">
                        <div data-testid="feature-c">Feature C</div>
                    </EntitlementGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('feature-a')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('feature-b')).not.toBeInTheDocument();
            expect(screen.getByTestId('feature-c')).toBeInTheDocument();
        });
    });
});
