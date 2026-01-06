import { CheckoutButton } from '@qazuor/qzpay-react';
import type { CheckoutParams, CheckoutResult } from '@qazuor/qzpay-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export function CheckoutButtonPage() {
    const [lastCheckout, setLastCheckout] = useState<CheckoutParams | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [simulateError, setSimulateError] = useState(false);

    const handleCheckout = async (params: CheckoutParams): Promise<CheckoutResult> => {
        setLastCheckout(params);
        setError(null);

        if (simulateError) {
            throw new Error('Simulated checkout error');
        }

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Return mock result (without URL to prevent navigation)
        return {
            sessionId: `cs_test_${Date.now()}`
        };
    };

    const handleError = (err: Error) => {
        setError(err.message);
    };

    return (
        <div className="container">
            <nav>
                <Link to="/">← Back</Link>
            </nav>
            <h1>Checkout Button Test</h1>

            <div style={{ marginBottom: '24px' }}>
                <label>
                    <input
                        type="checkbox"
                        checked={simulateError}
                        onChange={(e) => setSimulateError(e.target.checked)}
                        data-testid="simulate-error-checkbox"
                    />{' '}
                    Simulate checkout error
                </label>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <CheckoutButton
                    mode="subscription"
                    priceId="price_monthly_pro"
                    successUrl="/success"
                    cancelUrl="/cancel"
                    onCheckout={handleCheckout}
                    onError={handleError}
                >
                    Subscribe to Pro Plan
                </CheckoutButton>

                <CheckoutButton
                    mode="payment"
                    priceId="price_one_time_product"
                    quantity={2}
                    successUrl="/thank-you"
                    cancelUrl="/cart"
                    customerId="cust_123"
                    allowPromoCodes={true}
                    onCheckout={handleCheckout}
                    onError={handleError}
                >
                    Buy Now ($99.99)
                </CheckoutButton>

                <CheckoutButton
                    mode="subscription"
                    priceId="price_enterprise"
                    successUrl="/enterprise/welcome"
                    cancelUrl="/pricing"
                    customerEmail="test@example.com"
                    onCheckout={handleCheckout}
                    onError={handleError}
                    disabled={true}
                >
                    Disabled Button
                </CheckoutButton>
            </div>

            {lastCheckout && (
                <div
                    data-testid="checkout-params"
                    style={{ marginTop: '24px', padding: '16px', backgroundColor: '#dbeafe', borderRadius: '4px' }}
                >
                    <h3>Last Checkout Params:</h3>
                    <pre>{JSON.stringify(lastCheckout, null, 2)}</pre>
                </div>
            )}

            {error && (
                <div
                    data-testid="checkout-page-error"
                    style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fee2e2', borderRadius: '4px' }}
                >
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            )}
        </div>
    );
}
