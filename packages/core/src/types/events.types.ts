/**
 * Event types for QZPay
 */
import type { QZPayBillingEvent } from '../constants/index.js';
import type { QZPayCheckoutSession } from './checkout.types.js';
import type { QZPayCustomer } from './customer.types.js';
import type { QZPayInvoice } from './invoice.types.js';
import type { QZPayPayment } from './payment.types.js';
import type { QZPaySubscription } from './subscription.types.js';
import type { QZPayVendor, QZPayVendorPayout } from './vendor.types.js';

export interface QZPayEvent<T = unknown> {
    id: string;
    type: QZPayBillingEvent;
    data: T;
    livemode: boolean;
    createdAt: Date;
}

export type QZPayEventHandler<T = unknown> = (event: QZPayEvent<T>) => Promise<void> | void;

export type QZPayEventMap = {
    'customer.created': QZPayCustomer;
    'customer.updated': QZPayCustomer;
    'customer.deleted': QZPayCustomer;
    'subscription.created': QZPaySubscription;
    'subscription.updated': QZPaySubscription;
    'subscription.canceled': QZPaySubscription;
    'subscription.paused': QZPaySubscription;
    'subscription.resumed': QZPaySubscription;
    'subscription.trial_ending': QZPaySubscription;
    'subscription.trial_ended': QZPaySubscription;
    'payment.succeeded': QZPayPayment;
    'payment.failed': QZPayPayment;
    'payment.refunded': QZPayPayment;
    'payment.disputed': QZPayPayment;
    'invoice.created': QZPayInvoice;
    'invoice.paid': QZPayInvoice;
    'invoice.payment_failed': QZPayInvoice;
    'invoice.voided': QZPayInvoice;
    'checkout.completed': QZPayCheckoutSession;
    'checkout.expired': QZPayCheckoutSession;
    'vendor.created': QZPayVendor;
    'vendor.updated': QZPayVendor;
    'vendor.payout': QZPayVendorPayout;
};

export type QZPayTypedEventHandler<K extends keyof QZPayEventMap> = (event: QZPayEvent<QZPayEventMap[K]>) => Promise<void> | void;
