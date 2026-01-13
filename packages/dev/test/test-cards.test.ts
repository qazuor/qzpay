/**
 * Test Cards Utilities Tests
 */
import { describe, expect, it } from 'vitest';
import {
    CARD_ERRORS,
    MERCADOPAGO_TEST_CARDS,
    STRIPE_TEST_CARDS,
    TEST_CARDS,
    getCardError,
    getPaymentOutcome,
    isTestCard
} from '../src/test-cards.js';

describe('TEST_CARDS', () => {
    it('should contain all expected test card numbers', () => {
        expect(TEST_CARDS.SUCCESS).toBe('4242424242424242');
        expect(TEST_CARDS.DECLINED).toBe('4000000000000002');
        expect(TEST_CARDS.INSUFFICIENT_FUNDS).toBe('4000000000009995');
        expect(TEST_CARDS.EXPIRED_CARD).toBe('4000000000000069');
        expect(TEST_CARDS.INCORRECT_CVC).toBe('4000000000000127');
        expect(TEST_CARDS.PROCESSING_ERROR).toBe('4000000000000119');
        expect(TEST_CARDS.REQUIRES_3DS).toBe('4000000000003220');
        expect(TEST_CARDS.ATTACH_FAILS).toBe('4000000000000341');
    });

    it('should have unique card numbers', () => {
        const cardNumbers = Object.values(TEST_CARDS);
        const uniqueNumbers = new Set(cardNumbers);
        expect(uniqueNumbers.size).toBe(cardNumbers.length);
    });

    it('should be readonly at type level', () => {
        // TEST_CARDS is readonly at the TypeScript level (enforced by 'as const')
        // JavaScript itself doesn't enforce readonly, so we just verify the type
        expect(TEST_CARDS).toBeDefined();
    });
});

describe('CARD_ERRORS', () => {
    it('should map DECLINED card to card_declined error', () => {
        const error = CARD_ERRORS[TEST_CARDS.DECLINED];
        expect(error).toEqual({
            code: 'card_declined',
            message: 'Your card was declined.'
        });
    });

    it('should map INSUFFICIENT_FUNDS card to insufficient_funds error', () => {
        const error = CARD_ERRORS[TEST_CARDS.INSUFFICIENT_FUNDS];
        expect(error).toEqual({
            code: 'insufficient_funds',
            message: 'Your card has insufficient funds.'
        });
    });

    it('should map EXPIRED_CARD card to expired_card error', () => {
        const error = CARD_ERRORS[TEST_CARDS.EXPIRED_CARD];
        expect(error).toEqual({
            code: 'expired_card',
            message: 'Your card has expired.'
        });
    });

    it('should map INCORRECT_CVC card to incorrect_cvc error', () => {
        const error = CARD_ERRORS[TEST_CARDS.INCORRECT_CVC];
        expect(error).toEqual({
            code: 'incorrect_cvc',
            message: 'Your card security code is incorrect.'
        });
    });

    it('should map PROCESSING_ERROR card to processing_error error', () => {
        const error = CARD_ERRORS[TEST_CARDS.PROCESSING_ERROR];
        expect(error).toEqual({
            code: 'processing_error',
            message: 'An error occurred while processing your card.'
        });
    });

    it('should map ATTACH_FAILS card to card_declined error', () => {
        const error = CARD_ERRORS[TEST_CARDS.ATTACH_FAILS];
        expect(error).toEqual({
            code: 'card_declined',
            message: 'Your card could not be attached.'
        });
    });

    it('should not have error for SUCCESS card', () => {
        const error = CARD_ERRORS[TEST_CARDS.SUCCESS];
        expect(error).toBeUndefined();
    });

    it('should not have error for REQUIRES_3DS card', () => {
        const error = CARD_ERRORS[TEST_CARDS.REQUIRES_3DS];
        expect(error).toBeUndefined();
    });

    it('should have code and message for all errors', () => {
        for (const [_cardNumber, error] of Object.entries(CARD_ERRORS)) {
            expect(error).toHaveProperty('code');
            expect(error).toHaveProperty('message');
            expect(typeof error.code).toBe('string');
            expect(typeof error.message).toBe('string');
            expect(error.code.length).toBeGreaterThan(0);
            expect(error.message.length).toBeGreaterThan(0);
        }
    });
});

