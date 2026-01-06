/**
 * CheckoutButton Component Tests
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutButton } from '../../src/components/CheckoutButton.js';
import type { CheckoutResult } from '../../src/types.js';

describe('CheckoutButton', () => {
    const defaultProps = {
        mode: 'subscription' as const,
        priceId: 'price_123',
        successUrl: '/success',
        cancelUrl: '/cancel'
    };

    let mockOnCheckout: ReturnType<typeof vi.fn>;
    let mockOnError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockOnCheckout = vi.fn();
        mockOnError = vi.fn();
        (window as unknown as { location: unknown }).location = undefined;
        (window as unknown as { location: { href: string } }).location = { href: '' };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render button with default text', () => {
            render(<CheckoutButton {...defaultProps} />);
            expect(screen.getByTestId('checkout-button')).toHaveTextContent('Checkout');
        });

        it('should render button with custom children', () => {
            render(<CheckoutButton {...defaultProps}>Subscribe Now</CheckoutButton>);
            expect(screen.getByTestId('checkout-button')).toHaveTextContent('Subscribe Now');
        });

        it('should apply custom className', () => {
            render(<CheckoutButton {...defaultProps} className="custom-class" />);
            const container = screen.getByTestId('checkout-button').parentElement;
            expect(container).toHaveClass('custom-class');
        });

        it('should render button as disabled when disabled prop is true', () => {
            render(<CheckoutButton {...defaultProps} disabled={true} />);
            expect(screen.getByTestId('checkout-button')).toBeDisabled();
        });

        it('should render button as disabled when no onCheckout handler provided', () => {
            render(<CheckoutButton {...defaultProps} />);
            expect(screen.getByTestId('checkout-button')).toBeDisabled();
        });

        it('should not render error initially', () => {
            render(<CheckoutButton {...defaultProps} />);
            expect(screen.queryByTestId('checkout-error')).not.toBeInTheDocument();
        });
    });

    describe('checkout flow', () => {
        it('should call onCheckout with correct params for subscription', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com' });

            render(<CheckoutButton {...defaultProps} mode="subscription" onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith(
                    expect.objectContaining({
                        mode: 'subscription',
                        lineItems: [{ priceId: 'price_123', quantity: 1 }],
                        successUrl: '/success',
                        cancelUrl: '/cancel',
                        allowPromoCodes: false
                    })
                );
            });
        });

        it('should call onCheckout with correct params for payment', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com' });

            render(<CheckoutButton {...defaultProps} mode="payment" quantity={2} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith(
                    expect.objectContaining({
                        mode: 'payment',
                        lineItems: [{ priceId: 'price_123', quantity: 2 }],
                        successUrl: '/success',
                        cancelUrl: '/cancel',
                        allowPromoCodes: false
                    })
                );
            });
        });

        it('should include customerId when provided', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com' });

            render(<CheckoutButton {...defaultProps} customerId="cus_123" onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customerId: 'cus_123'
                    })
                );
            });
        });

        it('should include customerEmail when provided', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com' });

            render(<CheckoutButton {...defaultProps} customerEmail="test@example.com" onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customerEmail: 'test@example.com'
                    })
                );
            });
        });

        it('should include promoCodeId when provided', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com' });

            render(<CheckoutButton {...defaultProps} promoCodeId="promo_123" onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith(
                    expect.objectContaining({
                        promoCodeId: 'promo_123'
                    })
                );
            });
        });

        it('should set allowPromoCodes to true when provided', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com' });

            render(<CheckoutButton {...defaultProps} allowPromoCodes={true} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith(
                    expect.objectContaining({
                        allowPromoCodes: true
                    })
                );
            });
        });

        it('should redirect to checkout URL on success', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com/session_123' });

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(window.location.href).toBe('https://checkout.example.com/session_123');
            });
        });

        it('should not redirect if no URL returned', async () => {
            mockOnCheckout.mockResolvedValue({} as CheckoutResult);

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalled();
            });

            expect(window.location.href).toBe('');
        });
    });

    describe('loading states', () => {
        it('should show loading text while processing', async () => {
            let resolveCheckout: (value: CheckoutResult) => void;
            const checkoutPromise = new Promise<CheckoutResult>((resolve) => {
                resolveCheckout = resolve;
            });
            mockOnCheckout.mockReturnValue(checkoutPromise);

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(screen.getByTestId('checkout-button')).toHaveTextContent('Loading...');
            });

            expect(screen.getByTestId('checkout-button')).toBeDisabled();

            resolveCheckout?.({ url: 'https://checkout.example.com' });
        });

        it('should restore button text after successful checkout', async () => {
            mockOnCheckout.mockResolvedValue({ url: 'https://checkout.example.com' });

            render(
                <CheckoutButton {...defaultProps} onCheckout={mockOnCheckout}>
                    Buy Now
                </CheckoutButton>
            );

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(screen.getByTestId('checkout-button')).toHaveTextContent('Loading...');
            });

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalled();
            });
        });
    });

    describe('error handling', () => {
        it('should not allow clicking when no checkout handler provided', () => {
            render(<CheckoutButton {...defaultProps} />);

            const button = screen.getByTestId('checkout-button');
            expect(button).toBeDisabled();
        });

        it('should display error when checkout fails', async () => {
            mockOnCheckout.mockRejectedValue(new Error('Checkout failed'));

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(screen.getByTestId('checkout-error')).toHaveTextContent('Checkout failed');
            });
        });

        it('should call onError callback when checkout fails', async () => {
            const error = new Error('Network error');
            mockOnCheckout.mockRejectedValue(error);

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} onError={mockOnError} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith(error);
            });
        });

        it('should handle non-Error exceptions', async () => {
            mockOnCheckout.mockRejectedValue('String error');

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(screen.getByTestId('checkout-error')).toHaveTextContent('Checkout failed');
            });
        });

        it('should clear error on subsequent click', async () => {
            mockOnCheckout.mockRejectedValueOnce(new Error('First error')).mockResolvedValueOnce({ url: 'https://checkout.example.com' });

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(screen.getByTestId('checkout-error')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(screen.queryByTestId('checkout-error')).not.toBeInTheDocument();
            });
        });

        it('should re-enable button after error', async () => {
            mockOnCheckout.mockRejectedValue(new Error('Checkout failed'));

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                expect(screen.getByTestId('checkout-error')).toBeInTheDocument();
            });

            expect(screen.getByTestId('checkout-button')).not.toBeDisabled();
        });
    });

    describe('accessibility', () => {
        it('should have correct button type', () => {
            render(<CheckoutButton {...defaultProps} />);
            expect(screen.getByTestId('checkout-button')).toHaveAttribute('type', 'button');
        });

        it('should have proper disabled state attributes', () => {
            render(<CheckoutButton {...defaultProps} disabled={true} />);
            const button = screen.getByTestId('checkout-button');
            expect(button).toBeDisabled();
            expect(button).toHaveStyle({ cursor: 'not-allowed' });
        });

        it('should have proper loading state attributes', async () => {
            let resolveCheckout: (value: CheckoutResult) => void;
            const checkoutPromise = new Promise<CheckoutResult>((resolve) => {
                resolveCheckout = resolve;
            });
            mockOnCheckout.mockReturnValue(checkoutPromise);

            render(<CheckoutButton {...defaultProps} onCheckout={mockOnCheckout} />);

            fireEvent.click(screen.getByTestId('checkout-button'));

            await waitFor(() => {
                const button = screen.getByTestId('checkout-button');
                expect(button).toBeDisabled();
                expect(button).toHaveStyle({ cursor: 'not-allowed' });
            });

            resolveCheckout?.({ url: 'https://checkout.example.com' });
        });
    });
});
