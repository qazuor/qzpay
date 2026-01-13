import { useEffect, useState } from 'react';
import { ArrowRight, Edit2, Plus, Tag, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import type { QZPayBillingInterval, QZPayCurrency } from '@qazuor/qzpay-core';

interface PriceFormData {
  planId: string;
  nickname: string;
  unitAmount: number;
  currency: QZPayCurrency;
  billingInterval: QZPayBillingInterval;
  intervalCount: number;
  trialDays: number;
}

const emptyForm: PriceFormData = {
  planId: '',
  nickname: '',
  unitAmount: 0,
  currency: 'USD',
  billingInterval: 'month',
  intervalCount: 1,
  trialDays: 0,
};

const CURRENCIES: QZPayCurrency[] = ['USD', 'EUR', 'GBP', 'ARS', 'BRL', 'MXN'];

export function PricesView() {
  const { t } = useTranslation('catalog');
  const { t: tCommon } = useTranslation('common');
  const { isInitialized } = useConfigStore();
  const { plans, prices, loadCatalog, addPrice, updatePrice, deletePrice } = useCatalogStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PriceFormData>(emptyForm);

  const INTERVALS: { value: QZPayBillingInterval; label: string }[] = [
    { value: 'day', label: t('prices.intervals.day') },
    { value: 'week', label: t('prices.intervals.week') },
    { value: 'month', label: t('prices.intervals.month') },
    { value: 'year', label: t('prices.intervals.year') },
  ];

  useEffect(() => {
    if (isInitialized) {
      loadCatalog();
    }
  }, [isInitialized, loadCatalog]);

  const handleOpenModal = (priceId?: string) => {
    if (priceId) {
      const price = prices.find(p => p.id === priceId);
      if (price) {
        setFormData({
          planId: price.planId,
          nickname: price.nickname ?? '',
          unitAmount: price.unitAmount / 100,
          currency: price.currency,
          billingInterval: price.billingInterval,
          intervalCount: price.intervalCount,
          trialDays: price.trialDays ?? 0,
        });
        setEditingPriceId(priceId);
      }
    } else {
      setFormData({ ...emptyForm, planId: plans[0]?.id ?? '' });
      setEditingPriceId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(emptyForm);
    setEditingPriceId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.planId) return;

    const priceData = {
      planId: formData.planId,
      nickname: formData.nickname || null,
      unitAmount: Math.round(formData.unitAmount * 100),
      currency: formData.currency,
      billingInterval: formData.billingInterval,
      intervalCount: formData.intervalCount,
      trialDays: formData.trialDays || null,
    };

    if (editingPriceId) {
      updatePrice(editingPriceId, priceData);
    } else {
      addPrice(priceData);
    }

    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (confirm(t('prices.confirmDelete'))) {
      deletePrice(id);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount / 100);
  };

  const getPlanName = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    return plan?.name ?? 'Unknown Plan';
  };

  if (!isInitialized) {
    return (
      <EmptyState
        icon={Tag}
        title={tCommon('billingNotInitialized.title')}
        description={tCommon('billingNotInitialized.description')}
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t('prices.title')}
        description={t('prices.description')}
        icon={Tag}
        helpTitle={t('prices.helpTitle')}
        helpContent={
          <div className="space-y-2">
            <p>{t('prices.helpContent')}</p>
            <p className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
              <span dangerouslySetInnerHTML={{ __html: t('prices.helpNextStep') }} />
            </p>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="btn btn-primary"
            disabled={plans.length === 0}
          >
            <Plus className="h-4 w-4" />
            {t('prices.addPrice')}
          </button>
        }
      />

      {/* Prices List */}
      {plans.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={t('prices.empty.createPlanFirst.title')}
          description={t('prices.empty.createPlanFirst.description')}
          tips={[
            t('prices.tips.tip4'),
            t('prices.tips.tip5'),
          ]}
        />
      ) : prices.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={t('prices.empty.title')}
          description={t('prices.empty.description')}
          action={
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              {t('prices.empty.createFirst')}
            </button>
          }
          tips={[
            t('prices.tips.tip1'),
            t('prices.tips.tip2'),
            t('prices.tips.tip3'),
          ]}
        />
      ) : (
        <div className="space-y-4">
          {prices.map(price => (
            <div key={price.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {formatAmount(price.unitAmount, price.currency)}
                      <span className="text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                        {' / '}
                        {price.intervalCount > 1 ? `${price.intervalCount} ` : ''}
                        {price.billingInterval}
                        {price.intervalCount > 1 ? 's' : ''}
                      </span>
                    </h3>
                    <span className={`badge ${price.active ? 'badge-success' : 'badge-error'}`}>
                      {price.active ? tCommon('labels.active') : tCommon('labels.inactive')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="badge badge-primary">{getPlanName(price.planId)}</span>
                    {price.nickname && (
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {price.nickname}
                      </span>
                    )}
                  </div>
                  {price.trialDays && (
                    <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('prices.dayTrial', { count: price.trialDays })}
                    </p>
                  )}
                  <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {price.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(price.id)}
                    className="btn btn-ghost p-2"
                    title="Edit price"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(price.id)}
                    className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                    title="Delete price"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Next step hint */}
          {prices.length > 0 && (
            <div
              className="card p-4 flex items-center gap-3"
              style={{ backgroundColor: 'var(--color-accent-low)', borderColor: 'var(--color-accent)' }}
            >
              <ArrowRight className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                  {t('prices.catalogReady.title')}
                </p>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                  dangerouslySetInnerHTML={{ __html: t('prices.catalogReady.description') }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {editingPriceId ? t('prices.modal.editTitle') : t('prices.modal.createTitle')}
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
                  <label htmlFor="pricePlan" className="label">
                    {t('prices.modal.planLabel')}
                  </label>
                  <select
                    id="pricePlan"
                    value={formData.planId}
                    onChange={e => setFormData(prev => ({ ...prev, planId: e.target.value }))}
                    className="select"
                  >
                    {plans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('prices.modal.planHelp')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="priceAmount" className="label">
                      {t('prices.modal.amountLabel')}
                    </label>
                    <input
                      id="priceAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unitAmount}
                      onChange={e => setFormData(prev => ({ ...prev, unitAmount: parseFloat(e.target.value) || 0 }))}
                      className="input"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {t('prices.modal.amountHelp')}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="priceCurrency" className="label">
                      {t('prices.modal.currencyLabel')}
                    </label>
                    <select
                      id="priceCurrency"
                      value={formData.currency}
                      onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value as QZPayCurrency }))}
                      className="select"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="priceInterval" className="label">
                      {t('prices.modal.intervalLabel')}
                    </label>
                    <select
                      id="priceInterval"
                      value={formData.billingInterval}
                      onChange={e => setFormData(prev => ({ ...prev, billingInterval: e.target.value as QZPayBillingInterval }))}
                      className="select"
                    >
                      {INTERVALS.map(i => (
                        <option key={i.value} value={i.value}>{i.label}</option>
                      ))}
                    </select>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {t('prices.modal.intervalHelp')}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="priceIntervalCount" className="label">
                      {t('prices.modal.intervalCountLabel')}
                    </label>
                    <input
                      id="priceIntervalCount"
                      type="number"
                      min="1"
                      value={formData.intervalCount}
                      onChange={e => setFormData(prev => ({ ...prev, intervalCount: parseInt(e.target.value) || 1 }))}
                      className="input"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {t('prices.modal.intervalCountHelp')}
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="priceTrialDays" className="label">
                    {t('prices.modal.trialDaysLabel')}
                  </label>
                  <input
                    id="priceTrialDays"
                    type="number"
                    min="0"
                    value={formData.trialDays}
                    onChange={e => setFormData(prev => ({ ...prev, trialDays: parseInt(e.target.value) || 0 }))}
                    className="input"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('prices.modal.trialDaysHelp')}
                  </p>
                </div>

                <div>
                  <label htmlFor="priceNickname" className="label">
                    {t('prices.modal.nicknameLabel')}
                  </label>
                  <input
                    id="priceNickname"
                    type="text"
                    value={formData.nickname}
                    onChange={e => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                    placeholder={t('prices.modal.nicknamePlaceholder')}
                    className="input"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('prices.modal.nicknameHelp')}
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-secondary"
                >
                  {tCommon('buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.planId}
                >
                  {editingPriceId ? t('prices.modal.saveChanges') : t('prices.modal.createPrice')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
