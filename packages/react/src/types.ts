import type {
    QZPayBilling,
    QZPayBillingInterval,
    QZPayCurrency,
    QZPayCustomer,
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayInvoice,
    QZPayPayment,
    QZPayPlan,
    QZPayPrice,
    QZPaySubscription
} from '@qazuor/qzpay-core';
/**
 * React types for QZPay
 */
import type { ReactNode } from 'react';

/**
 * QZPay context value
 */
export interface QZPayContextValue {
    /**
     * QZPay billing instance
     */
    billing: QZPayBilling;

    /**
     * Whether the billing system is ready
     */
    isReady: boolean;

    /**
     * Current customer (if set)
     */
    customer: QZPayCustomer | null;

    /**
     * Set the current customer
     */
    setCustomer: (customer: QZPayCustomer | null) => void;

    /**
     * Whether in live mode
     */
    livemode: boolean;
}

/**
 * QZPay provider props
 */
export interface QZPayProviderProps {
    /**
     * QZPay billing instance
     */
    billing: QZPayBilling;

    /**
     * Initial customer (optional)
     */
    initialCustomer?: QZPayCustomer | undefined;

    /**
     * Children to render
     */
    children: ReactNode;
}

/**
 * Hook state for async operations
 */
export interface QZPayAsyncState<T> {
    /**
     * Data returned from the operation
     */
    data: T | null;

    /**
     * Whether the operation is loading
     */
    isLoading: boolean;

    /**
     * Error from the operation
     */
    error: Error | null;

    /**
     * Refetch the data
     */
    refetch: () => Promise<void>;
}

/**
 * Customer hook return type
 */
export interface UseCustomerReturn extends QZPayAsyncState<QZPayCustomer> {
    /**
     * Update the customer
     */
    update: (data: Partial<QZPayCustomer>) => Promise<QZPayCustomer | null>;
}

/**
 * Subscription hook options
 */
export interface UseSubscriptionOptions {
    /**
     * Customer ID to get subscriptions for
     */
    customerId?: string | undefined;

    /**
     * Subscription ID to get specific subscription
     */
    subscriptionId?: string | undefined;
}

/**
 * Subscription hook return type
 */
export interface UseSubscriptionReturn extends QZPayAsyncState<QZPaySubscription | QZPaySubscription[]> {
    /**
     * Create a new subscription
     */
    create: (input: {
        customerId: string;
        planId: string;
        priceId?: string | undefined;
        quantity?: number | undefined;
        trialDays?: number | undefined;
        promoCodeId?: string | undefined;
    }) => Promise<QZPaySubscription>;

    /**
     * Cancel a subscription
     */
    cancel: (subscriptionId: string, options?: { cancelAtPeriodEnd?: boolean | undefined }) => Promise<QZPaySubscription>;

    /**
     * Pause a subscription
     */
    pause: (subscriptionId: string) => Promise<QZPaySubscription>;

    /**
     * Resume a subscription
     */
    resume: (subscriptionId: string) => Promise<QZPaySubscription>;
}

/**
 * Plans hook return type
 */
export interface UsePlansReturn extends QZPayAsyncState<QZPayPlan[]> {
    /**
     * Get a specific plan by ID
     */
    getPlan: (planId: string) => QZPayPlan | undefined;

    /**
     * Get prices for a plan
     */
    getPrices: (planId: string) => Promise<QZPayPrice[]>;
}

/**
 * Payment hook options
 */
export interface UsePaymentOptions {
    /**
     * Customer ID to get payments for
     */
    customerId?: string | undefined;
}

/**
 * Payment hook return type
 */
export interface UsePaymentReturn extends QZPayAsyncState<QZPayPayment[]> {
    /**
     * Process a payment
     */
    process: (input: {
        customerId: string;
        amount: number;
        currency: QZPayCurrency;
        invoiceId?: string | undefined;
        paymentMethodId?: string | undefined;
    }) => Promise<QZPayPayment>;

