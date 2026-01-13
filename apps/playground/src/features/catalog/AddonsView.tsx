import { useEffect, useState } from 'react';
import { Edit2, Package, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import type { QZPayBillingInterval } from '@qazuor/qzpay-core';

interface AddonFormData {
  name: string;
  description: string;
  unitAmount: number;
  currency: string;
  billingInterval: QZPayBillingInterval | 'one_time';
}

const emptyForm: AddonFormData = {
  name: '',
  description: '',
  unitAmount: 0,
  currency: 'USD',
  billingInterval: 'month',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'ARS', 'BRL', 'MXN'];

export function AddonsView() {
  const { t } = useTranslation('catalog');
  const { isInitialized } = useConfigStore();
  const { addons, loadCatalog, addAddon, updateAddon, deleteAddon } = useCatalogStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddonFormData>(emptyForm);

  useEffect(() => {
    if (isInitialized) {
      loadCatalog();
    }
  }, [isInitialized, loadCatalog]);

  const handleOpenModal = (addonId?: string) => {
    if (addonId) {
      const addon = addons.find(a => a.id === addonId);
      if (addon) {
        setFormData({
          name: addon.name,
          description: addon.description ?? '',
          unitAmount: addon.unitAmount / 100,
          currency: addon.currency,
          billingInterval: addon.billingInterval,
        });
        setEditingAddonId(addonId);
      }
    } else {
      setFormData(emptyForm);
      setEditingAddonId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(emptyForm);
    setEditingAddonId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const addonData = {
      name: formData.name,
      description: formData.description || null,
      unitAmount: Math.round(formData.unitAmount * 100),
      currency: formData.currency,
      billingInterval: formData.billingInterval,
    };

    if (editingAddonId) {
      updateAddon(editingAddonId, addonData);
    } else {
      addAddon(addonData);
    }

    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (confirm(t('addons.confirmDelete'))) {
      deleteAddon(id);
    }
  };

  const INTERVALS: { value: QZPayBillingInterval | 'one_time'; label: string }[] = [
    { value: 'one_time', label: t('addons.billingTypes.one_time') },
    { value: 'month', label: t('addons.billingTypes.month') },
    { value: 'year', label: t('addons.billingTypes.year') },
  ];

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount / 100);
  };

  if (!isInitialized) {
    return (
      <EmptyState
        icon={Package}
        title={t('addons.empty.title')}
        description={t('addons.empty.description')}
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t('addons.title')}
        description={t('addons.description')}
        icon={Package}
        helpTitle={t('addons.helpTitle')}
        helpContent={
          <div className="space-y-2">
            <p>
              {t('addons.helpContent')}
            </p>
            <p
              className="text-sm"
              style={{ color: 'var(--color-text-muted)' }}
              dangerouslySetInnerHTML={{ __html: t('addons.helpExamples') }}
            />
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {t('addons.addAddon')}
          </button>
        }
      />

      {/* Add-ons List */}
      {addons.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('addons.empty.title')}
          description={t('addons.empty.description')}
          action={
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              {t('addons.empty.createFirst')}
            </button>
          }
          tips={[
            t('addons.tips.tip1'),
            t('addons.tips.tip2'),
            t('addons.tips.tip3'),
          ]}
        />
      ) : (
        <div className="space-y-4">
          {addons.map(addon => (
            <div key={addon.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {addon.name}
                    </h3>
                    <span className="badge badge-primary">
                      {formatAmount(addon.unitAmount, addon.currency)}
                      {addon.billingInterval !== 'one_time' && ` / ${addon.billingInterval}`}
                    </span>
                    <span className={`badge ${addon.active ? 'badge-success' : 'badge-error'}`}>
                      {addon.active ? t('common.status.active') : t('common.status.inactive')}
                    </span>
                  </div>
                  {addon.description && (
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {addon.description}
                    </p>
                  )}
                  <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {addon.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(addon.id)}
                    className="btn btn-ghost p-2"
                    title="Edit add-on"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(addon.id)}
                    className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                    title="Delete add-on"
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {editingAddonId ? t('addons.modal.editTitle') : t('addons.modal.createTitle')}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="btn btn-ghost p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label htmlFor="addonName" className="label">
                    {t('addons.modal.nameLabel')}
                  </label>
                  <input
                    id="addonName"
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('addons.modal.namePlaceholder')}
                    className="input"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="addonDescription" className="label">
                    {t('addons.modal.descriptionLabel')}
                  </label>
                  <textarea
                    id="addonDescription"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('addons.modal.descriptionPlaceholder')}
                    className="input min-h-[80px] resize-y"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="addonAmount" className="label">
                      {t('addons.modal.priceLabel')}
                    </label>
                    <input
                      id="addonAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unitAmount}
                      onChange={e => setFormData(prev => ({ ...prev, unitAmount: parseFloat(e.target.value) || 0 }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="addonCurrency" className="label">
                      {t('addons.modal.currencyLabel')}
                    </label>
                    <select
                      id="addonCurrency"
                      value={formData.currency}
                      onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="select"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="addonInterval" className="label">
                    {t('addons.modal.billingTypeLabel')}
                  </label>
                  <select
                    id="addonInterval"
                    value={formData.billingInterval}
                    onChange={e => setFormData(prev => ({ ...prev, billingInterval: e.target.value as QZPayBillingInterval | 'one_time' }))}
                    className="select"
                  >
                    {INTERVALS.map(i => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-secondary"
                >
                  {t('common.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.name.trim()}
                >
                  {editingAddonId ? t('addons.modal.saveChanges') : t('addons.modal.createAddon')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
