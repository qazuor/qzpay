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
     * Explicit provider-side price/plan identifier to subscribe against,
     * overriding the value otherwise resolved from the selected price's
     * `providerPriceIds[provider]` map.
     *
     * This exists because provider plan selection can depend on runtime,
     * per-customer state that a static price row cannot encode. The
     * motivating case (MercadoPago `preapproval_plan`): a single commercial
     * plan+interval needs TWO provider plan variants — one carrying a
     * `free_trial` (for trial-eligible customers) and one without (for
     * customers who already used their lifetime trial). Trial-eligibility is
     * per-customer, so the caller resolves the correct variant at checkout
     * and passes its id here; the price row cannot hold both.
     *
     * When present, it takes precedence over
     * `price.providerPriceIds?.[provider]`. When omitted, resolution falls
     * back to the price map exactly as before (backwards compatible).
     */
    providerPriceId?: string;
    /**
     * Explicit provider-side transaction amount to seed the recurring charge
     * with, overriding the amount that would otherwise be derived from the
     * selected price row (`price.unitAmount`).
     *
     * This exists for ad-hoc provider flows that build a direct recurring
     * charge with no provider-side plan behind it (e.g. MercadoPago's
     * `/preapproval` ad-hoc fallback, used when the caller does not pass
     * {@link providerPriceId}). Previously, a discounted-signup checkout
     * relied on provisioning the provider plan itself at the already-discounted
     * amount — the plan's own `transaction_amount` WAS the discount. Without a
     * plan, that mechanism does not exist, so a discounted signup needs a way
     * to say "start this recurring charge at this amount" directly. This is
     * that mechanism, and nothing more: it sets the amount the subscription is
     * BORN with, at every cycle, exactly like provisioning the plan at the
     * discounted amount did. It carries no cycle-count or promo semantics —
     * if the caller's discount only applies to the first N cycles, restoring
     * the full amount afterward (e.g. by later updating
     * `transactionAmount` via `subscriptions.update()`) is the caller's job,
     * not this field's.
     *
     * In **cents** (smallest currency unit) — the SAME convention as
     * `price.amount` on the resolved provider input, NOT the major-unit
     * `transactionAmount` accepted by {@link QZPayUpdateSubscriptionInput}'s
     * update flow. Adapters that talk to providers expecting major units
     * (e.g. MercadoPago) MUST divide by 100 at the provider boundary, exactly
     * as they already do for `price.amount`.
     *
     * `0` is a valid, distinct override value — it is NOT equivalent to
     * omitting this field. Only `undefined` (the field absent, or explicitly
     * set to `undefined`) falls back to the price row's amount; a `0`
     * override is passed through as-is. Whether `0` is an amount a given
     * provider actually accepts (MercadoPago enforces a minimum charge) is
     * the caller's concern, not this field's — core and the adapter must not
     * silently reinterpret it as "no override".
     *
     * When present, it takes precedence over `price.unitAmount` in flows that
     * build an ad-hoc recurring charge without a provider-side plan. Ignored
     * by flows that resolve the amount from a provider-side plan instead
     * (e.g. MercadoPago's plan-based flow, where MP derives the amount from
     * the referenced `preapproval_plan` — there is no amount field on that
     * request for this to override). When omitted, resolution falls back to
     * `price.unitAmount` exactly as before — fully backwards compatible.
     */
    providerUnitAmountOverride?: number;
    /**
     * Provider-side identifiers to persist alongside the new local
     * subscription. Keys are provider names (`'mercadopago'`, `'stripe'`,
     * etc.), values are the provider's subscription ID. Usually undefined
     * at create time (the provider call happens after the local insert and
     * is reconciled via `linkProviderId`); set this when the caller already
     * holds the provider ID (e.g. backfills, manual reconciliation).
     */
    providerSubscriptionIds?: Record<string, string>;
    /**
     * Email of the PAYER declared to the provider for this subscription's
     * recurring charge (e.g. MercadoPago preapproval `payer_email`), when it
     * differs from the customer's contact email (`customer.email`).
     *
     * Some providers bind the charge to whichever account holds this exact
     * email — MercadoPago's `/preapproval` only authorizes payment from the
     * MP account matching `payer_email` verbatim. A user's registration
     * email and the MercadoPago account they actually want to pay with
     * (e.g. the one holding a balance) are frequently different people's
     * emails in practice, and overwriting `customer.email` to fix that would
     * also redirect that customer's transactional email — the column is the
     * real contact address, not a payment-provider knob.
     *
     * When present, this takes precedence over `customer.email` for the
     * provider-facing payer identity ONLY; it never touches the stored
     * customer record. When omitted, resolution falls back to
     * `customer.email` exactly as before — fully backwards compatible.
     */
    payerEmail?: string;
}

export interface QZPayUpdateSubscriptionInput {
    planId?: string;
    quantity?: number;
    prorationBehavior?: QZPayProrationBehavior;
    metadata?: QZPayMetadata;
    status?: QZPaySubscriptionStatus;
    /** Cancellation timestamp. Pass `null` to CLEAR it (e.g. un-cancelling a
     * soft-cancelled subscription); omit to leave it untouched. */
    canceledAt?: Date | null;
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
    /**
     * Sets the provider-side `external_reference` on an existing subscription
     * (MP `PUT /preapproval/{id}`). Used to retroactively link a
     * provider-hosted subscription created without a local record yet — or
     * without the final one — to the local entity that ends up owning it
     * (e.g. Hospeda's consumer-linking flow, HOS-191). Adapters that do not
     * support mutating this field after creation MAY ignore it.
     */
    externalReference?: string;
    /**
     * Human-readable label to set as the provider-side subscription
     * description (MP `PUT /preapproval` `reason`). When provided, adapters
     * prefer it over any synthetic fallback derived from `planId` (e.g. MP's
     * `"Plan updated to: ${planId}"`), so buyers see the plan's display name
     * instead of an opaque id on a plan change. Adapters that do not expose a
     * mutable description MAY ignore it.
     */
    reason?: string;
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
