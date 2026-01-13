/**
 * Vendors Repository Integration Tests
 *
 * Tests the vendors repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayVendorsRepository } from '../src/repositories/vendors.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayVendorsRepository', () => {
    let repository: QZPayVendorsRepository;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayVendorsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('create', () => {
        it('should create a new vendor', async () => {
            const input = {
                externalId: 'vendor-ext-1',
                name: 'Acme Corp',
                email: 'vendor@acme.com',
                commissionRate: '15.5',
                livemode: true
            };

            const vendor = await repository.create(input);

            expect(vendor.id).toBeDefined();
            expect(vendor.externalId).toBe('vendor-ext-1');
            expect(vendor.name).toBe('Acme Corp');
            expect(vendor.email).toBe('vendor@acme.com');
            expect(vendor.onboardingStatus).toBe('pending');
            expect(vendor.canReceivePayments).toBe(false);
        });

        it('should create vendor with provider IDs', async () => {
            const vendor = await repository.create({
                externalId: 'vendor-ext-2',
                email: 'vendor2@test.com',
                stripeAccountId: 'acct_stripe123',
                mpMerchantId: 'mp_merchant456',
                livemode: true
            });

            expect(vendor.stripeAccountId).toBe('acct_stripe123');
            expect(vendor.mpMerchantId).toBe('mp_merchant456');
        });
    });

    describe('findById', () => {
        it('should find vendor by ID', async () => {
            const created = await repository.create({
                externalId: 'vendor-find-1',
                email: 'find@vendor.com',
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });

        it('should not find soft-deleted vendor', async () => {
            const created = await repository.create({
                externalId: 'vendor-deleted-1',
                email: 'deleted@vendor.com',
                livemode: true
            });

            await repository.softDelete(created.id);
            const found = await repository.findById(created.id);

            expect(found).toBeNull();
        });
    });

    describe('findByExternalId', () => {
        it('should find vendor by external ID', async () => {
            await repository.create({
                externalId: 'unique-external-123',
                email: 'external@vendor.com',
                livemode: true
            });

            const found = await repository.findByExternalId('unique-external-123', true);

            expect(found).not.toBeNull();
            expect(found?.externalId).toBe('unique-external-123');
        });
    });

    describe('findByStripeAccountId', () => {
        it('should find vendor by Stripe account ID', async () => {
            await repository.create({
                externalId: 'vendor-stripe-1',
                email: 'stripe@vendor.com',
                stripeAccountId: 'acct_unique123',
                livemode: true
            });

            const found = await repository.findByStripeAccountId('acct_unique123');

            expect(found).not.toBeNull();
            expect(found?.stripeAccountId).toBe('acct_unique123');
        });
    });

    describe('findByMpMerchantId', () => {
        it('should find vendor by MercadoPago merchant ID', async () => {
            await repository.create({
                externalId: 'vendor-mp-1',
                email: 'mp@vendor.com',
                mpMerchantId: 'mp_unique789',
                livemode: true
            });

            const found = await repository.findByMpMerchantId('mp_unique789');

            expect(found).not.toBeNull();
            expect(found?.mpMerchantId).toBe('mp_unique789');
        });
    });

    describe('findByOnboardingStatus', () => {
        it('should find vendors by onboarding status', async () => {
            await repository.create({
                externalId: 'vendor-pending-1',
                email: 'pending@vendor.com',
                onboardingStatus: 'pending',
                livemode: true
            });
            await repository.create({
                externalId: 'vendor-completed-1',
                email: 'completed@vendor.com',
                onboardingStatus: 'completed',
                livemode: true
            });

            const pending = await repository.findByOnboardingStatus('pending', true);
            const completed = await repository.findByOnboardingStatus('completed', true);

            expect(pending).toHaveLength(1);
            expect(completed).toHaveLength(1);
        });
    });

    describe('findPaymentReady', () => {
        it('should find vendors that can receive payments', async () => {
            await repository.create({
                externalId: 'vendor-ready-1',
                email: 'ready@vendor.com',
                canReceivePayments: true,
                livemode: true
            });
            await repository.create({
                externalId: 'vendor-notready-1',
                email: 'notready@vendor.com',
                canReceivePayments: false,
                livemode: true
            });

            const ready = await repository.findPaymentReady(true);

            expect(ready).toHaveLength(1);
            expect(ready[0].externalId).toBe('vendor-ready-1');
        });
    });

    describe('update', () => {
        it('should update vendor fields', async () => {
            const created = await repository.create({
                externalId: 'vendor-update-1',
                name: 'Original Name',
                email: 'original@vendor.com',
                livemode: true
            });

            const updated = await repository.update(created.id, {
                name: 'Updated Name',
                email: 'updated@vendor.com'
            });

            expect(updated.name).toBe('Updated Name');
            expect(updated.email).toBe('updated@vendor.com');
            expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });
    });

    describe('updateOnboardingStatus', () => {
        it('should update onboarding status', async () => {
            const created = await repository.create({
                externalId: 'vendor-onboard-1',
                email: 'onboard@vendor.com',
                livemode: true
            });

            const updated = await repository.updateOnboardingStatus(created.id, 'in_progress');

            expect(updated.onboardingStatus).toBe('in_progress');
        });

        it('should enable payments when status is completed', async () => {
            const created = await repository.create({
                externalId: 'vendor-onboard-2',
                email: 'onboard2@vendor.com',
                livemode: true
            });

            const updated = await repository.updateOnboardingStatus(created.id, 'completed');

            expect(updated.onboardingStatus).toBe('completed');
            expect(updated.canReceivePayments).toBe(true);
        });

        it('should respect explicit canReceivePayments value', async () => {
            const created = await repository.create({
                externalId: 'vendor-onboard-3',
                email: 'onboard3@vendor.com',
                livemode: true
            });

            const updated = await repository.updateOnboardingStatus(created.id, 'completed', false);

            expect(updated.onboardingStatus).toBe('completed');
            expect(updated.canReceivePayments).toBe(false);
        });
    });

    describe('updateStripeAccountId', () => {
        it('should update Stripe account ID', async () => {
            const created = await repository.create({
                externalId: 'vendor-stripeup-1',
                email: 'stripeup@vendor.com',
                livemode: true
            });

            const updated = await repository.updateStripeAccountId(created.id, 'acct_new123');

            expect(updated.stripeAccountId).toBe('acct_new123');
        });
    });

    describe('updatePendingBalance', () => {
        it('should update pending balance', async () => {
            const created = await repository.create({
                externalId: 'vendor-balance-1',
                email: 'balance@vendor.com',
                livemode: true
            });

            const updated = await repository.updatePendingBalance(created.id, 50000);

            expect(updated.pendingBalance).toBe(50000);
        });
    });

    describe('addToPendingBalance', () => {
        it('should add to pending balance', async () => {
            const created = await repository.create({
                externalId: 'vendor-addbal-1',
                email: 'addbal@vendor.com',
                pendingBalance: 10000,
                livemode: true
            });

            const updated = await repository.addToPendingBalance(created.id, 5000);

            expect(updated.pendingBalance).toBe(15000);
        });

        it('should handle null pending balance', async () => {
            const created = await repository.create({
                externalId: 'vendor-addbal-2',
                email: 'addbal2@vendor.com',
                livemode: true
            });

            const updated = await repository.addToPendingBalance(created.id, 7500);

            expect(updated.pendingBalance).toBe(7500);
        });
    });

    describe('softDelete', () => {
        it('should soft delete vendor', async () => {
            const created = await repository.create({
                externalId: 'vendor-softdel-1',
                email: 'softdel@vendor.com',
                livemode: true
            });

            await repository.softDelete(created.id);

            const found = await repository.findById(created.id);
            expect(found).toBeNull();
        });

        it('should throw when deleting non-existent vendor', async () => {
            await expect(repository.softDelete('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await repository.create({
                externalId: 'vendor-search-1',
                email: 'search1@vendor.com',
                onboardingStatus: 'pending',
                canReceivePayments: false,
                livemode: true
            });
            await repository.create({
                externalId: 'vendor-search-2',
                email: 'search2@vendor.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                livemode: true
            });
            await repository.create({
                externalId: 'vendor-search-3',
                email: 'search3@vendor.com',
                onboardingStatus: 'completed',
                canReceivePayments: true,
                livemode: false
            });
        });

        it('should search by onboarding status', async () => {
            const pendingResult = await repository.search({ onboardingStatus: 'pending' });
            const completedResult = await repository.search({ onboardingStatus: 'completed' });

            expect(pendingResult.data).toHaveLength(1);
            expect(completedResult.data).toHaveLength(2);
        });

        it('should search by canReceivePayments', async () => {
            const readyResult = await repository.search({ canReceivePayments: true });
            const notReadyResult = await repository.search({ canReceivePayments: false });

            expect(readyResult.data).toHaveLength(2);
            expect(notReadyResult.data).toHaveLength(1);
        });

        it('should search by livemode', async () => {
            const liveResult = await repository.search({ livemode: true });
            const testResult = await repository.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should paginate results', async () => {
            const page1 = await repository.search({ limit: 2, offset: 0 });
            const page2 = await repository.search({ limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page2.data).toHaveLength(1);
        });
    });

    describe('Vendor Payouts', () => {
        let testVendorId: string;

        beforeEach(async () => {
            const vendor = await repository.create({
                externalId: 'vendor-payout-test',
                email: 'payout@vendor.com',
                livemode: true
            });
            testVendorId = vendor.id;
        });

        it('should create payout', async () => {
            const payout = await repository.createPayout({
                vendorId: testVendorId,
                amount: 50000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe'
            });

            expect(payout.id).toBeDefined();
            expect(payout.vendorId).toBe(testVendorId);
            expect(payout.amount).toBe(50000);
            expect(payout.status).toBe('pending');
        });

        it('should find payout by ID', async () => {
            const created = await repository.createPayout({
                vendorId: testVendorId,
                amount: 25000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe'
            });

            const found = await repository.findPayoutById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
        });

        it('should find payout by provider payout ID', async () => {
            await repository.createPayout({
                vendorId: testVendorId,
                amount: 30000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPayoutId: 'po_stripe123'
            });

            const found = await repository.findPayoutByProviderPayoutId('po_stripe123');

            expect(found).not.toBeNull();
            expect(found?.providerPayoutId).toBe('po_stripe123');
        });

        it('should find payouts by vendor ID with pagination', async () => {
            for (let i = 0; i < 5; i++) {
                await repository.createPayout({
                    vendorId: testVendorId,
                    amount: 10000 * (i + 1),
                    currency: 'USD',
                    status: 'succeeded',
                    provider: 'stripe'
                });
            }

            const result = await repository.findPayoutsByVendorId(testVendorId, { limit: 3, offset: 0 });

            expect(result.data).toHaveLength(3);
            expect(result.total).toBe(5);
        });

        it('should filter payouts by status', async () => {
            await repository.createPayout({
                vendorId: testVendorId,
                amount: 10000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe'
            });
            await repository.createPayout({
                vendorId: testVendorId,
                amount: 20000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe'
            });

            const pendingResult = await repository.findPayoutsByVendorId(testVendorId, { status: ['pending'] });
            const succeededResult = await repository.findPayoutsByVendorId(testVendorId, { status: ['succeeded'] });

            expect(pendingResult.data).toHaveLength(1);
            expect(succeededResult.data).toHaveLength(1);
        });

        it('should update payout status', async () => {
            const created = await repository.createPayout({
                vendorId: testVendorId,
                amount: 15000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe'
            });

            const updated = await repository.updatePayoutStatus(created.id, 'succeeded');

            expect(updated.status).toBe('succeeded');
            expect(updated.paidAt).toBeInstanceOf(Date);
        });

        it('should update payout status with failure info', async () => {
            const created = await repository.createPayout({
                vendorId: testVendorId,
                amount: 15000,
                currency: 'USD',
                status: 'processing',
                provider: 'stripe'
            });

            const updated = await repository.updatePayoutStatus(created.id, 'failed', {
                failureCode: 'insufficient_funds',
                failureMessage: 'Insufficient funds in account'
            });

            expect(updated.status).toBe('failed');
            expect(updated.failureCode).toBe('insufficient_funds');
        });

        it('should get payout totals for vendor', async () => {
            await repository.createPayout({
                vendorId: testVendorId,
                amount: 10000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe'
            });
            await repository.createPayout({
                vendorId: testVendorId,
                amount: 20000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe'
            });
            await repository.createPayout({
                vendorId: testVendorId,
                amount: 5000,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe'
            });
            await repository.createPayout({
                vendorId: testVendorId,
                amount: 3000,
                currency: 'USD',
                status: 'failed',
                provider: 'stripe'
            });

            const totals = await repository.getPayoutTotalsForVendor(testVendorId);

            expect(totals.totalPaid).toBe(30000);
            expect(totals.totalPending).toBe(5000);
            expect(totals.totalFailed).toBe(3000);
        });
    });
});
