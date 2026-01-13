/**
 * Subscription Lifecycle Engine
 *
 * Simulates what a real application would implement using the QZPay library:
 * - Subscription renewals
 * - Trial expiration handling
 * - Payment retries with grace periods
 * - Automatic cancellation after failed payments
 * - Event emission for all lifecycle changes
 *
 * In a real app, this would be implemented as cron jobs or background workers.
 * In the playground, this runs when simulated time advances.
 */

import type { QZPayBilling, QZPaySubscription } from '@qazuor/qzpay-core';
import { useEventsStore } from '../stores/events.store';

/**
 * Safely convert a value to Date
 * Handles both Date objects and ISO strings (from localStorage serialization)
 */
function toDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// Configuration for the lifecycle engine
export interface LifecycleConfig {
  // Days before trial ends to send reminder
  trialEndingReminderDays: number[];
  // Days before subscription renews to send reminder
  renewalReminderDays: number[];
  // Grace period days after failed payment
  gracePeriodDays: number;
  // Payment retry intervals in days
  paymentRetryDays: number[];
  // Simulate payment success rate (0-1)
  paymentSuccessRate: number;
}

export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  trialEndingReminderDays: [7, 3, 1],
  renewalReminderDays: [7, 3, 1],
  gracePeriodDays: 7,
  paymentRetryDays: [1, 3, 5],
  paymentSuccessRate: 0.8, // 80% success rate for simulated payments
};

// Track subscription lifecycle state (stored in metadata)
interface SubscriptionLifecycleState {
  // Trial reminders sent
  trialRemindersSent?: number[];
  // Renewal reminders sent
  renewalRemindersSent?: number[];
  // Grace period start date
  gracePeriodStartedAt?: string;
  // Payment retry attempts
  paymentRetryAttempts?: number;
  // Last payment attempt date
  lastPaymentAttemptAt?: string;
  // Is in grace period
  inGracePeriod?: boolean;
}

// Event types for lifecycle
export type LifecycleEventType =
  | 'subscription.trial_ending'
  | 'subscription.trial_ended'
  | 'subscription.trial_converted'
  | 'subscription.expiring'
  | 'subscription.renewed'
  | 'subscription.renewal_failed'
  | 'subscription.grace_period_started'
  | 'subscription.grace_period_ending'
  | 'subscription.canceled_nonpayment'
  | 'payment.retry_scheduled'
  | 'payment.retry_attempted';

