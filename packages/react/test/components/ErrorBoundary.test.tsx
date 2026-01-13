/**
 * ErrorBoundary Component Tests
 */
import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayErrorBoundary } from '../../src/components/ErrorBoundary.js';

// Component that throws an error
interface ThrowErrorProps {
    shouldThrow: boolean;
    error?: Error;
}

function ThrowError({ shouldThrow, error }: ThrowErrorProps): ReactNode {
    if (shouldThrow) {
        throw error || new Error('Test error');
    }
    return <div data-testid="child-content">Child Content</div>;
}

describe('QZPayErrorBoundary', () => {
    // Suppress console.error for these tests to avoid cluttering output
    const originalConsoleError = console.error;
    beforeEach(() => {
        console.error = vi.fn();
    });

    afterEach(() => {
        console.error = originalConsoleError;
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render children when no error', () => {
            render(
                <QZPayErrorBoundary>
                    <div data-testid="child">Child Component</div>
                </QZPayErrorBoundary>
            );

            expect(screen.getByTestId('child')).toHaveTextContent('Child Component');
        });

        it('should render default fallback when error occurs', () => {
            render(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
            expect(screen.getByText('An error occurred while rendering this component.')).toBeInTheDocument();
        });

        it('should display error message in default fallback', () => {
            const errorMessage = 'Custom error message';

            render(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={true} error={new Error(errorMessage)} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });

        it('should render custom ReactNode fallback', () => {
            const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;

            render(
                <QZPayErrorBoundary fallback={customFallback}>
                    <ThrowError shouldThrow={true} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom Error UI');
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });

        it('should render custom function fallback with error', () => {
            const fallbackFn = (error: Error) => <div data-testid="function-fallback">Error: {error.message}</div>;

            render(
                <QZPayErrorBoundary fallback={fallbackFn}>
                    <ThrowError shouldThrow={true} error={new Error('Function fallback test')} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByTestId('function-fallback')).toHaveTextContent('Error: Function fallback test');
        });
    });

    describe('error callback', () => {
        it('should call onError callback when error is caught', () => {
            const onError = vi.fn();
            const testError = new Error('Callback test error');

            render(
                <QZPayErrorBoundary onError={onError}>
                    <ThrowError shouldThrow={true} error={testError} />
                </QZPayErrorBoundary>
            );

            expect(onError).toHaveBeenCalled();
            expect(onError).toHaveBeenCalledWith(testError, expect.any(Object));
        });

        it('should not call onError when no error occurs', () => {
            const onError = vi.fn();

            render(
                <QZPayErrorBoundary onError={onError}>
                    <div>No Error</div>
                </QZPayErrorBoundary>
            );

            expect(onError).not.toHaveBeenCalled();
        });
    });

    describe('accessibility', () => {
        it('should have proper ARIA attributes on default fallback', () => {
            render(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </QZPayErrorBoundary>
            );

            const alert = screen.getByRole('alert');
            expect(alert).toHaveAttribute('aria-live', 'assertive');
        });

        it('should have error details in expandable section', () => {
            render(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={true} error={new Error('Details test')} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByText('Error details')).toBeInTheDocument();
        });
    });

    describe('error recovery', () => {
        it('should catch errors from nested components', () => {
            function NestedError() {
                return (
                    <div>
                        <div>
                            <ThrowError shouldThrow={true} />
                        </div>
                    </div>
                );
            }

            render(
                <QZPayErrorBoundary>
                    <NestedError />
                </QZPayErrorBoundary>
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });

        it('should catch errors from multiple child components', () => {
            function MultiChild() {
                return (
                    <>
                        <div>Safe component</div>
                        <ThrowError shouldThrow={true} />
                    </>
                );
            }

            render(
                <QZPayErrorBoundary>
                    <MultiChild />
                </QZPayErrorBoundary>
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    describe('multiple error boundaries', () => {
        it('should isolate errors to nearest boundary', () => {
            render(
                <QZPayErrorBoundary fallback={<div data-testid="outer-fallback">Outer Error</div>}>
                    <div data-testid="outer-content">Outer Content</div>
                    <QZPayErrorBoundary fallback={<div data-testid="inner-fallback">Inner Error</div>}>
                        <ThrowError shouldThrow={true} />
                    </QZPayErrorBoundary>
                </QZPayErrorBoundary>
            );

            // Inner boundary should catch the error
            expect(screen.getByTestId('inner-fallback')).toBeInTheDocument();
            expect(screen.getByTestId('outer-content')).toBeInTheDocument();
            expect(screen.queryByTestId('outer-fallback')).not.toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        it('should handle errors with no message', () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';

            render(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={true} error={errorWithoutMessage} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });

        it('should handle different error types', () => {
            const typeError = new TypeError('Type error occurred');

            render(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={true} error={typeError} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByText('Type error occurred')).toBeInTheDocument();
        });

        it('should maintain boundary state across re-renders', () => {
            const { rerender } = render(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={false} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByTestId('child-content')).toBeInTheDocument();

            rerender(
                <QZPayErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </QZPayErrorBoundary>
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    describe('integration scenarios', () => {
        it('should work with payment form errors', () => {
            function PaymentFormWithError() {
                throw new Error('Payment processing failed');
            }

            const onError = vi.fn();

            render(
                <QZPayErrorBoundary
                    onError={onError}
                    fallback={(error) => <div data-testid="payment-error">Payment Error: {error.message}</div>}
                >
                    <PaymentFormWithError />
                </QZPayErrorBoundary>
            );

            expect(screen.getByTestId('payment-error')).toHaveTextContent('Payment Error: Payment processing failed');
            expect(onError).toHaveBeenCalled();
        });

        it('should work with subscription status errors', () => {
            function SubscriptionWithError() {
                throw new Error('Failed to load subscription');
            }

            render(
                <QZPayErrorBoundary fallback={<div data-testid="subscription-error">Subscription Error</div>}>
                    <SubscriptionWithError />
                </QZPayErrorBoundary>
            );

            expect(screen.getByTestId('subscription-error')).toBeInTheDocument();
        });
    });

    describe('class component behavior', () => {
        it('should be a proper React component', () => {
            expect(QZPayErrorBoundary).toBeDefined();
            expect(QZPayErrorBoundary.prototype).toBeInstanceOf(Component);
        });

        it('should implement componentDidCatch', () => {
            expect(typeof QZPayErrorBoundary.prototype.componentDidCatch).toBe('function');
        });

        it('should implement getDerivedStateFromError', () => {
            expect(typeof QZPayErrorBoundary.getDerivedStateFromError).toBe('function');
        });
    });
});
