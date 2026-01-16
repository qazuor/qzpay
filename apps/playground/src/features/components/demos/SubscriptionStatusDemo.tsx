import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';
import { SubscriptionStatus } from '@qazuor/qzpay-react';
import { AlertCircle, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportPlaygroundData } from '../../../adapters/local-storage.adapter';

interface SubscriptionStatusDemoProps {
    customer: QZPayCustomer | null;
}

export function SubscriptionStatusDemo({ customer }: SubscriptionStatusDemoProps) {
    const { t } = useTranslation('showcase');
    const data = exportPlaygroundData();
    const subscriptions = Object.values(data.subscriptions || {}) as QZPaySubscription[];

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

    const customerSubscriptions = subscriptions.filter((s) => s.customerId === customer.id);

    if (customerSubscriptions.length === 0) {
        return (
            <div className="space-y-6">
                <div className="card p-4">
                    <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                        {t('demos.subscriptionStatus.title')}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {t('demos.subscriptionStatus.description')}
                    </p>
                </div>
                <div className="card p-6">
                    <div className="flex items-center gap-3 text-amber-400">
                        <AlertCircle className="h-5 w-5" />
                        <p>{t('demos.subscriptionStatus.noSubscription')}</p>
                    </div>
                </div>
            </div>
        );
    }

    const handleCancel = () => {
        console.log('Cancel subscription requested');
        // In a real app, this would call billing.subscriptions.cancel()
    };

    return (
        <div className="space-y-6">
            {/* Demo Description */}
            <div className="card p-4">
                <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    {t('demos.subscriptionStatus.title')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {t('demos.subscriptionStatus.description')}
                </p>
            </div>

            {/* Live Components */}
            <div className="card p-6 space-y-4">
                <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('demos.livePreview')}
                </h4>
                {customerSubscriptions.map((subscription) => (
                    <SubscriptionStatus
                        key={subscription.id}
                        subscription={subscription}
                        showCancelButton={subscription.status === 'active'}
                        onCancel={handleCancel}
                    />
                ))}
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
                    {`import { SubscriptionStatus, useSubscription } from '@qazuor/qzpay-react';

function MySubscription() {
  const { subscription, cancel } = useSubscription({ customerId });

  if (!subscription) return <p>No active subscription</p>;

  return (
    <SubscriptionStatus
      subscription={subscription}
      showCancelButton
      onCancel={cancel}
    />
  );
}`}
                </pre>
            </div>
        </div>
    );
}
