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
 * Get status badge style
 */
function getStatusStyle(status: QZPayInvoiceStatus): { backgroundColor: string; color: string } {
    switch (status) {
        case 'paid':
            return { backgroundColor: '#dcfce7', color: '#166534' };
        case 'open':
            return { backgroundColor: '#fef3c7', color: '#92400e' };
        case 'draft':
            return { backgroundColor: '#e0e7ff', color: '#3730a3' };
        case 'void':
        case 'uncollectible':
            return { backgroundColor: '#f3f4f6', color: '#6b7280' };
        default:
            return { backgroundColor: '#e5e7eb', color: '#374151' };
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
            <div className={className} data-testid="invoice-list-loading">
                Loading invoices...
            </div>
        );
    }

    if (error) {
        return (
            <div className={className} data-testid="invoice-list-error">
                <div style={{ color: '#dc2626' }}>Failed to load invoices: {error.message}</div>
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
            <div className={className} data-testid="invoice-list-empty">
                {emptyState ?? <p>No invoices found</p>}
            </div>
        );
    }

    return (
        <div className={className} data-testid="invoice-list">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr
                        style={{
                            borderBottom: '2px solid #e5e7eb',
                            textAlign: 'left'
                        }}
                    >
                        <th style={{ padding: '12px 8px' }}>Invoice</th>
                        <th style={{ padding: '12px 8px' }}>Date</th>
                        <th style={{ padding: '12px 8px' }}>Status</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount</th>
                        {(onPayInvoice || onDownloadInvoice) && <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {displayInvoices.map((invoice) => {
                        const statusStyle = getStatusStyle(invoice.status);
                        const canPay = invoice.status === 'open';

                        return (
                            <tr key={invoice.id} style={{ borderBottom: '1px solid #e5e7eb' }} data-testid={`invoice-row-${invoice.id}`}>
                                <td style={{ padding: '12px 8px' }}>
                                    <div style={{ fontWeight: 500 }}>{invoice.id.slice(0, 8)}</div>
                                    {invoice.subscriptionId && (
                                        <div
                                            style={{
                                                fontSize: '14px',
                                                color: '#6b7280'
                                            }}
                                        >
                                            Subscription: {invoice.subscriptionId.slice(0, 8)}
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '12px 8px', color: '#6b7280' }}>{formatDate(invoice.createdAt)}</td>
                                <td style={{ padding: '12px 8px' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            textTransform: 'capitalize',
                                            ...statusStyle
                                        }}
                                        data-testid={`invoice-status-${invoice.id}`}
                                    >
                                        {invoice.status}
                                    </span>
                                </td>
                                <td
                                    style={{
                                        padding: '12px 8px',
                                        textAlign: 'right',
                                        fontWeight: 500
                                    }}
                                >
                                    {formatAmount(invoice.amountDue, invoice.currency)}
                                </td>
                                {(onPayInvoice || onDownloadInvoice) && (
                                    <td
                                        style={{
                                            padding: '12px 8px',
                                            textAlign: 'right'
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            {onPayInvoice && canPay && (
                                                <button
                                                    type="button"
                                                    onClick={() => onPayInvoice(invoice)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#2563eb',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px'
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
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: 'transparent',
                                                        color: '#2563eb',
                                                        border: '1px solid #2563eb',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px'
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
