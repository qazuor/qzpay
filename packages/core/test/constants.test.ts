import { describe, expect, it } from 'vitest';
import {
    QZPAY_BILLING_EVENT,
    QZPAY_BILLING_EVENT_VALUES,
    QZPAY_BILLING_INTERVAL,
    QZPAY_BILLING_INTERVAL_VALUES,
    QZPAY_CANCEL_AT,
    QZPAY_CANCEL_AT_VALUES,
    QZPAY_CHECKOUT_MODE,
    QZPAY_CHECKOUT_MODE_VALUES,
    QZPAY_CURRENCY,
    QZPAY_CURRENCY_VALUES,
    QZPAY_DAY_OF_WEEK,
    QZPAY_DAY_OF_WEEK_VALUES,
    QZPAY_DISCOUNT_CONDITION,
    QZPAY_DISCOUNT_CONDITION_VALUES,
    QZPAY_DISCOUNT_STACKING_MODE,
    QZPAY_DISCOUNT_STACKING_MODE_VALUES,
    QZPAY_DISCOUNT_TYPE,
    QZPAY_DISCOUNT_TYPE_VALUES,
    QZPAY_INVOICE_STATUS,
    QZPAY_INVOICE_STATUS_VALUES,
    QZPAY_PAYMENT_PROVIDER,
    QZPAY_PAYMENT_PROVIDER_VALUES,
    QZPAY_PAYMENT_STATUS,
    QZPAY_PAYMENT_STATUS_VALUES,
    QZPAY_PRORATION_BEHAVIOR,
    QZPAY_PRORATION_BEHAVIOR_VALUES,
    QZPAY_SUBSCRIPTION_STATUS,
    QZPAY_SUBSCRIPTION_STATUS_VALUES,
    QZPAY_VENDOR_STATUS,
    QZPAY_VENDOR_STATUS_VALUES
} from '../src/constants/index.js';

