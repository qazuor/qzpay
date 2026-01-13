import { AlertCircle, ArrowRight, CheckCircle2, Info, Key, Play, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config.store';
import type { PaymentMode } from '../../lib/billing';
import { TEST_CARDS } from '../../adapters/mock-payment.adapter';
import { TemplateSelector } from './TemplateSelector';
import { ExtendedConfig } from './ExtendedConfig';

export function SetupView() {
  const { t } = useTranslation('setup');
  const {
    paymentMode,
    stripeSecretKey,
    mercadopagoAccessToken,
    mercadopagoPublicKey,
    isInitialized,
    initError,
    setPaymentMode,
    setStripeSecretKey,
    setMercadopagoAccessToken,
    setMercadopagoPublicKey,
    initializeBilling,
  } = useConfigStore();

  const handleModeChange = (mode: PaymentMode) => {
    setPaymentMode(mode);
  };

  const handleSaveConfig = async () => {
    await initializeBilling();
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Page Header with Help */}
      <div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {t('title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('description')}
        </p>
      </div>

      {/* Info Box - Only show when not initialized */}
      {!isInitialized && (
        <div className="card p-4" style={{ backgroundColor: 'var(--color-accent-low)', borderColor: 'var(--color-accent)' }}>
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
            <div>
              <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                {t('firstTime.title')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }} dangerouslySetInnerHTML={{ __html: t('firstTime.description') }} />
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      {isInitialized && (
        <div
          className="flex items-center gap-2 p-4 rounded-lg"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80' }}
        >
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">
            {t('status.initialized', {
              mode: paymentMode === 'mock'
                ? t('status.modes.mock')
                : paymentMode === 'stripe'
                  ? t('status.modes.stripe')
                  : t('status.modes.mercadopago')
            })}
          </span>
        </div>
      )}

      {initError && (
        <div
          className="flex items-center gap-2 p-4 rounded-lg"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}
        >
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{initError}</span>
        </div>
      )}

      {/* Payment Mode Selection */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Server className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>{t('paymentMode.title')}</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {t('paymentMode.description')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mock Mode */}
          <button
            type="button"
            onClick={() => handleModeChange('mock')}
            className={`
              p-4 rounded-xl text-left transition-all duration-200 relative
              ${paymentMode === 'mock'
                ? 'ring-2'
                : 'hover:bg-[var(--color-surface-elevated)]'
              }
            `}
            style={{
              backgroundColor: paymentMode === 'mock' ? 'var(--color-accent-low)' : 'var(--color-surface-elevated)',
              borderColor: paymentMode === 'mock' ? 'var(--color-accent)' : 'transparent',
              ...(paymentMode === 'mock' ? { '--tw-ring-color': 'var(--color-accent)' } as React.CSSProperties : {}),
            }}
          >
            {paymentMode !== 'mock' && (
              <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">
                {t('paymentMode.mock.recommended')}
              </span>
            )}
            <div className="font-semibold" style={{ color: paymentMode === 'mock' ? 'var(--color-accent-high)' : 'var(--color-text)' }}>
              {t('paymentMode.mock.title')}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {t('paymentMode.mock.description')}
            </div>
            <ul className="text-xs mt-3 space-y-1" style={{ color: 'var(--color-text-muted)' }}>
              <li>• {t('paymentMode.mock.features.testCards')}</li>
              <li>• {t('paymentMode.mock.features.browserStorage')}</li>
              <li>• {t('paymentMode.mock.features.perfectLearning')}</li>
            </ul>
          </button>

          {/* Stripe Mode */}
          <button
            type="button"
            onClick={() => handleModeChange('stripe')}
            className={`
              p-4 rounded-xl text-left transition-all duration-200
              ${paymentMode === 'stripe'
                ? 'ring-2 ring-purple-500'
                : 'hover:bg-[var(--color-surface-elevated)]'
              }
            `}
            style={{
              backgroundColor: paymentMode === 'stripe' ? 'rgba(147, 51, 234, 0.2)' : 'var(--color-surface-elevated)',
            }}
          >
            <div className="font-semibold" style={{ color: paymentMode === 'stripe' ? '#c4b5fd' : 'var(--color-text)' }}>
              {t('paymentMode.stripe.title')}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {t('paymentMode.stripe.description')}
            </div>
            <ul className="text-xs mt-3 space-y-1" style={{ color: 'var(--color-text-muted)' }}>
              <li>• {t('paymentMode.stripe.features.realApi')}</li>
              <li>• {t('paymentMode.stripe.features.testCharges')}</li>
              <li>• {t('paymentMode.stripe.features.fullIntegration')}</li>
            </ul>
          </button>

          {/* MercadoPago Mode */}
          <button
            type="button"
            onClick={() => handleModeChange('mercadopago')}
            className={`
              p-4 rounded-xl text-left transition-all duration-200
              ${paymentMode === 'mercadopago'
                ? 'ring-2 ring-cyan-500'
                : 'hover:bg-[var(--color-surface-elevated)]'
              }
            `}
            style={{
              backgroundColor: paymentMode === 'mercadopago' ? 'rgba(6, 182, 212, 0.2)' : 'var(--color-surface-elevated)',
            }}
          >
            <div className="font-semibold" style={{ color: paymentMode === 'mercadopago' ? '#67e8f9' : 'var(--color-text)' }}>
              {t('paymentMode.mercadopago.title')}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {t('paymentMode.mercadopago.description')}
            </div>
            <ul className="text-xs mt-3 space-y-1" style={{ color: 'var(--color-text-muted)' }}>
              <li>• {t('paymentMode.mercadopago.features.realApi')}</li>
              <li>• {t('paymentMode.mercadopago.features.sandbox')}</li>
              <li>• {t('paymentMode.mercadopago.features.latam')}</li>
            </ul>
          </button>
        </div>
      </div>

      {/* API Keys */}
      {paymentMode !== 'mock' && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>{t('apiKeys.title')}</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {t('apiKeys.description')}
          </p>

          {paymentMode === 'stripe' && (
            <div>
              <label htmlFor="stripeKey" className="label">
                {t('apiKeys.stripe.label')}
              </label>
              <input
                id="stripeKey"
                type="password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
                placeholder={t('apiKeys.stripe.placeholder')}
                className="input"
              />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {t('apiKeys.stripe.help').split('<link>')[0]}
                <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                  {t('apiKeys.stripe.help').split('<link>')[1].split('</link>')[0]}
                </a>
                {t('apiKeys.stripe.help').split('</link>')[1]}
              </p>
            </div>
          )}

          {paymentMode === 'mercadopago' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="mpToken" className="label">
                  {t('apiKeys.mercadopago.label')}
                </label>
                <input
                  id="mpToken"
                  type="password"
                  value={mercadopagoAccessToken}
                  onChange={(e) => setMercadopagoAccessToken(e.target.value)}
                  placeholder={t('apiKeys.mercadopago.placeholder')}
                  className="input"
                />
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  {t('apiKeys.mercadopago.help').split('<link>')[0]}
                  <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                    {t('apiKeys.mercadopago.help').split('<link>')[1].split('</link>')[0]}
                  </a>
                  {t('apiKeys.mercadopago.help').split('</link>')[1]}
                </p>
              </div>
              <div>
                <label htmlFor="mpPublicKey" className="label">
                  Public Key (for card tokenization)
                </label>
                <input
                  id="mpPublicKey"
                  type="password"
                  value={mercadopagoPublicKey}
                  onChange={(e) => setMercadopagoPublicKey(e.target.value)}
                  placeholder="TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="input"
                />
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  Required for credit card payments. Find it in the same{' '}
                  <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                    developer panel
                  </a>
                  {' '}under "Public Key".
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initialize Button */}
      {!isInitialized && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={paymentMode === 'stripe' && !stripeSecretKey || paymentMode === 'mercadopago' && !mercadopagoAccessToken}
            className="btn btn-primary px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-5 w-5" />
            {t('buttons.initialize')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Re-initialize button when already initialized */}
      {isInitialized && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={paymentMode === 'stripe' && !stripeSecretKey || paymentMode === 'mercadopago' && !mercadopagoAccessToken}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" />
            {t('buttons.reinitialize')}
          </button>
        </div>
      )}

      {/* Test Cards Reference - Show for all modes when initialized */}
      {isInitialized && (
        <div className="card p-6">
          <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{t('testCards.title')}</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {t('testCards.description')}
          </p>

          {/* Mock Test Cards */}
          {paymentMode === 'mock' && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{TEST_CARDS.SUCCESS}</code>
                <span className="text-green-400">{t('testCards.success')}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{TEST_CARDS.DECLINED}</code>
                <span className="text-red-400">{t('testCards.declined')}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{TEST_CARDS.INSUFFICIENT_FUNDS}</code>
                <span className="text-red-400">{t('testCards.insufficientFunds')}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{TEST_CARDS.EXPIRED_CARD}</code>
                <span className="text-red-400">{t('testCards.expiredCard')}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{TEST_CARDS.REQUIRES_3DS}</code>
                <span className="text-orange-400">{t('testCards.requires3ds')}</span>
              </div>
              <div className="flex justify-between py-2">
                <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{TEST_CARDS.ATTACH_FAILS}</code>
                <span className="text-red-400">{t('testCards.attachFails')}</span>
              </div>
            </div>
          )}

          {/* Stripe Test Cards */}
          {paymentMode === 'stripe' && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>4242 4242 4242 4242</code>
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 12/34</span>
                </div>
                <span className="text-green-400">{t('testCards.success')}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>4000 0000 0000 0002</code>
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 12/34</span>
                </div>
                <span className="text-red-400">{t('testCards.declined')}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>4000 0000 0000 9995</code>
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 12/34</span>
                </div>
                <span className="text-red-400">{t('testCards.insufficientFunds')}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>4000 0000 0000 3220</code>
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 12/34</span>
                </div>
                <span className="text-orange-400">{t('testCards.requires3ds')}</span>
              </div>
              <div className="flex justify-between py-2">
                <div>
                  <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>4000 0000 0000 0069</code>
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 12/34</span>
                </div>
                <span className="text-red-400">{t('testCards.expiredCard')}</span>
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                {t('testCards.stripeDocsLink')}{' '}
                <a href="https://stripe.com/docs/testing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                  stripe.com/docs/testing
                </a>
              </p>
            </div>
          )}

          {/* MercadoPago Test Cards */}
          {paymentMode === 'mercadopago' && (
            <div className="space-y-4 text-sm">
              {/* Argentina */}
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Argentina (ARS)
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>5031 7557 3453 0604</code>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 11/30</span>
                    </div>
                    <span className="text-green-400">{t('testCards.success')}</span>
                  </div>
                  <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>5031 7557 3453 0604</code>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 456, Exp: 11/30</span>
                    </div>
                    <span className="text-red-400">{t('testCards.declined')}</span>
                  </div>
                </div>
              </div>

              {/* Mexico */}
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  México (MXN)
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>5474 9254 3267 0366</code>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 11/30</span>
                    </div>
                    <span className="text-green-400">{t('testCards.success')}</span>
                  </div>
                </div>
              </div>

              {/* Brazil */}
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Brasil (BRL)
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-2">
                    <div>
                      <code className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>5031 4332 1540 6351</code>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>CVV: 123, Exp: 11/30</span>
                    </div>
                    <span className="text-green-400">{t('testCards.success')}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                {t('testCards.mercadopagoDocsLink')}{' '}
                <a href="https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/cards" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                  mercadopago.com/developers
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Next Steps - Only when initialized */}
      {isInitialized && (
        <div className="card p-6" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            {t('nextSteps.title')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)', color: 'var(--color-accent)' }}>
                1
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>{t('nextSteps.createPlans.title')}</p>
                <p style={{ color: 'var(--color-text-muted)' }}>{t('nextSteps.createPlans.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)', color: 'var(--color-accent)' }}>
                2
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>{t('nextSteps.addPrices.title')}</p>
                <p style={{ color: 'var(--color-text-muted)' }}>{t('nextSteps.addPrices.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)', color: 'var(--color-accent)' }}>
                3
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>{t('nextSteps.createCustomers.title')}</p>
                <p style={{ color: 'var(--color-text-muted)' }}>{t('nextSteps.createCustomers.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)', color: 'var(--color-accent)' }}>
                4
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>{t('nextSteps.subscribe.title')}</p>
                <p style={{ color: 'var(--color-text-muted)' }}>{t('nextSteps.subscribe.description')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start Templates - Only when initialized */}
      {isInitialized && (
        <div className="card p-6">
          <TemplateSelector />
        </div>
      )}

      {/* Extended Configuration - Only when initialized */}
      {isInitialized && <ExtendedConfig />}
    </div>
  );
}