export interface LifecycleEvent {
  type: LifecycleEventType;
  subscriptionId: string;
  customerId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Process all subscription lifecycle events for the current simulated time
 */
export async function processSubscriptionLifecycle(
  billing: QZPayBilling,
  currentTime: Date,
  config: LifecycleConfig = DEFAULT_LIFECYCLE_CONFIG
): Promise<LifecycleEvent[]> {
  const events: LifecycleEvent[] = [];
  const addEvent = useEventsStore.getState().addEvent;

  try {
    // Get all subscriptions
    const { data: subscriptions } = await billing.subscriptions.list();

    for (const subscription of subscriptions) {
      const subEvents = await processSubscription(
        billing,
        subscription,
        currentTime,
        config
      );
      events.push(...subEvents);

      // Add events to the events store
      for (const event of subEvents) {
        addEvent({
          type: event.type,
          payload: {
            subscriptionId: event.subscriptionId,
            customerId: event.customerId,
            ...event.data,
          },
          timestamp: event.timestamp,
        });
      }
    }
  } catch (error) {
    console.error('Error processing subscription lifecycle:', error);
  }

  return events;
}

/**
 * Process lifecycle for a single subscription
 */
async function processSubscription(
  billing: QZPayBilling,
  subscription: QZPaySubscription,
  currentTime: Date,
  config: LifecycleConfig
): Promise<LifecycleEvent[]> {
  const events: LifecycleEvent[] = [];
  const state = getLifecycleState(subscription);

  // Skip canceled or paused subscriptions
  if (subscription.status === 'canceled' || subscription.status === 'paused') {
    return events;
  }

  // Handle based on subscription status and state
  if (subscription.status === 'trialing') {
    events.push(...await processTrialing(billing, subscription, currentTime, config, state));
  } else if (subscription.status === 'active') {
    if (state.inGracePeriod) {
      // Subscription is in grace period (past_due simulation)
      events.push(...await processGracePeriod(billing, subscription, currentTime, config, state));
    } else {
      events.push(...await processActive(billing, subscription, currentTime, config, state));
    }
  }

  return events;
}

/**
 * Process subscription in trialing status
 */
async function processTrialing(
  billing: QZPayBilling,
  subscription: QZPaySubscription,
  currentTime: Date,
  config: LifecycleConfig,
  state: SubscriptionLifecycleState
): Promise<LifecycleEvent[]> {
  const events: LifecycleEvent[] = [];

  // Safely convert trialEnd to Date (handles both Date objects and ISO strings)
  const trialEnd = toDate(subscription.trialEnd);
  if (!trialEnd) return events;

  const daysUntilTrialEnd = Math.ceil(
    (trialEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check for trial ending reminders
  const sentReminders = state.trialRemindersSent || [];
  for (const reminderDay of config.trialEndingReminderDays) {
    if (daysUntilTrialEnd <= reminderDay && daysUntilTrialEnd > 0 && !sentReminders.includes(reminderDay)) {
      events.push({
        type: 'subscription.trial_ending',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          daysRemaining: daysUntilTrialEnd,
          trialEnd: trialEnd.toISOString(),
        },
        timestamp: currentTime,
      });

      // Update state
      sentReminders.push(reminderDay);
      await updateLifecycleState(billing, subscription.id, {
        ...state,
        trialRemindersSent: sentReminders,
      });
    }
  }

  // Check if trial has ended
  if (currentTime >= trialEnd) {
    // Try to convert to paid subscription
    const paymentSuccess = await attemptPayment(billing, subscription, currentTime, config);

    if (paymentSuccess) {
      // Trial converted successfully - update subscription to active
      // Calculate new period end (30 days from now for monthly)
      const newPeriodEnd = new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update subscription status directly via storage (billing service has restricted interface)
      const { exportPlaygroundData, importPlaygroundData } = await import('../adapters/local-storage.adapter');
      const playgroundData = exportPlaygroundData();
      if (playgroundData.subscriptions[subscription.id]) {
        Object.assign(playgroundData.subscriptions[subscription.id], {
          status: 'active',
          currentPeriodStart: currentTime,
          currentPeriodEnd: newPeriodEnd,
          trialStart: null,
          trialEnd: null,
          updatedAt: currentTime,
        });
        importPlaygroundData(playgroundData);
      }

      events.push({
        type: 'subscription.trial_converted',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          convertedAt: currentTime.toISOString(),
          newPeriodEnd: newPeriodEnd.toISOString(),
        },
        timestamp: currentTime,
      });

      // Clear trial reminders
      await updateLifecycleState(billing, subscription.id, {
        trialRemindersSent: [],
        renewalRemindersSent: [],
      });
    } else {
      // Trial ended without payment - cancel the subscription
      // For trials, we don't do grace periods - if no payment method, cancel immediately
      events.push({
        type: 'subscription.trial_ended',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          endedAt: currentTime.toISOString(),
          converted: false,
          reason: 'payment_failed',
        },
        timestamp: currentTime,
      });

      // Cancel the subscription
      await billing.subscriptions.cancel(subscription.id);

      events.push({
        type: 'subscription.canceled_nonpayment',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          canceledAt: currentTime.toISOString(),
          reason: 'trial_payment_failed',
        },
        timestamp: currentTime,
      });
    }
  }

  return events;
}

/**
 * Process subscription in active status
 */
