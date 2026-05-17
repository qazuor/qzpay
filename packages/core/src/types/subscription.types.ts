/**
 * Subscription types for QZPay
 */
import type { QZPayBillingInterval, QZPayCancelAt, QZPayProrationBehavior, QZPaySubscriptionStatus } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

/**
 * Status of a scheduled plan change pending application at
 * `applyAt`. The lifecycle is owned by the consuming app's scheduler
 * (cron); qzpay provides the storage primitive only.
 *
 * - `pending`: queued, waiting for `applyAt` to be reached.
 * - `applied`: the scheduler successfully ran the change.
 * - `cancelled`: the change was reverted before `applyAt`
 *   (e.g. user changed mind, or replaced by a different plan change).
 * - `failed`: the scheduler tried and exhausted its retry budget;
 *   ops needs to intervene.
 */
export type QZPayScheduledPlanChangeStatus = 'pending' | 'applied' | 'cancelled' | 'failed';

/**
 * A plan change scheduled to take effect at a future point in time —
 * typically the end of the current billing period for downgrades that
 * should not apply immediately.
 *
 * qzpay-core defines the shape and persists it as the JSONB column
 * `scheduled_plan_change` on `billing_subscriptions`; the actual
 * scheduling and cron logic stay in the consuming application.
 *
 * Monetary fields are stored in MAJOR currency units to match the
 * argument the payment adapter expects on
 * `subscriptions.update({ transactionAmount })`. Cents conversion
 * happens at the storage layer if needed.
 */
export interface QZPayScheduledPlanChange {
    /** Target plan id the subscription should move to. */
    newPlanId: string;
    /**
     * Target price id within the new plan. Required so the scheduler
     * doesn't have to re-derive the price by interval lookup, which
     * could surface a different row if the plan's prices changed
     * between scheduling and application.
     */
    newPriceId: string;
    /**
     * Recurring charge amount the provider should apply on the
     * cycle following the plan change, in MAJOR currency units.
     */
    targetTransactionAmountMajor: number;
    /** When the scheduled change should fire (typically `currentPeriodEnd`). */
    applyAt: string;
    /** When the change was scheduled. */
    requestedAt: string;
    /** Optional user id of the actor that requested the change. */
    requestedBy?: string;
    /** Current state of the scheduled change. */
    status: QZPayScheduledPlanChangeStatus;
    /** Number of times the scheduler attempted to apply the change. */
    attemptCount: number;
    /** Last attempt timestamp, when {@link attemptCount} > 0. */
    lastAttemptAt?: string;
    /** When the change was applied or cancelled (whichever happened). */
    resolvedAt?: string;
    /** Last error message captured by the scheduler, when {@link status} is `failed`. */
    lastError?: string;
    /** App-specific metadata (e.g. audit linkage). */
    metadata?: QZPayMetadata;
}

