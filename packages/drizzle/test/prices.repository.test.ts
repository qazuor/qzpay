/**
 * Prices Repository Integration Tests
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayPlansRepository } from '../src/repositories/plans.repository.js';
import { QZPayPricesRepository } from '../src/repositories/prices.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayPricesRepository', () => {
    let repository: QZPayPricesRepository;
    let plansRepository: QZPayPlansRepository;
    let testPlanId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayPricesRepository(db);
        plansRepository = new QZPayPlansRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
        // Create a test plan for prices
        const plan = await plansRepository.create({
            id: crypto.randomUUID(),
            name: 'Test Plan',
            active: true,
            livemode: true
        });
        testPlanId = plan.id;
    });

    describe('create', () => {
        it('should create a new price', async () => {
            const input = {
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            };

            const price = await repository.create(input);

            expect(price.id).toBe(input.id);
            expect(price.planId).toBe(testPlanId);
            expect(price.unitAmount).toBe(2999);
            expect(price.currency).toBe('USD');
            expect(price.billingInterval).toBe('month');
            expect(price.active).toBe(true);
        });

        it('should create price with provider IDs', async () => {
            const input = {
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 4999,
                currency: 'USD',
                billingInterval: 'year',
                intervalCount: 1,
                stripePriceId: 'price_stripe123',
                mpPriceId: 'mp_price456',
                active: true,
                livemode: true
            };

            const price = await repository.create(input);

            expect(price.stripePriceId).toBe('price_stripe123');
            expect(price.mpPriceId).toBe('mp_price456');
        });

        it('should create price with nickname and trial days', async () => {
            const input = {
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                nickname: 'Monthly Pro',
                trialDays: 14,
                active: true,
                livemode: true
            };

            const price = await repository.create(input);

            expect(price.nickname).toBe('Monthly Pro');
            expect(price.trialDays).toBe(14);
        });
    });

    describe('findById', () => {
        it('should find price by ID', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.unitAmount).toBe(1999);
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findByPlanId', () => {
        beforeEach(async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 9999,
                currency: 'USD',
                billingInterval: 'year',
                intervalCount: 1,
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: false,
                livemode: true
            });
        });

        it('should find active prices by plan ID', async () => {
            const prices = await repository.findByPlanId(testPlanId);

            expect(prices).toHaveLength(2);
            expect(prices.every((p) => p.active)).toBe(true);
            // Should be ordered by unitAmount ASC
            expect(prices[0].unitAmount).toBe(999);
            expect(prices[1].unitAmount).toBe(9999);
        });

        it('should find all prices including inactive', async () => {
            const prices = await repository.findByPlanId(testPlanId, false);

            expect(prices).toHaveLength(3);
        });
    });

    describe('findByStripePriceId', () => {
        it('should find price by Stripe price ID', async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                stripePriceId: 'price_test123',
                active: true,
                livemode: true
            });

            const found = await repository.findByStripePriceId('price_test123');

            expect(found).not.toBeNull();
            expect(found?.stripePriceId).toBe('price_test123');
        });
    });

    describe('findByMpPriceId', () => {
        it('should find price by MercadoPago price ID', async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'ars',
                billingInterval: 'month',
                intervalCount: 1,
                mpPriceId: 'mp_price_test456',
                active: true,
                livemode: true
            });

            const found = await repository.findByMpPriceId('mp_price_test456');

            expect(found).not.toBeNull();
            expect(found?.mpPriceId).toBe('mp_price_test456');
        });
    });

    describe('findByProviderPriceId', () => {
        it('should find by stripe provider', async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                stripePriceId: 'price_provider_test',
                active: true,
                livemode: true
            });

            const found = await repository.findByProviderPriceId('stripe', 'price_provider_test');

            expect(found).not.toBeNull();
        });

        it('should find by mercadopago provider', async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'ars',
                billingInterval: 'month',
                intervalCount: 1,
                mpPriceId: 'mp_provider_test',
                active: true,
                livemode: true
            });

            const found = await repository.findByProviderPriceId('mercadopago', 'mp_provider_test');

            expect(found).not.toBeNull();
        });
    });

    describe('update', () => {
        it('should update price fields', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            const updated = await repository.update(created.id, {
                unitAmount: 2499
            });

            expect(updated.unitAmount).toBe(2499);
            expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });
    });

    describe('updateStripePriceId / updateMpPriceId / updateProviderPriceId', () => {
        it('should update Stripe price ID', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            const updated = await repository.updateStripePriceId(created.id, 'price_new123');

            expect(updated.stripePriceId).toBe('price_new123');
        });

        it('should update MercadoPago price ID', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'ars',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            const updated = await repository.updateMpPriceId(created.id, 'mp_new456');

            expect(updated.mpPriceId).toBe('mp_new456');
        });

        it('should update provider price ID', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            await repository.updateProviderPriceId(created.id, 'stripe', 'price_via_provider');
            const foundStripe = await repository.findById(created.id);
            expect(foundStripe?.stripePriceId).toBe('price_via_provider');

            await repository.updateProviderPriceId(created.id, 'mercadopago', 'mp_via_provider');
            const foundMp = await repository.findById(created.id);
            expect(foundMp?.mpPriceId).toBe('mp_via_provider');
        });
    });

    describe('activate / deactivate', () => {
        it('should activate a price', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: false,
                livemode: true
            });

            const activated = await repository.activate(created.id);

            expect(activated.active).toBe(true);
        });

        it('should deactivate a price', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            const deactivated = await repository.deactivate(created.id);

            expect(deactivated.active).toBe(false);
        });
    });

    describe('delete', () => {
        it('should hard delete a price', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            await repository.delete(created.id);

            const found = await repository.findById(created.id);
            expect(found).toBeNull();
        });

        it('should throw error when deleting non-existent price', async () => {
            await expect(repository.delete('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'eur',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 9999,
                currency: 'USD',
                billingInterval: 'year',
                intervalCount: 1,
                active: false,
                livemode: true
            });
        });

        it('should search by currency', async () => {
            const result = await repository.search({ currency: 'USD' });

            expect(result.data).toHaveLength(2);
            expect(result.data.every((p) => p.currency === 'USD')).toBe(true);
        });

        it('should search by billing interval', async () => {
            const result = await repository.search({ billingInterval: 'year' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].billingInterval).toBe('year');
        });

        it('should search by active status', async () => {
            const activeResult = await repository.search({ active: true });
            const inactiveResult = await repository.search({ active: false });

            expect(activeResult.data).toHaveLength(2);
            expect(inactiveResult.data).toHaveLength(1);
        });

        it('should search by planId', async () => {
            const result = await repository.search({ planId: testPlanId });

            expect(result.data).toHaveLength(3);
        });

        it('should paginate results', async () => {
            const page1 = await repository.search({ limit: 1, offset: 0 });
            const page2 = await repository.search({ limit: 1, offset: 1 });

            expect(page1.data).toHaveLength(1);
            expect(page1.total).toBe(3);
            expect(page2.data).toHaveLength(1);
        });
    });

    describe('updateMetadata', () => {
        it('should update price metadata', async () => {
            const created = await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                metadata: { initial: true },
                active: true,
                livemode: true
            });

            const updated = await repository.updateMetadata(created.id, { updated: true, tier: 'premium' });

            expect(updated.metadata).toEqual({ updated: true, tier: 'premium' });
        });
    });

    describe('count', () => {
        beforeEach(async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: false,
                livemode: true
            });
        });

        it('should count prices with filters', async () => {
            const total = await repository.count();
            const active = await repository.count(undefined, undefined, true);
            const inactive = await repository.count(undefined, undefined, false);
            const byPlan = await repository.count(testPlanId);

            expect(total).toBe(2);
            expect(active).toBe(1);
            expect(inactive).toBe(1);
            expect(byPlan).toBe(2);
        });
    });

    describe('findDefaultForPlan', () => {
        beforeEach(async () => {
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 2999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 999,
                currency: 'USD',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });
            await repository.create({
                id: crypto.randomUUID(),
                planId: testPlanId,
                unitAmount: 1999,
                currency: 'eur',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });
        });

        it('should find lowest active price for plan', async () => {
            const defaultPrice = await repository.findDefaultForPlan(testPlanId);

            expect(defaultPrice).not.toBeNull();
            expect(defaultPrice?.unitAmount).toBe(999);
        });

        it('should find lowest active price for plan with specific currency', async () => {
            const defaultPrice = await repository.findDefaultForPlan(testPlanId, 'eur');

            expect(defaultPrice).not.toBeNull();
            expect(defaultPrice?.unitAmount).toBe(1999);
            expect(defaultPrice?.currency).toBe('eur');
        });

        it('should return null for non-existent plan', async () => {
            const defaultPrice = await repository.findDefaultForPlan('00000000-0000-0000-0000-000000000000');

            expect(defaultPrice).toBeNull();
        });
    });
});
