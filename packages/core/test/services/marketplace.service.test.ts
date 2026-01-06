/**
 * Tests for marketplace service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayPayoutSchedule, QZPayVendor, QZPayVendorPayout } from '../../src/index.js';
import {
    qzpayCalculatePendingEarnings,
    qzpayCalculatePlatformCommission,
    qzpayCalculateRevenueShares,
    qzpayCalculateSplit,
    qzpayCalculateVendorAmount,
    qzpayCalculateVendorEarnings,
    qzpayCheckPayoutEligibility,
    qzpayCreatePayout,
    qzpayFilterPayoutsByDateRange,
    qzpayFilterPayoutsByStatus,
    qzpayGetNextPayoutDate,
    qzpayGetPayoutPeriod,
    qzpayGetVendorCommissionRate,
    qzpayIsWithinPayoutPeriod,
    qzpayMarkPayoutFailed,
    qzpayMarkPayoutPaid,
    qzpayMarkPayoutProcessing,
    qzpayVendorCanReceivePayments,
    qzpayVendorIsActive,
    qzpayVendorIsPending,
    qzpayVendorIsSuspended
} from '../../src/index.js';

// ==================== Test Fixtures ====================

function createVendor(overrides: Partial<QZPayVendor> = {}): QZPayVendor {
    return {
        id: 'vnd_123',
        name: 'Test Vendor',
        email: 'vendor@example.com',
        status: 'active',
        commissionRate: 10,
        payoutSchedule: {
            interval: 'monthly',
            dayOfMonth: 1,
            dayOfWeek: null
        },
        minimumPayoutAmount: 5000,
        providerAccountIds: { stripe: 'acct_123' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

function createPayout(overrides: Partial<QZPayVendorPayout> = {}): QZPayVendorPayout {
    return {
        id: 'po_123',
        vendorId: 'vnd_123',
        amount: 10000,
        currency: 'USD',
        status: 'pending',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        providerPayoutIds: {},
        paidAt: null,
        createdAt: new Date(),
        ...overrides
    };
}

// ==================== Commission Tests ====================

describe('Commission Calculations', () => {
    describe('qzpayCalculatePlatformCommission', () => {
        it('should calculate commission percentage', () => {
            const commission = qzpayCalculatePlatformCommission(10000, 10);
            expect(commission).toBe(1000);
        });

        it('should apply minimum commission', () => {
            const commission = qzpayCalculatePlatformCommission(100, 10, { minCommission: 50 });
            expect(commission).toBe(50);
        });

        it('should apply maximum commission', () => {
            const commission = qzpayCalculatePlatformCommission(100000, 10, { maxCommission: 5000 });
            expect(commission).toBe(5000);
        });
    });

    describe('qzpayCalculateVendorAmount', () => {
        it('should calculate vendor amount after commission', () => {
            const vendorAmount = qzpayCalculateVendorAmount(10000, 10);
            expect(vendorAmount).toBe(9000);
        });
    });

    describe('qzpayCalculateSplit', () => {
        it('should calculate split with vendor percentage', () => {
            const split = qzpayCalculateSplit(10000, { vendorId: 'vnd_123', vendorPercentage: 80 }, 'USD');

            expect(split.vendorAmount).toBe(8000);
            expect(split.platformFee).toBe(2000);
        });

        it('should calculate split with fixed platform fee', () => {
            const split = qzpayCalculateSplit(10000, { vendorId: 'vnd_123', platformFee: 500 }, 'USD');

            expect(split.vendorAmount).toBe(9500);
            expect(split.platformFee).toBe(500);
        });

        it('should apply minimum platform fee', () => {
            const split = qzpayCalculateSplit(10000, { vendorId: 'vnd_123', platformFeePercentage: 5, minPlatformFee: 1000 }, 'USD');

            expect(split.platformFee).toBe(1000);
            expect(split.vendorAmount).toBe(9000);
        });
    });
});

// ==================== Vendor Status Tests ====================

describe('Vendor Status', () => {
    describe('qzpayVendorIsActive', () => {
        it('should return true for active vendor', () => {
            const vendor = createVendor({ status: 'active' });
            expect(qzpayVendorIsActive(vendor)).toBe(true);
        });

        it('should return false for deleted vendor', () => {
            const vendor = createVendor({ status: 'active', deletedAt: new Date() });
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
        it('should return true for active vendor with provider account', () => {
            const vendor = createVendor();
            expect(qzpayVendorCanReceivePayments(vendor)).toBe(true);
        });

        it('should return false without provider account', () => {
            const vendor = createVendor({ providerAccountIds: {} });
            expect(qzpayVendorCanReceivePayments(vendor)).toBe(false);
        });

        it('should return false for suspended vendor', () => {
            const vendor = createVendor({ status: 'suspended' });
            expect(qzpayVendorCanReceivePayments(vendor)).toBe(false);
        });
    });

    describe('qzpayGetVendorCommissionRate', () => {
        it('should return vendor commission rate', () => {
            const vendor = createVendor({ commissionRate: 15 });
            expect(qzpayGetVendorCommissionRate(vendor)).toBe(15);
        });

        it('should return default rate if not set', () => {
            const vendor = createVendor({ commissionRate: null });
            expect(qzpayGetVendorCommissionRate(vendor, 10)).toBe(10);
        });
    });
});

// ==================== Payout Schedule Tests ====================

describe('Payout Schedules', () => {
    describe('qzpayGetNextPayoutDate', () => {
        it('should calculate next daily payout', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'daily', dayOfMonth: null, dayOfWeek: null };
            const from = new Date('2024-01-15T12:00:00Z');
            const next = qzpayGetNextPayoutDate(schedule, from);

            // Verify it's the next day (independent of timezone)
            expect(next.getDate()).toBe(16);
            expect(next.getMonth()).toBe(0); // January
            expect(next.getFullYear()).toBe(2024);
            // Verify it's at midnight local time
            expect(next.getHours()).toBe(0);
            expect(next.getMinutes()).toBe(0);
        });

        it('should calculate next weekly payout', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'weekly', dayOfMonth: null, dayOfWeek: 1 }; // Monday
            const from = new Date('2024-01-15T12:00:00Z'); // Monday
            const next = qzpayGetNextPayoutDate(schedule, from);

            // Should be 7 days later (next Monday)
            expect(next.getDay()).toBe(1); // Monday
            expect(next.getDate()).toBe(22); // Jan 22
            expect(next.getMonth()).toBe(0); // January
        });

        it('should calculate next monthly payout', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'monthly', dayOfMonth: 1, dayOfWeek: null };
            const from = new Date('2024-01-15T12:00:00Z');
            const next = qzpayGetNextPayoutDate(schedule, from);

            expect(next.getDate()).toBe(1);
            expect(next.getMonth()).toBe(1); // February
        });
    });

    describe('qzpayGetPayoutPeriod', () => {
        it('should get daily period', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'daily', dayOfMonth: null, dayOfWeek: null };
            const date = new Date('2024-01-15T12:00:00Z');
            const period = qzpayGetPayoutPeriod(schedule, date);

            expect(period.start.getDate()).toBe(15);
            expect(period.end.getDate()).toBe(15);
        });

        it('should get monthly period', () => {
            const schedule: QZPayPayoutSchedule = { interval: 'monthly', dayOfMonth: 1, dayOfWeek: null };
            const date = new Date('2024-01-15T12:00:00Z');
            const period = qzpayGetPayoutPeriod(schedule, date);

            expect(period.start.getDate()).toBe(1);
            expect(period.end.getDate()).toBe(31);
        });
    });

    describe('qzpayIsWithinPayoutPeriod', () => {
        it('should check if date is within period', () => {
            const period = {
                start: new Date('2024-01-01T00:00:00Z'),
                end: new Date('2024-01-31T23:59:59Z')
            };

            expect(qzpayIsWithinPayoutPeriod(new Date('2024-01-15'), period)).toBe(true);
            expect(qzpayIsWithinPayoutPeriod(new Date('2024-02-01'), period)).toBe(false);
        });
    });
});

// ==================== Payout Management Tests ====================

describe('Payout Management', () => {
    describe('qzpayCreatePayout', () => {
        it('should create payout record', () => {
            const period = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            const payout = qzpayCreatePayout('vnd_123', 10000, 'USD', period);

            expect(payout.id).toMatch(/^po_/);
            expect(payout.vendorId).toBe('vnd_123');
            expect(payout.amount).toBe(10000);
            expect(payout.status).toBe('pending');
        });
    });

    describe('qzpayCheckPayoutEligibility', () => {
        it('should allow eligible payout', () => {
            const vendor = createVendor({ minimumPayoutAmount: 5000 });
            const result = qzpayCheckPayoutEligibility(vendor, 10000, 5000);

            expect(result.eligible).toBe(true);
        });

        it('should reject if vendor not active', () => {
            const vendor = createVendor({ status: 'suspended' });
            const result = qzpayCheckPayoutEligibility(vendor, 10000);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('not active');
        });

        it('should reject if no payment account', () => {
            const vendor = createVendor({ providerAccountIds: {} });
            const result = qzpayCheckPayoutEligibility(vendor, 10000);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('no payment account');
        });

        it('should reject if below minimum', () => {
            const vendor = createVendor({ minimumPayoutAmount: 10000 });
            const result = qzpayCheckPayoutEligibility(vendor, 5000, 10000);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Minimum payout amount');
        });
    });

    describe('qzpayMarkPayoutProcessing', () => {
        it('should mark payout as processing', () => {
            const payout = createPayout();
            const processing = qzpayMarkPayoutProcessing(payout);

            expect(processing.status).toBe('processing');
        });
    });

    describe('qzpayMarkPayoutPaid', () => {
        it('should mark payout as paid', () => {
            const payout = createPayout();
            const paid = qzpayMarkPayoutPaid(payout, { provider: 'stripe', id: 'po_stripe_123' });

            expect(paid.status).toBe('paid');
            expect(paid.paidAt).toBeInstanceOf(Date);
            expect(paid.providerPayoutIds.stripe).toBe('po_stripe_123');
        });
    });

    describe('qzpayMarkPayoutFailed', () => {
        it('should mark payout as failed', () => {
            const payout = createPayout();
            const failed = qzpayMarkPayoutFailed(payout);

            expect(failed.status).toBe('failed');
        });
    });
});

// ==================== Reporting Tests ====================

describe('Payout Reporting', () => {
    describe('qzpayCalculateVendorEarnings', () => {
        it('should calculate total paid earnings', () => {
            const payouts = [
                createPayout({ status: 'paid', amount: 10000 }),
                createPayout({ status: 'paid', amount: 5000 }),
                createPayout({ status: 'pending', amount: 3000 })
            ];

            const earnings = qzpayCalculateVendorEarnings(payouts);
            expect(earnings).toBe(15000);
        });
    });

    describe('qzpayCalculatePendingEarnings', () => {
        it('should calculate pending earnings', () => {
            const payouts = [
                createPayout({ status: 'pending', amount: 10000 }),
                createPayout({ status: 'processing', amount: 5000 }),
                createPayout({ status: 'paid', amount: 3000 })
            ];

            const pending = qzpayCalculatePendingEarnings(payouts);
            expect(pending).toBe(15000);
        });
    });

    describe('qzpayFilterPayoutsByStatus', () => {
        it('should filter payouts by status', () => {
            const payouts = [createPayout({ status: 'paid' }), createPayout({ status: 'pending' }), createPayout({ status: 'paid' })];

            const paid = qzpayFilterPayoutsByStatus(payouts, 'paid');
            expect(paid).toHaveLength(2);
        });
    });

    describe('qzpayFilterPayoutsByDateRange', () => {
        it('should filter payouts by date range', () => {
            const payouts = [
                createPayout({ createdAt: new Date('2024-01-15') }),
                createPayout({ createdAt: new Date('2024-02-15') }),
                createPayout({ createdAt: new Date('2024-03-15') })
            ];

            const filtered = qzpayFilterPayoutsByDateRange(payouts, new Date('2024-01-01'), new Date('2024-02-28'));

            expect(filtered).toHaveLength(2);
        });
    });
});

// ==================== Revenue Share Tests ====================

describe('Revenue Sharing', () => {
    describe('qzpayCalculateRevenueShares', () => {
        it('should calculate basic revenue shares', () => {
            const config = { vendorRate: 70, platformRate: 30 };
            const shares = qzpayCalculateRevenueShares(10000, config);

            expect(shares.vendorAmount).toBe(7000);
            expect(shares.platformAmount).toBe(3000);
            expect(shares.affiliateAmount).toBe(0);
            expect(shares.referralAmount).toBe(0);
        });

        it('should calculate shares with affiliate', () => {
            const config = { vendorRate: 70, platformRate: 30, affiliateRate: 10 };
            const shares = qzpayCalculateRevenueShares(10000, config, 'aff_123');

            expect(shares.affiliateAmount).toBe(1000);
            expect(shares.vendorAmount + shares.platformAmount + shares.affiliateAmount).toBe(10000);
        });

        it('should calculate shares with referral', () => {
            const config = { vendorRate: 70, platformRate: 30, referralRate: 5 };
            const shares = qzpayCalculateRevenueShares(10000, config, undefined, 'ref_123');

            expect(shares.referralAmount).toBe(500);
            expect(shares.vendorAmount + shares.platformAmount + shares.referralAmount).toBe(10000);
        });

        it('should calculate shares with both affiliate and referral', () => {
            const config = { vendorRate: 70, platformRate: 30, affiliateRate: 10, referralRate: 5 };
            const shares = qzpayCalculateRevenueShares(10000, config, 'aff_123', 'ref_123');

            expect(shares.affiliateAmount).toBe(1000);
            expect(shares.referralAmount).toBe(500);
            expect(shares.vendorAmount + shares.platformAmount + shares.affiliateAmount + shares.referralAmount).toBe(10000);
        });
    });
});