async function processActive(
  billing: QZPayBilling,
  subscription: QZPaySubscription,
  currentTime: Date,
  config: LifecycleConfig,
  state: SubscriptionLifecycleState
): Promise<LifecycleEvent[]> {
  const events: LifecycleEvent[] = [];

  // Safely convert currentPeriodEnd to Date (handles both Date objects and ISO strings)
  const currentPeriodEnd = toDate(subscription.currentPeriodEnd);
  if (!currentPeriodEnd) {
    console.warn(`Subscription ${subscription.id} has invalid currentPeriodEnd`);
    return events;
  }

  const daysUntilRenewal = Math.ceil(
    (currentPeriodEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check for renewal reminders
  const sentReminders = state.renewalRemindersSent || [];
  for (const reminderDay of config.renewalReminderDays) {
    if (daysUntilRenewal <= reminderDay && daysUntilRenewal > 0 && !sentReminders.includes(reminderDay)) {
      events.push({
        type: 'subscription.expiring',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          daysRemaining: daysUntilRenewal,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        },
        timestamp: currentTime,
      });

      sentReminders.push(reminderDay);
      await updateLifecycleState(billing, subscription.id, {
        ...state,
        renewalRemindersSent: sentReminders,
      });
    }
  }

  // Check if subscription needs renewal
  if (currentTime >= currentPeriodEnd) {
    // Check if marked for cancellation at period end
    if (subscription.cancelAtPeriodEnd) {
      await billing.subscriptions.cancel(subscription.id);
      events.push({
        type: 'subscription.canceled_nonpayment',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          reason: 'canceled_at_period_end',
          canceledAt: currentTime.toISOString(),
        },
        timestamp: currentTime,
      });
      return events;
    }

    // Attempt renewal payment
    const paymentSuccess = await attemptPayment(billing, subscription, currentTime, config);

    if (paymentSuccess) {
      // Renewal successful - extend the subscription period
      const newPeriodStart = currentPeriodEnd;
      const newPeriodEnd = new Date(newPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update subscription period directly via storage
      const { exportPlaygroundData, importPlaygroundData } = await import('../adapters/local-storage.adapter');
      const playgroundData = exportPlaygroundData();
      if (playgroundData.subscriptions[subscription.id]) {
        Object.assign(playgroundData.subscriptions[subscription.id], {
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          updatedAt: currentTime,
        });
        importPlaygroundData(playgroundData);
      }

      events.push({
        type: 'subscription.renewed',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          renewedAt: currentTime.toISOString(),
          previousPeriodEnd: currentPeriodEnd.toISOString(),
          newPeriodEnd: newPeriodEnd.toISOString(),
        },
        timestamp: currentTime,
      });

      // Reset renewal reminders for new period
      await updateLifecycleState(billing, subscription.id, {
        renewalRemindersSent: [],
        paymentRetryAttempts: 0,
        inGracePeriod: false,
      });
    } else {
      // Payment failed - start grace period
      const gracePeriodEnd = new Date(currentTime.getTime() + config.gracePeriodDays * 24 * 60 * 60 * 1000);

      await updateLifecycleState(billing, subscription.id, {
        ...state,
        inGracePeriod: true,
        gracePeriodStartedAt: currentTime.toISOString(),
        paymentRetryAttempts: 1,
        lastPaymentAttemptAt: currentTime.toISOString(),
      });

      events.push({
        type: 'subscription.renewal_failed',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          failedAt: currentTime.toISOString(),
          reason: 'payment_failed',
        },
        timestamp: currentTime,
      });

      events.push({
        type: 'subscription.grace_period_started',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          startedAt: currentTime.toISOString(),
          endsAt: gracePeriodEnd.toISOString(),
          gracePeriodDays: config.gracePeriodDays,
        },
        timestamp: currentTime,
      });
    }
  }

  return events;
}

/**
 * Process subscription in grace period
 */
