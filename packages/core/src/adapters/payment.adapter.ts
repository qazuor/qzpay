/**
 * Payment adapter interface for QZPay
 * Defines the contract for payment provider operations (Stripe, MercadoPago, etc.)
 */
import type { QZPayPaymentProvider } from '../constants/index.js';
import type {
    QZPayCheckoutResult,
    QZPayCheckoutSession,
    QZPayCreateCheckoutInput,
    QZPayCreatePaymentInput,
    QZPayCreatePriceInput,
    QZPayCreateSubscriptionInput,
    QZPayPayment,
    QZPayPrice,
    QZPayRefund,
    QZPayRefundInput,
    QZPaySubscription,
    QZPayUpdateSubscriptionInput,
    QZPayVendor,
    QZPayVendorPayout
} from '../types/index.js';

export interface QZPayPaymentAdapter {
    /**
     * Provider identifier
     */
    readonly provider: QZPayPaymentProvider;

    /**
     * Customer operations
     */
    customers: QZPayPaymentCustomerAdapter;

    /**
     * Subscription operations
     */
    subscriptions: QZPayPaymentSubscriptionAdapter;

    /**
     * Payment operations
     */
    payments: QZPayPaymentPaymentAdapter;

    /**
     * Checkout operations
     */
    checkout: QZPayPaymentCheckoutAdapter;

    /**
     * Price operations
     */
    prices: QZPayPaymentPriceAdapter;

    /**
     * Webhook handling
     */
    webhooks: QZPayPaymentWebhookAdapter;

    /**
     * Vendor/Connect operations (marketplace)
     */
    vendors?: QZPayPaymentVendorAdapter;
}

/**
 * Input for creating a customer in the payment provider
 * This is a subset of QZPayCreateCustomerInput
 */
export interface QZPayProviderCreateCustomerInput {
    email: string;
    name?: string | null;
    metadata?: Record<string, string>;
    externalId?: string;
}

export interface QZPayPaymentCustomerAdapter {
    create(input: QZPayProviderCreateCustomerInput): Promise<string>;
    update(providerCustomerId: string, input: Partial<QZPayProviderCreateCustomerInput>): Promise<void>;
    delete(providerCustomerId: string): Promise<void>;
    retrieve(providerCustomerId: string): Promise<QZPayProviderCustomer>;
}

export interface QZPayProviderCustomer {
    id: string;
    email: string;
    name: string | null;
    metadata: Record<string, string>;
}

/**
 * Input passed by `billing.subscriptions.create({ mode: 'paid' })` to the
 * provider subscription adapter. Aggregates resolved customer + price + plan
 * data plus orchestration metadata (idempotency key, return URLs, external
 * reference) so the adapter has everything it needs without re-querying the
 * core storage layer.
 *
 * Adapters are free to ignore fields that do not apply to their provider
 * (e.g. Stripe ignores `backUrl` and `freeTrialDays`, MercadoPago ignores
 * `providerPriceId`).
 */
export interface QZPayProviderCreateSubscriptionInput {
    /**
     * Provider-side customer identifier (e.g. MP customer ID, Stripe `cus_*`).
     *
     * Optional because not every provider needs an existing provider-side
     * customer to create a subscription: MercadoPago's `/preapproval` ad-hoc
     * flow creates the subscription against a `payer_email` and never
     * references the customer id. Adapters that DO require it (Stripe-style)
     * MUST validate it explicitly when undefined and throw a clear
     * adapter-level error — core no longer gates on this field globally
     * because doing so blocked otherwise-valid flows (e.g. sandbox signups
     * where the customer-create sync fails for reasons unrelated to the
     * subscription, see hospeda staging smoke 2026-05-21 Finding #4).
     */
    readonly providerCustomerId?: string;
    /** Provider-side price identifier — set for Stripe-style providers. Optional for ad-hoc preapprovals (MP). */
    readonly providerPriceId?: string;
    /** Original `billing.subscriptions.create()` input, forwarded for metadata/quantity/mode-specific fields. */
    readonly input: QZPayCreateSubscriptionInput;
    /** Resolved customer record — pre-fetched by core so the adapter does not re-query storage. */
    readonly customer: {
        readonly email: string;
        readonly firstName?: string | null;
        readonly lastName?: string | null;
    };
    /**
     * Resolved price record — used to build the provider charge body (amount, currency, cadence).
     *
     * `amount` is in the **smallest currency unit (cents)** — the canonical
     * internal convention across qzpay-core (matches `Price.unitAmount`,
     * `Addon.unitAmount`, `Subscription.transactionAmount` update field
     * documentation aside — see note below).
     *
     * Adapters that talk to providers expecting major units (decimal pesos /
     * dollars), like MercadoPago `/preapproval`, MUST divide by 100 at the
     * provider boundary. Adapters whose providers also accept smallest-unit
     * (e.g. Stripe `unit_amount`) can forward verbatim.
     *
     * Historical note: `Subscription.update` input documents `transactionAmount`
     * in **major units** (`subscription.types.ts:177`). That convention only
     * applies to the explicit update flow which takes input from external
     * callers; the `create` flow's `price.amount` here is **always cents**
     * because it comes from the resolved storage record.
     */
    readonly price: {
        /** Amount in cents (smallest currency unit). Adapters convert at provider boundary. */
        readonly amount: number;
        readonly currency: string;
        readonly interval: 'day' | 'week' | 'month' | 'year';
        readonly intervalCount: number;
    };
    /** Resolved plan record — used to build the user-facing description (`reason`). */
    readonly plan: {
        readonly name: string;
    };
    /** Local subscription UUID, used as `external_reference` so webhooks can find the local record. */
    readonly externalReference: string;
    /** Stable idempotency key (typically the local subscription UUID) sent as `X-Idempotency-Key` to the provider. */
    readonly idempotencyKey: string;
    /** Where the provider redirects the user back after authorizing (MP `back_url`). */
    readonly backUrl?: string;
    /** Provider webhook URL for this specific subscription (MP `notification_url`). */
    readonly notificationUrl?: string;
}

