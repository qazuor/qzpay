import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  Copy,
  Check,
  Settings,
  Clock,
  DollarSign,
  Users,
  Package,
  FileText,
  Tag,
  Shield,
  Sliders,
} from 'lucide-react';
import { useState } from 'react';
import { TEST_CARDS } from '../../../adapters/mock-payment.adapter';
import { useConfigStore } from '../../../stores/config.store';
import { useCatalogStore } from '../../../stores/catalog.store';
import { exportPlaygroundData } from '../../../adapters/local-storage.adapter';
import type { ViewType } from '../../../App';

interface QuickReferencePanelProps {
  currentView: ViewType;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 rounded hover:bg-opacity-20 hover:bg-white transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
      )}
    </button>
  );
}

export function QuickReferencePanel({ currentView }: QuickReferencePanelProps) {
  const { t } = useTranslation('sidebar');
  const { paymentMode, simulation, defaults } = useConfigStore();
  const { plans, prices, entitlementDefinitions, limitDefinitions } = useCatalogStore();

  // Get counts from localStorage
  const data = exportPlaygroundData();
  const customerCount = Object.keys(data.customers || {}).length;
  const subscriptionCount = Object.keys(data.subscriptions || {}).length;
  const addonCount = Object.keys(data.addons || {}).length;
  const promoCount = Object.keys(data.promoCodes || {}).length;

  const mockTestCards = [
    { number: TEST_CARDS.SUCCESS, status: 'success', labelKey: 'testCards.success' },
    { number: TEST_CARDS.DECLINED, status: 'error', labelKey: 'testCards.declined' },
    { number: TEST_CARDS.INSUFFICIENT_FUNDS, status: 'error', labelKey: 'testCards.insufficientFunds' },
    { number: TEST_CARDS.REQUIRES_3DS, status: 'warning', labelKey: 'testCards.requires3ds' },
    { number: TEST_CARDS.EXPIRED_CARD, status: 'error', labelKey: 'testCards.expiredCard' },
  ];

  const stripeTestCards = [
    { number: '4242424242424242', status: 'success', labelKey: 'testCards.success', extra: 'CVV: 123' },
    { number: '4000000000000002', status: 'error', labelKey: 'testCards.declined', extra: 'CVV: 123' },
    { number: '4000000000009995', status: 'error', labelKey: 'testCards.insufficientFunds', extra: 'CVV: 123' },
    { number: '4000000000003220', status: 'warning', labelKey: 'testCards.requires3ds', extra: 'CVV: 123' },
  ];

  const mercadopagoTestCards = [
    { number: '5031755734530604', status: 'success', labelKey: 'testCards.success', extra: 'CVV: 123', country: 'AR' },
    { number: '5031755734530604', status: 'error', labelKey: 'testCards.declined', extra: 'CVV: 456', country: 'AR' },
    { number: '5474925432670366', status: 'success', labelKey: 'testCards.success', extra: 'CVV: 123', country: 'MX' },
    { number: '5031433215406351', status: 'success', labelKey: 'testCards.success', extra: 'CVV: 123', country: 'BR' },
  ];

  const getTestCards = () => {
    switch (paymentMode) {
      case 'stripe':
        return stripeTestCards;
      case 'mercadopago':
        return mercadopagoTestCards;
      default:
        return mockTestCards;
    }
  };

  const testCards = getTestCards();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-orange-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  // Context-aware quick info based on current view
  const getContextualInfo = () => {
    switch (currentView) {
      case 'customers':
      case 'subscriptions':
        return (
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {t('contextual.availablePlans')}
            </div>
            {plans.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t('contextual.noPlans')}
              </p>
            ) : (
              <div className="space-y-1">
                {plans.slice(0, 5).map((plan) => {
                  const planPrices = prices.filter((p) => p.planId === plan.id);
                  return (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between text-xs p-1.5 rounded"
                      style={{ backgroundColor: 'var(--color-bg)' }}
                    >
                      <span style={{ color: 'var(--color-text)' }}>{plan.name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {planPrices.length} {planPrices.length === 1 ? 'price' : 'prices'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      case 'payments':
      case 'invoices':
        return (
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {t('contextual.simulationSettings')}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>{t('contextual.autoProcess')}</span>
                <span style={{ color: simulation.autoProcessPayments ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {simulation.autoProcessPayments ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>{t('contextual.failureRate')}</span>
                <span style={{ color: 'var(--color-text)' }}>{simulation.paymentFailureRate}%</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>{t('contextual.webhookDelay')}</span>
                <span style={{ color: 'var(--color-text)' }}>{simulation.simulatedWebhookDelay}ms</span>
              </div>
            </div>
          </div>
        );
      case 'entitlements':
        return (
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {t('contextual.entitlementStats')}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div style={{ color: 'var(--color-text-muted)' }}>{t('contextual.defined')}</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>
                  {entitlementDefinitions.length}
                </div>
              </div>
              <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div style={{ color: 'var(--color-text-muted)' }}>{t('contextual.plansUsing')}</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>
                  {plans.filter((p) => p.entitlements && p.entitlements.length > 0).length}
                </div>
              </div>
            </div>
          </div>
        );
      case 'limits':
        return (
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {t('contextual.limitStats')}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div style={{ color: 'var(--color-text-muted)' }}>{t('contextual.defined')}</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>
                  {limitDefinitions.length}
                </div>
              </div>
              <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div style={{ color: 'var(--color-text-muted)' }}>{t('contextual.plansUsing')}</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>
                  {plans.filter((p) => p.limits && Object.keys(p.limits).length > 0).length}
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const contextualInfo = getContextualInfo();

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {/* Test Cards - Always visible */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
            {t('testCards.title')}
          </span>
          {paymentMode !== 'mock' && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }}>
              {paymentMode === 'stripe' ? 'Stripe' : 'MercadoPago'}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {testCards.map((card, index) => (
            <div
              key={`${card.number}-${index}`}
              className="flex items-center justify-between text-xs p-1.5 rounded"
              style={{ backgroundColor: 'var(--color-bg)' }}
            >
              <div className="flex flex-col">
                <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                  {card.number}
                </code>
                {'extra' in card && (
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {card.extra}
                    {'country' in card && ` (${card.country})`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className={getStatusColor(card.status)}>{t(card.labelKey)}</span>
                <CopyButton text={card.number} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Config Summary */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
            {t('config.title')}
          </span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between p-1.5 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>{t('config.mode')}</span>
            <span
              className="font-medium"
              style={{ color: paymentMode === 'mock' ? 'var(--color-accent)' : 'var(--color-success)' }}
            >
              {paymentMode === 'mock' ? 'Mock' : paymentMode === 'stripe' ? 'Stripe' : 'MercadoPago'}
            </span>
          </div>
          <div className="flex justify-between p-1.5 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>{t('config.currency')}</span>
            <span style={{ color: 'var(--color-text)' }}>{defaults.currency}</span>
          </div>
          <div className="flex justify-between p-1.5 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>{t('config.defaultInterval')}</span>
            <span style={{ color: 'var(--color-text)' }}>{defaults.billingInterval}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
            {t('stats.title')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Package className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.plans')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{plans.length}</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <DollarSign className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.prices')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{prices.length}</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Users className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.customers')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{customerCount}</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <FileText className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.subs')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{subscriptionCount}</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Tag className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.addons')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{addonCount}</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Tag className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.promos')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{promoCount}</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Shield className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.entitlements')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{entitlementDefinitions.length}</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Sliders className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{t('stats.limits')}</span>
            <span className="ml-auto font-medium" style={{ color: 'var(--color-text)' }}>{limitDefinitions.length}</span>
          </div>
        </div>
      </div>

      {/* Contextual Info based on current view */}
      {contextualInfo && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {contextualInfo}
        </div>
      )}
    </div>
  );
}
