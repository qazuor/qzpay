/**
 * Test Card Numbers for Payment Simulation
 *
 * These card numbers simulate different payment outcomes when using the mock adapter.
 * They follow the same patterns used by Stripe and other payment providers for testing.
 */

/**
 * Test card numbers that simulate different payment outcomes
 */
export const TEST_CARDS = {
    /** Payment succeeds */
    SUCCESS: '4242424242424242',
    /** Payment is declined */
    DECLINED: '4000000000000002',
    /** Payment fails due to insufficient funds */
    INSUFFICIENT_FUNDS: '4000000000009995',
    /** Payment fails due to expired card */
    EXPIRED_CARD: '4000000000000069',
    /** Payment fails due to incorrect CVC */
    INCORRECT_CVC: '4000000000000127',
    /** Payment fails due to processing error */
    PROCESSING_ERROR: '4000000000000119',
    /** Payment requires 3D Secure authentication */
    REQUIRES_3DS: '4000000000003220',
    /** Card cannot be attached to customer */
    ATTACH_FAILS: '4000000000000341'
} as const;

/**
 * Type for test card keys
 */
export type TestCardKey = keyof typeof TEST_CARDS;

/**
 * Type for test card numbers
 */
export type TestCardNumber = (typeof TEST_CARDS)[TestCardKey];

/**
 * Error codes and messages for each test card
 */
export const CARD_ERRORS: Record<string, { code: string; message: string }> = {
    [TEST_CARDS.DECLINED]: {
        code: 'card_declined',
        message: 'Your card was declined.'
    },
    [TEST_CARDS.INSUFFICIENT_FUNDS]: {
        code: 'insufficient_funds',
        message: 'Your card has insufficient funds.'
    },
    [TEST_CARDS.EXPIRED_CARD]: {
        code: 'expired_card',
        message: 'Your card has expired.'
    },
    [TEST_CARDS.INCORRECT_CVC]: {
        code: 'incorrect_cvc',
        message: 'Your card security code is incorrect.'
    },
    [TEST_CARDS.PROCESSING_ERROR]: {
        code: 'processing_error',
        message: 'An error occurred while processing your card.'
    },
    [TEST_CARDS.ATTACH_FAILS]: {
        code: 'card_declined',
        message: 'Your card could not be attached.'
    }
};

/**
 * Stripe-specific test card numbers
 */
export const STRIPE_TEST_CARDS = {
    /** Visa - Success */
    VISA_SUCCESS: '4242424242424242',
    /** Mastercard - Success */
    MASTERCARD_SUCCESS: '5555555555554444',
    /** Amex - Success */
    AMEX_SUCCESS: '378282246310005',
    /** Declined */
    DECLINED: '4000000000000002',
    /** Insufficient funds */
    INSUFFICIENT_FUNDS: '4000000000009995',
    /** Expired card */
    EXPIRED_CARD: '4000000000000069',
    /** Requires 3DS */
    REQUIRES_3DS: '4000000000003220',
    /** 3DS required (always challenge) */
    REQUIRES_3DS_ALWAYS: '4000002760003184'
} as const;

/**
 * MercadoPago-specific test card numbers by country
 */
export const MERCADOPAGO_TEST_CARDS = {
    /** Argentina - Mastercard - Success (CVV: 123) */
    AR_MASTERCARD_SUCCESS: '5031755734530604',
    /** Argentina - Visa - Success (CVV: 123) */
    AR_VISA_SUCCESS: '4509953566233704',
    /** Argentina - Amex - Success (CVV: 1234) */
    AR_AMEX_SUCCESS: '371180303257522',
    /** Mexico - Visa - Success (CVV: 123) */
    MX_VISA_SUCCESS: '4170068810108020',
    /** Brazil - Mastercard - Success (CVV: 123) */
    BR_MASTERCARD_SUCCESS: '5474925432670366',
    /** Brazil - Visa - Success (CVV: 123) */
    BR_VISA_SUCCESS: '4235647728025682'
} as const;

/**
 * Get error details for a test card number
 */
export function getCardError(cardNumber: string): { code: string; message: string } | null {
    return CARD_ERRORS[cardNumber] ?? null;
}

/**
 * Check if a card number is a test card
 */
export function isTestCard(cardNumber: string): boolean {
    return Object.values(TEST_CARDS).includes(cardNumber as TestCardNumber);
}

/**
 * Determine payment outcome based on card number
 */
export function getPaymentOutcome(cardNumber: string): {
    status: 'succeeded' | 'failed' | 'requires_action';
    error?: { code: string; message: string };
} {
    if (cardNumber === TEST_CARDS.REQUIRES_3DS) {
        return { status: 'requires_action' };
    }

    const error = CARD_ERRORS[cardNumber];
    if (error) {
        return { status: 'failed', error };
    }

    return { status: 'succeeded' };
}
