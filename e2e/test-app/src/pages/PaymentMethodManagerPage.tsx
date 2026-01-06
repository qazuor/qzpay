import type { QZPayPaymentMethod } from '@qazuor/qzpay-core';
import { PaymentMethodManager } from '@qazuor/qzpay-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

// Mock payment methods
const initialMethods: QZPayPaymentMethod[] = [
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
            expMonth: 3,
            expYear: 2025 // Expiring soon
        },
        metadata: {},
        createdAt: new Date()
    },
    {
        id: 'pm_amex_1234',
        customerId: 'cust_123',
        type: 'card',
        isDefault: false,
        card: {
            brand: 'amex',
            last4: '1234',
            expMonth: 1,
            expYear: 2024 // Expired
        },
        metadata: {},
        createdAt: new Date()
    },
    {
        id: 'pm_bank_9999',
        customerId: 'cust_123',
        type: 'bank_account',
        isDefault: false,
        bankAccount: {
            bankName: 'Bank of America',
            last4: '9999',
            accountType: 'savings'
        },
        metadata: {},
        createdAt: new Date()
    }
];

export function PaymentMethodManagerPage() {
    const [paymentMethods, setPaymentMethods] = useState<QZPayPaymentMethod[]>(initialMethods);
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [simulateError, setSimulateError] = useState(false);

    const handleAddPaymentMethod = () => {
        setLastAction('Add payment method clicked');
        // Simulate adding a new payment method
        const newMethod: QZPayPaymentMethod = {
            id: `pm_new_${Date.now()}`,
            customerId: 'cust_123',
            type: 'card',
            isDefault: false,
            card: {
                brand: 'discover',
                last4: String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
                expMonth: 12,
                expYear: 2028
            },
            metadata: {},
            createdAt: new Date()
        };
        setPaymentMethods([...paymentMethods, newMethod]);
    };

    const handleRemovePaymentMethod = async (id: string) => {
        if (simulateError) {
            throw new Error('Simulated error: Cannot remove payment method');
        }

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        setPaymentMethods(paymentMethods.filter((m) => m.id !== id));
        setLastAction(`Removed payment method: ${id}`);
    };

    const handleSetDefaultPaymentMethod = async (id: string) => {
        if (simulateError) {
            throw new Error('Simulated error: Cannot set default');
        }

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        setPaymentMethods(
            paymentMethods.map((m) => ({
                ...m,
                isDefault: m.id === id
            }))
        );
        setLastAction(`Set default payment method: ${id}`);
    };

    return (
        <div className="container">
            <nav>
                <Link to="/">← Back</Link>
            </nav>
            <h1>Payment Method Manager Test</h1>

            <div style={{ marginBottom: '24px' }}>
                <label>
                    <input
                        type="checkbox"
                        checked={simulateError}
                        onChange={(e) => setSimulateError(e.target.checked)}
                        data-testid="simulate-error-checkbox"
                    />{' '}
                    Simulate errors
                </label>
            </div>

            <PaymentMethodManager
                paymentMethods={paymentMethods}
                showAddButton={true}
                onAddPaymentMethod={handleAddPaymentMethod}
                onRemovePaymentMethod={handleRemovePaymentMethod}
                onSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
                allowRemove={true}
                allowSetDefault={true}
            />

            {lastAction && (
                <div
                    data-testid="pm-action"
                    style={{ marginTop: '24px', padding: '16px', backgroundColor: '#dbeafe', borderRadius: '4px' }}
                >
                    <h3>Last Action:</h3>
                    <p>{lastAction}</p>
                </div>
            )}

            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
                <h3>Current Payment Methods ({paymentMethods.length})</h3>
                <pre style={{ fontSize: '12px' }} data-testid="pm-state">
                    {JSON.stringify(
                        paymentMethods.map((m) => ({ id: m.id, isDefault: m.isDefault })),
                        null,
                        2
                    )}
                </pre>
            </div>
        </div>
    );
}
