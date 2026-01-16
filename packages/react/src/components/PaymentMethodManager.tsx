import type { QZPayPaymentMethod } from '@qazuor/qzpay-core';
/**
 * Payment Method Manager Component
 *
 * Displays and manages customer payment methods
 */
import { type ReactNode, useState } from 'react';
import type { PaymentMethodManagerProps } from '../types.js';

/**
 * Format payment method for display
 */
function formatPaymentMethod(method: QZPayPaymentMethod): { title: string; subtitle: string } {
    if (method.card) {
        const brand = method.card.brand.charAt(0).toUpperCase() + method.card.brand.slice(1);
        return {
            title: `${brand} **** ${method.card.last4}`,
            subtitle: `Expires ${method.card.expMonth.toString().padStart(2, '0')}/${method.card.expYear}`
        };
    }
    if (method.bankAccount) {
        const bankName = method.bankAccount.bankName ?? 'Bank Account';
        return {
            title: `${bankName} **** ${method.bankAccount.last4}`,
            subtitle: `${method.bankAccount.accountType.charAt(0).toUpperCase()}${method.bankAccount.accountType.slice(1)} account`
        };
    }
    return {
        title: `Payment Method ${method.id.slice(0, 8)}`,
        subtitle: method.type
    };
}

/**
 * Get card brand icon (simple text representation)
 */
function getCardIcon(method: QZPayPaymentMethod): string {
    if (method.card) {
        switch (method.card.brand) {
            case 'visa':
                return 'VISA';
            case 'mastercard':
                return 'MC';
            case 'amex':
                return 'AMEX';
            case 'discover':
                return 'DISC';
            default:
                return 'CARD';
        }
    }
    if (method.bankAccount) {
        return 'BANK';
    }
    return 'PAY';
}

/**
 * Check if a card is expiring soon (within 60 days)
 */
function isExpiringSoon(method: QZPayPaymentMethod): boolean {
    if (!method.card) return false;

    const now = new Date();
    const expDate = new Date(method.card.expYear, method.card.expMonth - 1);
    const daysUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysUntilExpiry <= 60 && daysUntilExpiry >= 0;
}

/**
 * Check if a card is expired
 */
function isExpired(method: QZPayPaymentMethod): boolean {
    if (!method.card) return false;

    const now = new Date();
    const expDate = new Date(method.card.expYear, method.card.expMonth, 0); // Last day of exp month

    return expDate < now;
}

/**
 * Payment method manager component for managing customer payment methods
 *
 * @example
 * ```tsx
 * // Basic usage with payment methods from API
 * <PaymentMethodManager
 *   customerId={customerId}
 *   paymentMethods={methods}
 *   showAddButton={true}
 *   onAddPaymentMethod={() => openAddMethodModal()}
 *   onRemovePaymentMethod={async (id) => api.removePaymentMethod(id)}
 *   onSetDefaultPaymentMethod={async (id) => api.setDefaultPaymentMethod(id)}
 *   allowRemove={true}
 *   allowSetDefault={true}
 * />
 * ```
 */
