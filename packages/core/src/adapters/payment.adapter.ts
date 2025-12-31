/**
 * Payment adapter interface for QZPay
 * Defines the contract for payment provider operations (Stripe, MercadoPago, etc.)
 */
import type { QZPayPaymentProvider } from '../constants/index.js';
import type {
    QZPayCheckoutResult,
    QZPayCheckoutSession,
    QZPayCreateCheckoutInput,
    QZPayCreateCustomerInput,
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

export interface QZPayPaymentCustomerAdapter {
    create(input: QZPayCreateCustomerInput): Promise<string>;
    update(providerCustomerId: string, input: Partial<QZPayCreateCustomerInput>): Promise<void>;
    delete(providerCustomerId: string): Promise<void>;
    retrieve(providerCustomerId: string): Promise<QZPayProviderCustomer>;
}

export interface QZPayProviderCustomer {
    id: string;
    email: string;
    name: string | null;
    metadata: Record<string, string>;
}

export interface QZPayPaymentSubscriptionAdapter {
    create(providerCustomerId: string, input: QZPayCreateSubscriptionInput, providerPriceId: string): Promise<QZPayProviderSubscription>;
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
