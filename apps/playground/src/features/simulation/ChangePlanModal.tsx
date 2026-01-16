import type { QZPayPrice, QZPaySubscription } from '@qazuor/qzpay-core';
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, Check, Loader2, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';

interface ChangePlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscription: QZPaySubscription;
    onPlanChanged: () => void;
}

export function ChangePlanModal({ isOpen, onClose, subscription, onPlanChanged }: ChangePlanModalProps) {
    const { t } = useTranslation('simulation');
    const { t: tc } = useTranslation('common');
    const { billing } = useConfigStore();
    const { plans, prices } = useCatalogStore();

    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
    const [applyImmediately, setApplyImmediately] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get current plan and price
    const currentPlan = plans.find((p) => p.id === subscription.planId);
    const currentPrice = prices.find((p) => p.planId === subscription.planId);

    // Get available plans (excluding current)
    const availablePlans = useMemo(() => {
        return plans.filter((p) => p.id !== subscription.planId && p.active);
    }, [plans, subscription.planId]);

    // Get prices for selected plan
    const selectedPlanPrices = useMemo(() => {
        if (!selectedPlanId) return [];
        return prices.filter((p) => p.planId === selectedPlanId && p.active);
    }, [prices, selectedPlanId]);

    // Auto-select first price when plan changes
    const handleSelectPlan = (planId: string) => {
        setSelectedPlanId(planId);
        const planPrices = prices.filter((p) => p.planId === planId && p.active);
        if (planPrices.length > 0) {
            setSelectedPriceId(planPrices[0].id);
        }
        setError(null);
    };

    // Calculate if this is an upgrade or downgrade
    const selectedPrice = prices.find((p) => p.id === selectedPriceId);
    const isUpgrade = selectedPrice && currentPrice ? selectedPrice.unitAmount > currentPrice.unitAmount : null;

    // Get simulated time function from store
    const { getCurrentTime } = useConfigStore();

    // Calculate proration preview
    const prorationPreview = useMemo(() => {
        if (!selectedPrice || !currentPrice) return null;

        const now = getCurrentTime();
        const periodEnd = subscription.currentPeriodEnd;
        const periodStart = subscription.currentPeriodStart;

        const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 0 || totalDays <= 0) return null;

        const currentDailyRate = currentPrice.unitAmount / totalDays;
        const newDailyRate = selectedPrice.unitAmount / totalDays;

        const unusedCredit = Math.round(currentDailyRate * daysRemaining);
        const newCharge = Math.round(newDailyRate * daysRemaining);
        const netAmount = newCharge - unusedCredit;

        return {
            daysRemaining,
            unusedCredit,
            newCharge,
            netAmount,
            isCharge: netAmount > 0
        };
    }, [selectedPrice, currentPrice, subscription, getCurrentTime]);

    const formatAmount = (cents: number, curr = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: curr
        }).format(cents / 100);
    };

    const formatPrice = (price: QZPayPrice) => {
        const amount = formatAmount(price.unitAmount, price.currency);
        return `${amount}/${price.billingInterval}`;
    };

    const getPriceDifference = (newPrice: QZPayPrice) => {
        if (!currentPrice) return null;
        const diff = newPrice.unitAmount - currentPrice.unitAmount;
        if (diff === 0) return null;
        const sign = diff > 0 ? '+' : '';
        return `${sign}${formatAmount(diff, newPrice.currency)}`;
    };

    const handleChangePlan = async () => {
        if (!billing || !selectedPlanId || !selectedPriceId) return;

        setIsProcessing(true);
        setError(null);

        try {
            await billing.subscriptions.changePlan(subscription.id, {
                newPlanId: selectedPlanId,
                newPriceId: selectedPriceId,
                prorationBehavior: 'create_prorations',
                applyAt: applyImmediately ? 'immediately' : 'period_end'
            });

            onPlanChanged();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('subscriptions.changePlan.error'));
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                        {t('subscriptions.changePlan.title')}
                    </h3>
                    <button type="button" onClick={onClose} className="btn btn-ghost p-1">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="modal-body space-y-4">
                    {/* Current Plan Info */}
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                            {t('subscriptions.changePlan.currentPlan')}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {currentPlan?.name || subscription.planId}
                            </span>
                            {currentPrice && <span style={{ color: 'var(--color-text-secondary)' }}>{formatPrice(currentPrice)}</span>}
                        </div>
                    </div>

                    {/* Available Plans */}
                    <div>
                        <label className="label">{t('subscriptions.changePlan.selectNewPlan')}</label>
                        {availablePlans.length === 0 ? (
                            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                                <p style={{ color: 'var(--color-text-muted)' }}>{t('subscriptions.changePlan.noOtherPlans')}</p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {availablePlans.map((plan) => {
                                    const planPrices = prices.filter((p) => p.planId === plan.id && p.active);
                                    const mainPrice = planPrices[0];
                                    const priceDiff = mainPrice ? getPriceDifference(mainPrice) : null;
                                    const isSelected = selectedPlanId === plan.id;

                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            onClick={() => handleSelectPlan(plan.id)}
                                            className={`
                        p-3 rounded-lg border text-left transition-all
                        ${isSelected ? 'ring-2' : 'hover:border-[var(--color-accent)]'}
                      `}
                                            style={{
                                                backgroundColor: isSelected ? 'var(--color-accent-low)' : 'var(--color-surface)',
                                                borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)'
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {isSelected && <Check className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}
                                                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                                        {plan.name}
                                                    </span>
                                                    {priceDiff && (
                                                        <span
                                                            className={`text-xs font-medium ${
                                                                priceDiff.startsWith('+') ? 'text-green-400' : 'text-orange-400'
                                                            }`}
                                                        >
                                                            {priceDiff}
                                                        </span>
                                                    )}
                                                </div>
                                                {mainPrice && (
                                                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {formatPrice(mainPrice)}
                                                    </span>
                                                )}
                                            </div>
                                            {plan.description && (
                                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                                    {plan.description}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Price Selection (if multiple prices for selected plan) */}
                    {selectedPlanPrices.length > 1 && (
                        <div>
                            <label className="label">{t('subscriptions.changePlan.selectPrice')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                {selectedPlanPrices.map((price) => (
                                    <button
                                        key={price.id}
                                        type="button"
                                        onClick={() => setSelectedPriceId(price.id)}
                                        className={`
                      p-2 rounded-lg border text-center transition-all
                      ${selectedPriceId === price.id ? 'ring-2' : ''}
                    `}
                                        style={{
                                            backgroundColor:
                                                selectedPriceId === price.id ? 'var(--color-accent-low)' : 'var(--color-surface)',
                                            borderColor: selectedPriceId === price.id ? 'var(--color-accent)' : 'var(--color-border)'
                                        }}
                                    >
                                        {formatPrice(price)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Proration Preview */}
                    {prorationPreview && applyImmediately && (
                        <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                            <p
                                className="text-xs uppercase tracking-wide flex items-center gap-1"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                {isUpgrade ? (
                                    <ArrowUp className="h-3 w-3 text-green-400" />
                                ) : (
                                    <ArrowDown className="h-3 w-3 text-orange-400" />
                                )}
                                {t('subscriptions.changePlan.prorationPreview')}
                            </p>

                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                        {t('subscriptions.changePlan.unusedCredit')} ({prorationPreview.daysRemaining}{' '}
                                        {t('subscriptions.changePlan.days')})
                                    </span>
                                    <span className="text-green-400">
                                        -{formatAmount(prorationPreview.unusedCredit, currentPrice?.currency)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('subscriptions.changePlan.newPlanCharge')}</span>
                                    <span style={{ color: 'var(--color-text)' }}>
                                        +{formatAmount(prorationPreview.newCharge, selectedPrice?.currency)}
                                    </span>
                                </div>
                                <div
                                    className="flex justify-between pt-2 border-t font-medium"
                                    style={{ borderColor: 'var(--color-border)' }}
                                >
                                    <span style={{ color: 'var(--color-text)' }}>{t('subscriptions.changePlan.netAmount')}</span>
                                    <span className={prorationPreview.isCharge ? 'text-red-400' : 'text-green-400'}>
                                        {prorationPreview.isCharge ? '+' : '-'}
                                        {formatAmount(Math.abs(prorationPreview.netAmount), selectedPrice?.currency)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Apply Options */}
                    {selectedPlanId && (
                        <div>
                            <label className="label">{t('subscriptions.changePlan.applyWhen')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setApplyImmediately(true)}
                                    className={`
                    p-3 rounded-lg border text-left transition-all
                    ${applyImmediately ? 'ring-2' : ''}
                  `}
                                    style={{
                                        backgroundColor: applyImmediately ? 'var(--color-accent-low)' : 'var(--color-surface)',
                                        borderColor: applyImmediately ? 'var(--color-accent)' : 'var(--color-border)'
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                            {t('subscriptions.changePlan.immediately')}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {t('subscriptions.changePlan.immediatelyDesc')}
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setApplyImmediately(false)}
                                    className={`
                    p-3 rounded-lg border text-left transition-all
                    ${!applyImmediately ? 'ring-2' : ''}
                  `}
                                    style={{
                                        backgroundColor: !applyImmediately ? 'var(--color-accent-low)' : 'var(--color-surface)',
                                        borderColor: !applyImmediately ? 'var(--color-accent)' : 'var(--color-border)'
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                            {t('subscriptions.changePlan.atPeriodEnd')}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {subscription.currentPeriodEnd.toLocaleDateString()}
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Warning for Downgrade */}
                    {isUpgrade === false && (
                        <div className="p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-yellow-500">{t('subscriptions.changePlan.downgradeWarning')}</p>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button type="button" onClick={onClose} className="btn btn-secondary">
                        {tc('buttons.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleChangePlan}
                        className="btn btn-primary"
                        disabled={!selectedPlanId || !selectedPriceId || isProcessing}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('subscriptions.changePlan.processing')}
                            </>
                        ) : isUpgrade ? (
                            <>
                                <ArrowUp className="h-4 w-4" />
                                {t('subscriptions.changePlan.confirmUpgrade')}
                            </>
                        ) : (
                            <>
                                <ArrowDown className="h-4 w-4" />
                                {t('subscriptions.changePlan.confirmDowngrade')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
