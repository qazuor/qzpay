/**
 * Memory Storage Adapter Tests - List Filters
 *
 * The in-memory adapter backs the rest of this package's test suite, so if
 * its `list()`/`listAll()` accept typed filters without actually applying
 * them to the in-memory arrays, every test written against it would be
 * exercising the same "filters typed, filters discarded" bug this whole
 * contract change (`packages/core/src/adapters/list-options.ts`) exists to
 * eliminate. Every test below asserts a NEGATIVE: with the filter applied,
 * at least one row that was present in the unfiltered list is gone.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { QZPayListAllLimitExceededError, createMemoryStorageAdapter } from '../src/adapters/memory-storage.adapter.js';

describe('memory storage adapter — list() filters', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    describe('customers.list — query filter', () => {
        it('matches partially and case-insensitively, excluding non-matching customers', async () => {
            await adapter.customers.create({ externalId: 'ext_1', email: 'alice@example.com', name: 'Alice Doe' });
            await adapter.customers.create({ externalId: 'ext_2', email: 'bob@example.com', name: 'Bob Smith' });

            const unfiltered = await adapter.customers.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            // Uppercase, partial: matches "alice@example.com" via a lowercase substring check.
            const result = await adapter.customers.list({ limit: 100, filters: { query: 'ALICE' } });

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.email).toBe('alice@example.com');
            expect(result.total).toBe(1);
        });

        it('matches against the name field too, not only email', async () => {
            await adapter.customers.create({ externalId: 'ext_1', email: 'alice@example.com', name: 'Alice Doe' });
            await adapter.customers.create({ externalId: 'ext_2', email: 'bob@example.com', name: 'Bob Smith' });

            const result = await adapter.customers.list({ limit: 100, filters: { query: 'smith' } });

            expect(result.data.map((c) => c.externalId)).toEqual(['ext_2']);
        });
    });

    describe('subscriptions.list — status filter', () => {
        it('a scalar status excludes subscriptions with a different status', async () => {
            await adapter.subscriptions.create({ id: 'sub_active', customerId: 'cus_1', planId: 'plan_1' });
            await adapter.subscriptions.create({ id: 'sub_trial', customerId: 'cus_1', planId: 'plan_1', trialDays: 14 });

            const unfiltered = await adapter.subscriptions.list({ limit: 100 });
            expect(unfiltered.data.map((s) => s.id).sort()).toEqual(['sub_active', 'sub_trial']);

            const result = await adapter.subscriptions.list({ limit: 100, filters: { status: 'trialing' } });

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.id).toBe('sub_trial');
        });

        it('an array status keeps only subscriptions whose status is in the set', async () => {
            await adapter.subscriptions.create({ id: 'sub_active', customerId: 'cus_1', planId: 'plan_1' });
            await adapter.subscriptions.create({ id: 'sub_trial', customerId: 'cus_1', planId: 'plan_1', trialDays: 14 });
            await adapter.subscriptions.update('sub_active', { status: 'canceled' });

            const result = await adapter.subscriptions.list({
                limit: 100,
                filters: { status: ['trialing', 'active'] }
            });

            // sub_active is now 'canceled' — outside the set — so only sub_trial remains,
            // even though the unfiltered list still has both subscriptions.
            expect(result.data.map((s) => s.id)).toEqual(['sub_trial']);
        });
    });

    describe('subscriptions.list — equality filter', () => {
        it('customerId excludes subscriptions belonging to a different customer', async () => {
            await adapter.subscriptions.create({ id: 'sub_1', customerId: 'cus_a', planId: 'plan_1' });
            await adapter.subscriptions.create({ id: 'sub_2', customerId: 'cus_b', planId: 'plan_1' });

            const unfiltered = await adapter.subscriptions.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.subscriptions.list({ limit: 100, filters: { customerId: 'cus_a' } });

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.id).toBe('sub_1');
        });
    });

    describe('payments.list — provider filter (derived from providerPaymentIds)', () => {
        it('excludes payments whose provider does not match', async () => {
            const now = new Date();
            await adapter.payments.create({
                id: 'pay_stripe',
                customerId: 'cus_1',
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: { stripe: 'pi_123' },
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });
            await adapter.payments.create({
                id: 'pay_mp',
                customerId: 'cus_1',
                amount: 2000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: { mercadopago: 'mp_456' },
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });

            const unfiltered = await adapter.payments.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.payments.list({ limit: 100, filters: { provider: 'mercadopago' } });

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.id).toBe('pay_mp');
        });

        it('startDate/endDate excludes payments created outside the inclusive range', async () => {
            await adapter.payments.create({
                id: 'pay_old',
                customerId: 'cus_1',
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: {},
                metadata: {},
                livemode: false,
                createdAt: new Date('2025-01-01T00:00:00Z'),
                updatedAt: new Date('2025-01-01T00:00:00Z')
            });
            await adapter.payments.create({
                id: 'pay_recent',
                customerId: 'cus_1',
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                providerPaymentIds: {},
                metadata: {},
                livemode: false,
                createdAt: new Date('2025-06-01T00:00:00Z'),
                updatedAt: new Date('2025-06-01T00:00:00Z')
            });

            const result = await adapter.payments.list({
                limit: 100,
                filters: { startDate: new Date('2025-03-01T00:00:00Z'), endDate: new Date('2025-12-31T00:00:00Z') }
            });

            expect(result.data.map((p) => p.id)).toEqual(['pay_recent']);
        });
    });

    describe('checkouts.list — status filter', () => {
        it('an array status keeps only checkouts whose status is in the set', async () => {
            const now = new Date();
            const baseSession = {
                customerEmail: null,
                mode: 'subscription' as const,
                currency: 'USD',
                lineItems: [],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
                expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
                paymentId: null,
                subscriptionId: null,
                providerSessionIds: {},
                metadata: {},
                livemode: false,
                createdAt: now,
                completedAt: null
            };

            await adapter.checkouts.create({ ...baseSession, id: 'chk_open', customerId: 'cus_1', status: 'open' });
            await adapter.checkouts.create({ ...baseSession, id: 'chk_expired', customerId: 'cus_1', status: 'expired' });

            const unfiltered = await adapter.checkouts.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.checkouts.list({ limit: 100, filters: { status: ['open', 'complete'] } });

            expect(result.data.map((c) => c.id)).toEqual(['chk_open']);
        });
    });

    describe('plans.list — query and equality filters', () => {
        it('active excludes plans with a different active flag', async () => {
            const activePlan = await adapter.plans.create({ id: 'plan_active', name: 'Pro Plan' });
            const inactivePlan = await adapter.plans.create({ id: 'plan_inactive', name: 'Legacy Plan' });
            await adapter.plans.update(inactivePlan.id, { active: false });

            const unfiltered = await adapter.plans.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.plans.list({ limit: 100, filters: { active: true } });

            expect(result.data.map((p) => p.id)).toEqual([activePlan.id]);
        });

        it('query matches name/description partially and case-insensitively', async () => {
            await adapter.plans.create({ id: 'plan_pro', name: 'Pro Plan' });
            await adapter.plans.create({ id: 'plan_basic', name: 'Basic Plan' });

            const result = await adapter.plans.list({ limit: 100, filters: { query: 'PRO' } });

            expect(result.data.map((p) => p.id)).toEqual(['plan_pro']);
        });
    });

    describe('prices.list — equality filters', () => {
        it('billingInterval excludes prices with a different interval', async () => {
            const plan = await adapter.plans.create({ id: 'plan_1', name: 'Pro Plan' });
            await adapter.prices.create({
                id: 'price_month',
                planId: plan.id,
                currency: 'USD',
                unitAmount: 1900,
                billingInterval: 'month'
            });
            await adapter.prices.create({ id: 'price_year', planId: plan.id, currency: 'USD', unitAmount: 19000, billingInterval: 'year' });

            const unfiltered = await adapter.prices.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.prices.list({ limit: 100, filters: { billingInterval: 'year' } });

            expect(result.data.map((p) => p.id)).toEqual(['price_year']);
        });
    });

    describe('promoCodes.list — equality filters', () => {
        it('type (discountType) excludes promo codes of a different type', async () => {
            await adapter.promoCodes.create({ id: 'promo_pct', code: 'SAVE20', discountType: 'percentage', discountValue: 20 });
            await adapter.promoCodes.create({ id: 'promo_fixed', code: 'FLAT10', discountType: 'fixed_amount', discountValue: 1000 });

            const unfiltered = await adapter.promoCodes.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.promoCodes.list({ limit: 100, filters: { type: 'fixed_amount' } });

            expect(result.data.map((p) => p.id)).toEqual(['promo_fixed']);
        });
    });

    describe('vendors.list — query and onboardingStatus filters', () => {
        it('query excludes vendors that do not match name/externalId', async () => {
            await adapter.vendors.create({ id: 'ven_acme', externalId: 'acme_1', name: 'Acme Inc', email: 'acme@example.com' });
            await adapter.vendors.create({ id: 'ven_globex', externalId: 'globex_1', name: 'Globex Corp', email: 'globex@example.com' });

            const result = await adapter.vendors.list({ limit: 100, filters: { query: 'acme' } });

            expect(result.data.map((v) => v.id)).toEqual(['ven_acme']);
        });

        it('onboardingStatus excludes vendors whose onboarding status differs (every vendor starts pending)', async () => {
            await adapter.vendors.create({ id: 'ven_1', externalId: 'ext_1', name: 'Vendor One', email: 'one@example.com' });

            const pending = await adapter.vendors.list({ limit: 100, filters: { onboardingStatus: 'pending' } });
            expect(pending.data).toHaveLength(1);

            const completed = await adapter.vendors.list({ limit: 100, filters: { onboardingStatus: 'completed' } });
            expect(completed.data).toHaveLength(0);
        });
    });

    describe('addons.list — query and equality filters', () => {
        it('active excludes deactivated add-ons', async () => {
            const addon1 = await adapter.addons.create({
                id: 'addon_1',
                name: 'Extra Storage',
                unitAmount: 500,
                currency: 'USD',
                billingInterval: 'month'
            });
            const addon2 = await adapter.addons.create({
                id: 'addon_2',
                name: 'Priority Support',
                unitAmount: 1000,
                currency: 'USD',
                billingInterval: 'month'
            });
            await adapter.addons.update(addon2.id, { active: false });

            const unfiltered = await adapter.addons.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.addons.list({ limit: 100, filters: { active: true } });

            expect(result.data.map((a) => a.id)).toEqual([addon1.id]);
        });
    });

    describe('invoices.list — status and date range filters', () => {
        it('status excludes invoices with a different status', async () => {
            const inv1 = await adapter.invoices.create({
                id: 'inv_1',
                customerId: 'cus_1',
                lines: [{ description: 'Pro Plan', quantity: 1, unitAmount: 1900 }]
            });
            const inv2 = await adapter.invoices.create({
                id: 'inv_2',
                customerId: 'cus_1',
                lines: [{ description: 'Pro Plan', quantity: 1, unitAmount: 1900 }]
            });
            await adapter.invoices.update(inv2.id, { status: 'paid' });

            const result = await adapter.invoices.list({ limit: 100, filters: { status: 'paid' } });

            expect(result.data.map((i) => i.id)).toEqual([inv2.id]);
            // Confirms the filter actually excluded something present unfiltered.
            expect(inv1.status).not.toBe('paid');
        });
    });

    describe('orderBy / orderDirection', () => {
        it('sorts ascending and descending by createdAt', async () => {
            let clock = new Date('2025-01-01T00:00:00Z').getTime();
            const storage = createMemoryStorageAdapter({ getCurrentTime: () => new Date(clock) });
            const orderedAdapter = storage.adapter;

            await orderedAdapter.customers.create({ externalId: 'first', email: 'first@example.com' });
            clock += 1000;
            await orderedAdapter.customers.create({ externalId: 'second', email: 'second@example.com' });
            clock += 1000;
            await orderedAdapter.customers.create({ externalId: 'third', email: 'third@example.com' });

            const asc = await orderedAdapter.customers.list({ limit: 100, orderBy: 'createdAt', orderDirection: 'asc' });
            expect(asc.data.map((c) => c.externalId)).toEqual(['first', 'second', 'third']);

            const desc = await orderedAdapter.customers.list({ limit: 100, orderBy: 'createdAt', orderDirection: 'desc' });
            expect(desc.data.map((c) => c.externalId)).toEqual(['third', 'second', 'first']);
        });
    });
});

describe('memory storage adapter — listAll()', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
    });

    it('applies filters and returns every matching row as a flat array', async () => {
        await adapter.subscriptions.create({ id: 'sub_a1', customerId: 'cus_a', planId: 'plan_1' });
        await adapter.subscriptions.create({ id: 'sub_a2', customerId: 'cus_a', planId: 'plan_1' });
        await adapter.subscriptions.create({ id: 'sub_b1', customerId: 'cus_b', planId: 'plan_1' });

        const result = await adapter.subscriptions.listAll({ filters: { customerId: 'cus_a' } });

        expect(Array.isArray(result)).toBe(true);
        expect(result.map((s) => s.id).sort()).toEqual(['sub_a1', 'sub_a2']);
    });

    it('throws QZPayListAllLimitExceededError when the result exceeds maxItems', async () => {
        await adapter.customers.create({ externalId: 'ext_1', email: 'one@example.com' });
        await adapter.customers.create({ externalId: 'ext_2', email: 'two@example.com' });
        await adapter.customers.create({ externalId: 'ext_3', email: 'three@example.com' });

        await expect(adapter.customers.listAll({ maxItems: 2 })).rejects.toThrow(QZPayListAllLimitExceededError);

        let caught: unknown;
        try {
            await adapter.customers.listAll({ maxItems: 2 });
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(QZPayListAllLimitExceededError);
        expect((caught as QZPayListAllLimitExceededError).entity).toBe('customers');
        expect((caught as QZPayListAllLimitExceededError).maxItems).toBe(2);
        expect((caught as QZPayListAllLimitExceededError).total).toBe(3);
    });

    it('does not throw when the result is within maxItems', async () => {
        await adapter.customers.create({ externalId: 'ext_1', email: 'one@example.com' });

        const result = await adapter.customers.listAll({ maxItems: 5 });

        expect(result).toHaveLength(1);
    });

    /**
     * These three filters were advertised by the admin HTTP routes
     * (`?planId=`, `?minAmount=`, `?maxAmount=` in `packages/hono`) while no
     * such filter existed anywhere below them, so the endpoints returned the
     * full set and looked like they had filtered.
     */
    describe('filters the admin HTTP routes advertised but never had', () => {
        /** Creates a payment with the full shape the adapter expects. */
        async function createPayment(id: string, amount: number) {
            const now = new Date();
            await adapter.payments.create({
                id,
                customerId: 'cus_1',
                amount,
                currency: 'ARS',
                status: 'succeeded',
                providerPaymentIds: { stripe: `pi_${id}` },
                metadata: {},
                livemode: false,
                createdAt: now,
                updatedAt: now
            });
        }
        it('subscriptions.list — planId excludes subscriptions on other plans', async () => {
            await adapter.subscriptions.create({ id: 'sub_a', customerId: 'cus_1', planId: 'plan_basic' });
            await adapter.subscriptions.create({ id: 'sub_b', customerId: 'cus_1', planId: 'plan_pro' });

            const unfiltered = await adapter.subscriptions.list({ limit: 100 });
            expect(unfiltered.data.map((s) => s.id).sort()).toEqual(['sub_a', 'sub_b']);

            const result = await adapter.subscriptions.list({
                limit: 100,
                filters: { planId: 'plan_pro' }
            });

            expect(result.data.map((s) => s.id)).toEqual(['sub_b']);
            expect(result.total).toBe(1);
        });

        it('subscriptions.list — planId combines with status rather than replacing it', async () => {
            await adapter.subscriptions.create({ id: 'sub_pro_active', customerId: 'cus_1', planId: 'plan_pro' });
            await adapter.subscriptions.create({
                id: 'sub_pro_trial',
                customerId: 'cus_1',
                planId: 'plan_pro',
                trialDays: 14
            });
            await adapter.subscriptions.create({
                id: 'sub_basic_trial',
                customerId: 'cus_1',
                planId: 'plan_basic',
                trialDays: 14
            });

            const result = await adapter.subscriptions.list({
                limit: 100,
                filters: { planId: 'plan_pro', status: 'trialing' }
            });

            // Only the row matching BOTH survives: a plan-mate on another status
            // and a same-status row on another plan are both excluded.
            expect(result.data.map((s) => s.id)).toEqual(['sub_pro_trial']);
        });

        it('subscriptions.listAll — planId applies there too', async () => {
            await adapter.subscriptions.create({ id: 'sub_a', customerId: 'cus_1', planId: 'plan_basic' });
            await adapter.subscriptions.create({ id: 'sub_b', customerId: 'cus_1', planId: 'plan_pro' });

            const all = await adapter.subscriptions.listAll({ filters: { planId: 'plan_basic' } });

            expect(all.map((s) => s.id)).toEqual(['sub_a']);
        });

        it('payments.list — minAmount excludes anything cheaper', async () => {
            await createPayment('pay_low', 500);
            await createPayment('pay_high', 5000);

            const unfiltered = await adapter.payments.list({ limit: 100 });
            expect(unfiltered.data).toHaveLength(2);

            const result = await adapter.payments.list({ limit: 100, filters: { minAmount: 1000 } });

            expect(result.data.map((p) => p.id)).toEqual(['pay_high']);
        });

        it('payments.list — maxAmount excludes anything dearer', async () => {
            await createPayment('pay_low', 500);
            await createPayment('pay_high', 5000);

            const result = await adapter.payments.list({ limit: 100, filters: { maxAmount: 1000 } });

            expect(result.data.map((p) => p.id)).toEqual(['pay_low']);
        });

        it('payments.list — the bounds are INCLUSIVE at both ends', async () => {
            await createPayment('pay_exact', 1000);
            await createPayment('pay_below', 999);
            await createPayment('pay_above', 1001);

            const result = await adapter.payments.list({
                limit: 100,
                filters: { minAmount: 1000, maxAmount: 1000 }
            });

            expect(result.data.map((p) => p.id)).toEqual(['pay_exact']);
        });

        it('payments.list — min and max bound a range together', async () => {
            await createPayment('pay_100', 100);
            await createPayment('pay_1000', 1000);
            await createPayment('pay_9000', 9000);

            const result = await adapter.payments.list({
                limit: 100,
                filters: { minAmount: 500, maxAmount: 5000 }
            });

            expect(result.data.map((p) => p.id)).toEqual(['pay_1000']);
        });

        it('payments.list — an amount of 0 is a real bound, not an absent one', async () => {
            // `minAmount: 0` must not be read as "no filter": a falsy-check
            // instead of an `undefined`-check would silently drop it.
            await createPayment('pay_free', 0);
            await createPayment('pay_paid', 100);

            const result = await adapter.payments.list({ limit: 100, filters: { maxAmount: 0 } });

            expect(result.data.map((p) => p.id)).toEqual(['pay_free']);
        });
    });
});
