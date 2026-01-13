import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../../stores/catalog.store';
import { exportPlaygroundData } from '../../../adapters/local-storage.adapter';
import { AlertCircle, UserX, CheckCircle, XCircle } from 'lucide-react';
import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';

interface LimitGateDemoProps {
  customer: QZPayCustomer | null;
}

export function LimitGateDemo({ customer }: LimitGateDemoProps) {
  const { t } = useTranslation('showcase');
  const { plans } = useCatalogStore();
  const data = exportPlaygroundData();
  const subscriptions = Object.values(data.subscriptions || {}) as QZPaySubscription[];

  // Collect all unique limit keys from all plans
  const allLimitKeys = [...new Set(plans.flatMap((p) => Object.keys(p.limits || {})))];

  if (!customer) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3" style={{ color: 'var(--color-text-muted)' }}>
          <UserX className="h-5 w-5" />
          <p>{t('demos.selectCustomer')}</p>
        </div>
      </div>
    );
  }

  if (allLimitKeys.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card p-4">
          <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            {t('demos.limitGate.title')}
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('demos.limitGate.description')}
          </p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertCircle className="h-5 w-5" />
            <p>{t('demos.limitGate.noLimits')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Get customer's subscription and plan limits
  const customerSubscription = subscriptions.find((s) => s.customerId === customer.id);
  const customerPlan = customerSubscription
    ? plans.find((p) => p.id === customerSubscription.planId)
    : null;
  const customerLimits = customerPlan?.limits || {};

  // Simulate usage (for demo purposes)
  const simulatedUsage: Record<string, number> = {};
  Object.keys(customerLimits).forEach((key) => {
    const maxLimit = customerLimits[key] || 100;
    // Simulate some usage, occasionally exceeding
    simulatedUsage[key] = Math.floor(Math.random() * (maxLimit * 1.2));
  });

  return (
    <div className="space-y-6">
      {/* Demo Description */}
      <div className="card p-4">
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          {t('demos.limitGate.title')}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('demos.limitGate.description')}
        </p>
      </div>

      {/* Customer Info */}
      <div className="card p-4">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <strong>{t('demos.limitGate.currentPlan')}:</strong>{' '}
          {customerPlan?.name || t('demos.limitGate.noPlan')}
        </p>
        {Object.keys(customerLimits).length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {t('demos.limitGate.planLimits')}:
            </p>
            <ul className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {Object.entries(customerLimits).map(([key, limit]) => (
                <li key={key}>
                  {key}: {limit === -1 ? t('demos.limitGate.unlimited') : limit}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Live Component Demo - Simulated */}
      <div className="card p-6">
        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {t('demos.livePreview')}
        </h4>
        <div className="space-y-4">
          {allLimitKeys.map((limitKey) => {
            const maxLimit = customerLimits[limitKey] ?? 0;
            const currentUsage = simulatedUsage[limitKey] ?? 0;
            const isWithinLimit = maxLimit === -1 || currentUsage < maxLimit;

            return (
              <div key={limitKey} className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  {isWithinLimit ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <code className="text-sm px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}>
                    {limitKey}
                  </code>
                </div>
                <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  {t('demos.limitGate.usage')}: {currentUsage} / {maxLimit === -1 ? '∞' : maxLimit}
                </p>
                {/* Simulated LimitGate behavior */}
                {isWithinLimit ? (
                  <p className="text-sm text-green-400">
                    {t('demos.limitGate.withinLimit')}
                  </p>
                ) : (
                  <p className="text-sm text-red-400">
                    {t('demos.limitGate.exceeded')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Code Example */}
      <div className="card p-4">
        <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('demos.codeExample')}
        </h4>
        <pre
          className="p-4 rounded-lg text-sm overflow-x-auto"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
        >
{`import { LimitGate } from '@qazuor/qzpay-react';

function ApiCallButton() {
  return (
    <LimitGate
      limitKey="api_calls"
      customerId={customerId}
      fallback={<UpgradePlanButton />}
    >
      <button onClick={makeApiCall}>
        Make API Call
      </button>
    </LimitGate>
  );
}`}
        </pre>
      </div>
    </div>
  );
}