export interface QZPayPaymentSubscriptionAdapter {
    create(input: QZPayProviderCreateSubscriptionInput): Promise<QZPayProviderSubscription>;
    update(providerSubscriptionId: string, input: QZPayUpdateSubscriptionInput): Promise<QZPayProviderSubscription>;
    cancel(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void>;
    pause(providerSubscriptionId: string): Promise<void>;
    resume(providerSubscriptionId: string): Promise<void>;
    retrieve(providerSubscriptionId: string): Promise<QZPayProviderSubscription>;
}

export interface QZPayProviderSubscription {
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    trialStart: Date | null;
    trialEnd: Date | null;
    metadata: Record<string, string>;
    /**
     * Provider-hosted authorization URL (e.g. MercadoPago preapproval `init_point`).
     * The caller redirects the end user here so they can attach a card and confirm
     * the recurring charge. Undefined for providers that do not have a hosted flow
     * (e.g. Stripe with pre-attached payment method).
     */
    initPoint?: string;
    /** Sandbox equivalent of `initPoint`, used during local development. */
    sandboxInitPoint?: string;
}

export interface QZPayPaymentPaymentAdapter {
    create(providerCustomerId: string, input: QZPayCreatePaymentInput): Promise<QZPayProviderPayment>;
    capture(providerPaymentId: string): Promise<QZPayProviderPayment>;
    cancel(providerPaymentId: string): Promise<void>;
    refund(input: QZPayRefundInput, providerPaymentId: string): Promise<QZPayProviderRefund>;
    retrieve(providerPaymentId: string): Promise<QZPayProviderPayment>;
}

export interface QZPayProviderPayment {
    id: string;
    status: string;
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    clientSecret?: string;
    nextAction?: {
        type: string;
        redirectUrl?: string;
    };
}

export interface QZPayProviderRefund {
    id: string;
    status: string;
    amount: number;
}

/**
 * Input passed by `billing.checkout.create()` to the provider checkout adapter.
 * Mirrors {@link QZPayProviderCreateSubscriptionInput} for the checkout path —
 * aggregates the original caller input together with core-resolved customer and
 * per-line-item pricing so the adapter does not re-query storage.
 *
 * Adapters are free to ignore fields that do not apply to their provider
 * (e.g. Stripe ignores `backUrl`, MercadoPago ignores `providerPriceId` when the
 * line item carries inline amount/currency for one-time payments).
 */
export interface QZPayProviderCreateCheckoutInput {
    /** Original `billing.checkout.create()` input — forwarded for URLs, metadata, payer info, statement descriptor, etc. */
    readonly input: QZPayCreateCheckoutInput;
    /**
     * Resolved customer record when `input.customerId` was supplied and the
     * record was found. Omitted for guest checkouts (email-only / no customer).
     */
    readonly customer?: {
        readonly id: string;
        readonly email: string;
        readonly firstName?: string | null;
        readonly lastName?: string | null;
        /** Provider-side customer identifier (MP customer ID, Stripe `cus_*`), if previously linked. */
        readonly providerCustomerId?: string;
    };
    /**
     * Per-line-item resolved pricing, index-aligned with `input.lineItems`. Each
     * entry has either a `providerPriceId` (subscription mode / pre-registered
     * plan) or inline `unitAmount` + `currency` (payment mode one-time charge).
     */
    /**
     * `unitAmount` is in the **smallest currency unit (cents)** — same
     * canonical convention as `QZPayProviderCreateSubscriptionInput.price.amount`.
     * Adapters that talk to providers expecting major units (MercadoPago
     * preference `unit_price` is decimal) MUST divide by 100 at the provider
     * boundary. Adapters whose providers also accept smallest-unit (Stripe)
     * forward verbatim.
     */
    readonly resolvedLineItems: ReadonlyArray<{
        readonly providerPriceId?: string;
        /** Per-unit amount in cents (smallest currency unit). Adapters convert at provider boundary. */
        readonly unitAmount: number;
        readonly currency: string;
        readonly title: string;
    }>;
    /** Local checkout UUID, set as provider `external_reference` so webhooks correlate back. */
    readonly externalReference: string;
    /** Stable idempotency key (typically the local checkout UUID). Adapters forward as `X-Idempotency-Key`. */
    readonly idempotencyKey: string;
    /** Where the provider redirects the user back after authorizing / paying (MP `back_url`). */
    readonly backUrl?: string;
    /** Provider webhook URL for this specific checkout session (MP `notification_url`). */
    readonly notificationUrl?: string;
}

export interface QZPayPaymentCheckoutAdapter {
    create(input: QZPayProviderCreateCheckoutInput): Promise<QZPayProviderCheckout>;
    retrieve(providerSessionId: string): Promise<QZPayProviderCheckout>;
    expire(providerSessionId: string): Promise<void>;
}

export interface QZPayProviderCheckout {
    id: string;
    url: string;
    status: string;
    paymentIntentId: string | null;
    subscriptionId: string | null;
    customerId: string | null;
    metadata: Record<string, string>;
}

export interface QZPayPaymentPriceAdapter {
    create(input: QZPayCreatePriceInput, providerProductId: string): Promise<string>;
    archive(providerPriceId: string): Promise<void>;
    retrieve(providerPriceId: string): Promise<QZPayProviderPrice>;
    createProduct(name: string, description?: string): Promise<string>;
}

export interface QZPayProviderPrice {
    id: string;
    active: boolean;
    unitAmount: number;
    currency: string;
    recurring: {
        interval: string;
        intervalCount: number;
    } | null;
}

export interface QZPayPaymentWebhookAdapter {
    constructEvent(payload: string | Buffer, signature: string): QZPayWebhookEvent;
    verifySignature(payload: string | Buffer, signature: string): boolean;
}

export interface QZPayWebhookEvent {
    id: string;
    type: string;
    data: unknown;
    created: Date;
}

export interface QZPayPaymentVendorAdapter {
    createAccount(vendor: QZPayVendor): Promise<string>;
    updateAccount(providerAccountId: string, vendor: Partial<QZPayVendor>): Promise<void>;
    deleteAccount(providerAccountId: string): Promise<void>;
    createPayout(providerAccountId: string, amount: number, currency: string): Promise<string>;
    retrievePayout(providerPayoutId: string): Promise<QZPayProviderPayout>;
    createTransfer(providerAccountId: string, amount: number, currency: string, paymentId: string): Promise<string>;
}

export interface QZPayProviderPayout {
    id: string;
    status: string;
    amount: number;
    currency: string;
    arrivalDate: Date;
}

/**
 * Type helpers for mapping internal types to provider responses
 */
export type QZPayMapProviderSubscription = (provider: QZPayProviderSubscription, subscription: QZPaySubscription) => QZPaySubscription;
export type QZPayMapProviderPayment = (provider: QZPayProviderPayment, payment: QZPayPayment) => QZPayPayment;
export type QZPayMapProviderRefund = (provider: QZPayProviderRefund, refund: QZPayRefund) => QZPayRefund;
export type QZPayMapProviderCheckout = (provider: QZPayProviderCheckout, session: QZPayCheckoutSession) => QZPayCheckoutResult;
export type QZPayMapProviderPrice = (provider: QZPayProviderPrice, price: QZPayPrice) => QZPayPrice;
export type QZPayMapProviderPayout = (provider: QZPayProviderPayout, payout: QZPayVendorPayout) => QZPayVendorPayout;
