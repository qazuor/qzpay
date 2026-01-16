/**
 * Billing event constants
 */
export const QZPAY_BILLING_EVENT = {
    // Customer events
    CUSTOMER_CREATED: 'customer.created',
    CUSTOMER_UPDATED: 'customer.updated',
    CUSTOMER_DELETED: 'customer.deleted',

    // Subscription events
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    SUBSCRIPTION_CANCELED: 'subscription.canceled',
    SUBSCRIPTION_PAUSED: 'subscription.paused',
    SUBSCRIPTION_RESUMED: 'subscription.resumed',
    SUBSCRIPTION_TRIAL_ENDING: 'subscription.trial_ending',
    SUBSCRIPTION_TRIAL_ENDED: 'subscription.trial_ended',

    // Payment events
    PAYMENT_SUCCEEDED: 'payment.succeeded',
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_REFUNDED: 'payment.refunded',
    PAYMENT_DISPUTED: 'payment.disputed',

    // Invoice events
    INVOICE_CREATED: 'invoice.created',
    INVOICE_PAID: 'invoice.paid',
    INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
    INVOICE_VOIDED: 'invoice.voided',

    // Checkout events
    CHECKOUT_COMPLETED: 'checkout.completed',
    CHECKOUT_EXPIRED: 'checkout.expired',

    // Vendor events (marketplace)
    VENDOR_CREATED: 'vendor.created',
    VENDOR_UPDATED: 'vendor.updated',
    VENDOR_PAYOUT: 'vendor.payout',

    // Add-on events
    ADDON_CREATED: 'addon.created',
    ADDON_UPDATED: 'addon.updated',
    ADDON_DELETED: 'addon.deleted',
    SUBSCRIPTION_ADDON_ADDED: 'subscription.addon_added',
    SUBSCRIPTION_ADDON_REMOVED: 'subscription.addon_removed',
    SUBSCRIPTION_ADDON_UPDATED: 'subscription.addon_updated',

    // Payment method events
    PAYMENT_METHOD_CREATED: 'payment_method.created',
    PAYMENT_METHOD_UPDATED: 'payment_method.updated',
    PAYMENT_METHOD_DELETED: 'payment_method.deleted'
} as const;

export type QZPayBillingEvent = (typeof QZPAY_BILLING_EVENT)[keyof typeof QZPAY_BILLING_EVENT];

export const QZPAY_BILLING_EVENT_VALUES = Object.values(QZPAY_BILLING_EVENT) as readonly QZPayBillingEvent[];
