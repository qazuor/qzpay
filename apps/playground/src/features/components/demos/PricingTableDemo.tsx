import { useTranslation } from 'react-i18next';
import { PricingTable } from '@qazuor/qzpay-react';
import { useCatalogStore } from '../../../stores/catalog.store';
import { AlertCircle } from 'lucide-react';
import type { QZPayPlan, QZPayPrice } from '@qazuor/qzpay-core';

export function PricingTableDemo() {
  const { t } = useTranslation('showcase');
  const { plans, prices } = useCatalogStore();

  const hasData = plans.length > 0 && prices.length > 0;

  const handleSelectPlan = (plan: QZPayPlan, price: QZPayPrice) => {
    console.log('Plan selected:', { plan: plan.name, planId: plan.id, priceId: price.id });
    // In a real app, this would trigger a checkout flow
  };

  if (!hasData) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 text-amber-400">
          <AlertCircle className="h-5 w-5" />
          <p>{t('demos.pricingTable.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Description */}
      <div className="card p-4">
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          {t('demos.pricingTable.title')}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('demos.pricingTable.description')}
        </p>
      </div>

      {/* Live Component */}
      <div className="card p-6">
        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {t('demos.livePreview')}
        </h4>
        <PricingTable
          plans={plans}
          onSelectPlan={handleSelectPlan}
        />
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
{`import { PricingTable } from '@qazuor/qzpay-react';

function Pricing() {
  const handleSelectPlan = (plan, price) => {
    // Navigate to checkout or create subscription
    console.log('Selected:', { plan, price });
  };

  return (
    <PricingTable
      onSelectPlan={handleSelectPlan}
      currency="USD"
      interval="month"
    />
  );
}`}
        </pre>
      </div>
    </div>
  );
}