    /**
     * Refund a payment
     */
    refund: (paymentId: string, amount?: number) => Promise<QZPayPayment>;
}

/**
 * Entitlements hook options
 */
export interface UseEntitlementsOptions {
    /**
     * Customer ID to check entitlements for
     */
    customerId: string;
}

/**
 * Entitlements hook return type
 */
export interface UseEntitlementsReturn extends QZPayAsyncState<QZPayCustomerEntitlement[]> {
    /**
     * Check if customer has a specific entitlement
     */
    hasEntitlement: (key: string) => boolean;

    /**
     * Check entitlement asynchronously (fresh check)
     */
    checkEntitlement: (key: string) => Promise<boolean>;
}

/**
 * Limits hook options
 */
export interface UseLimitsOptions {
    /**
     * Customer ID to check limits for
     */
    customerId: string;
}

/**
 * Limit check result
 */
export interface QZPayLimitCheckResult {
    allowed: boolean;
    currentValue: number;
    maxValue: number;
    remaining: number;
}

/**
 * Limits hook return type
 */
export interface UseLimitsReturn extends QZPayAsyncState<QZPayCustomerLimit[]> {
    /**
     * Check a specific limit
     */
    checkLimit: (key: string) => Promise<QZPayLimitCheckResult>;

    /**
     * Increment a limit
     */
    increment: (key: string, amount?: number) => Promise<QZPayCustomerLimit>;

    /**
     * Record usage for a limit
     */
    recordUsage: (key: string, quantity: number) => Promise<void>;
}

/**
 * Invoices hook options
 */
export interface UseInvoicesOptions {
    /**
     * Customer ID to get invoices for
     */
    customerId?: string | undefined;
}

/**
 * Invoices hook return type
 */
export interface UseInvoicesReturn extends QZPayAsyncState<QZPayInvoice[]> {
    /**
     * Get a specific invoice
     */
    getInvoice: (invoiceId: string) => Promise<QZPayInvoice | null>;
}

/**
 * Pricing table props
 */
export interface PricingTableProps {
    /**
     * Plans to display
     */
    plans?: QZPayPlan[] | undefined;

    /**
     * Currency to display prices in
     */
    currency?: QZPayCurrency | undefined;

    /**
     * Billing interval to show
     */
    interval?: QZPayBillingInterval | undefined;

    /**
     * Currently selected plan ID
     */
    selectedPlanId?: string | undefined;

    /**
     * Callback when a plan is selected
     */
    onSelectPlan?: ((plan: QZPayPlan, price: QZPayPrice) => void) | undefined;

    /**
     * Custom class name
     */
    className?: string | undefined;
}

/**
 * Subscription status props
 */
export interface SubscriptionStatusProps {
    /**
     * Subscription to display
     */
    subscription?: QZPaySubscription | undefined;

    /**
     * Show cancel button
     */
    showCancelButton?: boolean | undefined;

    /**
     * Callback when cancel is clicked
     */
    onCancel?: (() => void) | undefined;

    /**
     * Custom class name
     */
    className?: string | undefined;
}

/**
 * Entitlement gate props
 */
export interface EntitlementGateProps {
    /**
     * Entitlement key to check
     */
    entitlementKey: string;

    /**
     * Customer ID to check for
     */
    customerId?: string | undefined;

    /**
     * Content to show if entitled
     */
    children: ReactNode;

    /**
     * Content to show if not entitled
     */
    fallback?: ReactNode | undefined;

    /**
     * Content to show while loading
     */
    loading?: ReactNode | undefined;
}

/**
 * Limit gate props
 */
export interface LimitGateProps {
    /**
     * Limit key to check
     */
    limitKey: string;

    /**
     * Customer ID to check for
     */
    customerId?: string | undefined;

    /**
     * Content to show if within limit
     */
    children: ReactNode;

    /**
     * Content to show if limit exceeded
     */
    fallback?: ReactNode | undefined;

    /**
     * Content to show while loading
     */
    loading?: ReactNode | undefined;
}
