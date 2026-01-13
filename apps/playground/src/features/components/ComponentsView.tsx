import { useState } from 'react';
import { Box, Code, ExternalLink, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../stores/catalog.store';
import { exportPlaygroundData } from '../../adapters/local-storage.adapter';
import type { QZPayCustomer } from '@qazuor/qzpay-core';

// Component demos
import { PricingTableDemo } from './demos/PricingTableDemo';
import { SubscriptionStatusDemo } from './demos/SubscriptionStatusDemo';
import { InvoiceListDemo } from './demos/InvoiceListDemo';
import { EntitlementGateDemo } from './demos/EntitlementGateDemo';
import { LimitGateDemo } from './demos/LimitGateDemo';

type DemoTab =
  | 'overview'
  | 'pricing-table'
  | 'subscription-status'
  | 'invoice-list'
  | 'entitlement-gate'
  | 'limit-gate';

const DEMO_TABS: { id: DemoTab; labelKey: string }[] = [
  { id: 'overview', labelKey: 'tabs.overview' },
  { id: 'pricing-table', labelKey: 'tabs.pricingTable' },
  { id: 'subscription-status', labelKey: 'tabs.subscriptionStatus' },
  { id: 'invoice-list', labelKey: 'tabs.invoiceList' },
  { id: 'entitlement-gate', labelKey: 'tabs.entitlementGate' },
  { id: 'limit-gate', labelKey: 'tabs.limitGate' },
];

export function ComponentsView() {
  const { t } = useTranslation('showcase');
  const [activeTab, setActiveTab] = useState<DemoTab>('overview');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { plans, prices } = useCatalogStore();

  // Get customers from localStorage
  const data = exportPlaygroundData();
  const customers = Object.values(data.customers || {}) as QZPayCustomer[];

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const hasData = plans.length > 0 && prices.length > 0;
  const hasCustomers = customers.length > 0;

  const renderDemo = () => {
    switch (activeTab) {
      case 'pricing-table':
        return <PricingTableDemo />;
      case 'subscription-status':
        return <SubscriptionStatusDemo customer={selectedCustomer} />;
      case 'invoice-list':
        return <InvoiceListDemo customer={selectedCustomer} />;
      case 'entitlement-gate':
        return <EntitlementGateDemo customer={selectedCustomer} />;
      case 'limit-gate':
        return <LimitGateDemo customer={selectedCustomer} />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Package Info */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-accent-low)' }}>
            <Box className="h-6 w-6" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              @qazuor/qzpay-react
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('overview.packageDescription')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <a
            href="https://www.npmjs.com/package/@qazuor/qzpay-react"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            <ExternalLink className="h-3 w-3" />
            npm
          </a>
          <a
            href="https://github.com/qazuor/qzpay/tree/main/packages/react"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            <Code className="h-3 w-3" />
            {t('overview.sourceCode')}
          </a>
        </div>
      </div>

      {/* Components Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO_TABS.filter((tab) => tab.id !== 'overview').map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="card p-4 text-left hover:ring-2 transition-all"
            style={{ '--tw-ring-color': 'var(--color-accent)' } as React.CSSProperties}
          >
            <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              {t(tab.labelKey)}
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t(`descriptions.${tab.id}`)}
            </p>
          </button>
        ))}
      </div>

      {/* Prerequisites */}
      {!hasData && (
        <div
          className="card p-4"
          style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.5)' }}
        >
          <p className="text-sm" style={{ color: '#fbbf24' }}>
            {t('overview.prerequisitesWarning')}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {t('title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('description')}
        </p>
      </div>

      {/* Customer Selector - Only show for component demos (not overview) */}
      {activeTab !== 'overview' && activeTab !== 'pricing-table' && (
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {t('customerSelector.label')}
              </label>
            </div>
            {hasCustomers ? (
              <select
                value={selectedCustomerId || ''}
                onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                className="select flex-1"
              >
                <option value="">{t('customerSelector.placeholder')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.email})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t('customerSelector.noCustomers')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {DEMO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2'
                : ''
            }`}
            style={{
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              borderBottomColor: activeTab === tab.id ? 'var(--color-accent)' : 'transparent',
            }}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Demo Content */}
      {renderDemo()}
    </div>
  );
}
