import type { QZPayInvoice } from '@qazuor/qzpay-core';
import { InvoiceList } from '@qazuor/qzpay-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

// Mock invoices
const mockInvoices: QZPayInvoice[] = [
    {
        id: 'inv_open_001',
        customerId: 'cust_123',
        subscriptionId: 'sub_001',
        status: 'open',
        currency: 'USD',
        amountDue: 4999,
        amountPaid: 0,
        lineItems: [],
        metadata: {},
        createdAt: new Date('2024-01-15')
    },
    {
        id: 'inv_paid_002',
        customerId: 'cust_123',
        subscriptionId: 'sub_001',
        status: 'paid',
        currency: 'USD',
        amountDue: 4999,
        amountPaid: 4999,
        lineItems: [],
        metadata: {},
        createdAt: new Date('2024-01-01'),
        paidAt: new Date('2024-01-01')
    },
    {
        id: 'inv_paid_003',
        customerId: 'cust_123',
        status: 'paid',
        currency: 'EUR',
        amountDue: 9900,
        amountPaid: 9900,
        lineItems: [],
        metadata: {},
        createdAt: new Date('2023-12-15'),
        paidAt: new Date('2023-12-15')
    },
    {
        id: 'inv_draft_004',
        customerId: 'cust_123',
        status: 'draft',
        currency: 'USD',
        amountDue: 2500,
        amountPaid: 0,
        lineItems: [],
        metadata: {},
        createdAt: new Date('2024-01-20')
    },
    {
        id: 'inv_uncollect_005',
        customerId: 'cust_123',
        status: 'uncollectible',
        currency: 'USD',
        amountDue: 7500,
        amountPaid: 0,
        lineItems: [],
        metadata: {},
        createdAt: new Date('2023-11-01')
    }
];

export function InvoiceListPage() {
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false);
    const [limit, setLimit] = useState<number>(0);

    const handlePayInvoice = (invoice: QZPayInvoice) => {
        setLastAction(`Pay invoice: ${invoice.id}`);
    };

    const handleDownloadInvoice = (invoice: QZPayInvoice) => {
        setLastAction(`Download invoice: ${invoice.id}`);
    };

    return (
        <div className="container">
            <nav>
                <Link to="/">← Back</Link>
            </nav>
            <h1>Invoice List Test</h1>

            <div style={{ marginBottom: '24px', display: 'flex', gap: '24px' }}>
                <label>
                    <input
                        type="checkbox"
                        checked={showOnlyUnpaid}
                        onChange={(e) => setShowOnlyUnpaid(e.target.checked)}
                        data-testid="show-only-unpaid"
                    />{' '}
                    Show only unpaid
                </label>

                <label>
                    Limit:{' '}
                    <input
                        type="number"
                        min="0"
                        value={limit}
                        onChange={(e) => setLimit(Number.parseInt(e.target.value) || 0)}
                        style={{ width: '60px' }}
                        data-testid="invoice-limit"
                    />
                </label>
            </div>

            <InvoiceList
                customerId="cust_123"
                invoices={mockInvoices}
                showOnlyUnpaid={showOnlyUnpaid}
                limit={limit || undefined}
                onPayInvoice={handlePayInvoice}
                onDownloadInvoice={handleDownloadInvoice}
            />

            {lastAction && (
                <div
                    data-testid="invoice-action"
                    style={{ marginTop: '24px', padding: '16px', backgroundColor: '#dbeafe', borderRadius: '4px' }}
                >
                    <h3>Last Action:</h3>
                    <p>{lastAction}</p>
                </div>
            )}
        </div>
    );
}
