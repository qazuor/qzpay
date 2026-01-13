import { useState } from 'react';
import { Sliders, Plus, Pencil, Trash2, X, Check, AlertCircle, Infinity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config.store';
import { useCatalogStore, type LimitDefinition } from '../../stores/catalog.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';

interface LimitFormData {
  key: string;
  name: string;
  description: string;
  unit: string;
  defaultValue: number;
}

const EMPTY_FORM: LimitFormData = {
  key: '',
  name: '',
  description: '',
  unit: '',
  defaultValue: 100,
};

export function LimitsView() {
  const { t } = useTranslation('catalog');
  const { isInitialized } = useConfigStore();
  const {
    limitDefinitions,
    plans,
    addLimitDefinition,
    updateLimitDefinition,
    deleteLimitDefinition,
  } = useCatalogStore();

  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formData, setFormData] = useState<LimitFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);

  if (!isInitialized) {
    return (
      <EmptyState
        icon={Sliders}
        title={t('common.billingNotInitialized')}
        description={t('common.billingNotInitializedDesc')}
      />
    );
  }

  const handleAdd = () => {
    setFormData(EMPTY_FORM);
    setEditingKey(null);
    setFormError(null);
    setIsUnlimited(false);
    setShowForm(true);
  };

  const handleEdit = (limit: LimitDefinition) => {
    setFormData({
      key: limit.key,
      name: limit.name,
      description: limit.description,
      unit: limit.unit,
      defaultValue: limit.defaultValue === -1 ? 100 : limit.defaultValue,
    });
    setEditingKey(limit.key);
    setFormError(null);
    setIsUnlimited(limit.defaultValue === -1);
    setShowForm(true);
  };

  const handleDelete = (key: string) => {
    const usedInPlans = plans.filter(p => p.limits && key in p.limits);
    if (usedInPlans.length > 0) {
      const planNames = usedInPlans.map(p => p.name).join(', ');
      if (!confirm(t('limits.confirmDeleteUsed', { plans: planNames }))) {
        return;
      }
    }
    deleteLimitDefinition(key);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingKey(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setIsUnlimited(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate key format (lowercase, underscores, no spaces)
    const keyRegex = /^[a-z][a-z0-9_]*$/;
    if (!keyRegex.test(formData.key)) {
      setFormError(t('limits.form.keyError'));
      return;
    }

    // Check for duplicate key when adding
    if (!editingKey && limitDefinitions.some(l => l.key === formData.key)) {
      setFormError(t('limits.form.keyDuplicate'));
      return;
    }

    const defaultValue = isUnlimited ? -1 : formData.defaultValue;

    if (editingKey) {
      updateLimitDefinition(editingKey, {
        name: formData.name,
        description: formData.description,
        unit: formData.unit,
        defaultValue,
      });
    } else {
      addLimitDefinition({
        key: formData.key,
        name: formData.name,
        description: formData.description,
        unit: formData.unit,
        defaultValue,
      });
    }

    handleCancel();
  };

  // Count plans using each limit
  const getUsageCount = (key: string) => {
    return plans.filter(p => p.limits && key in p.limits).length;
  };

  const formatValue = (value: number) => {
    return value === -1 ? t('limits.unlimited') : value.toLocaleString();
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t('limits.title')}
        description={t('limits.description')}
        icon={Sliders}
        helpTitle={t('limits.helpTitle')}
        helpContent={
          <div className="space-y-2">
            <p>{t('limits.helpContent')}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('limits.helpNote')}
            </p>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={handleAdd}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {t('limits.addLimit')}
          </button>
        }
      />

      {/* Form Modal */}
      {showForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {editingKey ? t('limits.form.editTitle') : t('limits.form.addTitle')}
            </h3>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded hover:bg-opacity-10 hover:bg-white"
            >
              <X className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
              >
                <AlertCircle className="h-4 w-4" />
                {formError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {t('limits.form.key')} *
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                disabled={!!editingKey}
                placeholder="api_calls"
                className="input w-full"
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('limits.form.keyHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {t('limits.form.name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="API Calls"
                className="input w-full"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                  {t('limits.form.unit')} *
                </label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="calls, GB, members"
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                  {t('limits.form.defaultValue')} *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: parseInt(e.target.value) || 0 })}
                    disabled={isUnlimited}
                    min={0}
                    className="input flex-1"
                  />
                  <label className="flex items-center gap-1 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => setIsUnlimited(e.target.checked)}
                      className="rounded"
                    />
                    <Infinity className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {t('limits.form.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('limits.form.descriptionPlaceholder')}
                className="input w-full"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleCancel} className="btn">
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                <Check className="h-4 w-4" />
                {editingKey ? t('common.save') : t('common.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Limits List */}
      {limitDefinitions.length === 0 ? (
        <EmptyState
          icon={Sliders}
          title={t('limits.empty.title')}
          description={t('limits.empty.description')}
          tips={[
            t('limits.tips.tip1'),
            t('limits.tips.tip2'),
            t('limits.tips.tip3'),
          ]}
        />
      ) : (
        <div className="space-y-3">
          {limitDefinitions.map((limit) => {
            const usageCount = getUsageCount(limit.key);
            return (
              <div key={limit.key} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Sliders className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {limit.name}
                      </h3>
                      <code
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                      >
                        {limit.key}
                      </code>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--color-accent-low)', color: 'var(--color-accent)' }}
                      >
                        {formatValue(limit.defaultValue)} {limit.unit}
                      </span>
                    </div>
                    {limit.description && (
                      <p className="text-sm ml-8" style={{ color: 'var(--color-text-secondary)' }}>
                        {limit.description}
                      </p>
                    )}
                    {usageCount > 0 && (
                      <p className="text-xs ml-8 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {t('limits.usedInPlans', { count: usageCount })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(limit)}
                      className="p-2 rounded hover:bg-opacity-10 hover:bg-white"
                      title={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(limit.key)}
                      className="p-2 rounded hover:bg-opacity-10 hover:bg-white"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--color-accent-low)' }}
          >
            <Sliders className="h-6 w-6" style={{ color: 'var(--color-accent-high)' }} />
          </div>
          <div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              {t('limits.about.title')}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              {t('limits.about.description')}
            </p>
            <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p>{t('limits.about.examples')}</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>api_calls</code> - {t('limits.about.apiCalls')}</li>
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>storage_gb</code> - {t('limits.about.storageGb')}</li>
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>team_members</code> - {t('limits.about.teamMembers')}</li>
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>projects</code> - {t('limits.about.projects')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
