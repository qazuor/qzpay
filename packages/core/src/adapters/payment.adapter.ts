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
    /** Provider-side customer identifier (e.g. MP customer ID, Stripe `cus_*`). */
    readonly providerCustomerId: string;
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
    /** Resolved price record — used to build the provider charge body (amount, currency, cadence). */
    readonly price: {
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

export interface QZPayPaymentCheckoutAdapter {
    create(input: QZPayCreateCheckoutInput, providerPriceIds: string[]): Promise<QZPayProviderCheckout>;
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