export interface QZPaySubscription {
    id: string;
    customerId: string;
    planId: string;
    status: QZPaySubscriptionStatus;
    interval: QZPayBillingInterval;
    intervalCount: number;
    quantity: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart: Date | null;
    trialEnd: Date | null;
    cancelAt: Date | null;
    canceledAt: Date | null;
    cancelAtPeriodEnd: boolean;
    providerSubscriptionIds: Record<string, string>;
    promoCodeId?: string | null;
    metadata: QZPayMetadata;
    /**
     * Plan change scheduled to apply at a future point (typically
     * `currentPeriodEnd`). `null` when no change is pending. The
     * lifecycle of the value (transition `pending` → `applied` /
     * `cancelled` / `failed`) is owned by the consuming application's
     * scheduler — qzpay provides the storage shape only.
     */
    scheduledPlanChange: QZPayScheduledPlanChange | null;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayCreateSubscriptionInput {
    customerId: string;
    planId: string;
    /**
     * Specific price within the plan to subscribe to. When omitted, the first
     * price of the plan is used. Required when the plan exposes multiple prices
     * (e.g. monthly + annual) and the caller wants to disambiguate.
     */
    priceId?: string;
    quantity?: number;
    trialDays?: number;
    metadata?: QZPayMetadata;
    promoCodeId?: string;
    /**
     * Creation mode for the subscription.
     * - `'trial'` (default): storage-only record, no provider call. Backwards
     *   compatible with pre-SPEC-124 behavior. Suitable for free trials where
     *   the card-on-file is not yet collected.
     * - `'paid'`: after persisting the local record, calls
     *   `paymentAdapter.subscriptions.create()` so the provider (e.g. MercadoPago
     *   preapproval) is created and the caller can redirect the user to the
     *   provider-hosted authorization page.
     */
    mode?: 'trial' | 'paid';
    /**
     * Billing cadence label. Used by the provider adapter for the `reason`
     * (user-facing description shown in MP dashboard + bank statement). The
     * actual interval/frequency sent to the provider comes from the selected
     * price.
     */
    billingInterval?: 'monthly' | 'annual';
    /**
     * URL the provider redirects the user back to after authorizing the
     * recurring charge (MP `back_url` for preapprovals). Required when
     * `mode === 'paid'` for providers that require it.
     */
    paymentMethodReturnUrl?: string;
    /**
     * URL the provider sends webhooks for this specific preapproval (MP
     * `notification_url`). Optional override; providers fall back to the
     * application-wide webhook URL when omitted.
     */
    notificationUrl?: string;
    /**
     * Extra free-trial days to apply at the provider level (MP
     * `auto_recurring.free_trial`). Additive to the local `trialDays` and
     * intended for promo-driven extensions of an existing trial.
     */
    freeTrialDays?: number;
    /**
     * Provider-side identifiers to persist alongside the new local
     * subscription. Keys are provider names (`'mercadopago'`, `'stripe'`,
     * etc.), values are the provider's subscription ID. Usually undefined
     * at create time (the provider call happens after the local insert and
     * is reconciled via `linkProviderId`); set this when the caller already
     * holds the provider ID (e.g. backfills, manual reconciliation).
     */
    providerSubscriptionIds?: Record<string, string>;
}

export interface QZPayUpdateSubscriptionInput {
    planId?: string;
    quantity?: number;
    prorationBehavior?: QZPayProrationBehavior;
    metadata?: QZPayMetadata;
    status?: QZPaySubscriptionStatus;
    canceledAt?: Date;
    cancelAt?: Date;
    /** Current period start date (for renewals) */
    currentPeriodStart?: Date;
    /** Current period end date (for renewals) */
    currentPeriodEnd?: Date;
    /** Trial end date (for trial extensions) */
    trialEnd?: Date | null;
    /**
     * New recurring charge amount in MAJOR currency units (e.g. ARS, not centavos).
     * Used for plan-change scenarios where the provider needs to charge a different
     * amount on subsequent recurrences (MP `auto_recurring.transaction_amount`).
     * Forwarded by adapters that support amount changes; ignored otherwise.
     */
    transactionAmount?: number;
    /**
     * Provider-side identifiers to link to the local subscription. Used by
     * webhook handlers after the provider confirms a preapproval was created
     * (or by reconciliation jobs). Keys are provider names (`'mercadopago'`,
     * `'stripe'`); when present in the partial, the storage layer maps each
     * entry to its dedicated column (`mp_subscription_id`, `stripe_subscription_id`).
     */
    providerSubscriptionIds?: Record<string, string>;
    /**
     * Replace, clear, or update the scheduled plan change attached to
     * the subscription. Passing `null` clears any pending schedule
     * (used to cancel a queued downgrade or after an upgrade resolves
     * mid-period); passing a full {@link QZPayScheduledPlanChange}
     * value writes/replaces the row. Omit to leave the existing value
     * untouched (standard partial-update semantics).
     */
    scheduledPlanChange?: QZPayScheduledPlanChange | null;
}

export interface QZPayCancelSubscriptionInput {
    cancelAt?: QZPayCancelAt;
    reason?: string;
}

export interface QZPaySubscriptionItem {
    id: string;
    subscriptionId: string;
    priceId: string;
    quantity: number;
    metadata: QZPayMetadata;
    createdAt: Date;
    updatedAt: Date;
}
