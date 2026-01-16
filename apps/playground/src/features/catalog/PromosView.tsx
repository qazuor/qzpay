import { Edit2, Gift, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useCatalogStore } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';

interface PromoFormData {
    code: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    maxRedemptions: number | null;
}

const emptyForm: PromoFormData = {
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    maxRedemptions: null
};

export function PromosView() {
    const { t } = useTranslation('catalog');
    const { isInitialized } = useConfigStore();
    const { promoCodes, loadCatalog, addPromoCode, updatePromoCode, deletePromoCode } = useCatalogStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
    const [formData, setFormData] = useState<PromoFormData>(emptyForm);

    useEffect(() => {
        if (isInitialized) {
            loadCatalog();
        }
    }, [isInitialized, loadCatalog]);

    const handleOpenModal = (promoId?: string) => {
        if (promoId) {
            const promo = promoCodes.find((p) => p.id === promoId);
            if (promo) {
                setFormData({
                    code: promo.code,
                    discountType: promo.discountType as 'percentage' | 'fixed_amount',
                    discountValue: promo.discountType === 'percentage' ? promo.discountValue : promo.discountValue / 100,
                    maxRedemptions: promo.maxRedemptions
                });
                setEditingPromoId(promoId);
            }
        } else {
            setFormData(emptyForm);
            setEditingPromoId(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData(emptyForm);
        setEditingPromoId(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code.trim()) return;

        const promoData = {
            code: formData.code.toUpperCase(),
            discountType: formData.discountType,
            discountValue: formData.discountType === 'percentage' ? formData.discountValue : Math.round(formData.discountValue * 100),
            maxRedemptions: formData.maxRedemptions
        };

        if (editingPromoId) {
            updatePromoCode(editingPromoId, promoData);
        } else {
            addPromoCode(promoData);
        }

        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (confirm(t('promos.confirmDelete'))) {
            deletePromoCode(id);
        }
    };

    const formatDiscount = (promo: (typeof promoCodes)[0]) => {
        if (promo.discountType === 'percentage') {
            return `${promo.discountValue}%`;
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(promo.discountValue / 100);
    };

    if (!isInitialized) {
        return <EmptyState icon={Gift} title={t('promos.empty.title')} description={t('promos.empty.description')} />;
    }

    return (
        <div className="max-w-4xl space-y-6">
            <PageHeader
                title={t('promos.title')}
                description={t('promos.description')}
                icon={Gift}
                helpTitle={t('promos.helpTitle')}
                helpContent={
                    <div className="space-y-2">
                        <p>{t('promos.helpContent')}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="badge badge-primary">SUMMER20</span>
                                <span>20% {t('promos.off')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="badge badge-primary">WELCOME10</span>
                                <span>$10 {t('promos.off')}</span>
                            </div>
                        </div>
                    </div>
                }
                actions={
                    <button type="button" onClick={() => handleOpenModal()} className="btn btn-primary">
                        <Plus className="h-4 w-4" />
                        {t('promos.addPromoCode')}
                    </button>
                }
            />

            {/* Promo Codes List */}
            {promoCodes.length === 0 ? (
                <EmptyState
                    icon={Gift}
                    title={t('promos.empty.title')}
                    description={t('promos.empty.description')}
                    action={
                        <button type="button" onClick={() => handleOpenModal()} className="btn btn-primary">
                            <Plus className="h-4 w-4" />
                            {t('promos.empty.createFirst')}
                        </button>
                    }
                    tips={[t('promos.tips.tip1'), t('promos.tips.tip2'), t('promos.tips.tip3')]}
                />
            ) : (
                <div className="space-y-4">
                    {promoCodes.map((promo) => (
                        <div key={promo.id} className="card p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold font-mono" style={{ color: 'var(--color-accent-high)' }}>
                                            {promo.code}
                                        </h3>
                                        <span className="badge badge-primary">
                                            {formatDiscount(promo)} {t('promos.off')}
                                        </span>
                                        <span className={`badge ${promo.active ? 'badge-success' : 'badge-error'}`}>
                                            {promo.active ? t('common.status.active') : t('common.status.inactive')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        <span>
                                            {promo.maxRedemptions
                                                ? t('promos.usedWithMax', { current: promo.currentRedemptions, max: promo.maxRedemptions })
                                                : t('promos.used', { current: promo.currentRedemptions })}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                        {promo.id}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenModal(promo.id)}
                                        className="btn btn-ghost p-2"
                                        title="Edit promo code"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(promo.id)}
                                        className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                        title="Delete promo code"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                                {editingPromoId ? t('promos.modal.editTitle') : t('promos.modal.createTitle')}
                            </h3>
                            <button type="button" onClick={handleCloseModal} className="btn btn-ghost p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body space-y-4">
                                <div>
                                    <label htmlFor="promoCode" className="label">
                                        {t('promos.modal.codeLabel')}
                                    </label>
                                    <input
                                        id="promoCode"
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        placeholder={t('promos.modal.codePlaceholder')}
                                        className="input font-mono"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="discountType" className="label">
                                            {t('promos.modal.discountTypeLabel')}
                                        </label>
                                        <select
                                            id="discountType"
                                            value={formData.discountType}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    discountType: e.target.value as 'percentage' | 'fixed_amount'
                                                }))
                                            }
                                            className="select"
                                        >
                                            <option value="percentage">{t('promos.modal.discountTypes.percentage')}</option>
                                            <option value="fixed_amount">{t('promos.modal.discountTypes.fixed_amount')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="discountValue" className="label">
                                            {formData.discountType === 'percentage'
                                                ? t('promos.modal.percentageLabel')
                                                : t('promos.modal.amountLabel')}
                                        </label>
                                        <input
                                            id="discountValue"
                                            type="number"
                                            step={formData.discountType === 'percentage' ? '1' : '0.01'}
                                            min="0"
                                            max={formData.discountType === 'percentage' ? '100' : undefined}
                                            value={formData.discountValue}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, discountValue: Number.parseFloat(e.target.value) || 0 }))
                                            }
                                            className="input"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="maxRedemptions" className="label">
                                        {t('promos.modal.maxRedemptionsLabel')}
                                    </label>
                                    <input
                                        id="maxRedemptions"
                                        type="number"
                                        min="1"
                                        value={formData.maxRedemptions ?? ''}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                maxRedemptions: e.target.value ? Number.parseInt(e.target.value) : null
                                            }))
                                        }
                                        placeholder={t('promos.modal.maxRedemptionsPlaceholder')}
                                        className="input"
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                                    {t('common.actions.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!formData.code.trim()}>
                                    {editingPromoId ? t('promos.modal.saveChanges') : t('promos.modal.createPromoCode')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
