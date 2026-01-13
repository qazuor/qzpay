import { ArrowRight, ArrowUpDown, CreditCard, Play, Pause, Plus, XCircle, X, AlertTriangle, RefreshCw, Package, DollarSign } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config.store';
import { useCatalogStore } from '../../stores/catalog.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { PaymentModal, type PaymentResult } from './PaymentModal';
import { ChangePlanModal } from './ChangePlanModal';
import { AddOnModal } from './AddOnModal';
import { OneTimePaymentModal } from './OneTimePaymentModal';
import type { QZPaySubscription, QZPayCustomer, QZPayPrice } from '@qazuor/qzpay-core';

/**
 * Safely convert a value to Date
 * Handles both Date objects and ISO strings
 */
function toDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Safely format a date value
 * Handles both Date objects and ISO strings
 */
function formatDate(value: Date | string | undefined | null): string {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleDateString();
}

export function SubscriptionsView() {
  const { t } = useTranslation('simulation');
  const { t: tc } = useTranslation('common');
  const { billing, isInitialized, getCurrentTime, timeSimulation } = useConfigStore();
  const { plans, prices, loadCatalog } = useCatalogStore();
  const [subscriptions, setSubscriptions] = useState<QZPaySubscription[]>([]);
  const [customers, setCustomers] = useState<QZPayCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    priceId: '',
    requireCardForTrial: false,
    promoCode: '',
  });
  const [promoValidation, setPromoValidation] = useState<{
    valid: boolean;
    discountAmount?: number;
    discountPercent?: number;
    error?: string;
  } | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingSubscription, setPendingSubscription] = useState<{
    customerId: string;
    planId: string;
    priceId: string;
    amount: number;
    currency: string;
    description: string;
    hasTrial: boolean;
    trialDays: number | null;
  } | null>(null);

  // Change plan modal state
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [subscriptionToChange, setSubscriptionToChange] = useState<QZPaySubscription | null>(null);

  // Add-on modal state
  const [addOnModalOpen, setAddOnModalOpen] = useState(false);
  const [subscriptionForAddOn, setSubscriptionForAddOn] = useState<QZPaySubscription | null>(null);

  // One-time payment modal state
  const [oneTimePaymentModalOpen, setOneTimePaymentModalOpen] = useState(false);

  // Renewal modal state
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [subscriptionToRenew, setSubscriptionToRenew] = useState<{
    subscription: QZPaySubscription;
    amount: number;
    currency: string;
  } | null>(null);

  // Get subscriptions that need renewal based on simulated time
  const getSubscriptionsNeedingRenewal = useCallback(() => {
    if (!timeSimulation.enabled) return [];
    const currentTime = getCurrentTime();
    return subscriptions.filter(sub => {
      if (sub.status !== 'active' && sub.status !== 'trialing') return false;
      const periodEnd = toDate(sub.currentPeriodEnd);
      return periodEnd ? periodEnd <= currentTime : false;
    });
  }, [subscriptions, timeSimulation.enabled, getCurrentTime]);

  const subscriptionsNeedingRenewal = getSubscriptionsNeedingRenewal();

  const loadData = async () => {
    if (!billing) return;
    setIsLoading(true);
    try {
      const [subsResult, custResult] = await Promise.all([
        billing.subscriptions.list(),
        billing.customers.list(),
      ]);
      setSubscriptions(subsResult.data);
      setCustomers(custResult.data);
      loadCatalog();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadData();
    }
  }, [isInitialized]);

  // Track simulated date changes to refresh data when time advances
  const prevSimulatedDate = useRef<Date | null>(null);
  useEffect(() => {
    const currentDate = timeSimulation.simulatedDate;
    // Only reload if the simulated date actually changed (not just on mount)
    if (prevSimulatedDate.current !== null &&
        currentDate !== null &&
        currentDate.getTime() !== prevSimulatedDate.current.getTime() &&
        isInitialized) {
      loadData();
    }
    prevSimulatedDate.current = currentDate;
  }, [timeSimulation.simulatedDate, isInitialized]);

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || customer?.email || customerId.slice(0, 12);
  };

  const getPlanName = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    return plan?.name || planId.slice(0, 12);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'trialing':
        return 'badge-primary';
      case 'paused':
        return 'badge-warning';
      case 'canceled':
        return 'badge-error';
      case 'past_due':
        return 'badge-warning';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const formatPrice = (price: QZPayPrice) => {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency,
    }).format(price.unitAmount / 100);
    return `${amount}/${price.billingInterval}`;
  };

  const handlePause = async (id: string) => {
    if (!billing) return;
    await billing.subscriptions.pause(id);
    loadData();
  };

  const handleResume = async (id: string) => {
    if (!billing) return;
    await billing.subscriptions.resume(id);
    loadData();
  };

  const handleCancel = async (id: string) => {
    if (!billing) return;
    if (confirm(t('subscriptions.confirmCancel'))) {
      await billing.subscriptions.cancel(id, { cancelAtPeriodEnd: false });
      loadData();
    }
  };

  const handleOpenChangePlan = (subscription: QZPaySubscription) => {
    setSubscriptionToChange(subscription);
    setChangePlanModalOpen(true);
  };

  const handleOpenAddOns = (subscription: QZPaySubscription) => {
    setSubscriptionForAddOn(subscription);
    setAddOnModalOpen(true);
  };

  // Handle subscription renewal
  const handleRenewSubscription = (subscription: QZPaySubscription) => {
    const price = prices.find(p => p.planId === subscription.planId);
    if (!price) return;

    setSubscriptionToRenew({
      subscription,
      amount: price.unitAmount,
      currency: price.currency,
    });
    setRenewalModalOpen(true);
  };

  const handleRenewalComplete = async (result: PaymentResult) => {
    if (!billing || !subscriptionToRenew) return;

    try {
      if (result.status === 'succeeded') {
        const { subscription } = subscriptionToRenew;

        // Create invoice for the renewal
        const invoice = await billing.invoices.create({
          customerId: subscription.customerId,
          subscriptionId: subscription.id,
          lines: [{
            description: `${getPlanName(subscription.planId)} - Renewal`,
            quantity: 1,
            unitAmount: subscriptionToRenew.amount,
          }],
        });

        // Mark invoice as paid
        if (result.paymentId) {
          await billing.invoices.markPaid(invoice.id, result.paymentId);
        }

        // Update subscription period (advance to next period)
        const currentEnd = new Date(subscription.currentPeriodEnd);
        const newStart = new Date(currentEnd);
        const newEnd = new Date(currentEnd);

        // Calculate next period based on interval
        switch (subscription.interval) {
          case 'day':
            newEnd.setDate(newEnd.getDate() + (subscription.intervalCount || 1));
            break;
          case 'week':
            newEnd.setDate(newEnd.getDate() + 7 * (subscription.intervalCount || 1));
            break;
          case 'month':
            newEnd.setMonth(newEnd.getMonth() + (subscription.intervalCount || 1));
            break;
          case 'year':
            newEnd.setFullYear(newEnd.getFullYear() + (subscription.intervalCount || 1));
            break;
        }

        // Update subscription via storage (since we need to update dates)
        const storage = billing.getStorage();
        await storage.subscriptions.update(subscription.id, {
          currentPeriodStart: newStart,
          currentPeriodEnd: newEnd,
          status: 'active', // Ensure active (in case it was trialing)
        });

        loadData();
      } else {
        alert(result.error || t('subscriptions.renewal.failed', 'Renewal payment failed'));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to process renewal');
    } finally {
      setSubscriptionToRenew(null);
      setRenewalModalOpen(false);
    }
  };

  // Validate promo code
  const handleValidatePromoCode = async () => {
    if (!billing || !formData.promoCode.trim()) {
      setPromoValidation(null);
      return;
    }

    setIsValidatingPromo(true);
    try {
      const result = await billing.promoCodes.validate(
        formData.promoCode.trim().toUpperCase(),
        formData.customerId,
        prices.find(p => p.id === formData.priceId)?.planId
      );
      setPromoValidation({
        valid: result.valid,
        discountAmount: result.discountAmount,
        discountPercent: result.discountPercent,
        error: result.error,
      });
    } catch (error) {
      setPromoValidation({
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate promo code',
      });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  // Calculate discounted amount
  const calculateDiscountedAmount = (originalAmount: number) => {
    if (!promoValidation?.valid) return originalAmount;

    if (promoValidation.discountPercent) {
      return Math.round(originalAmount * (1 - promoValidation.discountPercent / 100));
    }
    if (promoValidation.discountAmount) {
      return Math.max(0, originalAmount - promoValidation.discountAmount);
    }
    return originalAmount;
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billing || !formData.customerId || !formData.priceId) return;

    // Check if customer already has an active subscription
    const existingSubscription = subscriptions.find(
      sub => sub.customerId === formData.customerId &&
             (sub.status === 'active' || sub.status === 'trialing')
    );
    if (existingSubscription) {
      alert(t('subscriptions.errors.alreadyHasSubscription',
        'This customer already has an active subscription. Use Change Plan to upgrade/downgrade.'));
      return;
    }

    // Get planId and price info from the selected price
    const selectedPrice = prices.find(p => p.id === formData.priceId);
    if (!selectedPrice) return;

    const plan = plans.find(p => p.id === selectedPrice.planId);
    const hasTrial = selectedPrice.trialDays && selectedPrice.trialDays > 0;

    // If trial and not requiring card, skip payment
    if (hasTrial && !formData.requireCardForTrial) {
      try {
        await billing.subscriptions.create({
          customerId: formData.customerId,
          planId: selectedPrice.planId,
          priceId: formData.priceId,
          trialDays: selectedPrice.trialDays ?? undefined,
        });
        setFormData({ customerId: '', priceId: '', requireCardForTrial: false, promoCode: '' }); setPromoValidation(null);
        setIsModalOpen(false);
        loadData();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to create subscription');
      }
      return;
    }

    // Calculate final amount with discount
    const discountedAmount = calculateDiscountedAmount(selectedPrice.unitAmount);

    // Otherwise, show payment modal
    setPendingSubscription({
      customerId: formData.customerId,
      planId: selectedPrice.planId,
      priceId: formData.priceId,
      amount: discountedAmount,
      currency: selectedPrice.currency,
      description: `${plan?.name || 'Subscription'} - ${t('subscriptions.payment.firstPayment')}${promoValidation?.valid ? ` (${formData.promoCode.toUpperCase()})` : ''}`,
      hasTrial: !!hasTrial,
      trialDays: selectedPrice.trialDays ?? null,
    });

    // Apply promo code if valid
    if (promoValidation?.valid && formData.promoCode) {
      try {
        await billing.promoCodes.apply(formData.promoCode.toUpperCase(), 'pending');
      } catch {
        // Promo code application will be done after subscription creation
      }
    }

    setIsModalOpen(false);
    setPaymentModalOpen(true);
  };

  const handlePaymentComplete = async (result: PaymentResult) => {
    if (!billing || !pendingSubscription) return;

    try {
      if (result.status === 'succeeded') {
        // If this is a trial with card required, we just collected the card - no invoice yet
        if (pendingSubscription.hasTrial && pendingSubscription.trialDays) {
          // Create subscription with trial
          await billing.subscriptions.create({
            customerId: pendingSubscription.customerId,
            planId: pendingSubscription.planId,
            priceId: pendingSubscription.priceId,
            trialDays: pendingSubscription.trialDays,
            metadata: {
              paymentMethodCollected: true,
              collectedPaymentId: result.paymentId,
            },
          });
        } else {
          // Regular subscription with first payment - create invoice
          const invoice = await billing.invoices.create({
            customerId: pendingSubscription.customerId,
            lines: [{
              description: pendingSubscription.description,
              quantity: 1,
              unitAmount: pendingSubscription.amount,
            }],
          });

          // Mark invoice as paid
          if (result.paymentId) {
            await billing.invoices.markPaid(invoice.id, result.paymentId);
          }

          // Create subscription as active (no trial)
          await billing.subscriptions.create({
            customerId: pendingSubscription.customerId,
            planId: pendingSubscription.planId,
            priceId: pendingSubscription.priceId,
            metadata: {
              firstPaymentId: result.paymentId,
              firstInvoiceId: invoice.id,
            },
          });
        }

        loadData();
      } else {
        // Payment failed - show error but don't create subscription
        alert(result.error || t('subscriptions.payment.failed'));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create subscription');
    } finally {
      setPendingSubscription(null);
      setPaymentModalOpen(false);
      setFormData({ customerId: '', priceId: '', requireCardForTrial: false, promoCode: '' }); setPromoValidation(null);
    }
  };

  const canCreateSubscription = customers.length > 0 && prices.length > 0;

  // Get selected price for showing trial info in modal
  const selectedPrice = prices.find(p => p.id === formData.priceId);
  const hasTrial = selectedPrice?.trialDays && selectedPrice.trialDays > 0;

  if (!isInitialized) {
    return (
      <EmptyState
        icon={CreditCard}
        title={tc('billingNotInitialized.title')}
        description={tc('billingNotInitialized.description')}
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t('subscriptions.title')}
        description={t('subscriptions.description')}
        icon={CreditCard}
        helpTitle={t('subscriptions.helpTitle')}
        helpContent={
          <div className="space-y-2">
            <p>
              {t('subscriptions.helpContent')}
            </p>
            <div className="flex flex-wrap gap-4 mt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="badge badge-success">active</span>
                <span>{t('subscriptions.statuses.active')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-primary">trialing</span>
                <span>{t('subscriptions.statuses.trialing')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-warning">paused</span>
                <span>{t('subscriptions.statuses.paused')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-error">canceled</span>
                <span>{t('subscriptions.statuses.canceled')}</span>
              </div>
            </div>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {customers.length > 0 && (
              <button
                type="button"
                onClick={() => setOneTimePaymentModalOpen(true)}
                className="btn btn-secondary"
              >
                <DollarSign className="h-4 w-4" />
                {t('subscriptions.oneTimePayment', 'One-time Payment')}
              </button>
            )}
            {canCreateSubscription && (
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    customerId: customers[0]?.id ?? '',
                    priceId: prices[0]?.id ?? '',
                    requireCardForTrial: false,
                    promoCode: '',
                  });
                  setPromoValidation(null);
                  setIsModalOpen(true);
                }}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4" />
                {t('subscriptions.createSubscription')}
              </button>
            )}
          </div>
        }
      />

      {/* Renewals Pending Alert */}
      {subscriptionsNeedingRenewal.length > 0 && (
        <div
          className="card p-4 flex items-start gap-3"
          style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: '#eab308' }}
        >
          <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: '#eab308' }} />
          <div className="flex-1">
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>
              {t('subscriptions.renewal.pendingTitle', { count: subscriptionsNeedingRenewal.length })}
            </p>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              {t('subscriptions.renewal.pendingDescription', 'These subscriptions have passed their billing period and need to be renewed.')}
            </p>
            <div className="space-y-2 mb-3">
              {subscriptionsNeedingRenewal.slice(0, 3).map(sub => (
                <div key={sub.id} className="flex items-center justify-between text-sm bg-black/20 rounded px-3 py-2">
                  <span style={{ color: 'var(--color-text)' }}>
                    {getCustomerName(sub.customerId)} - {getPlanName(sub.planId)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRenewSubscription(sub)}
                    className="btn btn-primary py-1 px-3 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t('subscriptions.renewal.renew', 'Renew')}
                  </button>
                </div>
              ))}
              {subscriptionsNeedingRenewal.length > 3 && (
                <p className="text-xs text-gray-500">
                  +{subscriptionsNeedingRenewal.length - 3} {t('subscriptions.renewal.more', 'more')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning if prerequisites missing */}
      {!canCreateSubscription && (
        <div
          className="card p-4 flex items-start gap-3"
          style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: '#eab308' }}
        >
          <ArrowRight className="h-5 w-5 mt-0.5" style={{ color: '#eab308' }} />
          <div>
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>
              {t('subscriptions.prerequisitesNeeded.title')}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('subscriptions.prerequisitesNeeded.description')}
              {customers.length === 0 && <span className="block" dangerouslySetInnerHTML={{ __html: `• ${t('subscriptions.prerequisitesNeeded.needCustomer')}` }} />}
              {prices.length === 0 && <span className="block" dangerouslySetInnerHTML={{ __html: `• ${t('subscriptions.prerequisitesNeeded.needPrice')}` }} />}
            </p>
          </div>
        </div>
      )}

      {/* Subscriptions List */}
      {isLoading ? (
        <div className="card p-8">
          <div className="text-center">
            <p style={{ color: 'var(--color-text-secondary)' }}>{t('subscriptions.loading')}</p>
          </div>
        </div>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t('subscriptions.empty.title')}
          description={t('subscriptions.empty.description')}
          action={
            canCreateSubscription && (
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    customerId: customers[0]?.id ?? '',
                    priceId: prices[0]?.id ?? '',
                    requireCardForTrial: false,
                    promoCode: '',
                  });
                  setPromoValidation(null);
                  setIsModalOpen(true);
                }}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4" />
                {t('subscriptions.empty.createFirst')}
              </button>
            )
          }
          tips={[
            t('subscriptions.tips.tip1'),
            t('subscriptions.tips.tip2'),
            t('subscriptions.tips.tip3'),
          ]}
        />
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const needsRenewal = subscriptionsNeedingRenewal.some(s => s.id === sub.id);
            return (
              <div
                key={sub.id}
                className={`card p-4 ${needsRenewal ? 'border-yellow-500/50' : ''}`}
                style={needsRenewal ? { backgroundColor: 'rgba(234, 179, 8, 0.05)' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                    >
                      <CreditCard className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                    </div>
                    <div>
                      <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {getCustomerName(sub.customerId)}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('subscriptions.plan', { name: getPlanName(sub.planId) })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {needsRenewal && (
                      <span className="badge bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        {t('subscriptions.renewal.needsRenewal', 'Needs Renewal')}
                      </span>
                    )}
                    <span className={`badge ${getStatusBadge(sub.status)}`}>
                      {sub.status}
                    </span>

                    {/* Renew button for subscriptions needing renewal */}
                    {needsRenewal && (
                      <button
                        type="button"
                        onClick={() => handleRenewSubscription(sub)}
                        className="btn btn-primary py-1.5 px-3 text-sm"
                        title={t('subscriptions.actions.renew', 'Renew')}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {t('subscriptions.renewal.renew', 'Renew')}
                      </button>
                    )}

                    {/* Change Plan */}
                    {sub.status === 'active' && !needsRenewal && (
                      <button
                        type="button"
                        onClick={() => handleOpenChangePlan(sub)}
                        className="btn btn-ghost p-2 hover:text-blue-400"
                        title={t('subscriptions.actions.changePlan')}
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    )}

                    {/* Add-ons */}
                    {(sub.status === 'active' || sub.status === 'trialing') && !needsRenewal && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddOns(sub)}
                        className="btn btn-ghost p-2 hover:text-purple-400"
                        title={t('subscriptions.actions.addons', 'Manage Add-ons')}
                      >
                        <Package className="h-4 w-4" />
                      </button>
                    )}

                    {/* Pause */}
                    {sub.status === 'active' && !needsRenewal && (
                      <button
                        type="button"
                        onClick={() => handlePause(sub.id)}
                        className="btn btn-ghost p-2 hover:text-yellow-400"
                        title={t('subscriptions.actions.pause')}
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}

                    {/* Resume */}
                    {sub.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleResume(sub.id)}
                        className="btn btn-ghost p-2 hover:text-green-400"
                        title={t('subscriptions.actions.resume')}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}

                    {/* Cancel */}
                    {sub.status !== 'canceled' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(sub.id)}
                        className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                        title={t('subscriptions.actions.cancel')}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className={`font-mono ${needsRenewal ? 'text-yellow-400' : ''}`}>
                    Period: {formatDate(sub.currentPeriodStart)} - {formatDate(sub.currentPeriodEnd)}
                    {needsRenewal && ' (expired)'}
                  </span>
                  <span className="font-mono">{sub.id}</span>
                </div>
              </div>
            );
          })}

          {/* Hint to check events */}
          <div
            className="card p-4 flex items-center gap-3"
            style={{ backgroundColor: 'var(--color-surface-elevated)' }}
          >
            <ArrowRight className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                {t('subscriptions.checkEvents.title')}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('subscriptions.checkEvents.description')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Subscription Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {t('subscriptions.modal.title')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-ghost p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription}>
              <div className="modal-body space-y-4">
                <div>
                  <label htmlFor="subCustomer" className="label">
                    {t('subscriptions.modal.customerLabel')}
                  </label>
                  <select
                    id="subCustomer"
                    value={formData.customerId}
                    onChange={e => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                    className="select"
                  >
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name || customer.email}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('subscriptions.modal.customerHelp')}
                  </p>
                </div>

                <div>
                  <label htmlFor="subPrice" className="label">
                    {t('subscriptions.modal.priceLabel')}
                  </label>
                  <select
                    id="subPrice"
                    value={formData.priceId}
                    onChange={e => setFormData(prev => ({ ...prev, priceId: e.target.value }))}
                    className="select"
                  >
                    {prices.map(price => (
                      <option key={price.id} value={price.id}>
                        {getPlanName(price.planId)} - {formatPrice(price)}
                        {price.trialDays ? ` (${price.trialDays} ${t('subscriptions.modal.dayTrial')})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('subscriptions.modal.priceHelp')}
                  </p>
                </div>

                {/* Promo Code */}
                <div>
                  <label htmlFor="promoCode" className="label">
                    {t('subscriptions.modal.promoCodeLabel', 'Promo Code')} <span className="text-gray-500">({t('subscriptions.modal.optional', 'optional')})</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="promoCode"
                      type="text"
                      value={formData.promoCode}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, promoCode: e.target.value.toUpperCase() }));
                        setPromoValidation(null);
                      }}
                      placeholder={t('subscriptions.modal.promoCodePlaceholder', 'Enter promo code')}
                      className="input flex-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleValidatePromoCode}
                      disabled={!formData.promoCode.trim() || isValidatingPromo}
                      className="btn btn-secondary"
                    >
                      {isValidatingPromo ? t('subscriptions.modal.validating', 'Validating...') : t('subscriptions.modal.apply', 'Apply')}
                    </button>
                  </div>
                  {promoValidation && (
                    <div className={`mt-2 p-2 rounded text-sm ${promoValidation.valid ? 'bg-green-900/30 text-green-300 border border-green-500/30' : 'bg-red-900/30 text-red-300 border border-red-500/30'}`}>
                      {promoValidation.valid ? (
                        <span>
                          {promoValidation.discountPercent
                            ? t('subscriptions.modal.discountApplied', { discount: `${promoValidation.discountPercent}%` })
                            : t('subscriptions.modal.discountApplied', { discount: new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedPrice?.currency || 'USD' }).format((promoValidation.discountAmount || 0) / 100) })}
                        </span>
                      ) : (
                        <span>{promoValidation.error}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Price Summary with Discount */}
                {selectedPrice && (
                  <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}>
                    <div className="flex justify-between items-center">
                      <span style={{ color: 'var(--color-text-secondary)' }}>{t('subscriptions.modal.originalPrice', 'Original Price')}</span>
                      <span className={promoValidation?.valid ? 'line-through text-gray-500' : ''} style={{ color: promoValidation?.valid ? undefined : 'var(--color-text)' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedPrice.currency }).format(selectedPrice.unitAmount / 100)}
                      </span>
                    </div>
                    {promoValidation?.valid && (
                      <>
                        <div className="flex justify-between items-center mt-1 text-green-400">
                          <span>{t('subscriptions.modal.discount', 'Discount')}</span>
                          <span>
                            -{promoValidation.discountPercent
                              ? `${promoValidation.discountPercent}%`
                              : new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedPrice.currency }).format((promoValidation.discountAmount || 0) / 100)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700 font-semibold">
                          <span style={{ color: 'var(--color-text)' }}>{t('subscriptions.modal.totalPrice', 'Total')}</span>
                          <span style={{ color: 'var(--color-accent)' }}>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedPrice.currency }).format(calculateDiscountedAmount(selectedPrice.unitAmount) / 100)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Trial card requirement toggle */}
                {hasTrial && (
                  <label
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.requireCardForTrial}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, requireCardForTrial: e.target.checked }))
                      }
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {t('subscriptions.modal.requireCardForTrial')}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {t('subscriptions.modal.requireCardForTrialHelp')}
                      </p>
                    </div>
                  </label>
                )}

                <div
                  className="p-3 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                >
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    {hasTrial && !formData.requireCardForTrial
                      ? t('subscriptions.modal.info.trialTitle')
                      : t('subscriptions.modal.info.title')}
                  </p>
                  <ul className="mt-2 space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                    {hasTrial && !formData.requireCardForTrial ? (
                      <>
                        <li dangerouslySetInnerHTML={{ __html: `• ${t('subscriptions.modal.info.trialStart', { days: selectedPrice?.trialDays })}` }} />
                        <li dangerouslySetInnerHTML={{ __html: `• ${t('subscriptions.modal.info.noPaymentNow')}` }} />
                      </>
                    ) : (
                      <>
                        <li dangerouslySetInnerHTML={{ __html: `• ${t('subscriptions.modal.info.event')}` }} />
                        <li dangerouslySetInnerHTML={{ __html: `• ${t('subscriptions.modal.info.invoice')}` }} />
                        <li dangerouslySetInnerHTML={{ __html: `• ${t('subscriptions.modal.info.payment')}` }} />
                      </>
                    )}
                  </ul>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  {tc('buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.customerId || !formData.priceId}
                >
                  {hasTrial && !formData.requireCardForTrial
                    ? t('subscriptions.modal.startTrial')
                    : t('subscriptions.modal.proceedToPayment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {pendingSubscription && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPendingSubscription(null);
          }}
          customerId={pendingSubscription.customerId}
          amount={pendingSubscription.amount}
          currency={pendingSubscription.currency}
          description={pendingSubscription.description}
          onPaymentComplete={handlePaymentComplete}
          collectOnly={pendingSubscription.hasTrial}
        />
      )}

      {/* Change Plan Modal */}
      {subscriptionToChange && (
        <ChangePlanModal
          isOpen={changePlanModalOpen}
          onClose={() => {
            setChangePlanModalOpen(false);
            setSubscriptionToChange(null);
          }}
          subscription={subscriptionToChange}
          onPlanChanged={loadData}
        />
      )}

      {/* Renewal Payment Modal */}
      {subscriptionToRenew && (
        <PaymentModal
          isOpen={renewalModalOpen}
          onClose={() => {
            setRenewalModalOpen(false);
            setSubscriptionToRenew(null);
          }}
          customerId={subscriptionToRenew.subscription.customerId}
          amount={subscriptionToRenew.amount}
          currency={subscriptionToRenew.currency}
          description={`${getPlanName(subscriptionToRenew.subscription.planId)} - ${t('subscriptions.renewal.renewalPayment', 'Renewal Payment')}`}
          onPaymentComplete={handleRenewalComplete}
        />
      )}

      {/* Add-on Modal */}
      {subscriptionForAddOn && (
        <AddOnModal
          isOpen={addOnModalOpen}
          onClose={() => {
            setAddOnModalOpen(false);
            setSubscriptionForAddOn(null);
          }}
          subscription={subscriptionForAddOn}
          onAddOnAdded={loadData}
        />
      )}

      {/* One-time Payment Modal */}
      <OneTimePaymentModal
        isOpen={oneTimePaymentModalOpen}
        onClose={() => setOneTimePaymentModalOpen(false)}
        onPaymentComplete={loadData}
      />
    </div>
  );
}