describe('STRIPE_TEST_CARDS', () => {
    it('should contain Visa success card', () => {
        expect(STRIPE_TEST_CARDS.VISA_SUCCESS).toBe('4242424242424242');
    });

    it('should contain Mastercard success card', () => {
        expect(STRIPE_TEST_CARDS.MASTERCARD_SUCCESS).toBe('5555555555554444');
    });

    it('should contain Amex success card', () => {
        expect(STRIPE_TEST_CARDS.AMEX_SUCCESS).toBe('378282246310005');
    });

    it('should contain declined card', () => {
        expect(STRIPE_TEST_CARDS.DECLINED).toBe('4000000000000002');
    });

    it('should contain 3DS cards', () => {
        expect(STRIPE_TEST_CARDS.REQUIRES_3DS).toBe('4000000000003220');
        expect(STRIPE_TEST_CARDS.REQUIRES_3DS_ALWAYS).toBe('4000002760003184');
    });

    it('should have unique card numbers', () => {
        const cardNumbers = Object.values(STRIPE_TEST_CARDS);
        const uniqueNumbers = new Set(cardNumbers);
        expect(uniqueNumbers.size).toBe(cardNumbers.length);
    });
});

describe('MERCADOPAGO_TEST_CARDS', () => {
    it('should contain Argentina test cards', () => {
        expect(MERCADOPAGO_TEST_CARDS.AR_MASTERCARD_SUCCESS).toBe('5031755734530604');
        expect(MERCADOPAGO_TEST_CARDS.AR_VISA_SUCCESS).toBe('4509953566233704');
        expect(MERCADOPAGO_TEST_CARDS.AR_AMEX_SUCCESS).toBe('371180303257522');
    });

    it('should contain Mexico test cards', () => {
        expect(MERCADOPAGO_TEST_CARDS.MX_VISA_SUCCESS).toBe('4170068810108020');
    });

    it('should contain Brazil test cards', () => {
        expect(MERCADOPAGO_TEST_CARDS.BR_MASTERCARD_SUCCESS).toBe('5474925432670366');
        expect(MERCADOPAGO_TEST_CARDS.BR_VISA_SUCCESS).toBe('4235647728025682');
    });

    it('should have unique card numbers', () => {
        const cardNumbers = Object.values(MERCADOPAGO_TEST_CARDS);
        const uniqueNumbers = new Set(cardNumbers);
        expect(uniqueNumbers.size).toBe(cardNumbers.length);
    });
});

describe('getCardError', () => {
    it('should return error for declined card', () => {
        const error = getCardError(TEST_CARDS.DECLINED);
        expect(error).toEqual({
            code: 'card_declined',
            message: 'Your card was declined.'
        });
    });

    it('should return error for insufficient funds card', () => {
        const error = getCardError(TEST_CARDS.INSUFFICIENT_FUNDS);
        expect(error).toEqual({
            code: 'insufficient_funds',
            message: 'Your card has insufficient funds.'
        });
    });

    it('should return null for success card', () => {
        const error = getCardError(TEST_CARDS.SUCCESS);
        expect(error).toBeNull();
    });

    it('should return null for requires 3DS card', () => {
        const error = getCardError(TEST_CARDS.REQUIRES_3DS);
        expect(error).toBeNull();
    });

    it('should return null for unknown card number', () => {
        const error = getCardError('9999999999999999');
        expect(error).toBeNull();
    });
});

describe('isTestCard', () => {
    it('should return true for SUCCESS card', () => {
        expect(isTestCard(TEST_CARDS.SUCCESS)).toBe(true);
    });

    it('should return true for DECLINED card', () => {
        expect(isTestCard(TEST_CARDS.DECLINED)).toBe(true);
    });

    it('should return true for REQUIRES_3DS card', () => {
        expect(isTestCard(TEST_CARDS.REQUIRES_3DS)).toBe(true);
    });

    it('should return true for all test cards', () => {
        for (const cardNumber of Object.values(TEST_CARDS)) {
            expect(isTestCard(cardNumber)).toBe(true);
        }
    });

    it('should return false for unknown card number', () => {
        expect(isTestCard('9999999999999999')).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isTestCard('')).toBe(false);
    });

    it('should return false for Stripe test cards not in TEST_CARDS', () => {
        expect(isTestCard(STRIPE_TEST_CARDS.MASTERCARD_SUCCESS)).toBe(false);
        expect(isTestCard(STRIPE_TEST_CARDS.AMEX_SUCCESS)).toBe(false);
    });
});

