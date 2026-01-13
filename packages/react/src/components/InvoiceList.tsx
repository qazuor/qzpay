import type { QZPayInvoiceStatus } from '@qazuor/qzpay-core';
/**
 * Invoice List Component
 *
 * Displays a list of customer invoices
 */
import type { ReactNode } from 'react';
import { useInvoices } from '../hooks/useInvoices.js';
import type { InvoiceListProps } from '../types.js';

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
 * Format date for display
 */
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(new Date(date));
}

/**
 * Get status badge style (dark theme compatible)
 */
function getStatusStyle(status: QZPayInvoiceStatus): { backgroundColor: string; color: string; borderColor: string } {
    switch (status) {
        case 'paid':
            return { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)' };
        case 'open':
            return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' };
        case 'draft':
            return { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)' };
        case 'void':
        case 'uncollectible':
            return { backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', borderColor: 'rgba(107, 114, 128, 0.3)' };
        default:
            return { backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', borderColor: 'rgba(107, 114, 128, 0.3)' };
    }
}

/**
 * Invoice list component for displaying customer invoices
 *
 * @example
 * ```tsx
 * // Basic usage
 * <InvoiceList customerId={customerId} />
 *
 * // Show only unpaid invoices with pay action
 * <InvoiceList
 *   customerId={customerId}
 *   showOnlyUnpaid={true}
 *   onPayInvoice={(invoice) => handlePayInvoice(invoice)}
 * />
 *
 * // With download action
 * <InvoiceList
 *   customerId={customerId}
 *   limit={5}
 *   onDownloadInvoice={(invoice) => downloadPDF(invoice)}
 * />
 * ```
 */
export function InvoiceList({
    customerId,
    invoices: providedInvoices,
    showOnlyUnpaid = false,
    limit,
    onPayInvoice,
    onDownloadInvoice,
    className,
    emptyState
}: InvoiceListProps): ReactNode {
    const { data: fetchedInvoices, isLoading, error } = useInvoices({ customerId });

    const invoices = providedInvoices ?? fetchedInvoices;

    if (isLoading) {
        return (
            <div
                className={className}
                data-testid="invoice-list-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
                style={{
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    textAlign: 'center',
                    opacity: 0.7
                }}
            >
                Loading invoices...
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={className}
                data-testid="invoice-list-error"
                role="alert"
                aria-live="assertive"
                style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444'
                }}
            >
                Failed to load invoices: {error.message}
            </div>
        );
    }

    // Filter and limit invoices
    let displayInvoices = invoices ?? [];

    if (showOnlyUnpaid) {
        displayInvoices = displayInvoices.filter((inv) => inv.status === 'open' || inv.status === 'uncollectible');
    }

    if (limit && limit > 0) {
        displayInvoices = displayInvoices.slice(0, limit);
    }

    if (displayInvoices.length === 0) {
        return (
            <div
                className={className}
                data-testid="invoice-list-empty"
                style={{
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    textAlign: 'center',
                    opacity: 0.7
                }}
            >
                {emptyState ?? <p style={{ margin: 0 }}>No invoices found</p>}
            </div>
        );
    }

    return (
        <div
            className={className}
            data-testid="invoice-list"
            style={{
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)',
                overflow: 'hidden'
            }}
        >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr
                        style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}
                    >
                        <th
                            style={{
                                padding: '14px 16px',
                                textAlign: 'left',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                opacity: 0.6,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            Invoice
                        </th>
                        <th
                            style={{
                                padding: '14px 16px',
                                textAlign: 'left',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                opacity: 0.6,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            Date
                        </th>
                        <th
                            style={{
                                padding: '14px 16px',
                                textAlign: 'left',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                opacity: 0.6,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            Status
                        </th>
                        <th
                            style={{
                                padding: '14px 16px',
                                textAlign: 'right',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                opacity: 0.6,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            Amount
                        </th>
                        {(onPayInvoice || onDownloadInvoice) && (
                            <th
                                style={{
                                    padding: '14px 16px',
                                    textAlign: 'right',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    opacity: 0.6,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                            >
                                Actions
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {displayInvoices.map((invoice, index) => {
                        const statusStyle = getStatusStyle(invoice.status);
                        const canPay = invoice.status === 'open';
                        const isLast = index === displayInvoices.length - 1;

                        return (
                            <tr
                                key={invoice.id}
                                style={{
                                    borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                                    transition: 'background 0.2s ease'
                                }}
                                data-testid={`invoice-row-${invoice.id}`}
                            >
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{invoice.id.slice(0, 8)}...</div>
                                    {invoice.subscriptionId && (
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '2px' }}>
                                            Sub: {invoice.subscriptionId.slice(0, 8)}...
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '14px 16px', opacity: 0.7, fontSize: '0.875rem' }}>
                                    {formatDate(invoice.createdAt)}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            textTransform: 'capitalize',
                                            backgroundColor: statusStyle.backgroundColor,
                                            color: statusStyle.color,
                                            border: `1px solid ${statusStyle.borderColor}`
                                        }}
                                        data-testid={`invoice-status-${invoice.id}`}
                                    >
                                        {invoice.status}
                                    </span>
                                </td>
                                <td
                                    style={{
                                        padding: '14px 16px',
                                        textAlign: 'right',
                                        fontWeight: 600,
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {formatAmount(invoice.amountDue, invoice.currency)}
                                </td>
                                {(onPayInvoice || onDownloadInvoice) && (
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            {onPayInvoice && canPay && (
                                                <button
                                                    type="button"
                                                    onClick={() => onPayInvoice(invoice)}
                                                    aria-label={`Pay invoice ${invoice.id}`}
                                                    style={{
                                                        padding: '6px 14px',
                                                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                                    }}
                                                    data-testid={`invoice-pay-${invoice.id}`}
                                                >
                                                    Pay
                                                </button>
                                            )}
                                            {onDownloadInvoice && (
                                                <button
                                                    type="button"
                                                    onClick={() => onDownloadInvoice(invoice)}
                                                    aria-label={`Download invoice ${invoice.id}`}
                                                    style={{
                                                        padding: '6px 14px',
                                                        backgroundColor: 'transparent',
                                                        color: '#3b82f6',
                                                        border: '1px solid rgba(59, 130, 246, 0.5)',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    data-testid={`invoice-download-${invoice.id}`}
                                                >
                                                    Download
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
