/**
 * MercadoPago Types Tests
 */
import { describe, expect, it } from 'vitest';
import {
    MERCADOPAGO_BILLING_INTERVAL,
    MERCADOPAGO_PAYMENT_STATUS,
    MERCADOPAGO_SUBSCRIPTION_STATUS,
    MERCADOPAGO_WEBHOOK_EVENTS,
    fromMercadoPagoInterval,
    toMercadoPagoInterval
} from '../src/types.js';

describe('MercadoPago Type Constants', () => {
    describe('MERCADOPAGO_SUBSCRIPTION_STATUS', () => {
        it('should have correct status mappings', () => {
            expect(MERCADOPAGO_SUBSCRIPTION_STATUS).toEqual({
                pending: 'pending',
                authorized: 'active',
                paused: 'paused',
                cancelled: 'canceled'
            });
        });
    });

    describe('MERCADOPAGO_PAYMENT_STATUS', () => {
        it('should have correct status mappings', () => {
            expect(MERCADOPAGO_PAYMENT_STATUS).toEqual({
                pending: 'pending',
                approved: 'succeeded',
                authorized: 'requires_capture',
                in_process: 'processing',
                in_mediation: 'disputed',
                rejected: 'failed',
                cancelled: 'canceled',
                refunded: 'refunded',
                charged_back: 'disputed'
            });
        });
    });

    describe('MERCADOPAGO_WEBHOOK_EVENTS', () => {
        it('should have correct event mappings', () => {
            expect(MERCADOPAGO_WEBHOOK_EVENTS['payment.created']).toBe('payment.created');
            expect(MERCADOPAGO_WEBHOOK_EVENTS['payment.updated']).toBe('payment.updated');
            expect(MERCADOPAGO_WEBHOOK_EVENTS['subscription_preapproval.created']).toBe('subscription.created');
            expect(MERCADOPAGO_WEBHOOK_EVENTS['subscription_preapproval.updated']).toBe('subscription.updated');
            expect(MERCADOPAGO_WEBHOOK_EVENTS['subscription_authorized_payment.created']).toBe('invoice.paid');
        });
    });

    describe('MERCADOPAGO_BILLING_INTERVAL', () => {
        it('should have correct interval mappings', () => {
            expect(MERCADOPAGO_BILLING_INTERVAL).toEqual({
                day: 'days',
                week: 'days',
                month: 'months',
                year: 'months'
            });
        });
    });
});

describe('toMercadoPagoInterval', () => {
    it('should convert day interval', () => {
        const result = toMercadoPagoInterval('day', 1);
        expect(result).toEqual({ frequency: 1, frequencyType: 'days' });
    });

    it('should convert week interval (7 days)', () => {
        const result = toMercadoPagoInterval('week', 1);
        expect(result).toEqual({ frequency: 7, frequencyType: 'days' });
    });

    it('should convert 2 weeks interval', () => {
        const result = toMercadoPagoInterval('week', 2);
        expect(result).toEqual({ frequency: 14, frequencyType: 'days' });
    });

    it('should convert month interval', () => {
        const result = toMercadoPagoInterval('month', 1);
        expect(result).toEqual({ frequency: 1, frequencyType: 'months' });
    });

    it('should convert 3 months (quarterly) interval', () => {
        const result = toMercadoPagoInterval('month', 3);
        expect(result).toEqual({ frequency: 3, frequencyType: 'months' });
    });

    it('should convert year interval (12 months)', () => {
        const result = toMercadoPagoInterval('year', 1);
        expect(result).toEqual({ frequency: 12, frequencyType: 'months' });
    });

    it('should convert 2 years interval', () => {
        const result = toMercadoPagoInterval('year', 2);
        expect(result).toEqual({ frequency: 24, frequencyType: 'months' });
    });

    it('should default unknown intervals to months', () => {
        const result = toMercadoPagoInterval('unknown', 1);
        expect(result).toEqual({ frequency: 1, frequencyType: 'months' });
    });
});

describe('fromMercadoPagoInterval', () => {
    it('should convert days to day interval', () => {
        const result = fromMercadoPagoInterval(1, 'days');
        expect(result).toEqual({ interval: 'day', intervalCount: 1 });
    });

    it('should convert 5 days to day interval', () => {
        const result = fromMercadoPagoInterval(5, 'days');
        expect(result).toEqual({ interval: 'day', intervalCount: 5 });
    });

    it('should convert 7 days to week interval', () => {
        const result = fromMercadoPagoInterval(7, 'days');
        expect(result).toEqual({ interval: 'week', intervalCount: 1 });
    });

    it('should convert 14 days to 2 weeks', () => {
        const result = fromMercadoPagoInterval(14, 'days');
        expect(result).toEqual({ interval: 'week', intervalCount: 2 });
    });

    it('should convert 1 month to month interval', () => {
        const result = fromMercadoPagoInterval(1, 'months');
        expect(result).toEqual({ interval: 'month', intervalCount: 1 });
    });

    it('should convert 3 months to quarter', () => {
        const result = fromMercadoPagoInterval(3, 'months');
        expect(result).toEqual({ interval: 'month', intervalCount: 3 });
    });

    it('should convert 12 months to year', () => {
        const result = fromMercadoPagoInterval(12, 'months');
        expect(result).toEqual({ interval: 'year', intervalCount: 1 });
    });

    it('should convert 24 months to 2 years', () => {
        const result = fromMercadoPagoInterval(24, 'months');
        expect(result).toEqual({ interval: 'year', intervalCount: 2 });
    });

    it('should default unknown frequency type to month', () => {
        const result = fromMercadoPagoInterval(1, 'unknown');
        expect(result).toEqual({ interval: 'month', intervalCount: 1 });
    });
});
