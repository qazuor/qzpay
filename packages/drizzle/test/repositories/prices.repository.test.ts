/**
 * Prices Repository Integration Tests
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { QZPayPricesRepository } from '../../src/repositories/prices.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('QZPayPricesRepository', () => {
    let repository: QZPayPricesRepository;
    let plansRepository: QZPayPlansRepository;
    let planId: string;

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
        planId = plan.id;
    });

    describe('create', () => {
        it('should create a new price', async () => {
            const priceId = crypto.randomUUID();
            const input = {
                id: priceId,
                planId,
                nickname: 'Monthly Pro',
                currency: 'usd',
                unitAmount: 2999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: 14,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            };

            const price = await repository.create(input);

            expect(price.id).toBe(priceId);
            expect(price.currency).toBe('usd');
            expect(price.unitAmount).toBe(2999);
        });
    });

    describe('findById', () => {
        it('should find price by ID', async () => {
            const priceId = crypto.randomUUID();
            const created = await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 1999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(priceId);
        });
    });

    describe('findByPlanId', () => {
        it('should find all prices for a plan', async () => {
            const priceId1 = crypto.randomUUID();
            const priceId2 = crypto.randomUUID();
            await repository.create({
                id: priceId1,
                planId,
                nickname: 'Monthly',
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: priceId2,
                planId,
                nickname: 'Yearly',
                currency: 'usd',
                unitAmount: 9999,
                billingInterval: 'year',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const prices = await repository.findByPlanId(planId);

            expect(prices).toHaveLength(2);
        });

        it('should filter inactive prices when activeOnly is true', async () => {
            const activeId = crypto.randomUUID();
            const inactiveId = crypto.randomUUID();
            await repository.create({
                id: activeId,
                planId,
                nickname: 'Active',
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: inactiveId,
                planId,
                nickname: 'Inactive',
                currency: 'usd',
                unitAmount: 1999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: false,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const prices = await repository.findByPlanId(planId, true);

            expect(prices.every((p) => p.active === true)).toBe(true);
        });
    });

    describe('findByStripePriceId', () => {
        it('should find price by Stripe ID', async () => {
            const priceId = crypto.randomUUID();
            await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: 'price_stripe123',
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const found = await repository.findByStripePriceId('price_stripe123');

            expect(found).not.toBeNull();
            expect(found?.stripePriceId).toBe('price_stripe123');
        });
    });

    describe('findByMpPriceId', () => {
        it('should find price by MercadoPago ID', async () => {
            const priceId = crypto.randomUUID();
            await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'ars',
                unitAmount: 9999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: 'mp_price456',
                metadata: {},
                livemode: true
            });

            const found = await repository.findByMpPriceId('mp_price456');

            expect(found).not.toBeNull();
            expect(found?.mpPriceId).toBe('mp_price456');
        });
    });

    describe('findByProviderPriceId', () => {
        it('should find price by Stripe provider', async () => {
            const priceId = crypto.randomUUID();
            await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: 'price_test',
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const found = await repository.findByProviderPriceId('stripe', 'price_test');

            expect(found).not.toBeNull();
        });

        it('should find price by MercadoPago provider', async () => {
            const priceId = crypto.randomUUID();
            await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'ars',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: 'mp_test',
                metadata: {},
                livemode: true
            });

            const found = await repository.findByProviderPriceId('mercadopago', 'mp_test');

            expect(found).not.toBeNull();
        });
    });

    describe('update', () => {
        it('should update price fields', async () => {
            const priceId = crypto.randomUUID();
            const created = await repository.create({
                id: priceId,
                planId,
                nickname: 'Original',
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const updated = await repository.update(created.id, {
                nickname: 'Updated',
                active: false
            });

            expect(updated.nickname).toBe('Updated');
            expect(updated.active).toBe(false);
        });
    });

    describe('updateStripePriceId', () => {
        it('should update Stripe price ID', async () => {
            const priceId = crypto.randomUUID();
            const created = await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const updated = await repository.updateStripePriceId(created.id, 'price_new_stripe');

            expect(updated.stripePriceId).toBe('price_new_stripe');
        });
    });

    describe('updateMpPriceId', () => {
        it('should update MercadoPago price ID', async () => {
            const priceId = crypto.randomUUID();
            const created = await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'ars',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const updated = await repository.updateMpPriceId(created.id, 'mp_new');

            expect(updated.mpPriceId).toBe('mp_new');
        });
    });

    describe('activate / deactivate', () => {
        it('should activate a price', async () => {
            const priceId = crypto.randomUUID();
            const created = await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: false,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const activated = await repository.activate(created.id);

            expect(activated.active).toBe(true);
        });

        it('should deactivate a price', async () => {
            const priceId = crypto.randomUUID();
            const created = await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const deactivated = await repository.deactivate(created.id);

            expect(deactivated.active).toBe(false);
        });
    });

    describe('delete', () => {
        it('should delete a price', async () => {
            const priceId = crypto.randomUUID();
            const created = await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            await repository.delete(created.id);

            const found = await repository.findById(created.id);
            expect(found).toBeNull();
        });
    });

    describe('search', () => {
        it('should search prices by plan', async () => {
            const priceId = crypto.randomUUID();
            await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const result = await repository.search({ planId });

            expect(result.data.length).toBeGreaterThan(0);
        });

        it('should filter by currency', async () => {
            const priceId = crypto.randomUUID();
            await repository.create({
                id: priceId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const result = await repository.search({ currency: 'usd' });

            expect(result.data.every((p) => p.currency === 'usd')).toBe(true);
        });
    });

    describe('findDefaultForPlan', () => {
        it('should find lowest price for plan', async () => {
            const lowId = crypto.randomUUID();
            const highId = crypto.randomUUID();
            await repository.create({
                id: lowId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: highId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 9999,
                billingInterval: 'year',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const defaultPrice = await repository.findDefaultForPlan(planId);

            expect(defaultPrice?.unitAmount).toBe(999);
        });

        it('should filter by currency when specified', async () => {
            const usdId = crypto.randomUUID();
            const eurId = crypto.randomUUID();
            await repository.create({
                id: usdId,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 1999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: eurId,
                planId,
                nickname: null,
                currency: 'eur',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const defaultPrice = await repository.findDefaultForPlan(planId, 'eur');

            expect(defaultPrice?.currency).toBe('eur');
            expect(defaultPrice?.unitAmount).toBe(999);
        });
    });

    describe('count', () => {
        it('should count all prices', async () => {
            const priceId1 = crypto.randomUUID();
            const priceId2 = crypto.randomUUID();
            await repository.create({
                id: priceId1,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 999,
                billingInterval: 'month',
                intervalCount: 1,
                trialDays: null,
                active: true,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });
            await repository.create({
                id: priceId2,
                planId,
                nickname: null,
                currency: 'usd',
                unitAmount: 1999,
                billingInterval: 'year',
                intervalCount: 1,
                trialDays: null,
                active: false,
                stripePriceId: null,
                mpPriceId: null,
                metadata: {},
                livemode: true
            });

            const total = await repository.count();
            const active = await repository.count(undefined, undefined, true);

            expect(total).toBe(2);
            expect(active).toBe(1);
        });
    });
});
