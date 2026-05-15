/**
 * Subscription types for QZPay
 */
import type { QZPayBillingInterval, QZPayCancelAt, QZPayProrationBehavior, QZPaySubscriptionStatus } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

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
