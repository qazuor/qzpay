import type { QZPayPaymentMethod } from '@qazuor/qzpay-core';
/**
 * Payment Form Component
 *
 * Allows customers to make payments using their payment methods
 */
import { type FormEvent, type ReactNode, useState } from 'react';
import { usePayment } from '../hooks/usePayment.js';
import type { PaymentFormProps } from '../types.js';

/**
 * Format amount for display
 */
function formatAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount / 100);
}

/**
 * Format payment method for display
 */
function formatPaymentMethod(method: QZPayPaymentMethod): string {
    if (method.card) {
        const brand = method.card.brand.charAt(0).toUpperCase() + method.card.brand.slice(1);
        return `${brand} ending in ${method.card.last4}`;
    }
    if (method.bankAccount) {
        return `Bank account ending in ${method.bankAccount.last4}`;
    }
    return `Payment method ${method.id.slice(0, 8)}`;
}

/**
 * Payment form component for collecting payments
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PaymentForm
 *   customerId={customerId}
 *   amount={1999}
 *   currency="USD"
 *   paymentMethods={methods}
 *   onSuccess={(payment) => console.log('Paid!', payment)}
 * />
 *
 * // Pay an invoice
 * <PaymentForm
 *   customerId={customerId}
 *   amount={invoice.amountDue}
 *   currency={invoice.currency}
 *   paymentMethods={methods}
 *   invoiceId={invoice.id}
 *   onSuccess={handlePaymentSuccess}
 *   onError={handlePaymentError}
 * />
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Payment form requires complex state management and validation
export function PaymentForm({
    customerId,
    amount,
    currency,
    paymentMethods,
    invoiceId,
    onSuccess,
    onError,
    onCancel,
    submitText = 'Pay Now',
    showCancel = false,
    className,
    disabled = false,
    isLoadingPaymentMethods = false
}: PaymentFormProps): ReactNode {
    const { process, isLoading: isProcessing, error: paymentError } = usePayment({ customerId });

    const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Get the selected or default payment method
    const getSelectedMethod = (): QZPayPaymentMethod | undefined => {
        if (!paymentMethods) return undefined;
        if (selectedMethodId) {
            return paymentMethods.find((m) => m.id === selectedMethodId);
        }
        return paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const method = getSelectedMethod();
        if (!method) {
            setError('Please select a payment method');
            return;
        }

        try {
            const payment = await process({
                customerId,
                amount,
                currency,
                paymentMethodId: method.id,
                ...(invoiceId !== undefined && { invoiceId })
            });

            onSuccess?.(payment);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Payment failed');
            setError(error.message);
            onError?.(error);
        }
    };

    const isLoading = isLoadingPaymentMethods || isProcessing;
    const displayError = error ?? paymentError?.message;

    if (isLoadingPaymentMethods) {
        return (
            <div className={className} data-testid="payment-form-loading">
                Loading payment methods...
            </div>
        );
    }

    if (!paymentMethods || paymentMethods.length === 0) {
        return (
            <div className={className} data-testid="payment-form-no-methods">
                <p>No payment methods available. Please add a payment method first.</p>
            </div>
        );
    }

    const selectedMethod = getSelectedMethod();

    return (
        <form className={className} onSubmit={handleSubmit} data-testid="payment-form">
            <div style={{ marginBottom: '16px' }}>
                <label htmlFor="payment-amount" style={{ display: 'block', marginBottom: '4px' }}>
                    Amount
                </label>
                <div id="payment-amount" style={{ fontSize: '24px', fontWeight: 'bold' }} data-testid="payment-amount">
                    {formatAmount(amount, currency)}
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label htmlFor="payment-method-select" style={{ display: 'block', marginBottom: '4px' }}>
                    Payment Method
                </label>
                <select
                    id="payment-method-select"
                    value={selectedMethod?.id ?? ''}
                    onChange={(e) => setSelectedMethodId(e.target.value)}
                    disabled={disabled || isLoading}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ccc'
                    }}
                    data-testid="payment-method-select"
                >
                    {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                            {formatPaymentMethod(method)}
                            {method.isDefault ? ' (Default)' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {displayError && (
                <div
                    style={{
                        color: '#dc2626',
                        padding: '8px',
                        marginBottom: '16px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '4px'
                    }}
                    data-testid="payment-error"
                >
                    {displayError}
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    type="submit"
                    disabled={disabled || isLoading}
                    style={{
                        flex: 1,
                        padding: '12px 24px',
                        backgroundColor: disabled || isLoading ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '16px'
                    }}
                    data-testid="payment-submit"
                >
                    {isProcessing ? 'Processing...' : submitText}
                </button>

                {showCancel && onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isLoading}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '16px'
                        }}
                        data-testid="payment-cancel"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}
