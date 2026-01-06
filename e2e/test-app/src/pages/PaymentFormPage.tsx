import type { QZPayPayment, QZPayPaymentMethod } from '@qazuor/qzpay-core';
import { PaymentForm } from '@qazuor/qzpay-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

// Mock payment methods
const mockPaymentMethods: QZPayPaymentMethod[] = [
    {
        id: 'pm_visa_4242',
        customerId: 'cust_123',
        type: 'card',
        isDefault: true,
        card: {
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2027
        },
        metadata: {},
        createdAt: new Date()
    },
    {
        id: 'pm_mastercard_5555',
        customerId: 'cust_123',
        type: 'card',
        isDefault: false,
        card: {
            brand: 'mastercard',
            last4: '5555',
            expMonth: 6,
            expYear: 2026
        },
        metadata: {},
        createdAt: new Date()
    },
    {
        id: 'pm_bank_1234',
        customerId: 'cust_123',
        type: 'bank_account',
        isDefault: false,
        bankAccount: {
            bankName: 'Chase',
            last4: '1234',
            accountType: 'checking'
        },
        metadata: {},
        createdAt: new Date()
    }
];

export function PaymentFormPage() {
    const [result, setResult] = useState<QZPayPayment | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSuccess = (payment: QZPayPayment) => {
        setResult(payment);
        setError(null);
    };

    const handleError = (err: Error) => {
        setError(err.message);
        setResult(null);
    };

    return (
        <div className="container">
            <nav>
                <Link to="/">← Back</Link>
            </nav>
            <h1>Payment Form Test</h1>

            <PaymentForm
                customerId="cust_123"
                amount={4999}
                currency="USD"
                paymentMethods={mockPaymentMethods}
                onSuccess={handleSuccess}
                onError={handleError}
                showCancel={true}
                onCancel={() => setError('Payment cancelled by user')}
            />

            {result && (
                <div
                    data-testid="payment-result"
                    style={{ marginTop: '24px', padding: '16px', backgroundColor: '#dcfce7', borderRadius: '4px' }}
                >
                    <h3>Payment Successful!</h3>
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
            )}

            {error && (
                <div
                    data-testid="payment-page-error"
                    style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fee2e2', borderRadius: '4px' }}
                >
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            )}
        </div>
    );
}
