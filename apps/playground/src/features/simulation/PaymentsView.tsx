import type { QZPayCustomer, QZPayPayment } from '@qazuor/qzpay-core';
import { ArrowRight, DollarSign, Plus, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useConfigStore } from '../../stores/config.store';
import { useEventsStore } from '../../stores/events.store';
import { PaymentModal, type PaymentResult } from './PaymentModal';

export function PaymentsView() {
    const { t } = useTranslation('simulation');
    const { t: tc } = useTranslation('common');
    const { billing, isInitialized, defaults, timeSimulation } = useConfigStore();
    const { events } = useEventsStore();
    const [payments, setPayments] = useState<QZPayPayment[]>([]);
    const [customers, setCustomers] = useState<QZPayCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // One-time payment state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        customerId: '',
        amount: '',
        description: '',
        currency: 'USD' as string
    });
    const [pendingPayment, setPendingPayment] = useState<{
        customerId: string;
        amount: number;
        currency: string;
        description: string;
    } | null>(null);

    const loadData = useCallback(async () => {
        if (!billing) return;
        setIsLoading(true);
        try {
            const [paymentsResult, custResult] = await Promise.all([billing.payments.list(), billing.customers.list()]);
            setPayments(paymentsResult.data);
            setCustomers(custResult.data);
        } finally {
            setIsLoading(false);
        }
    }, [billing]);

    // Initial load
    useEffect(() => {
        if (isInitialized) {
            loadData();
        }
    }, [isInitialized, loadData]);

    // Refresh when payment events occur
    useEffect(() => {
        const paymentEvents = events.filter((e) => e.type === 'payment.succeeded' || e.type === 'payment.failed');
        if (paymentEvents.length > 0 && isInitialized) {
            loadData();
        }
    }, [events, isInitialized, loadData]);

    // Track simulated date changes to refresh data when time advances
    const prevSimulatedDate = useRef<Date | null>(null);
    useEffect(() => {
        const currentDate = timeSimulation.simulatedDate;
        if (
            prevSimulatedDate.current !== null &&
            currentDate !== null &&
            currentDate.getTime() !== prevSimulatedDate.current.getTime() &&
            isInitialized
        ) {
            loadData();
        }
        prevSimulatedDate.current = currentDate;
    }, [timeSimulation.simulatedDate, isInitialized, loadData]);

    const getCustomerName = (customerId: string) => {
        const customer = customers.find((c) => c.id === customerId);
        return customer?.name || customer?.email || customerId.slice(0, 12);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'succeeded':
                return 'badge-success';
            case 'pending':
                return 'badge-warning';
            case 'failed':
                return 'badge-error';
            case 'refunded':
            case 'partially_refunded':
                return 'bg-purple-900/50 text-purple-400';
            case 'canceled':
                return 'bg-gray-700 text-gray-300';
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

    // Handle opening create payment modal
    const handleOpenCreateModal = () => {
        setFormData({
            customerId: customers[0]?.id ?? '',
            amount: '',
            description: '',
            currency: defaults.currency || 'USD'
        });
        setIsCreateModalOpen(true);
    };

    // Handle submitting the payment form
    const handleCreatePayment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.amount) return;

        const amountInCents = Math.round(Number.parseFloat(formData.amount) * 100);
        if (amountInCents <= 0) return;

        setPendingPayment({
            customerId: formData.customerId,
            amount: amountInCents,
            currency: formData.currency,
            description: formData.description || t('payments.oneTime.defaultDescription', 'One-time payment')
        });
        setIsCreateModalOpen(false);
        setIsPaymentModalOpen(true);
    };

    // Handle payment completion
    const handlePaymentComplete = async (result: PaymentResult) => {
        if (result.status === 'succeeded') {
            loadData();
        } else if (result.error) {
            alert(result.error);
        }
        setPendingPayment(null);
        setIsPaymentModalOpen(false);
    };

    const canCreatePayment = customers.length > 0;

    if (!isInitialized) {
        return (
            <EmptyState
                icon={DollarSign}
                title={t('customers.setupCatalogFirst.title')}
                description={t('customers.setupCatalogFirst.description')}
            />
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <PageHeader
                title={t('payments.title')}
                description={t('payments.description')}
                icon={DollarSign}
                actions={
                    <div className="flex items-center gap-2">
                        {canCreatePayment && (
                            <button type="button" onClick={handleOpenCreateModal} className="btn btn-primary">
                                <Plus className="h-4 w-4" />
                                {t('payments.oneTime.create', 'One-time Payment')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={loadData}
                            className="btn btn-ghost p-2"
                            title={t('payments.refresh') || 'Refresh'}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                }
                helpTitle={t('payments.helpTitle')}
                helpContent={
                    <div className="space-y-2">
                        <p>{t('payments.helpContent')}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="badge badge-success">succeeded</span>
                                <span>{t('payments.statuses.succeeded')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="badge badge-warning">pending</span>
                                <span>{t('payments.statuses.pending')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="badge badge-error">failed</span>
                                <span>{t('payments.statuses.failed')}</span>
                            </div>
                        </div>
                    </div>
                }
            />

            {/* Payments List */}
            {isLoading ? (
                <div className="card p-8">
                    <div className="text-center">
                        <p style={{ color: 'var(--color-text-secondary)' }}>{t('payments.loading')}</p>
                    </div>
                </div>
            ) : payments.length === 0 ? (
                <EmptyState
                    icon={DollarSign}
                    title={t('payments.empty.title')}
                    description={t('payments.empty.description')}
                    tips={[t('payments.tips.tip1'), t('payments.tips.tip2'), t('payments.tips.tip3')]}
                />
            ) : (
                <div className="space-y-3">
                    {payments.map((payment) => (
                        <div key={payment.id} className="card p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-10 w-10 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                    >
                                        <DollarSign className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                                    </div>
                                    <div>
                                        <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                                            {formatAmount(payment.amount, payment.currency)}
                                        </div>
                                        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {getCustomerName(payment.customerId)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`badge ${getStatusBadge(payment.status)}`}>{payment.status}</span>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {payment.createdAt.toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                {payment.id}
                            </p>
                        </div>
                    ))}

                    {/* Hint to check events */}
                    <div className="card p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                        <ArrowRight className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                        <div>
                            <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {t('payments.viewEvents.title')}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                {t('payments.viewEvents.description')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Create One-time Payment Modal */}
            {isCreateModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                                {t('payments.oneTime.modalTitle', 'Create One-time Payment')}
                            </h3>
                            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-ghost p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePayment}>
                            <div className="modal-body space-y-4">
                                <div>
                                    <label htmlFor="paymentCustomer" className="label">
                                        {t('payments.oneTime.customerLabel', 'Customer')}
                                    </label>
                                    <select
                                        id="paymentCustomer"
                                        value={formData.customerId}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, customerId: e.target.value }))}
                                        className="select"
                                    >
                                        {customers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name || customer.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="paymentAmount" className="label">
                                            {t('payments.oneTime.amountLabel', 'Amount')}
                                        </label>
                                        <input
                                            id="paymentAmount"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={formData.amount}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                                            placeholder="0.00"
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="paymentCurrency" className="label">
                                            {t('payments.oneTime.currencyLabel', 'Currency')}
                                        </label>
                                        <select
                                            id="paymentCurrency"
                                            value={formData.currency}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                                            className="select"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="ARS">ARS</option>
                                            <option value="MXN">MXN</option>
                                            <option value="BRL">BRL</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="paymentDescription" className="label">
                                        {t('payments.oneTime.descriptionLabel', 'Description')}{' '}
                                        <span className="text-gray-500">({t('payments.oneTime.optional', 'optional')})</span>
                                    </label>
                                    <input
                                        id="paymentDescription"
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                        placeholder={t('payments.oneTime.descriptionPlaceholder', 'Product purchase, donation, etc.')}
                                        className="input"
                                    />
                                </div>

                                {formData.amount && Number.parseFloat(formData.amount) > 0 && (
                                    <div
                                        className="p-3 rounded-lg border"
                                        style={{ backgroundColor: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}
                                    >
                                        <div className="flex justify-between items-center font-semibold">
                                            <span style={{ color: 'var(--color-text)' }}>{t('payments.oneTime.totalLabel', 'Total')}</span>
                                            <span style={{ color: 'var(--color-accent)' }}>
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: formData.currency }).format(
                                                    Number.parseFloat(formData.amount)
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">
                                    {tc('buttons.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={!formData.customerId || !formData.amount || Number.parseFloat(formData.amount) <= 0}
                                >
                                    {t('payments.oneTime.proceedToPayment', 'Proceed to Payment')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {pendingPayment && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => {
                        setIsPaymentModalOpen(false);
                        setPendingPayment(null);
                    }}
                    customerId={pendingPayment.customerId}
                    amount={pendingPayment.amount}
                    currency={pendingPayment.currency}
                    description={pendingPayment.description}
                    onPaymentComplete={handlePaymentComplete}
                />
            )}
        </div>
    );
}
