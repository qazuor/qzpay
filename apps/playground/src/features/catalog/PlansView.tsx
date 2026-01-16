import type { QZPayPlanFeature } from '@qazuor/qzpay-core';
import { ArrowRight, Edit2, LayoutGrid, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SafeFormattedText } from '../../hooks/useSafeTranslation';
import { useCatalogStore } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';

interface PlanFormData {
    name: string;
    description: string;
    features: QZPayPlanFeature[];
}

const emptyForm: PlanFormData = {
    name: '',
    description: '',
    features: []
};

export function PlansView() {
    const { t } = useTranslation('catalog');
    const { t: tCommon } = useTranslation('common');
    const { isInitialized } = useConfigStore();
    const { plans, prices, loadCatalog, addPlan, updatePlan, deletePlan } = useCatalogStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [formData, setFormData] = useState<PlanFormData>(emptyForm);
    const [newFeature, setNewFeature] = useState('');

    useEffect(() => {
        if (isInitialized) {
            loadCatalog();
        }
    }, [isInitialized, loadCatalog]);

    const handleOpenModal = (planId?: string) => {
        if (planId) {
            const plan = plans.find((p) => p.id === planId);
            if (plan) {
                setFormData({
                    name: plan.name,
                    description: plan.description ?? '',
                    features: plan.features ?? []
                });
                setEditingPlanId(planId);
            }
        } else {
            setFormData(emptyForm);
            setEditingPlanId(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData(emptyForm);
        setEditingPlanId(null);
        setNewFeature('');
    };

    const handleAddFeature = () => {
        if (newFeature.trim()) {
            setFormData((prev) => ({
                ...prev,
                features: [...prev.features, { name: newFeature.trim(), included: true }]
            }));
            setNewFeature('');
        }
    };

    const handleRemoveFeature = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        if (editingPlanId) {
            updatePlan(editingPlanId, {
                name: formData.name,
                description: formData.description || null,
                features: formData.features
            });
        } else {
            addPlan({
                name: formData.name,
                description: formData.description || null,
                features: formData.features
            });
        }

        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (confirm(t('plans.confirmDelete'))) {
            deletePlan(id);
        }
    };

    // Get price count for a plan
    const getPriceCount = (planId: string) => {
        return prices.filter((p) => p.planId === planId).length;
    };

    if (!isInitialized) {
        return (
            <EmptyState
                icon={LayoutGrid}
                title={tCommon('billingNotInitialized.title')}
                description={tCommon('billingNotInitialized.description')}
            />
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <PageHeader
                title={t('plans.title')}
                description={t('plans.description')}
                icon={LayoutGrid}
                helpTitle={t('plans.helpTitle')}
                helpContent={
                    <div className="space-y-2">
                        <p>{t('plans.helpContent')}</p>
                        <p className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                            <span>
                                <SafeFormattedText text={t('plans.helpNextStep')} />
                            </span>
                        </p>
                    </div>
                }
                actions={
                    <button type="button" onClick={() => handleOpenModal()} className="btn btn-primary">
                        <Plus className="h-4 w-4" />
                        {t('plans.addPlan')}
                    </button>
                }
            />

            {/* Plans List */}
            {plans.length === 0 ? (
                <EmptyState
                    icon={LayoutGrid}
                    title={t('plans.empty.title')}
                    description={t('plans.empty.description')}
                    action={
                        <button type="button" onClick={() => handleOpenModal()} className="btn btn-primary">
                            <Plus className="h-4 w-4" />
                            {t('plans.empty.createFirst')}
                        </button>
                    }
                    tips={[t('plans.tips.tip1'), t('plans.tips.tip2'), t('plans.tips.tip3')]}
                />
            ) : (
                <div className="space-y-4">
                    {plans.map((plan) => {
                        const priceCount = getPriceCount(plan.id);
                        return (
                            <div key={plan.id} className="card p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                                {plan.name}
                                            </h3>
                                            <span className={`badge ${plan.active ? 'badge-success' : 'badge-error'}`}>
                                                {plan.active ? tCommon('labels.active') : tCommon('labels.inactive')}
                                            </span>
                                            {priceCount === 0 && <span className="badge badge-warning">{t('plans.noPrices')}</span>}
                                            {priceCount > 0 && (
                                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    {t('plans.priceCount', { count: priceCount })}
                                                </span>
                                            )}
                                        </div>
                                        {plan.description && (
                                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                {plan.description}
                                            </p>
                                        )}
                                        {plan.features && plan.features.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {plan.features.map((feature, idx) => (
                                                    <span key={idx} className="badge badge-primary">
                                                        {feature.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-xs mt-3 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                            {plan.id}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenModal(plan.id)}
                                            className="btn btn-ghost p-2"
                                            title="Edit plan"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(plan.id)}
                                            className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                            title="Delete plan"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Next step hint */}
                    {plans.length > 0 && prices.filter((p) => plans.some((pl) => pl.id === p.planId)).length === 0 && (
                        <div
                            className="card p-4 flex items-center gap-3"
                            style={{ backgroundColor: 'var(--color-accent-low)', borderColor: 'var(--color-accent)' }}
                        >
                            <ArrowRight className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                            <div>
                                <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                                    {t('plans.nextStepHint.title')}
                                </p>
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    <SafeFormattedText text={t('plans.nextStepHint.description')} />
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                                {editingPlanId ? t('plans.modal.editTitle') : t('plans.modal.createTitle')}
                            </h3>
                            <button type="button" onClick={handleCloseModal} className="btn btn-ghost p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body space-y-4">
                                <div>
                                    <label htmlFor="planName" className="label">
                                        {t('plans.modal.nameLabel')}
                                    </label>
                                    <input
                                        id="planName"
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                        placeholder={t('plans.modal.namePlaceholder')}
                                        className="input"
                                    />
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {t('plans.modal.nameHelp')}
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="planDescription" className="label">
                                        {t('plans.modal.descriptionLabel')}
                                    </label>
                                    <textarea
                                        id="planDescription"
                                        value={formData.description}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                        placeholder={t('plans.modal.descriptionPlaceholder')}
                                        className="input min-h-[80px] resize-y"
                                        rows={3}
                                    />
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {t('plans.modal.descriptionHelp')}
                                    </p>
                                </div>

                                <div>
                                    <label className="label">{t('plans.modal.featuresLabel')}</label>
                                    <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                        {t('plans.modal.featuresHelp')}
                                    </p>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={newFeature}
                                            onChange={(e) => setNewFeature(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddFeature();
                                                }
                                            }}
                                            placeholder={t('plans.modal.featurePlaceholder')}
                                            className="input flex-1"
                                        />
                                        <button type="button" onClick={handleAddFeature} className="btn btn-secondary">
                                            {t('plans.modal.addFeature')}
                                        </button>
                                    </div>
                                    {formData.features.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {formData.features.map((feature, idx) => (
                                                <span key={idx} className="badge badge-primary flex items-center gap-1">
                                                    {feature.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFeature(idx)}
                                                        className="hover:text-white ml-1"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                                    {tCommon('buttons.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!formData.name.trim()}>
                                    {editingPlanId ? t('plans.modal.saveChanges') : t('plans.modal.createPlan')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
