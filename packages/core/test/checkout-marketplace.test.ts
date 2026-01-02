/**
 * Tests for checkout and marketplace service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayCheckoutSession, QZPayCreateCheckoutInput, QZPayPayoutSchedule, QZPayVendor, QZPayVendorPayout } from '../src/index.js';
import {
    // Checkout helpers
    qzpayAddLineItem,
    qzpayAddProviderSession,
    qzpayBuildCancelUrl,
    qzpayBuildSuccessUrl,
    qzpayCalculateCheckoutTotals,
    // Marketplace helpers
    qzpayCalculateMultiVendorSplit,
    qzpayCalculatePendingEarnings,
    qzpayCalculatePlatformCommission,
    qzpayCalculateRevenueShares,
    qzpayCalculateSimpleTotal,
    qzpayCalculateSplit,
    qzpayCalculateVendorAmount,
    qzpayCalculateVendorEarnings,
    qzpayCanCompleteCheckout,
    qzpayCheckPayoutEligibility,
    qzpayCheckoutHasCustomer,
    qzpayCheckoutIsComplete,
    qzpayCheckoutIsExpired,
    qzpayCheckoutIsOpen,
    qzpayCheckoutResultIsSuccess,
    qzpayCompleteCheckout,
    qzpayCreateCheckoutResult,
    qzpayCreateCheckoutSession,
    qzpayCreatePayout,
    qzpayExpireCheckout,
    qzpayExtractSessionIdFromUrl,
    qzpayFilterPayoutsByDateRange,
    qzpayFilterPayoutsByStatus,
    qzpayGetCheckoutMinutesRemaining,
    qzpayGetCheckoutTimeRemaining,
    qzpayGetNextPayoutDate,
    qzpayGetPayoutPeriod,
    qzpayGetTotalQuantity,
    qzpayGetVendorCommissionRate,
    qzpayIsWithinPayoutPeriod,
    qzpayMarkPayoutFailed,
    qzpayMarkPayoutPaid,
    qzpayMarkPayoutProcessing,
    qzpayRemoveLineItem,
    qzpaySetCheckoutCustomer,
    qzpayUpdateLineItemQuantity,
    qzpayValidateCheckoutInput,
    qzpayVendorCanReceivePayments,
    qzpayVendorIsActive,
    qzpayVendorIsPending,
    qzpayVendorIsSuspended
} from '../src/index.js';

// ==================== Test Fixtures ====================

function createCheckoutInput(overrides: Partial<QZPayCreateCheckoutInput> = {}): QZPayCreateCheckoutInput {
    return {
        mode: 'payment',
        lineItems: [{ priceId: 'price_123', quantity: 1 }],
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        ...overrides
    };
}

function createCheckoutSession(overrides: Partial<QZPayCheckoutSession> = {}): QZPayCheckoutSession {
    const now = new Date();
    return {
        id: 'cs_test_123',
        customerId: null,
        customerEmail: null,
        mode: 'payment',
        status: 'open',
        currency: 'usd',
        lineItems: [{ priceId: 'price_123', quantity: 1 }],
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
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

function createVendor(overrides: Partial<QZPayVendor> = {}): QZPayVendor {
    return {
        id: 'vendor_123',
        externalId: 'ext_vendor_123',
        name: 'Test Vendor',
        email: 'vendor@example.com',
        status: 'active',
        commissionRate: 10,
        payoutSchedule: { interval: 'weekly', dayOfWeek: 1 },
        providerAccountIds: { stripe: 'acct_123' },
        metadata: {},
        livemode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

function createPayout(overrides: Partial<QZPayVendorPayout> = {}): QZPayVendorPayout {
    const now = new Date();
    return {
        id: 'po_123',
        vendorId: 'vendor_123',
        amount: 10000,
        currency: 'usd',
        status: 'pending',
        periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: now,
        providerPayoutIds: {},
        paidAt: null,
        createdAt: now,
        ...overrides
    };
}

// ==================== Checkout Session Tests ====================

describe('Checkout Session Helpers', () => {
    describe('qzpayCreateCheckoutSession', () => {
        it('should create a new checkout session', () => {
            const input = createCheckoutInput();
            const session = qzpayCreateCheckoutSession(input, false);

            expect(session.id).toMatch(/^cs_/);
            expect(session.status).toBe('open');
            expect(session.mode).toBe('payment');
            expect(session.lineItems).toHaveLength(1);
            expect(session.livemode).toBe(false);
        });

        it('should set expiration based on input', () => {
            const input = createCheckoutInput({ expiresInMinutes: 60 });
            const session = qzpayCreateCheckoutSession(input, true);

            const expectedExpiry = Date.now() + 60 * 60 * 1000;
            expect(session.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3);
        });

        it('should use default 30 minute expiration', () => {
            const input = createCheckoutInput();
            const session = qzpayCreateCheckoutSession(input, true);

            const expectedExpiry = Date.now() + 30 * 60 * 1000;
            expect(session.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3);
        });
    });

    describe('qzpayCheckoutIsExpired', () => {
        it('should return false for non-expired session', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutIsExpired(session)).toBe(false);
        });

        it('should return true for expired session', () => {
            const session = createCheckoutSession({
                expiresAt: new Date('2020-01-01')
            });
            expect(qzpayCheckoutIsExpired(session)).toBe(true);
        });
    });

    describe('qzpayCheckoutIsOpen', () => {
        it('should return true for open non-expired session', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutIsOpen(session)).toBe(true);
        });

        it('should return false for expired session', () => {
            const session = createCheckoutSession({
                expiresAt: new Date('2020-01-01')
            });
            expect(qzpayCheckoutIsOpen(session)).toBe(false);
        });

        it('should return false for completed session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            expect(qzpayCheckoutIsOpen(session)).toBe(false);
        });
    });

    describe('qzpayCheckoutIsComplete', () => {
        it('should return true for completed session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            expect(qzpayCheckoutIsComplete(session)).toBe(true);
        });

        it('should return false for open session', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutIsComplete(session)).toBe(false);
        });
    });

    describe('qzpayGetCheckoutTimeRemaining', () => {
        it('should return positive time for non-expired', () => {
            const session = createCheckoutSession();
            expect(qzpayGetCheckoutTimeRemaining(session)).toBeGreaterThan(0);
        });

        it('should return 0 for expired session', () => {
            const session = createCheckoutSession({
                expiresAt: new Date('2020-01-01')
            });
            expect(qzpayGetCheckoutTimeRemaining(session)).toBe(0);
        });
    });

    describe('qzpayGetCheckoutMinutesRemaining', () => {
        it('should return minutes remaining', () => {
            const session = createCheckoutSession();
            const minutes = qzpayGetCheckoutMinutesRemaining(session);
            expect(minutes).toBeGreaterThanOrEqual(29);
            expect(minutes).toBeLessThanOrEqual(31);
        });
    });
});

// ==================== Checkout Validation Tests ====================

describe('Checkout Validation', () => {
    describe('qzpayValidateCheckoutInput', () => {
        it('should validate correct input', () => {
            const input = createCheckoutInput();
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should require line items', () => {
            const input = createCheckoutInput({ lineItems: [] });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least one line item is required');
        });

        it('should validate line item quantity', () => {
            const input = createCheckoutInput({
                lineItems: [{ priceId: 'price_123', quantity: 0 }]
            });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Quantity must be at least 1'))).toBe(true);
        });

        it('should validate success URL', () => {
            const input = createCheckoutInput({ successUrl: 'invalid-url' });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Success URL is not a valid URL');
        });

        it('should validate cancel URL', () => {
            const input = createCheckoutInput({ cancelUrl: '' });
            const result = qzpayValidateCheckoutInput(input);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Cancel URL is required');
        });

        it('should require customer when option set', () => {
            const input = createCheckoutInput();
            const result = qzpayValidateCheckoutInput(input, { requireCustomer: true });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Customer ID or email is required');
        });

        it('should allow customer email as alternative', () => {
            const input = createCheckoutInput({ customerEmail: 'test@example.com' });
            const result = qzpayValidateCheckoutInput(input, { requireCustomer: true });

            expect(result.valid).toBe(true);
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

        it('should validate allowed modes', () => {
            const input = createCheckoutInput({ mode: 'setup' });
            const result = qzpayValidateCheckoutInput(input, {
                allowedModes: ['payment', 'subscription']
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Checkout mode 'setup' is not allowed");
        });
    });

    describe('qzpayCanCompleteCheckout', () => {
        it('should allow completion of open session', () => {
            const session = createCheckoutSession();
            const result = qzpayCanCompleteCheckout(session);

            expect(result.valid).toBe(true);
        });

        it('should reject completion of completed session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            const result = qzpayCanCompleteCheckout(session);

            expect(result.valid).toBe(false);
        });

        it('should reject completion of expired session', () => {
            const session = createCheckoutSession({
                expiresAt: new Date('2020-01-01')
            });
            const result = qzpayCanCompleteCheckout(session);

            expect(result.valid).toBe(false);
        });
    });
});

// ==================== Checkout Totals Tests ====================

describe('Checkout Totals', () => {
    describe('qzpayCalculateCheckoutTotals', () => {
        it('should calculate totals from prices', () => {
            const lineItems = [
                { priceId: 'price_1', quantity: 2 },
                { priceId: 'price_2', quantity: 1 }
            ];
            const prices = new Map([
                ['price_1', { id: 'price_1', unitAmount: 1000, currency: 'usd' as const }],
                ['price_2', { id: 'price_2', unitAmount: 2500, currency: 'usd' as const }]
            ] as [string, { id: string; unitAmount: number; currency: 'usd' }][]);

            const totals = qzpayCalculateCheckoutTotals(lineItems, prices as never);

            expect(totals.subtotal).toBe(4500);
            expect(totals.total).toBe(4500);
        });

        it('should apply discount', () => {
            const lineItems = [{ priceId: 'price_1', quantity: 1 }];
            const prices = new Map([['price_1', { id: 'price_1', unitAmount: 10000, currency: 'usd' as const }]]);

            const totals = qzpayCalculateCheckoutTotals(lineItems, prices as never, 2000);

            expect(totals.subtotal).toBe(10000);
            expect(totals.discount).toBe(2000);
            expect(totals.total).toBe(8000);
        });

        it('should calculate tax', () => {
            const lineItems = [{ priceId: 'price_1', quantity: 1 }];
            const prices = new Map([['price_1', { id: 'price_1', unitAmount: 10000, currency: 'usd' as const }]]);

            const totals = qzpayCalculateCheckoutTotals(lineItems, prices as never, 0, 0.1);

            expect(totals.tax).toBe(1000);
            expect(totals.total).toBe(11000);
        });
    });

    describe('qzpayCalculateSimpleTotal', () => {
        it('should sum amounts', () => {
            expect(qzpayCalculateSimpleTotal([1000, 2000, 3000])).toBe(6000);
        });

        it('should apply discount', () => {
            expect(qzpayCalculateSimpleTotal([5000, 5000], 2000)).toBe(8000);
        });

        it('should not go below zero', () => {
            expect(qzpayCalculateSimpleTotal([1000], 5000)).toBe(0);
        });
    });
});

// ==================== Checkout URL Tests ====================

describe('Checkout URLs', () => {
    describe('qzpayBuildSuccessUrl', () => {
        it('should append session_id', () => {
            const url = qzpayBuildSuccessUrl('https://example.com/success', 'cs_123');
            expect(url).toBe('https://example.com/success?session_id=cs_123');
        });

        it('should preserve existing params', () => {
            const url = qzpayBuildSuccessUrl('https://example.com/success?ref=abc', 'cs_123');
            expect(url).toContain('session_id=cs_123');
            expect(url).toContain('ref=abc');
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
        it('should extract session_id', () => {
            const sessionId = qzpayExtractSessionIdFromUrl('https://example.com/success?session_id=cs_123');
            expect(sessionId).toBe('cs_123');
        });

        it('should return null for missing session_id', () => {
            const sessionId = qzpayExtractSessionIdFromUrl('https://example.com/success');
            expect(sessionId).toBeNull();
        });

        it('should return null for invalid URL', () => {
            const sessionId = qzpayExtractSessionIdFromUrl('not-a-url');
            expect(sessionId).toBeNull();
        });
    });
});

// ==================== Checkout State Transitions Tests ====================

describe('Checkout State Transitions', () => {
    describe('qzpayCompleteCheckout', () => {
        it('should mark session as complete', () => {
            const session = createCheckoutSession();
            const completed = qzpayCompleteCheckout(session, 'pay_123');

            expect(completed.status).toBe('complete');
            expect(completed.paymentId).toBe('pay_123');
            expect(completed.completedAt).toBeInstanceOf(Date);
        });

        it('should set subscription ID for subscription mode', () => {
            const session = createCheckoutSession({ mode: 'subscription' });
            const completed = qzpayCompleteCheckout(session, undefined, 'sub_123');

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
    });
});

// ==================== Line Item Tests ====================

describe('Line Item Helpers', () => {
    describe('qzpayAddLineItem', () => {
        it('should add new line item', () => {
            const session = createCheckoutSession();
            const updated = qzpayAddLineItem(session, { priceId: 'price_new', quantity: 2 });

            expect(updated.lineItems).toHaveLength(2);
        });

        it('should update quantity for existing item', () => {
            const session = createCheckoutSession();
            const updated = qzpayAddLineItem(session, { priceId: 'price_123', quantity: 3 });

            expect(updated.lineItems).toHaveLength(1);
            expect(updated.lineItems[0].quantity).toBe(4);
        });
    });

    describe('qzpayRemoveLineItem', () => {
        it('should remove line item', () => {
            const session = createCheckoutSession();
            const updated = qzpayRemoveLineItem(session, 'price_123');

            expect(updated.lineItems).toHaveLength(0);
        });
    });

    describe('qzpayUpdateLineItemQuantity', () => {
        it('should update quantity', () => {
            const session = createCheckoutSession();
            const updated = qzpayUpdateLineItemQuantity(session, 'price_123', 5);

            expect(updated.lineItems[0].quantity).toBe(5);
        });

        it('should remove item when quantity is 0', () => {
            const session = createCheckoutSession();
            const updated = qzpayUpdateLineItemQuantity(session, 'price_123', 0);

            expect(updated.lineItems).toHaveLength(0);
        });
    });

    describe('qzpayGetTotalQuantity', () => {
        it('should sum quantities', () => {
            const session = createCheckoutSession({
                lineItems: [
                    { priceId: 'p1', quantity: 2 },
                    { priceId: 'p2', quantity: 3 }
                ]
            });

            expect(qzpayGetTotalQuantity(session)).toBe(5);
        });
    });
});

// ==================== Customer Tests ====================

describe('Customer Helpers', () => {
    describe('qzpaySetCheckoutCustomer', () => {
        it('should set customer ID', () => {
            const session = createCheckoutSession();
            const updated = qzpaySetCheckoutCustomer(session, 'cus_123');

            expect(updated.customerId).toBe('cus_123');
        });

        it('should set customer email', () => {
            const session = createCheckoutSession();
            const updated = qzpaySetCheckoutCustomer(session, 'cus_123', 'test@example.com');

            expect(updated.customerEmail).toBe('test@example.com');
        });
    });

    describe('qzpayCheckoutHasCustomer', () => {
        it('should return true when customer set', () => {
            const session = createCheckoutSession({ customerId: 'cus_123' });
            expect(qzpayCheckoutHasCustomer(session)).toBe(true);
        });

        it('should return false when no customer', () => {
            const session = createCheckoutSession();
            expect(qzpayCheckoutHasCustomer(session)).toBe(false);
        });
    });
});

// ==================== Result Tests ====================

describe('Checkout Result Helpers', () => {
    describe('qzpayCreateCheckoutResult', () => {
        it('should create result with URL', () => {
            const session = createCheckoutSession();
            const result = qzpayCreateCheckoutResult(session, 'https://checkout.example.com');

            expect(result.session).toBe(session);
            expect(result.url).toBe('https://checkout.example.com');
        });
    });

    describe('qzpayCheckoutResultIsSuccess', () => {
        it('should return true for completed session', () => {
            const session = createCheckoutSession({ status: 'complete' });
            const result = qzpayCreateCheckoutResult(session, 'https://example.com');

            expect(qzpayCheckoutResultIsSuccess(result)).toBe(true);
        });

        it('should return false for non-completed session', () => {
            const session = createCheckoutSession();
            const result = qzpayCreateCheckoutResult(session, 'https://example.com');

            expect(qzpayCheckoutResultIsSuccess(result)).toBe(false);
        });
    });
});

// ==================== Marketplace Commission Tests ====================

describe('Marketplace Commission Helpers', () => {
    describe('qzpayCalculatePlatformCommission', () => {
        it('should calculate percentage commission', () => {
            expect(qzpayCalculatePlatformCommission(10000, 10)).toBe(1000);
            expect(qzpayCalculatePlatformCommission(10000, 15)).toBe(1500);
        });

        it('should apply minimum commission', () => {
            expect(qzpayCalculatePlatformCommission(1000, 10, { minCommission: 500 })).toBe(500);
        });

        it('should apply maximum commission', () => {
            expect(qzpayCalculatePlatformCommission(100000, 10, { maxCommission: 5000 })).toBe(5000);
        });
    });

    describe('qzpayCalculateVendorAmount', () => {
        it('should calculate vendor amount after commission', () => {
            expect(qzpayCalculateVendorAmount(10000, 10)).toBe(9000);
            expect(qzpayCalculateVendorAmount(10000, 25)).toBe(7500);
        });
    });

    describe('qzpayCalculateSplit', () => {
        it('should calculate split with vendor percentage', () => {
            const result = qzpayCalculateSplit(10000, { vendorId: 'v1', vendorPercentage: 80 }, 'usd');

            expect(result.vendorAmount).toBe(8000);
            expect(result.platformFee).toBe(2000);
        });

        it('should calculate split with fixed vendor amount', () => {
            const result = qzpayCalculateSplit(10000, { vendorId: 'v1', vendorAmount: 7500 }, 'usd');

            expect(result.vendorAmount).toBe(7500);
            expect(result.platformFee).toBe(2500);
        });

        it('should apply platform fee percentage', () => {
            const result = qzpayCalculateSplit(10000, { vendorId: 'v1', platformFeePercentage: 15 }, 'usd');

            expect(result.platformFee).toBe(1500);
            expect(result.vendorAmount).toBe(8500);
        });

        it('should apply min/max platform fee', () => {
            const result = qzpayCalculateSplit(1000, { vendorId: 'v1', platformFeePercentage: 5, minPlatformFee: 100 }, 'usd');

            expect(result.platformFee).toBe(100);
        });
    });

    describe('qzpayCalculateMultiVendorSplit', () => {
        it('should split between multiple vendors', () => {
            const result = qzpayCalculateMultiVendorSplit({
                totalAmount: 10000,
                currency: 'usd',
                splits: [
                    { vendorId: 'v1', percentage: 40 },
                    { vendorId: 'v2', percentage: 40 }
                ],
                platformFeePercentage: 20
            });

            expect(result.vendorPayouts).toHaveLength(2);
            expect(result.platformFee).toBe(2000);
        });
    });
});

// ==================== Vendor Status Tests ====================

describe('Vendor Status Helpers', () => {
    describe('qzpayVendorIsActive', () => {
        it('should return true for active vendor', () => {
            const vendor = createVendor();
            expect(qzpayVendorIsActive(vendor)).toBe(true);
        });

        it('should return false for deleted vendor', () => {
            const vendor = createVendor({ deletedAt: new Date() });
            expect(qzpayVendorIsActive(vendor)).toBe(false);
        });

        it('should return false for non-active status', () => {
            const vendor = createVendor({ status: 'pending' });
            expect(qzpayVendorIsActive(vendor)).toBe(false);
        });
    });

    describe('qzpayVendorIsPending', () => {
        it('should return true for pending vendor', () => {
            const vendor = createVendor({ status: 'pending' });
            expect(qzpayVendorIsPending(vendor)).toBe(true);
        });
    });

    describe('qzpayVendorIsSuspended', () => {
        it('should return true for suspended vendor', () => {
            const vendor = createVendor({ status: 'suspended' });
            expect(qzpayVendorIsSuspended(vendor)).toBe(true);
        });
    });

    describe('qzpayVendorCanReceivePayments', () => {
        it('should return true for active vendor with account', () => {
            const vendor = createVendor();
            expect(qzpayVendorCanReceivePayments(vendor)).toBe(true);
        });

        it('should return false for vendor without account', () => {
            const vendor = createVendor({ providerAccountIds: {} });
            expect(qzpayVendorCanReceivePayments(vendor)).toBe(false);
        });
    });

    describe('qzpayGetVendorCommissionRate', () => {
        it('should return vendor rate', () => {
            const vendor = createVendor({ commissionRate: 15 });
            expect(qzpayGetVendorCommissionRate(vendor)).toBe(15);
        });

        it('should return default rate when not set', () => {
            const vendor = createVendor({ commissionRate: undefined as never });
            expect(qzpayGetVendorCommissionRate(vendor, 10)).toBe(10);
        });
    });
});

// ==================== Payout Schedule Tests ====================

describe('Payout Schedule Helpers', () => {
    describe('qzpayGetNextPayoutDate', () => {
        it('should calculate next daily payout', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'daily' };
            const now = new Date('2025-06-15T12:00:00Z');
            const next = qzpayGetNextPayoutDate(schedule, now);

            expect(next.getDate()).toBe(16);
            expect(next.getHours()).toBe(0);
        });

        it('should calculate next weekly payout', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'weekly', dayOfWeek: 1 }; // Monday
            const now = new Date('2025-06-15T12:00:00Z'); // Sunday
            const next = qzpayGetNextPayoutDate(schedule, now);

            expect(next.getDay()).toBe(1);
        });

        it('should calculate next monthly payout', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'monthly', dayOfMonth: 15 };
            const now = new Date('2025-06-20T12:00:00Z');
            const next = qzpayGetNextPayoutDate(schedule, now);

            expect(next.getMonth()).toBe(6); // July
            expect(next.getDate()).toBe(15);
        });
    });

    describe('qzpayGetPayoutPeriod', () => {
        it('should get daily period', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'daily' };
            const period = qzpayGetPayoutPeriod(schedule, new Date('2025-06-15T12:00:00Z'));

            expect(period.start.getDate()).toBe(15);
            expect(period.end.getDate()).toBe(15);
        });

        it('should get monthly period', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'monthly' };
            const period = qzpayGetPayoutPeriod(schedule, new Date('2025-06-15T12:00:00Z'));

            expect(period.start.getDate()).toBe(1);
            expect(period.end.getDate()).toBe(30);
        });
    });

    describe('qzpayIsWithinPayoutPeriod', () => {
        it('should return true for date within period', () => {
            const period = {
                start: new Date('2025-06-01'),
                end: new Date('2025-06-30')
            };
            const date = new Date('2025-06-15');

            expect(qzpayIsWithinPayoutPeriod(date, period)).toBe(true);
        });

        it('should return false for date outside period', () => {
            const period = {
                start: new Date('2025-06-01'),
                end: new Date('2025-06-30')
            };
            const date = new Date('2025-07-01');

            expect(qzpayIsWithinPayoutPeriod(date, period)).toBe(false);
        });
    });
});

// ==================== Payout Helpers Tests ====================

describe('Payout Helpers', () => {
    describe('qzpayCreatePayout', () => {
        it('should create payout record', () => {
            const period = {
                start: new Date('2025-06-01'),
                end: new Date('2025-06-30')
            };
            const payout = qzpayCreatePayout('vendor_123', 50000, 'usd', period);

            expect(payout.id).toMatch(/^po_/);
            expect(payout.vendorId).toBe('vendor_123');
            expect(payout.amount).toBe(50000);
            expect(payout.status).toBe('pending');
        });
    });

    describe('qzpayCheckPayoutEligibility', () => {
        it('should return eligible for active vendor', () => {
            const vendor = createVendor();
            const result = qzpayCheckPayoutEligibility(vendor, 10000);

            expect(result.eligible).toBe(true);
        });

        it('should return ineligible for inactive vendor', () => {
            const vendor = createVendor({ status: 'suspended' });
            const result = qzpayCheckPayoutEligibility(vendor, 10000);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('not active');
        });

        it('should check minimum payout amount', () => {
            const vendor = createVendor();
            const result = qzpayCheckPayoutEligibility(vendor, 500, 1000);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Minimum payout');
        });
    });

    describe('qzpayMarkPayoutProcessing', () => {
        it('should update status to processing', () => {
            const payout = createPayout();
            const updated = qzpayMarkPayoutProcessing(payout);

            expect(updated.status).toBe('processing');
        });
    });

    describe('qzpayMarkPayoutPaid', () => {
        it('should update status to paid', () => {
            const payout = createPayout();
            const updated = qzpayMarkPayoutPaid(payout, { provider: 'stripe', id: 'po_stripe_123' });

            expect(updated.status).toBe('paid');
            expect(updated.paidAt).toBeInstanceOf(Date);
            expect(updated.providerPayoutIds.stripe).toBe('po_stripe_123');
        });
    });

    describe('qzpayMarkPayoutFailed', () => {
        it('should update status to failed', () => {
            const payout = createPayout();
            const updated = qzpayMarkPayoutFailed(payout);

            expect(updated.status).toBe('failed');
        });
    });
});

// ==================== Reporting Tests ====================

describe('Marketplace Reporting', () => {
    describe('qzpayCalculateVendorEarnings', () => {
        it('should sum paid payouts', () => {
            const payouts = [
                createPayout({ status: 'paid', amount: 5000 }),
                createPayout({ status: 'paid', amount: 3000 }),
                createPayout({ status: 'pending', amount: 2000 })
            ];

            expect(qzpayCalculateVendorEarnings(payouts)).toBe(8000);
        });
    });

    describe('qzpayCalculatePendingEarnings', () => {
        it('should sum pending and processing payouts', () => {
            const payouts = [
                createPayout({ status: 'paid', amount: 5000 }),
                createPayout({ status: 'pending', amount: 3000 }),
                createPayout({ status: 'processing', amount: 2000 })
            ];

            expect(qzpayCalculatePendingEarnings(payouts)).toBe(5000);
        });
    });

    describe('qzpayFilterPayoutsByStatus', () => {
        it('should filter by status', () => {
            const payouts = [createPayout({ status: 'paid' }), createPayout({ status: 'pending' }), createPayout({ status: 'paid' })];

            expect(qzpayFilterPayoutsByStatus(payouts, 'paid')).toHaveLength(2);
        });
    });

    describe('qzpayFilterPayoutsByDateRange', () => {
        it('should filter by date range', () => {
            const payouts = [
                createPayout({ createdAt: new Date('2025-06-01') }),
                createPayout({ createdAt: new Date('2025-06-15') }),
                createPayout({ createdAt: new Date('2025-07-01') })
            ];

            const filtered = qzpayFilterPayoutsByDateRange(payouts, new Date('2025-06-01'), new Date('2025-06-30'));

            expect(filtered).toHaveLength(2);
        });
    });
});

// ==================== Revenue Share Tests ====================

describe('Revenue Share Helpers', () => {
    describe('qzpayCalculateRevenueShares', () => {
        it('should calculate basic vendor/platform split', () => {
            const result = qzpayCalculateRevenueShares(10000, {
                vendorRate: 80,
                platformRate: 20
            });

            expect(result.vendorAmount).toBe(8000);
            expect(result.platformAmount).toBe(2000);
        });

        it('should include affiliate cut', () => {
            const result = qzpayCalculateRevenueShares(10000, { vendorRate: 80, platformRate: 20, affiliateRate: 5 }, 'affiliate_123');

            expect(result.affiliateAmount).toBe(500);
            expect(result.vendorAmount + result.platformAmount + result.affiliateAmount).toBe(10000);
        });

        it('should include referral cut', () => {
            const result = qzpayCalculateRevenueShares(
                10000,
                { vendorRate: 80, platformRate: 20, referralRate: 3 },
                undefined,
                'referrer_123'
            );

            expect(result.referralAmount).toBe(300);
        });

        it('should not add affiliate cut without ID', () => {
            const result = qzpayCalculateRevenueShares(10000, {
                vendorRate: 80,
                platformRate: 20,
                affiliateRate: 5
            });

            expect(result.affiliateAmount).toBe(0);
        });
    });
});