export function PaymentMethodManager({
    paymentMethods,
    isLoading = false,
    showAddButton = true,
    onAddPaymentMethod,
    onRemovePaymentMethod,
    onSetDefaultPaymentMethod,
    allowRemove = true,
    allowSetDefault = true,
    className,
    emptyState
}: PaymentMethodManagerProps): ReactNode {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const handleRemove = async (method: QZPayPaymentMethod) => {
        if (!onRemovePaymentMethod) return;

        setProcessingId(method.id);
        setActionError(null);

        try {
            await onRemovePaymentMethod(method.id);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to remove payment method');
            setActionError(error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleSetDefault = async (method: QZPayPaymentMethod) => {
        if (!onSetDefaultPaymentMethod || method.isDefault) return;

        setProcessingId(method.id);
        setActionError(null);

        try {
            await onSetDefaultPaymentMethod(method.id);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to set default');
            setActionError(error.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (isLoading) {
        return (
            <output className={className} data-testid="payment-method-manager-loading" aria-live="polite" aria-busy="true">
                Loading payment methods...
            </output>
        );
    }

    if (!paymentMethods || paymentMethods.length === 0) {
        return (
            <div className={className} data-testid="payment-method-manager-empty">
                {emptyState ?? (
                    <div style={{ textAlign: 'center', padding: '24px' }}>
                        <p style={{ color: '#6b7280', marginBottom: '16px' }}>No payment methods added</p>
                        {showAddButton && onAddPaymentMethod && (
                            <button
                                type="button"
                                onClick={onAddPaymentMethod}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                                data-testid="add-payment-method-button"
                            >
                                Add Payment Method
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={className} data-testid="payment-method-manager">
            {actionError && (
                <div
                    role="alert"
                    aria-live="assertive"
                    style={{
                        color: '#dc2626',
                        padding: '8px',
                        marginBottom: '16px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '4px'
                    }}
                    data-testid="payment-method-manager-action-error"
                >
                    {actionError}
                </div>
            )}

            <ul
                aria-label="Payment methods"
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyle: 'none', margin: 0, padding: 0 }}
            >
                {paymentMethods.map((method) => {
                    const { title, subtitle } = formatPaymentMethod(method);
                    const icon = getCardIcon(method);
                    const expiring = isExpiringSoon(method);
                    const expired = isExpired(method);
                    const isProcessing = processingId === method.id;

                    return (
                        <li
                            key={method.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '16px',
                                border: method.isDefault ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                borderRadius: '8px',
                                backgroundColor: expired ? '#fef2f2' : 'white'
                            }}
                            data-testid={`payment-method-${method.id}`}
                        >
                            {/* Icon */}
                            <div
                                style={{
                                    width: '48px',
                                    height: '32px',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: '#374151',
                                    marginRight: '16px'
                                }}
                            >
                                {icon}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <span style={{ fontWeight: 500 }}>{title}</span>
                                    {method.isDefault && (
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                padding: '2px 8px',
                                                backgroundColor: '#dbeafe',
                                                color: '#1d4ed8',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            Default
                                        </span>
                                    )}
                                    {expired && (
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                padding: '2px 8px',
                                                backgroundColor: '#fee2e2',
                                                color: '#dc2626',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            Expired
                                        </span>
                                    )}
                                    {!expired && expiring && (
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                padding: '2px 8px',
                                                backgroundColor: '#fef3c7',
                                                color: '#92400e',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            Expiring Soon
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '14px', color: '#6b7280' }}>{subtitle}</div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {allowSetDefault && !method.isDefault && onSetDefaultPaymentMethod && (
                                    <button
                                        type="button"
                                        onClick={() => handleSetDefault(method)}
                                        disabled={isProcessing}
                                        aria-label={`Set ${title} as default payment method`}
                                        aria-busy={isProcessing}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: 'transparent',
                                            color: '#2563eb',
                                            border: '1px solid #2563eb',
                                            borderRadius: '4px',
                                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            opacity: isProcessing ? 0.5 : 1
                                        }}
                                        data-testid={`set-default-${method.id}`}
                                    >
                                        Set Default
                                    </button>
                                )}
                                {allowRemove && onRemovePaymentMethod && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(method)}
                                        disabled={isProcessing}
                                        aria-label={`Remove ${title} payment method`}
                                        aria-busy={isProcessing}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: 'transparent',
                                            color: '#dc2626',
                                            border: '1px solid #dc2626',
                                            borderRadius: '4px',
                                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            opacity: isProcessing ? 0.5 : 1
                                        }}
                                        data-testid={`remove-${method.id}`}
                                    >
                                        {isProcessing ? 'Removing...' : 'Remove'}
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {showAddButton && onAddPaymentMethod && (
                <button
                    type="button"
                    onClick={onAddPaymentMethod}
                    style={{
                        width: '100%',
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: 'transparent',
                        color: '#2563eb',
                        border: '2px dashed #2563eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                    }}
                    data-testid="add-payment-method-button"
                >
                    + Add Payment Method
                </button>
            )}
        </div>
    );
}
