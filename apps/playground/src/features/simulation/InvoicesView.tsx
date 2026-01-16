import type { QZPayCustomer, QZPayInvoice } from '@qazuor/qzpay-core';
import { ArrowRight, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useConfigStore } from '../../stores/config.store';

export function InvoicesView() {
    const { t } = useTranslation('simulation');
    const { billing, isInitialized } = useConfigStore();
    const [invoices, setInvoices] = useState<QZPayInvoice[]>([]);
    const [customers, setCustomers] = useState<QZPayCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadData = async () => {
        if (!billing) return;
        setIsLoading(true);
        try {
            const [invoicesResult, custResult] = await Promise.all([billing.invoices.list(), billing.customers.list()]);
            setInvoices(invoicesResult.data);
            setCustomers(custResult.data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isInitialized) {
            loadData();
        }
    }, [isInitialized]);

    const getCustomerName = (customerId: string) => {
        const customer = customers.find((c) => c.id === customerId);
        return customer?.name || customer?.email || customerId.slice(0, 12);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return 'badge-success';
            case 'open':
                return 'badge-primary';
            case 'draft':
                return 'bg-gray-700 text-gray-300';
            case 'void':
                return 'badge-error';
            case 'uncollectible':
                return 'badge-warning';
            default:
                return 'bg-gray-700 text-gray-300';
        }
    };

    const formatAmount = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount / 100);
    };

    if (!isInitialized) {
        return (
            <EmptyState
                icon={FileText}
                title={t('customers.setupCatalogFirst.title')}
                description={t('customers.setupCatalogFirst.description')}
            />
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <PageHeader
                title={t('invoices.title')}
                description={t('invoices.description')}
                icon={FileText}
                helpTitle={t('invoices.helpTitle')}
                helpContent={
                    <div className="space-y-2">
                        <p>{t('invoices.helpContent')}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="badge badge-success">paid</span>
                                <span>{t('invoices.statuses.paid')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="badge badge-primary">open</span>
                                <span>{t('invoices.statuses.open')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="badge badge-error">void</span>
                                <span>{t('invoices.statuses.void')}</span>
                            </div>
                        </div>
                    </div>
                }
            />

            {/* Invoices List */}
            {isLoading ? (
                <div className="card p-8">
                    <div className="text-center">
                        <p style={{ color: 'var(--color-text-secondary)' }}>{t('invoices.loading')}</p>
                    </div>
                </div>
            ) : invoices.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title={t('invoices.empty.title')}
                    description={t('invoices.empty.description')}
                    tips={[t('invoices.tips.tip1'), t('invoices.tips.tip2'), t('invoices.tips.tip3')]}
                />
            ) : (
                <div className="space-y-3">
                    {invoices.map((invoice) => (
                        <div key={invoice.id} className="card p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-10 w-10 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                    >
                                        <FileText className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                                    </div>
                                    <div>
                                        <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                                            {formatAmount(invoice.total, invoice.currency)}
                                        </div>
                                        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {getCustomerName(invoice.customerId)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`badge ${getStatusBadge(invoice.status)}`}>{invoice.status}</span>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {invoice.createdAt.toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                {invoice.id}
                            </p>
                        </div>
                    ))}

                    {/* Hint to check payments */}
                    <div className="card p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                        <ArrowRight className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                        <div>
                            <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {t('invoices.viewPayments.title')}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                {t('invoices.viewPayments.description')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
