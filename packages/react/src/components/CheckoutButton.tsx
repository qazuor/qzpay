/**
 * Checkout Button Component
 *
 * Simple button to initiate a checkout session
 */
import { type ReactNode, useState } from 'react';
import type { CheckoutButtonProps, CheckoutParams } from '../types.js';

/**
 * Checkout button that initiates a checkout session
 *
 * Note: This component requires you to provide an onCheckout handler
 * that handles the actual checkout session creation (e.g., via Stripe, MercadoPago, etc.)
 *
 * @example
 * ```tsx
 * // Basic subscription checkout
 * <CheckoutButton
 *   mode="subscription"
 *   priceId={price.id}
 *   successUrl="/success"
 *   cancelUrl="/cancel"
 *   onCheckout={async (params) => {
 *     // Call your backend to create a checkout session
 *     const { url } = await api.createCheckoutSession(params);
 *     return { url };
 *   }}
 * >
 *   Subscribe Now
 * </CheckoutButton>
 *
 * // One-time payment with customer
 * <CheckoutButton
 *   mode="payment"
 *   priceId={productPrice.id}
 *   customerId={customerId}
 *   successUrl="/thank-you"
 *   cancelUrl="/cart"
 *   onCheckout={handleCheckout}
 * >
 *   Buy Now
 * </CheckoutButton>
 * ```
 */
export function CheckoutButton({
    mode,
    priceId,
    quantity = 1,
    successUrl,
    cancelUrl,
    customerId,
    customerEmail,
    promoCodeId,
    allowPromoCodes = false,
    children = 'Checkout',
    onCheckout,
    onError,
    className,
    disabled = false
}: CheckoutButtonProps): ReactNode {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClick = async () => {
        if (!onCheckout) {
            setError('No checkout handler provided');
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const params: CheckoutParams = {
                mode,
                lineItems: [{ priceId, quantity }],
                successUrl,
                cancelUrl,
                allowPromoCodes
            };
            if (customerId !== undefined) {
                params.customerId = customerId;
            }
            if (customerEmail !== undefined) {
                params.customerEmail = customerEmail;
            }
            if (promoCodeId !== undefined) {
                params.promoCodeId = promoCodeId;
            }

            const result = await onCheckout(params);

            // Redirect to checkout URL if provided
            if (typeof window !== 'undefined' && result.url) {
                window.location.href = result.url;
            }
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error('Checkout failed');
            setError(errorObj.message);
            onError?.(errorObj);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={className}>
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled || isLoading || !onCheckout}
                aria-busy={isLoading}
                aria-disabled={disabled || isLoading || !onCheckout}
                aria-describedby={error ? 'checkout-error' : undefined}
                style={{
                    padding: '12px 24px',
                    backgroundColor: disabled || isLoading ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 500
                }}
                data-testid="checkout-button"
            >
                {isLoading ? 'Loading...' : children}
            </button>

            {error && (
                <div
                    id="checkout-error"
                    role="alert"
                    aria-live="assertive"
                    style={{
                        color: '#dc2626',
                        fontSize: '14px',
                        marginTop: '8px'
                    }}
                    data-testid="checkout-error"
                >
                    {error}
                </div>
            )}
        </div>
    );
}
