import type { QZPayCustomer } from '@qazuor/qzpay-core';
import { ArrowRight, Plus, Trash2, User, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useConfirm } from '../../hooks/useConfirm';
import { SafeFormattedText } from '../../hooks/useSafeTranslation';
import { useToast } from '../../hooks/useToast';
import { useCatalogStore } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';

export function CustomersView() {
    const { t } = useTranslation('simulation');
    const { t: tc } = useTranslation('common');
    const { billing, isInitialized } = useConfigStore();
    const { plans, prices, loadCatalog } = useCatalogStore();
    const [customers, setCustomers] = useState<QZPayCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        name: ''
    });
    const confirm = useConfirm();
    const toast = useToast();

    const loadCustomers = async () => {
        if (!billing) return;
        setIsLoading(true);
        try {
            const result = await billing.customers.list();
            setCustomers(result.data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isInitialized) {
            loadCustomers();
            loadCatalog();
        }
    }, [isInitialized, loadCatalog]);

    const handleCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!billing) return;

        try {
            await billing.customers.create({
                email: formData.email,
                name: formData.name || undefined,
                externalId: `ext_${Date.now()}`
            });
            setFormData({ email: '', name: '' });
            setIsModalOpen(false);
            loadCustomers();
            toast.success(t('customers.created', 'Customer created successfully'));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create customer');
        }
    };

    const handleDeleteCustomer = async (id: string) => {
        if (!billing) return;

        const confirmed = await confirm.show({
            title: t('customers.deleteCustomer'),
            message: t('customers.confirmDelete'),
            variant: 'danger',
            confirmText: tc('buttons.delete')
        });

        if (!confirmed) return;

        try {
            await billing.customers.delete(id);
            loadCustomers();
            toast.success(t('customers.deleted', 'Customer deleted successfully'));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete customer');
        }
    };

    // Check if catalog is ready for subscriptions
    const hasCatalog = plans.length > 0 && prices.length > 0;

    if (!isInitialized) {
        return <EmptyState icon={Users} title={tc('billingNotInitialized.title')} description={tc('billingNotInitialized.description')} />;
    }

    return (
        <div className="max-w-4xl space-y-6">
            <PageHeader
                title={t('customers.title')}
                description={t('customers.description')}
                icon={Users}
                helpTitle={t('customers.helpTitle')}
                helpContent={
                    <div className="space-y-2">
                        <p>{t('customers.helpContent')}</p>
                        <p className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                            <span>
                                <SafeFormattedText text={t('customers.helpNextStep')} />
                            </span>
                        </p>
                    </div>
                }
                actions={
                    <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                        <Plus className="h-4 w-4" />
                        {t('customers.addCustomer')}
                    </button>
                }
            />

            {/* Warning if no catalog */}
            {!hasCatalog && (
                <div
                    className="card p-4 flex items-start gap-3"
                    style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: '#eab308' }}
                >
                    <ArrowRight className="h-5 w-5 mt-0.5" style={{ color: '#eab308' }} />
                    <div>
                        <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                            {t('customers.setupCatalogFirst.title')}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            <SafeFormattedText text={t('customers.setupCatalogFirst.description')} />
                        </p>
                    </div>
                </div>
            )}

            {/* Customer List */}
            {isLoading ? (
                <div className="card p-8">
                    <div className="text-center">
                        <p style={{ color: 'var(--color-text-secondary)' }}>{t('customers.loading')}</p>
                    </div>
                </div>
            ) : customers.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title={t('customers.empty.title')}
                    description={t('customers.empty.description')}
                    action={
                        <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                            <Plus className="h-4 w-4" />
                            {t('customers.empty.createFirst')}
                        </button>
                    }
                    tips={[t('customers.tips.tip1'), t('customers.tips.tip2'), t('customers.tips.tip3')]}
                />
            ) : (
                <div className="space-y-3">
                    {customers.map((customer) => (
                        <div key={customer.id} className="card p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-10 w-10 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                    >
                                        <User className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                                    </div>
                                    <div>
                                        <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                                            {customer.name || t('customers.unnamed')}
                                        </div>
                                        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {customer.email}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                        {customer.id}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteCustomer(customer.id)}
                                        className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                        title={t('customers.deleteCustomer')}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Next step hint */}
                    {customers.length > 0 && hasCatalog && (
                        <div
                            className="card p-4 flex items-center gap-3"
                            style={{ backgroundColor: 'var(--color-accent-low)', borderColor: 'var(--color-accent)' }}
                        >
                            <ArrowRight className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                            <div>
                                <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                                    {t('customers.readyForSubscriptions.title')}
                                </p>
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    <SafeFormattedText text={t('customers.readyForSubscriptions.description')} />
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                                {t('customers.modal.title')}
                            </h3>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCustomer}>
                            <div className="modal-body space-y-4">
                                <div>
                                    <label htmlFor="email" className="label">
                                        {t('customers.modal.emailLabel')}
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="input"
                                        placeholder={t('customers.modal.emailPlaceholder')}
                                    />
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {t('customers.modal.emailHelp')}
                                    </p>
                                </div>
                                <div>
                                    <label htmlFor="name" className="label">
                                        {t('customers.modal.nameLabel')}
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input"
                                        placeholder={t('customers.modal.namePlaceholder')}
                                    />
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {t('customers.modal.nameHelp')}
                                    </p>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                                    {tc('buttons.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!formData.email.trim()}>
                                    {t('customers.modal.createCustomer')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <confirm.ConfirmDialog />

            {/* Toast Container */}
            <toast.ToastContainer />
        </div>
    );
}