describe('constants', () => {
    describe('QZPAY_SUBSCRIPTION_STATUS', () => {
        it('should have all expected values', () => {
            expect(QZPAY_SUBSCRIPTION_STATUS.ACTIVE).toBe('active');
            expect(QZPAY_SUBSCRIPTION_STATUS.TRIALING).toBe('trialing');
            expect(QZPAY_SUBSCRIPTION_STATUS.CANCELED).toBe('canceled');
        });

        it('should export values array', () => {
            expect(QZPAY_SUBSCRIPTION_STATUS_VALUES).toContain('active');
            expect(QZPAY_SUBSCRIPTION_STATUS_VALUES.length).toBe(8);
        });
    });

    describe('QZPAY_PAYMENT_STATUS', () => {
        it('should have all expected values', () => {
            expect(QZPAY_PAYMENT_STATUS.PENDING).toBe('pending');
            expect(QZPAY_PAYMENT_STATUS.SUCCEEDED).toBe('succeeded');
            expect(QZPAY_PAYMENT_STATUS.FAILED).toBe('failed');
        });

        it('should export values array', () => {
            expect(QZPAY_PAYMENT_STATUS_VALUES).toContain('succeeded');
            expect(QZPAY_PAYMENT_STATUS_VALUES.length).toBe(8);
        });
    });

    describe('QZPAY_INVOICE_STATUS', () => {
        it('should have all expected values', () => {
            expect(QZPAY_INVOICE_STATUS.DRAFT).toBe('draft');
            expect(QZPAY_INVOICE_STATUS.PAID).toBe('paid');
        });

        it('should export values array', () => {
            expect(QZPAY_INVOICE_STATUS_VALUES.length).toBe(5);
        });
    });

    describe('QZPAY_BILLING_INTERVAL', () => {
        it('should have all expected values', () => {
            expect(QZPAY_BILLING_INTERVAL.DAY).toBe('day');
            expect(QZPAY_BILLING_INTERVAL.MONTH).toBe('month');
            expect(QZPAY_BILLING_INTERVAL.YEAR).toBe('year');
        });

        it('should export values array', () => {
            expect(QZPAY_BILLING_INTERVAL_VALUES.length).toBe(4);
        });
    });

    describe('QZPAY_DISCOUNT_TYPE', () => {
        it('should have all expected values', () => {
            expect(QZPAY_DISCOUNT_TYPE.PERCENTAGE).toBe('percentage');
            expect(QZPAY_DISCOUNT_TYPE.FIXED_AMOUNT).toBe('fixed_amount');
        });

        it('should export values array', () => {
            expect(QZPAY_DISCOUNT_TYPE_VALUES.length).toBe(3);
        });
    });

    describe('QZPAY_DISCOUNT_STACKING_MODE', () => {
        it('should have all expected values', () => {
            expect(QZPAY_DISCOUNT_STACKING_MODE.NONE).toBe('none');
            expect(QZPAY_DISCOUNT_STACKING_MODE.BEST).toBe('best');
        });

        it('should export values array', () => {
            expect(QZPAY_DISCOUNT_STACKING_MODE_VALUES.length).toBe(4);
        });
    });

    describe('QZPAY_DISCOUNT_CONDITION', () => {
        it('should have all expected values', () => {
            expect(QZPAY_DISCOUNT_CONDITION.FIRST_PURCHASE).toBe('first_purchase');
            expect(QZPAY_DISCOUNT_CONDITION.MIN_AMOUNT).toBe('min_amount');
        });

        it('should export values array', () => {
            expect(QZPAY_DISCOUNT_CONDITION_VALUES.length).toBe(7);
        });
    });

    describe('QZPAY_DAY_OF_WEEK', () => {
        it('should have correct numeric values', () => {
            expect(QZPAY_DAY_OF_WEEK.SUNDAY).toBe(0);
            expect(QZPAY_DAY_OF_WEEK.MONDAY).toBe(1);
            expect(QZPAY_DAY_OF_WEEK.SATURDAY).toBe(6);
        });

        it('should export values array', () => {
            expect(QZPAY_DAY_OF_WEEK_VALUES.length).toBe(7);
        });
    });

    describe('QZPAY_CHECKOUT_MODE', () => {
        it('should have all expected values', () => {
            expect(QZPAY_CHECKOUT_MODE.PAYMENT).toBe('payment');
            expect(QZPAY_CHECKOUT_MODE.SUBSCRIPTION).toBe('subscription');
        });

        it('should export values array', () => {
            expect(QZPAY_CHECKOUT_MODE_VALUES.length).toBe(3);
        });
    });

    describe('QZPAY_PAYMENT_PROVIDER', () => {
        it('should have all expected values', () => {
            expect(QZPAY_PAYMENT_PROVIDER.STRIPE).toBe('stripe');
            expect(QZPAY_PAYMENT_PROVIDER.MERCADOPAGO).toBe('mercadopago');
        });

        it('should export values array', () => {
            expect(QZPAY_PAYMENT_PROVIDER_VALUES.length).toBe(2);
        });
    });

    describe('QZPAY_VENDOR_STATUS', () => {
        it('should have all expected values', () => {
            expect(QZPAY_VENDOR_STATUS.PENDING).toBe('pending');
            expect(QZPAY_VENDOR_STATUS.ACTIVE).toBe('active');
        });

        it('should export values array', () => {
            expect(QZPAY_VENDOR_STATUS_VALUES.length).toBe(4);
        });
    });

    describe('QZPAY_CURRENCY', () => {
        it('should have ISO 4217 currency codes', () => {
            expect(QZPAY_CURRENCY.USD).toBe('USD');
            expect(QZPAY_CURRENCY.EUR).toBe('EUR');
            expect(QZPAY_CURRENCY.ARS).toBe('ARS');
        });

        it('should export values array', () => {
            expect(QZPAY_CURRENCY_VALUES.length).toBe(10);
        });
    });

    describe('QZPAY_PRORATION_BEHAVIOR', () => {
        it('should have all expected values', () => {
            expect(QZPAY_PRORATION_BEHAVIOR.CREATE_PRORATIONS).toBe('create_prorations');
            expect(QZPAY_PRORATION_BEHAVIOR.NONE).toBe('none');
        });

        it('should export values array', () => {
            expect(QZPAY_PRORATION_BEHAVIOR_VALUES.length).toBe(3);
        });
    });

    describe('QZPAY_CANCEL_AT', () => {
        it('should have all expected values', () => {
            expect(QZPAY_CANCEL_AT.IMMEDIATELY).toBe('immediately');
            expect(QZPAY_CANCEL_AT.PERIOD_END).toBe('period_end');
        });

        it('should export values array', () => {
            expect(QZPAY_CANCEL_AT_VALUES.length).toBe(2);
        });
    });

    describe('QZPAY_BILLING_EVENT', () => {
        it('should have customer events', () => {
            expect(QZPAY_BILLING_EVENT.CUSTOMER_CREATED).toBe('customer.created');
            expect(QZPAY_BILLING_EVENT.CUSTOMER_UPDATED).toBe('customer.updated');
        });

        it('should have subscription events', () => {
            expect(QZPAY_BILLING_EVENT.SUBSCRIPTION_CREATED).toBe('subscription.created');
            expect(QZPAY_BILLING_EVENT.SUBSCRIPTION_CANCELED).toBe('subscription.canceled');
        });

        it('should have payment events', () => {
            expect(QZPAY_BILLING_EVENT.PAYMENT_SUCCEEDED).toBe('payment.succeeded');
            expect(QZPAY_BILLING_EVENT.PAYMENT_FAILED).toBe('payment.failed');
        });

        it('should export values array', () => {
            expect(QZPAY_BILLING_EVENT_VALUES.length).toBeGreaterThan(20);
        });
    });
});
