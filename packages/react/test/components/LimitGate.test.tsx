/**
 * LimitGate Component Tests
 */
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LimitGate } from '../../src/components/LimitGate.js';
import { QZPayProvider } from '../../src/context/QZPayContext.js';
import { createMockBilling, createMockCustomer } from '../helpers/react-mocks.js';

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

describe('LimitGate', () => {
    describe('rendering', () => {
        it('should render children when within limit', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.limits.check).mockResolvedValue({
                allowed: true,
                currentValue: 50,
                maxValue: 100,
                remaining: 50
            });

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <LimitGate limitKey="api_calls">
                        <div data-testid="allowed-content">You can make API calls</div>
                    </LimitGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('allowed-content')).toBeInTheDocument();
            });
        });

        it('should render fallback when limit exceeded', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.limits.check).mockResolvedValue({
                allowed: false,
                currentValue: 100,
                maxValue: 100,
                remaining: 0
            });

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <LimitGate limitKey="api_calls" fallback={<div data-testid="upgrade-prompt">Upgrade to continue</div>}>
                        <div data-testid="allowed-content">You can make API calls</div>
                    </LimitGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('allowed-content')).not.toBeInTheDocument();
        });

        it('should render null fallback by default', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.limits.check).mockResolvedValue({
                allowed: false,
                currentValue: 100,
                maxValue: 100,
                remaining: 0
            });

            const { container } = render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <LimitGate limitKey="api_calls">
                        <div data-testid="allowed-content">Content</div>
                    </LimitGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mockBilling.limits.check).toHaveBeenCalled();
            });

            expect(screen.queryByTestId('allowed-content')).not.toBeInTheDocument();
            expect(container.innerHTML).toBe('');
        });

        it('should render loading state while checking', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();

            let resolveCheck: (value: unknown) => void;
            const checkPromise = new Promise((resolve) => {
                resolveCheck = resolve;
            });
            vi.mocked(mockBilling.limits.getByCustomerId).mockReturnValue(checkPromise as never);
            vi.mocked(mockBilling.limits.check).mockReturnValue(checkPromise as never);

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <LimitGate limitKey="api_calls" loading={<div data-testid="loading">Loading...</div>}>
                        <div data-testid="content">Content</div>
                    </LimitGate>
                </TestWrapper>
            );

            expect(screen.getByTestId('loading')).toBeInTheDocument();

            resolveCheck?.({ allowed: true, currentValue: 0, maxValue: 100, remaining: 100 });
        });
    });

    describe('customerId handling', () => {
        it('should use customerId prop when provided', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer({ id: 'cus_context' });
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.limits.check).mockResolvedValue({
                allowed: true,
                currentValue: 0,
                maxValue: 100,
                remaining: 100
            });

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <LimitGate limitKey="api_calls" customerId="cus_override">
                        <div data-testid="content">Content</div>
                    </LimitGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mockBilling.limits.getByCustomerId).toHaveBeenCalledWith('cus_override');
            });
        });

        it('should use customer from context when customerId not provided', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer({ id: 'cus_context' });
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.limits.check).mockResolvedValue({
                allowed: true,
                currentValue: 0,
                maxValue: 100,
                remaining: 100
            });

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <LimitGate limitKey="api_calls">
                        <div data-testid="content">Content</div>
                    </LimitGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(mockBilling.limits.getByCustomerId).toHaveBeenCalledWith('cus_context');
            });
        });

        it('should render fallback when no customer context', async () => {
            const mockBilling = createMockBilling();

            render(
                <TestWrapper billing={mockBilling}>
                    <LimitGate limitKey="api_calls" fallback={<div data-testid="no-customer">No Customer</div>}>
                        <div data-testid="content">Content</div>
                    </LimitGate>
                </TestWrapper>
            );

            expect(screen.getByTestId('no-customer')).toBeInTheDocument();
            expect(screen.queryByTestId('content')).not.toBeInTheDocument();
        });
    });

    describe('error handling', () => {
        it('should render fallback when check fails', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue([]);
            vi.mocked(mockBilling.limits.check).mockRejectedValue(new Error('Check failed'));

            render(
                <TestWrapper billing={mockBilling} initialCustomer={mockCustomer}>
                    <LimitGate limitKey="api_calls" fallback={<div data-testid="error-fallback">Error occurred</div>}>
                        <div data-testid="content">Content</div>
                    </LimitGate>
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
            });
        });
    });
});
