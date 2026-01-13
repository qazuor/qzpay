/**
 * Vendor Marketplace E2E Tests
 *
 * Tests complete vendor flows from onboarding through payouts
 * against a real PostgreSQL database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayPaymentsRepository } from '../../src/repositories/payments.repository.js';
import { QZPayVendorsRepository } from '../../src/repositories/vendors.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Vendor Marketplace E2E', () => {
    let vendorsRepo: QZPayVendorsRepository;
    let customersRepo: QZPayCustomersRepository;
    let paymentsRepo: QZPayPaymentsRepository;

    let testCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        vendorsRepo = new QZPayVendorsRepository(db);
        customersRepo = new QZPayCustomersRepository(db);
        paymentsRepo = new QZPayPaymentsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Setup: Create a customer for marketplace transactions
        const customer = await customersRepo.create({
            externalId: 'ext-marketplace-customer',
            email: 'marketplace@example.com',
            name: 'Marketplace Customer',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    describe('Vendor Onboarding Flow', () => {
        it('should complete full vendor onboarding lifecycle', async () => {
            // Step 1: Create vendor with pending status
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-001',
                name: 'Artisan Crafts Store',
                email: 'artisan@example.com',
                onboardingStatus: 'pending',
                canReceivePayments: false,
                pendingBalance: 0,
                livemode: true
            });

            expect(vendor.onboardingStatus).toBe('pending');
            expect(vendor.canReceivePayments).toBe(false);

            // Step 2: Move to in_progress (vendor starts filling forms)
            const inProgressVendor = await vendorsRepo.updateOnboardingStatus(vendor.id, 'in_progress');
            expect(inProgressVendor.onboardingStatus).toBe('in_progress');

            // Step 3: Connect Stripe account
            const connectedVendor = await vendorsRepo.updateStripeAccountId(vendor.id, 'acct_1234567890');
            expect(connectedVendor.stripeAccountId).toBe('acct_1234567890');

            // Step 4: Complete onboarding (Stripe account verified)
            const completedVendor = await vendorsRepo.updateOnboardingStatus(vendor.id, 'completed');
            expect(completedVendor.onboardingStatus).toBe('completed');
            expect(completedVendor.canReceivePayments).toBe(true); // Auto-enabled

            // Verify can find in payment ready list
            const paymentReady = await vendorsRepo.findPaymentReady(true);
            expect(paymentReady.some((v) => v.id === vendor.id)).toBe(true);
        });

        it('should handle rejected vendor', async () => {
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-rejected',
                name: 'Rejected Vendor',
                email: 'rejected@example.com',
                onboardingStatus: 'pending',
                canReceivePayments: false,
                livemode: true
            });

            // Reject vendor (e.g., failed verification)
            const rejectedVendor = await vendorsRepo.updateOnboardingStatus(vendor.id, 'rejected', false);

            expect(rejectedVendor.onboardingStatus).toBe('rejected');
            expect(rejectedVendor.canReceivePayments).toBe(false);

            // Verify not in payment ready list
            const paymentReady = await vendorsRepo.findPaymentReady(true);
            expect(paymentReady.some((v) => v.id === vendor.id)).toBe(false);
        });

        it('should find vendors by onboarding status', async () => {
            // Create vendors with different statuses
            await vendorsRepo.create({
                externalId: 'vendor-pending-1',
                name: 'Pending Vendor 1',
                email: 'pending1@example.com',
                onboardingStatus: 'pending',
                canReceivePayments: false,
                livemode: true
            });

            await vendorsRepo.create({
                externalId: 'vendor-completed-1',
                name: 'Completed Vendor 1',
                email: 'completed1@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                livemode: true
            });

            const pendingVendors = await vendorsRepo.findByOnboardingStatus('pending', true);
            const completedVendors = await vendorsRepo.findByOnboardingStatus('completed', true);

            expect(pendingVendors).toHaveLength(1);
            expect(completedVendors).toHaveLength(1);
        });
    });

    describe('Vendor Balance Management', () => {
        let testVendorId: string;

        beforeEach(async () => {
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-balance',
                name: 'Balance Test Vendor',
                email: 'balance@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                pendingBalance: 0,
                livemode: true
            });
            testVendorId = vendor.id;
        });

        it('should accumulate balance from marketplace sales', async () => {
            // Simulate 3 sales with vendor commission
            await vendorsRepo.addToPendingBalance(testVendorId, 1500); // $15 commission
            await vendorsRepo.addToPendingBalance(testVendorId, 2500); // $25 commission
            await vendorsRepo.addToPendingBalance(testVendorId, 1000); // $10 commission

            const vendor = await vendorsRepo.findById(testVendorId);
            expect(vendor?.pendingBalance).toBe(5000); // $50 total
        });

        it('should update balance directly', async () => {
            // Set initial balance
            await vendorsRepo.updatePendingBalance(testVendorId, 10000);

            let vendor = await vendorsRepo.findById(testVendorId);
            expect(vendor?.pendingBalance).toBe(10000);

            // Reset after payout
            await vendorsRepo.updatePendingBalance(testVendorId, 0);

            vendor = await vendorsRepo.findById(testVendorId);
            expect(vendor?.pendingBalance).toBe(0);
        });
    });

    describe('Vendor Payout Flow', () => {
        let testVendorId: string;

        beforeEach(async () => {
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-payout',
                name: 'Payout Test Vendor',
                email: 'payout@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                pendingBalance: 50000, // $500 pending
                stripeAccountId: 'acct_payout_test',
                livemode: true
            });
            testVendorId = vendor.id;
        });

        it('should complete full payout lifecycle', async () => {
            // Step 1: Create pending payout
            const payout = await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 50000,
                currency: 'USD',
                status: 'pending',
                livemode: true
            });

            expect(payout.status).toBe('pending');
            expect(payout.amount).toBe(50000);

            // Step 2: Mark as processing
            const processingPayout = await vendorsRepo.updatePayoutStatus(payout.id, 'processing');
            expect(processingPayout.status).toBe('processing');

            // Step 3: Mark as succeeded
            const succeededPayout = await vendorsRepo.updatePayoutStatus(payout.id, 'succeeded', {
                paidAt: new Date()
            });

            expect(succeededPayout.status).toBe('succeeded');
            expect(succeededPayout.paidAt).not.toBeNull();

            // Step 4: Reset vendor balance
            await vendorsRepo.updatePendingBalance(testVendorId, 0);

            const vendor = await vendorsRepo.findById(testVendorId);
            expect(vendor?.pendingBalance).toBe(0);
        });

        it('should handle failed payout', async () => {
            const payout = await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 50000,
                currency: 'USD',
                status: 'pending',
                livemode: true
            });

            await vendorsRepo.updatePayoutStatus(payout.id, 'processing');

            const failedPayout = await vendorsRepo.updatePayoutStatus(payout.id, 'failed', {
                failureCode: 'insufficient_balance',
                failureMessage: 'Stripe account has insufficient balance'
            });

            expect(failedPayout.status).toBe('failed');
            expect(failedPayout.failureCode).toBe('insufficient_balance');

            // Vendor balance should remain unchanged
            const vendor = await vendorsRepo.findById(testVendorId);
            expect(vendor?.pendingBalance).toBe(50000);
        });

        it('should track payout history', async () => {
            // Create multiple payouts
            for (let i = 1; i <= 3; i++) {
                const payout = await vendorsRepo.createPayout({
                    vendorId: testVendorId,
                    provider: 'stripe',
                    amount: 10000 * i,
                    currency: 'USD',
                    status: 'pending',
                    livemode: true
                });
                await vendorsRepo.updatePayoutStatus(payout.id, 'succeeded');
            }

            const payouts = await vendorsRepo.findPayoutsByVendorId(testVendorId);
            expect(payouts.data).toHaveLength(3);
            expect(payouts.total).toBe(3);
        });

        it('should calculate payout totals', async () => {
            // Succeeded payout
            const payout1 = await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 10000,
                currency: 'USD',
                status: 'pending',
                livemode: true
            });
            await vendorsRepo.updatePayoutStatus(payout1.id, 'succeeded');

            // Pending payout
            await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 5000,
                currency: 'USD',
                status: 'pending',
                livemode: true
            });

            // Failed payout
            const payout3 = await vendorsRepo.createPayout({
                vendorId: testVendorId,
                provider: 'stripe',
                amount: 2000,
                currency: 'USD',
                status: 'pending',
                livemode: true
            });
            await vendorsRepo.updatePayoutStatus(payout3.id, 'failed');

            const totals = await vendorsRepo.getPayoutTotalsForVendor(testVendorId);

            expect(totals.totalPaid).toBe(10000);
            expect(totals.totalPending).toBe(5000);
            expect(totals.totalFailed).toBe(2000);
        });
    });

    describe('Multi-Provider Vendor Support', () => {
        it('should support Stripe connected accounts', async () => {
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-stripe',
                name: 'Stripe Vendor',
                email: 'stripe@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                stripeAccountId: 'acct_stripe_vendor',
                livemode: true
            });

            const found = await vendorsRepo.findByStripeAccountId('acct_stripe_vendor');
            expect(found).not.toBeNull();
            expect(found?.id).toBe(vendor.id);
        });

        it('should support MercadoPago merchants', async () => {
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-mp',
                name: 'MercadoPago Vendor',
                email: 'mp@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                mpMerchantId: 'mp_merchant_123',
                livemode: true
            });

            const found = await vendorsRepo.findByMpMerchantId('mp_merchant_123');
            expect(found).not.toBeNull();
            expect(found?.id).toBe(vendor.id);
        });
    });

    describe('Marketplace Sales Flow', () => {
        let testVendorId: string;

        beforeEach(async () => {
            const vendor = await vendorsRepo.create({
                externalId: 'vendor-sales',
                name: 'Sales Test Vendor',
                email: 'sales@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                pendingBalance: 0,
                stripeAccountId: 'acct_sales_vendor',
                livemode: true
            });
            testVendorId = vendor.id;
        });

        it('should process marketplace sale with split payment', async () => {
            const saleAmount = 10000; // $100
            const platformFee = 1000; // $10 (10% platform fee)
            const vendorShare = saleAmount - platformFee; // $90 to vendor

            // Step 1: Create payment for marketplace sale
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                amount: saleAmount,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'pi_marketplace_sale',
                metadata: {
                    vendorId: testVendorId,
                    platformFee,
                    vendorShare
                },
                livemode: true
            });

            expect(payment.status).toBe('succeeded');

            // Step 2: Add vendor share to pending balance
            await vendorsRepo.addToPendingBalance(testVendorId, vendorShare);

            const vendor = await vendorsRepo.findById(testVendorId);
            expect(vendor?.pendingBalance).toBe(vendorShare);
        });

        it('should handle multiple sales accumulation', async () => {
            const sales = [
                { amount: 5000, platformFee: 500 },
                { amount: 10000, platformFee: 1000 },
                { amount: 2500, platformFee: 250 }
            ];

            let totalVendorShare = 0;

            for (const sale of sales) {
                const vendorShare = sale.amount - sale.platformFee;
                totalVendorShare += vendorShare;

                await paymentsRepo.create({
                    customerId: testCustomerId,
                    amount: sale.amount,
                    currency: 'USD',
                    status: 'succeeded',
                    provider: 'stripe',
                    livemode: true
                });

                await vendorsRepo.addToPendingBalance(testVendorId, vendorShare);
            }

            const vendor = await vendorsRepo.findById(testVendorId);
            expect(vendor?.pendingBalance).toBe(totalVendorShare);
            expect(totalVendorShare).toBe(15750); // (5000-500) + (10000-1000) + (2500-250)
        });
    });

    describe('Vendor Search and Filtering', () => {
        beforeEach(async () => {
            await vendorsRepo.create({
                externalId: 'vendor-active',
                name: 'Active Vendor',
                email: 'active@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                livemode: true
            });
            await vendorsRepo.create({
                externalId: 'vendor-pending',
                name: 'Pending Vendor',
                email: 'pending@example.com',
                onboardingStatus: 'pending',
                canReceivePayments: false,
                livemode: true
            });
            await vendorsRepo.create({
                externalId: 'vendor-test',
                name: 'Test Vendor',
                email: 'test@example.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                livemode: false
            });
        });

        it('should search by onboarding status', async () => {
            const completedResult = await vendorsRepo.search({ onboardingStatus: 'completed' });
            const pendingResult = await vendorsRepo.search({ onboardingStatus: 'pending' });

            expect(completedResult.data).toHaveLength(2);
            expect(pendingResult.data).toHaveLength(1);
        });

        it('should search by payment capability', async () => {
            const canReceiveResult = await vendorsRepo.search({ canReceivePayments: true });
            const cannotReceiveResult = await vendorsRepo.search({ canReceivePayments: false });

            expect(canReceiveResult.data).toHaveLength(2);
            expect(cannotReceiveResult.data).toHaveLength(1);
        });

        it('should filter by livemode', async () => {
            const liveResult = await vendorsRepo.search({ livemode: true });
            const testResult = await vendorsRepo.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });
    });
});