async function processGracePeriod(
  billing: QZPayBilling,
  subscription: QZPaySubscription,
  currentTime: Date,
  config: LifecycleConfig,
  state: SubscriptionLifecycleState
): Promise<LifecycleEvent[]> {
  const events: LifecycleEvent[] = [];

  if (!state.gracePeriodStartedAt) {
    return events;
  }

  const gracePeriodStart = new Date(state.gracePeriodStartedAt);
  const gracePeriodEnd = new Date(gracePeriodStart.getTime() + config.gracePeriodDays * 24 * 60 * 60 * 1000);
  const daysSinceGracePeriodStart = Math.floor(
    (currentTime.getTime() - gracePeriodStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check if we should retry payment
  const retryAttempts = state.paymentRetryAttempts || 0;
  const lastAttempt = state.lastPaymentAttemptAt ? new Date(state.lastPaymentAttemptAt) : gracePeriodStart;
  const daysSinceLastAttempt = Math.floor(
    (currentTime.getTime() - lastAttempt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check if it's time for a retry
  if (retryAttempts < config.paymentRetryDays.length) {
    const nextRetryDay = config.paymentRetryDays[retryAttempts];

    if (daysSinceLastAttempt >= nextRetryDay) {
      events.push({
        type: 'payment.retry_attempted',
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        data: {
          attemptNumber: retryAttempts + 1,
          attemptedAt: currentTime.toISOString(),
        },
        timestamp: currentTime,
      });

      const paymentSuccess = await attemptPayment(billing, subscription, currentTime, config);

      if (paymentSuccess) {
        // Payment succeeded - subscription recovered
        events.push({
          type: 'subscription.renewed',
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          data: {
            renewedAt: currentTime.toISOString(),
            recoveredFromGracePeriod: true,
          },
          timestamp: currentTime,
        });

        await updateLifecycleState(billing, subscription.id, {
          inGracePeriod: false,
          gracePeriodStartedAt: undefined,
          paymentRetryAttempts: 0,
          lastPaymentAttemptAt: undefined,
          renewalRemindersSent: [],
        });

        return events;
      } else {
        // Payment failed again
        const newRetryAttempts = retryAttempts + 1;
        await updateLifecycleState(billing, subscription.id, {
          ...state,
          paymentRetryAttempts: newRetryAttempts,
          lastPaymentAttemptAt: currentTime.toISOString(),
        });

        // Schedule next retry event
        if (newRetryAttempts < config.paymentRetryDays.length) {
          const nextRetryIn = config.paymentRetryDays[newRetryAttempts];
          events.push({
            type: 'payment.retry_scheduled',
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            data: {
              scheduledFor: new Date(currentTime.getTime() + nextRetryIn * 24 * 60 * 60 * 1000).toISOString(),
              attemptNumber: newRetryAttempts + 1,
            },
            timestamp: currentTime,
          });
        }
      }
    }
  }

  // Check if grace period is ending soon (1 day warning)
  const daysUntilGracePeriodEnd = Math.ceil(
    (gracePeriodEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilGracePeriodEnd === 1 && daysSinceGracePeriodStart < config.gracePeriodDays - 1) {
    events.push({
      type: 'subscription.grace_period_ending',
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      data: {
        endsAt: gracePeriodEnd.toISOString(),
        daysRemaining: 1,
      },
      timestamp: currentTime,
    });
  }

  // Check if grace period has expired
  if (currentTime >= gracePeriodEnd) {
    // Cancel subscription due to non-payment
    await billing.subscriptions.cancel(subscription.id);

    await updateLifecycleState(billing, subscription.id, {
      inGracePeriod: false,
      gracePeriodStartedAt: undefined,
      paymentRetryAttempts: 0,
      lastPaymentAttemptAt: undefined,
    });

    events.push({
      type: 'subscription.canceled_nonpayment',
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      data: {
        canceledAt: currentTime.toISOString(),
        reason: 'grace_period_expired',
        gracePeriodDays: config.gracePeriodDays,
        totalRetryAttempts: retryAttempts,
      },
      timestamp: currentTime,
    });
  }

  return events;
}

/**
 * Attempt to process a payment for subscription
 */
async function attemptPayment(
  billing: QZPayBilling,
  subscription: QZPaySubscription,
  currentTime: Date,
  config: LifecycleConfig
): Promise<boolean> {
  const addEvent = useEventsStore.getState().addEvent;

  try {
    // Get the price for this subscription
    const prices = await billing.plans.getPrices(subscription.planId);
    const price = prices[0]; // Get first price

    if (!price) {
      console.warn(`No price found for plan ${subscription.planId}`);
      return false;
    }

    // Check if customer has a saved payment method (Card on File)
    const { exportPlaygroundData } = await import('../adapters/local-storage.adapter');
    const playgroundData = exportPlaygroundData();
    const customerPaymentMethods = Object.values(playgroundData.paymentMethods || {}).filter(
      (pm: Record<string, unknown>) => pm.customerId === subscription.customerId && pm.status === 'active'
    );

    // Also check if payment method was collected during subscription creation (trial with card)
    const metadata = subscription.metadata as Record<string, unknown> | undefined;
    const paymentMethodCollectedInSubscription = metadata?.paymentMethodCollected === true;

    const hasPaymentMethod = customerPaymentMethods.length > 0 || paymentMethodCollectedInSubscription;

    // If customer has no payment method, payment always fails
    // If they have one, use the configured success rate
    const isSuccess = hasPaymentMethod
      ? Math.random() < config.paymentSuccessRate
      : false;

    // Record the payment attempt
    const paymentId = `pay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await billing.payments.record({
      id: paymentId,
      customerId: subscription.customerId,
      amount: price.unitAmount * subscription.quantity,
      currency: price.currency,
      status: isSuccess ? 'succeeded' : 'failed',
      metadata: {
        subscriptionId: subscription.id,
        type: 'subscription_renewal',
        simulatedAt: currentTime.toISOString(),
      },
    });

    // Emit payment event
    addEvent({
      type: isSuccess ? 'payment.succeeded' : 'payment.failed',
      payload: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        amount: price.unitAmount * subscription.quantity,
        currency: price.currency,
        simulated: true,
        hasPaymentMethod,
        failureReason: !isSuccess
          ? (hasPaymentMethod ? 'payment_declined' : 'no_payment_method')
          : undefined,
      },
      timestamp: currentTime,
    });

    return isSuccess;
  } catch (error) {
    console.error('Error recording payment:', error);
    return false;
  }
}

/**
 * Get lifecycle state from subscription metadata
 */
function getLifecycleState(subscription: QZPaySubscription): SubscriptionLifecycleState {
  return (subscription.metadata?.lifecycleState as SubscriptionLifecycleState) || {};
}

/**
 * Update lifecycle state in subscription metadata
 */
async function updateLifecycleState(
  billing: QZPayBilling,
  subscriptionId: string,
  state: SubscriptionLifecycleState
): Promise<void> {
  try {
    const subscription = await billing.subscriptions.get(subscriptionId);
    if (subscription) {
      await billing.subscriptions.update(subscriptionId, {
        metadata: {
          ...subscription.metadata,
          lifecycleState: state,
        },
      });
    }
  } catch (error) {
    console.error('Error updating lifecycle state:', error);
  }
}
