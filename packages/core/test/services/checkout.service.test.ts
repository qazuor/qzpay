/**
 * Tests for checkout service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayCheckoutLineItem, QZPayCheckoutSession, QZPayCreateCheckoutInput, QZPayPrice } from '../../src/index.js';
import {
    qzpayAddLineItem,
    qzpayAddProviderSession,
    qzpayBuildCancelUrl,
    qzpayBuildSuccessUrl,
    qzpayCalculateCheckoutTotals,
    qzpayCalculateSimpleTotal,
    qzpayCanCompleteCheckout,
    qzpayCheckoutHasCustomer,
    qzpayCheckoutIsComplete,
    qzpayCheckoutIsExpired,
    qzpayCheckoutIsOpen,
    qzpayCheckoutResultIsSuccess,
    qzpayCompleteCheckout,
    qzpayCreateCheckoutResult,
    qzpayCreateCheckoutSession,
    qzpayExpireCheckout,
    qzpayExtractSessionIdFromUrl,
    qzpayGetCheckoutMinutesRemaining,
    qzpayGetCheckoutTimeRemaining,
    qzpayGetTotalQuantity,
    qzpayRemoveLineItem,
    qzpaySetCheckoutCustomer,
    qzpayUpdateLineItemQuantity,
    qzpayValidateCheckoutInput
} from '../../src/index.js';

// ==================== Test Fixtures ====================

function createCheckoutInput(overrides: Partial<QZPayCreateCheckoutInput> = {}): QZPayCreateCheckoutInput {
    return {
        mode: 'payment',
        lineItems: [
            {
                priceId: 'price_123',
                quantity: 2
            }
        ],
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        ...overrides
    };
}

function createCheckoutSession(overrides: Partial<QZPayCheckoutSession> = {}): QZPayCheckoutSession {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 60 * 1000);

    return {
        id: 'cs_test123',
        customerId: null,
        customerEmail: null,
        mode: 'payment',
        status: 'open',
        currency: 'USD',
        lineItems: [{ priceId: 'price_123', quantity: 1 }],
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        expiresAt: futureDate,
        paymentId: null,
        subscriptionId: null,
        providerSessionIds: {},
        metadata: {},
        livemode: false,
        createdAt: now,
        completedAt: null,
        ...overrides
    };
}

function createPrice(overrides: Partial<QZPayPrice> = {}): QZPayPrice {
    return {
        id: 'price_123',
        type: 'one_time',
        productId: 'prod_123',
        currency: 'USD',
        unitAmount: 1000,
        recurring: null,
        active: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

// ==================== Session Creation Tests ====================

describe('Checkout Session Creation', () => {
    describe('qzpayCreateCheckoutSession', () => {
        it('should create a checkout session with default values', () => {
            const input = createCheckoutInput();
            const session = qzpayCreateCheckoutSession(input, false);

            expect(session.id).toMatch(/^cs_/);
            expect(session.mode).toBe('payment');
            expect(session.status).toBe('open');
            expect(session.currency).toBe('USD');
            expect(session.lineItems).toHaveLength(1);
            expect(session.livemode).toBe(false);
        });

        it('should use custom expiration minutes', () => {
            const input = createCheckoutInput({ expiresInMinutes: 60 });
            const session = qzpayCreateCheckoutSession(input, false);

            const diff = session.expiresAt.getTime() - session.createdAt.getTime();
            const minutes = diff / (60 * 1000);

            expect(minutes).toBeCloseTo(60, 0);
        });

        it('should include customer information', () => {
            const input = createCheckoutInput({
                customerId: 'cus_123',
                customerEmail: 'test@example.com'
            });
            const session = qzpayCreateCheckoutSession(input, false);

            expect(session.customerId).toBe('cus_123');
            expect(session.customerEmail).toBe('test@example.com');
        });

        it('should include metadata', () => {
            const input = createCheckoutInput({
                metadata: { orderId: '12345' }
            });
            const session = qzpayCreateCheckoutSession(input, false);

            expect(session.metadata.orderId).toBe('12345');
        });

        it('should use specified currency', () => {
            const input = createCheckoutInput();
            const session = qzpayCreateCheckoutSession(input, false, 'EUR');

            expect(session.currency).toBe('EUR');
        });
    });
});

// ==================== Session Status Tests ====================

describe('Checkout Session Status', () => {
    describe('qzpayCheckoutIsExpired', () => {
        it('should return false for non-expired session', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutIsExpired(session)).toBe(false);
        });

        it('should return true for expired session', () => {
            const pastDate = new Date(Date.now() - 1000);
            const session = createCheckoutSession({ expiresAt: pastDate });
            expect(qzpayCheckoutIsExpired(session)).toBe(true);
        });
    });

    describe('qzpayCheckoutIsOpen', () => {
        it('should return true for open non-expired session', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutIsOpen(session)).toBe(true);
        });

        it('should return false for expired session', () => {
            const pastDate = new Date(Date.now() - 1000);
            const session = createCheckoutSession({ expiresAt: pastDate });
            expect(qzpayCheckoutIsOpen(session)).toBe(false);
        });

        it('should return false for complete session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            expect(qzpayCheckoutIsOpen(session)).toBe(false);
        });
    });

    describe('qzpayCheckoutIsComplete', () => {
        it('should return true for complete session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            expect(qzpayCheckoutIsComplete(session)).toBe(true);
        });

        it('should return false for open session', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutIsComplete(session)).toBe(false);
        });
    });

    describe('qzpayGetCheckoutTimeRemaining', () => {
        it('should return positive time for future expiration', () => {
            const session = createCheckoutSession();
            const remaining = qzpayGetCheckoutTimeRemaining(session);
            expect(remaining).toBeGreaterThan(0);
        });

        it('should return 0 for expired session', () => {
            const pastDate = new Date(Date.now() - 1000);
            const session = createCheckoutSession({ expiresAt: pastDate });
            const remaining = qzpayGetCheckoutTimeRemaining(session);
            expect(remaining).toBe(0);
        });
    });

    describe('qzpayGetCheckoutMinutesRemaining', () => {
        it('should return approximate minutes remaining', () => {
            const futureDate = new Date(Date.now() + 15 * 60 * 1000);
            const session = createCheckoutSession({ expiresAt: futureDate });
            const minutes = qzpayGetCheckoutMinutesRemaining(session);
            expect(minutes).toBeGreaterThanOrEqual(14);
            expect(minutes).toBeLessThanOrEqual(16);
        });
    });
});

// ==================== Validation Tests ====================

describe('Checkout Validation', () => {
    describe('qzpayValidateCheckoutInput', () => {
        it('should validate correct input', () => {
            const input = createCheckoutInput();
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject empty line items', () => {
            const input = createCheckoutInput({ lineItems: [] });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least one line item is required');
        });

        it('should reject invalid success URL', () => {
            const input = createCheckoutInput({ successUrl: 'not-a-url' });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Success URL is not a valid URL');
        });

        it('should reject invalid cancel URL', () => {
            const input = createCheckoutInput({ cancelUrl: 'not-a-url' });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Cancel URL is not a valid URL');
        });

        it('should reject line items without priceId', () => {
            const input = createCheckoutInput({
                lineItems: [{ priceId: '', quantity: 1 }]
            });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Price ID is required'))).toBe(true);
        });

        it('should reject line items with invalid quantity', () => {
            const input = createCheckoutInput({
                lineItems: [{ priceId: 'price_123', quantity: 0 }]
            });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Quantity must be at least 1'))).toBe(true);
        });

        it('should require customer for requireCustomer option', () => {
            const input = createCheckoutInput();
            const result = qzpayValidateCheckoutInput(input, { requireCustomer: true });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Customer ID or email is required');
        });

        it('should validate subscription mode requirements', () => {
            const input = createCheckoutInput({
                mode: 'subscription',
                lineItems: [
                    { priceId: 'price_1', quantity: 1 },
                    { priceId: 'price_2', quantity: 1 }
                ]
            });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Subscription mode requires exactly one line item');
        });
    });

    describe('qzpayCanCompleteCheckout', () => {
        it('should allow completing open session', () => {
            const session = createCheckoutSession();
            const result = qzpayCanCompleteCheckout(session);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject completing expired session', () => {
            const pastDate = new Date(Date.now() - 1000);
            const session = createCheckoutSession({ expiresAt: pastDate });
            const result = qzpayCanCompleteCheckout(session);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Cannot complete checkout: session has expired');
        });

        it('should reject completing already completed session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            const result = qzpayCanCompleteCheckout(session);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('session is complete'))).toBe(true);
        });
    });
});

// ==================== Totals Calculation Tests ====================

describe('Checkout Totals', () => {
    describe('qzpayCalculateCheckoutTotals', () => {
        it('should calculate totals correctly', () => {
            const lineItems: QZPayCheckoutLineItem[] = [
                { priceId: 'price_1', quantity: 2 },
                { priceId: 'price_2', quantity: 1 }
            ];

            const prices = new Map<string, QZPayPrice>([
                ['price_1', createPrice({ id: 'price_1', unitAmount: 1000 })],
                ['price_2', createPrice({ id: 'price_2', unitAmount: 500 })]
            ]);

            const totals = qzpayCalculateCheckoutTotals(lineItems, prices);

            expect(totals.subtotal).toBe(2500); // (1000 * 2) + (500 * 1)
            expect(totals.discount).toBe(0);
            expect(totals.tax).toBe(0);
            expect(totals.total).toBe(2500);
        });

        it('should apply discount', () => {
            const lineItems: QZPayCheckoutLineItem[] = [{ priceId: 'price_1', quantity: 1 }];
            const prices = new Map<string, QZPayPrice>([['price_1', createPrice({ unitAmount: 1000 })]]);

            const totals = qzpayCalculateCheckoutTotals(lineItems, prices, 200);

            expect(totals.subtotal).toBe(1000);
            expect(totals.discount).toBe(200);
            expect(totals.total).toBe(800);
        });

        it('should apply tax rate', () => {
            const lineItems: QZPayCheckoutLineItem[] = [{ priceId: 'price_1', quantity: 1 }];
            const prices = new Map<string, QZPayPrice>([['price_1', createPrice({ unitAmount: 1000 })]]);

            const totals = qzpayCalculateCheckoutTotals(lineItems, prices, 0, 0.1); // 10% tax

            expect(totals.subtotal).toBe(1000);
            expect(totals.tax).toBe(100);
            expect(totals.total).toBe(1100);
        });

        it('should handle missing prices', () => {
            const lineItems: QZPayCheckoutLineItem[] = [{ priceId: 'price_missing', quantity: 1 }];
            const prices = new Map<string, QZPayPrice>();

            const totals = qzpayCalculateCheckoutTotals(lineItems, prices);

            expect(totals.subtotal).toBe(0);
            expect(totals.total).toBe(0);
        });
    });

    describe('qzpayCalculateSimpleTotal', () => {
        it('should sum amounts', () => {
            const total = qzpayCalculateSimpleTotal([100, 200, 300]);
            expect(total).toBe(600);
        });

        it('should apply discount', () => {
            const total = qzpayCalculateSimpleTotal([100, 200], 50);
            expect(total).toBe(250);
        });

        it('should not go below zero', () => {
            const total = qzpayCalculateSimpleTotal([100], 200);
            expect(total).toBe(0);
        });
    });
});

// ==================== URL Helpers Tests ====================

describe('Checkout URL Helpers', () => {
    describe('qzpayBuildSuccessUrl', () => {
        it('should append session_id to URL', () => {
            const url = qzpayBuildSuccessUrl('https://example.com/success', 'cs_123');
            expect(url).toBe('https://example.com/success?session_id=cs_123');
        });

        it('should preserve existing query params', () => {
            const url = qzpayBuildSuccessUrl('https://example.com/success?foo=bar', 'cs_123');
            expect(url).toContain('foo=bar');
            expect(url).toContain('session_id=cs_123');
        });
    });

    describe('qzpayBuildCancelUrl', () => {
        it('should append session_id and canceled flag', () => {
            const url = qzpayBuildCancelUrl('https://example.com/cancel', 'cs_123');
            expect(url).toContain('session_id=cs_123');
            expect(url).toContain('canceled=true');
        });
    });

    describe('qzpayExtractSessionIdFromUrl', () => {
        it('should extract session_id from URL', () => {
            const sessionId = qzpayExtractSessionIdFromUrl('https://example.com/success?session_id=cs_123');
            expect(sessionId).toBe('cs_123');
        });

        it('should return null for URL without session_id', () => {
            const sessionId = qzpayExtractSessionIdFromUrl('https://example.com/success');
            expect(sessionId).toBeNull();
        });

        it('should return null for invalid URL', () => {
            const sessionId = qzpayExtractSessionIdFromUrl('not-a-url');
            expect(sessionId).toBeNull();
        });
    });
});

// ==================== State Transition Tests ====================

describe('Checkout State Transitions', () => {
    describe('qzpayCompleteCheckout', () => {
        it('should mark session as complete', () => {
            const session = createCheckoutSession();
            const completed = qzpayCompleteCheckout(session, 'pay_123');

            expect(completed.status).toBe('complete');
            expect(completed.paymentId).toBe('pay_123');
            expect(completed.completedAt).toBeInstanceOf(Date);
        });

        it('should include subscription ID for subscription mode', () => {
            const session = createCheckoutSession({ mode: 'subscription' });
            const completed = qzpayCompleteCheckout(session, 'pay_123', 'sub_123');

            expect(completed.subscriptionId).toBe('sub_123');
        });
    });

    describe('qzpayExpireCheckout', () => {
        it('should mark session as expired', () => {
            const session = createCheckoutSession();
            const expired = qzpayExpireCheckout(session);

            expect(expired.status).toBe('expired');
        });
    });

    describe('qzpayAddProviderSession', () => {
        it('should add provider session ID', () => {
            const session = createCheckoutSession();
            const updated = qzpayAddProviderSession(session, 'stripe', 'cs_stripe_123');

            expect(updated.providerSessionIds.stripe).toBe('cs_stripe_123');
        });

        it('should preserve existing provider sessions', () => {
            const session = createCheckoutSession({
                providerSessionIds: { stripe: 'cs_stripe_123' }
            });
            const updated = qzpayAddProviderSession(session, 'paypal', 'cs_paypal_123');

            expect(updated.providerSessionIds.stripe).toBe('cs_stripe_123');
            expect(updated.providerSessionIds.paypal).toBe('cs_paypal_123');
        });
    });
});

// ==================== Line Item Helpers Tests ====================

describe('Checkout Line Items', () => {
    describe('qzpayAddLineItem', () => {
        it('should add new line item', () => {
            const session = createCheckoutSession();
            const newItem: QZPayCheckoutLineItem = { priceId: 'price_new', quantity: 1 };
            const updated = qzpayAddLineItem(session, newItem);

            expect(updated.lineItems).toHaveLength(2);
            expect(updated.lineItems[1]).toEqual(newItem);
        });

        it('should increase quantity for existing price', () => {
            const session = createCheckoutSession({
                lineItems: [{ priceId: 'price_123', quantity: 2 }]
            });
            const updated = qzpayAddLineItem(session, { priceId: 'price_123', quantity: 1 });

            expect(updated.lineItems).toHaveLength(1);
            expect(updated.lineItems[0]?.quantity).toBe(3);
        });
    });

    describe('qzpayRemoveLineItem', () => {
        it('should remove line item', () => {
            const session = createCheckoutSession({
                lineItems: [
                    { priceId: 'price_1', quantity: 1 },
                    { priceId: 'price_2', quantity: 1 }
                ]
            });
            const updated = qzpayRemoveLineItem(session, 'price_1');

            expect(updated.lineItems).toHaveLength(1);
            expect(updated.lineItems[0]?.priceId).toBe('price_2');
        });
    });

    describe('qzpayUpdateLineItemQuantity', () => {
        it('should update quantity', () => {
            const session = createCheckoutSession({
                lineItems: [{ priceId: 'price_123', quantity: 1 }]
            });
            const updated = qzpayUpdateLineItemQuantity(session, 'price_123', 5);

            expect(updated.lineItems[0]?.quantity).toBe(5);
        });

        it('should remove item if quantity is less than 1', () => {
            const session = createCheckoutSession({
                lineItems: [{ priceId: 'price_123', quantity: 1 }]
            });
            const updated = qzpayUpdateLineItemQuantity(session, 'price_123', 0);

            expect(updated.lineItems).toHaveLength(0);
        });
    });

    describe('qzpayGetTotalQuantity', () => {
        it('should sum all quantities', () => {
            const session = createCheckoutSession({
                lineItems: [
                    { priceId: 'price_1', quantity: 2 },
                    { priceId: 'price_2', quantity: 3 }
                ]
            });
            const total = qzpayGetTotalQuantity(session);

            expect(total).toBe(5);
        });
    });
});

// ==================== Customer Helpers Tests ====================

describe('Checkout Customer Helpers', () => {
    describe('qzpaySetCheckoutCustomer', () => {
        it('should set customer ID and email', () => {
            const session = createCheckoutSession();
            const updated = qzpaySetCheckoutCustomer(session, 'cus_123', 'test@example.com');

            expect(updated.customerId).toBe('cus_123');
            expect(updated.customerEmail).toBe('test@example.com');
        });

        it('should preserve existing email if not provided', () => {
            const session = createCheckoutSession({ customerEmail: 'old@example.com' });
            const updated = qzpaySetCheckoutCustomer(session, 'cus_123');

            expect(updated.customerId).toBe('cus_123');
            expect(updated.customerEmail).toBe('old@example.com');
        });
    });

    describe('qzpayCheckoutHasCustomer', () => {
        it('should return true when customer is set', () => {
            const session = createCheckoutSession({ customerId: 'cus_123' });
            expect(qzpayCheckoutHasCustomer(session)).toBe(true);
        });

        it('should return false when customer is not set', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutHasCustomer(session)).toBe(false);
        });
    });
});

// ==================== Result Helpers Tests ====================

describe('Checkout Result Helpers', () => {
    describe('qzpayCreateCheckoutResult', () => {
        it('should create result with URL', () => {
            const session = createCheckoutSession();
            const result = qzpayCreateCheckoutResult(session, 'https://checkout.example.com/cs_123');

            expect(result.session).toBe(session);
            expect(result.url).toBe('https://checkout.example.com/cs_123');
        });
    });

    describe('qzpayCheckoutResultIsSuccess', () => {
        it('should return true for complete session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            const result = qzpayCreateCheckoutResult(session, 'https://example.com');

            expect(qzpayCheckoutResultIsSuccess(result)).toBe(true);
        });

        it('should return false for open session', () => {
            const session = createCheckoutSession();
            const result = qzpayCreateCheckoutResult(session, 'https://example.com');

            expect(qzpayCheckoutResultIsSuccess(result)).toBe(false);
        });
    });
});
