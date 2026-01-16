import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';
import { AlertCircle, Lock, Unlock, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportPlaygroundData } from '../../../adapters/local-storage.adapter';
import { useCatalogStore } from '../../../stores/catalog.store';

interface EntitlementGateDemoProps {
    customer: QZPayCustomer | null;
}

export function EntitlementGateDemo({ customer }: EntitlementGateDemoProps) {
    const { t } = useTranslation('showcase');
    const { plans } = useCatalogStore();
    const data = exportPlaygroundData();
    const subscriptions = Object.values(data.subscriptions || {}) as QZPaySubscription[];

    // Collect all unique entitlements from all plans
    const allEntitlements = [...new Set(plans.flatMap((p) => p.entitlements || []))];

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

    if (allEntitlements.length === 0) {
        return (
            <div className="space-y-6">
                <div className="card p-4">
                    <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                        {t('demos.entitlementGate.title')}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {t('demos.entitlementGate.description')}
                    </p>
                </div>
                <div className="card p-6">
                    <div className="flex items-center gap-3 text-amber-400">
                        <AlertCircle className="h-5 w-5" />
                        <p>{t('demos.entitlementGate.noEntitlements')}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Get customer's subscription and plan
    const customerSubscription = subscriptions.find((s) => s.customerId === customer.id);
    const customerPlan = customerSubscription ? plans.find((p) => p.id === customerSubscription.planId) : null;
    const customerEntitlements = customerPlan?.entitlements || [];

    return (
        <div className="space-y-6">
            {/* Demo Description */}
            <div className="card p-4">
                <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    {t('demos.entitlementGate.title')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {t('demos.entitlementGate.description')}
                </p>
            </div>

            {/* Customer Info */}
            <div className="card p-4">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <strong>{t('demos.entitlementGate.currentPlan')}:</strong> {customerPlan?.name || t('demos.entitlementGate.noPlan')}
                </p>
                {customerEntitlements.length > 0 && (
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        <strong>{t('demos.entitlementGate.activeEntitlements')}:</strong> {customerEntitlements.join(', ')}
                    </p>
                )}
            </div>

            {/* Live Component Demo - Simulated */}
            <div className="card p-6">
                <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('demos.livePreview')}
                </h4>
                <div className="space-y-4">
                    {allEntitlements.map((entitlementKey) => {
                        const hasAccess = customerEntitlements.includes(entitlementKey);
                        return (
                            <div key={entitlementKey} className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-2 mb-2">
                                    {hasAccess ? <Unlock className="h-4 w-4 text-green-400" /> : <Lock className="h-4 w-4 text-red-400" />}
                                    <code
                                        className="text-sm px-2 py-1 rounded"
                                        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                                    >
                                        {entitlementKey}
                                    </code>
                                </div>
                                {/* Simulated EntitlementGate behavior */}
                                {hasAccess ? (
                                    <p className="text-sm text-green-400">{t('demos.entitlementGate.unlocked')}</p>
                                ) : (
                                    <p className="text-sm text-red-400">{t('demos.entitlementGate.locked')}</p>
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
                    {`import { EntitlementGate } from '@qazuor/qzpay-react';

function PremiumFeature() {
  return (
    <EntitlementGate
      entitlementKey="advanced_analytics"
      customerId={customerId}
      fallback={<UpgradePrompt />}
    >
      <AdvancedAnalyticsDashboard />
    </EntitlementGate>
  );
}`}
                </pre>
            </div>
        </div>
    );
}