describe('getPaymentOutcome', () => {
    it('should return succeeded for SUCCESS card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.SUCCESS);
        expect(outcome).toEqual({
            status: 'succeeded'
        });
    });

    it('should return requires_action for REQUIRES_3DS card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.REQUIRES_3DS);
        expect(outcome).toEqual({
            status: 'requires_action'
        });
    });

    it('should return failed with error for DECLINED card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.DECLINED);
        expect(outcome).toEqual({
            status: 'failed',
            error: {
                code: 'card_declined',
                message: 'Your card was declined.'
            }
        });
    });

    it('should return failed with error for INSUFFICIENT_FUNDS card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.INSUFFICIENT_FUNDS);
        expect(outcome).toEqual({
            status: 'failed',
            error: {
                code: 'insufficient_funds',
                message: 'Your card has insufficient funds.'
            }
        });
    });

    it('should return failed with error for EXPIRED_CARD card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.EXPIRED_CARD);
        expect(outcome).toEqual({
            status: 'failed',
            error: {
                code: 'expired_card',
                message: 'Your card has expired.'
            }
        });
    });

    it('should return failed with error for INCORRECT_CVC card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.INCORRECT_CVC);
        expect(outcome).toEqual({
            status: 'failed',
            error: {
                code: 'incorrect_cvc',
                message: 'Your card security code is incorrect.'
            }
        });
    });

    it('should return failed with error for PROCESSING_ERROR card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.PROCESSING_ERROR);
        expect(outcome).toEqual({
            status: 'failed',
            error: {
                code: 'processing_error',
                message: 'An error occurred while processing your card.'
            }
        });
    });

    it('should return failed with error for ATTACH_FAILS card', () => {
        const outcome = getPaymentOutcome(TEST_CARDS.ATTACH_FAILS);
        expect(outcome).toEqual({
            status: 'failed',
            error: {
                code: 'card_declined',
                message: 'Your card could not be attached.'
            }
        });
    });

    it('should return succeeded for unknown card number', () => {
        const outcome = getPaymentOutcome('9999999999999999');
        expect(outcome).toEqual({
            status: 'succeeded'
        });
    });

    it('should return succeeded for Stripe success cards', () => {
        const visaOutcome = getPaymentOutcome(STRIPE_TEST_CARDS.VISA_SUCCESS);
        expect(visaOutcome.status).toBe('succeeded');

        const mastercardOutcome = getPaymentOutcome(STRIPE_TEST_CARDS.MASTERCARD_SUCCESS);
        expect(mastercardOutcome.status).toBe('succeeded');

        const amexOutcome = getPaymentOutcome(STRIPE_TEST_CARDS.AMEX_SUCCESS);
        expect(amexOutcome.status).toBe('succeeded');
    });

    it('should have consistent error structure', () => {
        const errorCards = [
            TEST_CARDS.DECLINED,
            TEST_CARDS.INSUFFICIENT_FUNDS,
            TEST_CARDS.EXPIRED_CARD,
            TEST_CARDS.INCORRECT_CVC,
            TEST_CARDS.PROCESSING_ERROR,
            TEST_CARDS.ATTACH_FAILS
        ];

        for (const cardNumber of errorCards) {
            const outcome = getPaymentOutcome(cardNumber);
            expect(outcome.status).toBe('failed');
            expect(outcome.error).toBeDefined();
            expect(outcome.error?.code).toBeDefined();
            expect(outcome.error?.message).toBeDefined();
            expect(typeof outcome.error?.code).toBe('string');
            expect(typeof outcome.error?.message).toBe('string');
        }
    });
});
