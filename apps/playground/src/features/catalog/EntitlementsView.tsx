import { useState } from 'react';
import { Shield, Plus, Pencil, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config.store';
import { useCatalogStore, type EntitlementDefinition } from '../../stores/catalog.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';

interface EntitlementFormData {
  key: string;
  name: string;
  description: string;
}

const EMPTY_FORM: EntitlementFormData = {
  key: '',
  name: '',
  description: '',
};

export function EntitlementsView() {
  const { t } = useTranslation('catalog');
  const { isInitialized } = useConfigStore();
  const {
    entitlementDefinitions,
    plans,
    addEntitlementDefinition,
    updateEntitlementDefinition,
    deleteEntitlementDefinition,
  } = useCatalogStore();

  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formData, setFormData] = useState<EntitlementFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isInitialized) {
    return (
      <EmptyState
        icon={Shield}
        title={t('common.billingNotInitialized')}
        description={t('common.billingNotInitializedDesc')}
      />
    );
  }

  const handleAdd = () => {
    setFormData(EMPTY_FORM);
    setEditingKey(null);
    setFormError(null);
    setShowForm(true);
  };

  const handleEdit = (entitlement: EntitlementDefinition) => {
    setFormData({
      key: entitlement.key,
      name: entitlement.name,
      description: entitlement.description,
    });
    setEditingKey(entitlement.key);
    setFormError(null);
    setShowForm(true);
  };

  const handleDelete = (key: string) => {
    const usedInPlans = plans.filter(p => p.entitlements?.includes(key));
    if (usedInPlans.length > 0) {
      const planNames = usedInPlans.map(p => p.name).join(', ');
      if (!confirm(t('entitlements.confirmDeleteUsed', { plans: planNames }))) {
        return;
      }
    }
    deleteEntitlementDefinition(key);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingKey(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate key format (lowercase, underscores, no spaces)
    const keyRegex = /^[a-z][a-z0-9_]*$/;
    if (!keyRegex.test(formData.key)) {
      setFormError(t('entitlements.form.keyError'));
      return;
    }

    // Check for duplicate key when adding
    if (!editingKey && entitlementDefinitions.some(e => e.key === formData.key)) {
      setFormError(t('entitlements.form.keyDuplicate'));
      return;
    }

    if (editingKey) {
      updateEntitlementDefinition(editingKey, {
        name: formData.name,
        description: formData.description,
      });
    } else {
      addEntitlementDefinition({
        key: formData.key,
        name: formData.name,
        description: formData.description,
      });
    }

    handleCancel();
  };

  // Count plans using each entitlement
  const getUsageCount = (key: string) => {
    return plans.filter(p => p.entitlements?.includes(key)).length;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t('entitlements.title')}
        description={t('entitlements.description')}
        icon={Shield}
        helpTitle={t('entitlements.helpTitle')}
        helpContent={
          <div className="space-y-2">
            <p>{t('entitlements.helpContent')}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('entitlements.helpNote')}
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
            {t('entitlements.addEntitlement')}
          </button>
        }
      />

      {/* Form Modal */}
      {showForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {editingKey ? t('entitlements.form.editTitle') : t('entitlements.form.addTitle')}
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
                {t('entitlements.form.key')} *
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                disabled={!!editingKey}
                placeholder="api_access"
                className="input w-full"
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('entitlements.form.keyHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {t('entitlements.form.name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="API Access"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {t('entitlements.form.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('entitlements.form.descriptionPlaceholder')}
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

      {/* Entitlements List */}
      {entitlementDefinitions.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={t('entitlements.empty.title')}
          description={t('entitlements.empty.description')}
          tips={[
            t('entitlements.tips.tip1'),
            t('entitlements.tips.tip2'),
            t('entitlements.tips.tip3'),
          ]}
        />
      ) : (
        <div className="space-y-3">
          {entitlementDefinitions.map((entitlement) => {
            const usageCount = getUsageCount(entitlement.key);
            return (
              <div key={entitlement.key} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Shield className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {entitlement.name}
                      </h3>
                      <code
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                      >
                        {entitlement.key}
                      </code>
                    </div>
                    {entitlement.description && (
                      <p className="text-sm ml-8" style={{ color: 'var(--color-text-secondary)' }}>
                        {entitlement.description}
                      </p>
                    )}
                    {usageCount > 0 && (
                      <p className="text-xs ml-8 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {t('entitlements.usedInPlans', { count: usageCount })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(entitlement)}
                      className="p-2 rounded hover:bg-opacity-10 hover:bg-white"
                      title={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entitlement.key)}
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
            <Shield className="h-6 w-6" style={{ color: 'var(--color-accent-high)' }} />
          </div>
          <div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              {t('entitlements.about.title')}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              {t('entitlements.about.description')}
            </p>
            <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p>{t('entitlements.about.examples')}</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>api_access</code> - {t('entitlements.about.apiAccess')}</li>
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>priority_support</code> - {t('entitlements.about.prioritySupport')}</li>
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>advanced_analytics</code> - {t('entitlements.about.advancedAnalytics')}</li>
                <li><code className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>custom_integrations</code> - {t('entitlements.about.customIntegrations')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
