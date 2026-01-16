import type { QZPayBillingInterval, QZPayCurrency } from '@qazuor/qzpay-core';
import { Eye, Sliders, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config.store';

const CURRENCIES: QZPayCurrency[] = ['USD', 'EUR', 'GBP', 'ARS', 'BRL', 'MXN'];
const INTERVALS: QZPayBillingInterval[] = ['day', 'week', 'month', 'year'];

export function ExtendedConfig() {
    const { t } = useTranslation('setup');
    const { simulation, display, defaults, setSimulationConfig, setDisplayConfig, setDefaultsConfig } = useConfigStore();

    return (
        <div className="space-y-6">
            {/* Simulation Settings */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {t('extendedConfig.simulation.title')}
                    </h3>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    {t('extendedConfig.simulation.description')}
                </p>

                <div className="space-y-4">
                    {/* Auto Process Payments */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                                {t('extendedConfig.simulation.autoProcessPayments.label')}
                            </label>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {t('extendedConfig.simulation.autoProcessPayments.help')}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={simulation.autoProcessPayments}
                                onChange={(e) => setSimulationConfig({ autoProcessPayments: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]" />
                        </label>
                    </div>

                    {/* Webhook Delay */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.simulation.webhookDelay.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.simulation.webhookDelay.help')}
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="0"
                                max="5000"
                                step="100"
                                value={simulation.simulatedWebhookDelay}
                                onChange={(e) => setSimulationConfig({ simulatedWebhookDelay: Number.parseInt(e.target.value) })}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                            />
                            <span className="text-sm font-mono w-16 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                                {simulation.simulatedWebhookDelay}ms
                            </span>
                        </div>
                    </div>

                    {/* Payment Failure Rate */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.simulation.failureRate.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.simulation.failureRate.help')}
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={simulation.paymentFailureRate}
                                onChange={(e) => setSimulationConfig({ paymentFailureRate: Number.parseInt(e.target.value) })}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                            />
                            <span className="text-sm font-mono w-12 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                                {simulation.paymentFailureRate}%
                            </span>
                        </div>
                    </div>

                    {/* Trial Auto Convert */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                                {t('extendedConfig.simulation.trialAutoConvert.label')}
                            </label>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {t('extendedConfig.simulation.trialAutoConvert.help')}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={simulation.trialAutoConvert}
                                onChange={(e) => setSimulationConfig({ trialAutoConvert: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]" />
                        </label>
                    </div>
                </div>
            </div>

            {/* Display Preferences */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {t('extendedConfig.display.title')}
                    </h3>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    {t('extendedConfig.display.description')}
                </p>

                <div className="space-y-4">
                    {/* Show Full IDs */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                                {t('extendedConfig.display.showFullIds.label')}
                            </label>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {t('extendedConfig.display.showFullIds.help')}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={display.showFullIds}
                                onChange={(e) => setDisplayConfig({ showFullIds: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]" />
                        </label>
                    </div>

                    {/* Date Format */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.display.dateFormat.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.display.dateFormat.help')}
                        </p>
                        <select
                            value={display.dateFormat}
                            onChange={(e) => setDisplayConfig({ dateFormat: e.target.value as 'short' | 'long' | 'iso' })}
                            className="select"
                        >
                            <option value="short">{t('extendedConfig.display.dateFormat.options.short')}</option>
                            <option value="long">{t('extendedConfig.display.dateFormat.options.long')}</option>
                            <option value="iso">{t('extendedConfig.display.dateFormat.options.iso')}</option>
                        </select>
                    </div>

                    {/* Currency Display */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.display.currencyDisplay.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.display.currencyDisplay.help')}
                        </p>
                        <select
                            value={display.currencyDisplay}
                            onChange={(e) => setDisplayConfig({ currencyDisplay: e.target.value as 'symbol' | 'code' | 'name' })}
                            className="select"
                        >
                            <option value="symbol">{t('extendedConfig.display.currencyDisplay.options.symbol')}</option>
                            <option value="code">{t('extendedConfig.display.currencyDisplay.options.code')}</option>
                            <option value="name">{t('extendedConfig.display.currencyDisplay.options.name')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Default Values */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Sliders className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {t('extendedConfig.defaults.title')}
                    </h3>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    {t('extendedConfig.defaults.description')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Default Currency */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.defaults.currency.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.defaults.currency.help')}
                        </p>
                        <select
                            value={defaults.currency}
                            onChange={(e) => setDefaultsConfig({ currency: e.target.value as QZPayCurrency })}
                            className="select"
                        >
                            {CURRENCIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Default Billing Interval */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.defaults.billingInterval.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.defaults.billingInterval.help')}
                        </p>
                        <select
                            value={defaults.billingInterval}
                            onChange={(e) => setDefaultsConfig({ billingInterval: e.target.value as QZPayBillingInterval })}
                            className="select"
                        >
                            {INTERVALS.map((i) => (
                                <option key={i} value={i}>
                                    {t(`extendedConfig.defaults.billingInterval.options.${i}`)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Default Trial Days */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.defaults.trialDays.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.defaults.trialDays.help')}
                        </p>
                        <input
                            type="number"
                            min="0"
                            max="365"
                            value={defaults.trialDays}
                            onChange={(e) => setDefaultsConfig({ trialDays: Number.parseInt(e.target.value) || 0 })}
                            className="input"
                        />
                    </div>

                    {/* Invoice Days Until Due */}
                    <div>
                        <label className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                            {t('extendedConfig.defaults.invoiceDaysUntilDue.label')}
                        </label>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('extendedConfig.defaults.invoiceDaysUntilDue.help')}
                        </p>
                        <input
                            type="number"
                            min="1"
                            max="90"
                            value={defaults.invoiceDaysUntilDue}
                            onChange={(e) => setDefaultsConfig({ invoiceDaysUntilDue: Number.parseInt(e.target.value) || 30 })}
                            className="input"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
