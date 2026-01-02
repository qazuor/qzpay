/**
 * Storage Adapter Integration Tests
 *
 * Tests the QZPayDrizzleStorageAdapter that bridges repositories to Core's storage interface.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createQZPayDrizzleAdapter, type QZPayDrizzleStorageAdapter } from '../src/adapter/index.js';
import { clearTestData, getTestDatabase, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayDrizzleStorageAdapter', () => {
    let adapter: QZPayDrizzleStorageAdapter;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        adapter = createQZPayDrizzleAdapter(db, { livemode: true });
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('customers storage', () => {
        it('should create and retrieve a customer', async () => {
            const created = await adapter.customers.create({
                externalId: 'ext-adapter-1',
                email: 'adapter@example.com',
                name: 'Adapter Test'
            });

            expect(created.id).toBeDefined();
            expect(created.externalId).toBe('ext-adapter-1');
            expect(created.email).toBe('adapter@example.com');

            const found = await adapter.customers.findById(created.id);
            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
        });

        it('should find customer by external ID', async () => {
            await adapter.customers.create({
                externalId: 'ext-find-adapter',
                email: 'find@example.com'
            });

            const found = await adapter.customers.findByExternalId('ext-find-adapter');
            expect(found).not.toBeNull();
            expect(found?.externalId).toBe('ext-find-adapter');
        });

        it('should update a customer', async () => {
            const created = await adapter.customers.create({
                externalId: 'ext-update-adapter',
                email: 'update@example.com',
                name: 'Original'
            });

            const updated = await adapter.customers.update(created.id, {
                name: 'Updated Name'
            });

            expect(updated.name).toBe('Updated Name');
        });

        it('should delete a customer', async () => {
            const created = await adapter.customers.create({
                externalId: 'ext-delete-adapter',
                email: 'delete@example.com'
            });

            await adapter.customers.delete(created.id);

            const found = await adapter.customers.findById(created.id);
            expect(found).toBeNull();
        });

        it('should list customers with pagination', async () => {
            await adapter.customers.create({ externalId: 'list-1', email: 'a@test.com' });
            await adapter.customers.create({ externalId: 'list-2', email: 'b@test.com' });
            await adapter.customers.create({ externalId: 'list-3', email: 'c@test.com' });

            const result = await adapter.customers.list({ limit: 2, offset: 0 });

            expect(result.data.length).toBeLessThanOrEqual(2);
            expect(result.total).toBe(3);
        });
    });

    describe('plans storage', () => {
        it('should create and retrieve a plan', async () => {
            const created = await adapter.plans.create({
                name: 'Pro Plan',
                description: 'Professional features',
                features: [{ name: 'Feature 1', included: true }],
                entitlements: ['pro_features'],
                limits: { api_calls: 10000 }
            });

            expect(created.id).toBeDefined();
            expect(created.name).toBe('Pro Plan');

            const found = await adapter.plans.findById(created.id);
            expect(found).not.toBeNull();
            expect(found?.name).toBe('Pro Plan');
        });

        it('should list active plans', async () => {
            await adapter.plans.create({
                name: 'Active Plan',
                features: [],
                entitlements: [],
                limits: {}
            });

            const result = await adapter.plans.list({ active: true });
            expect(result.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('subscriptions storage', () => {
        let customerId: string;
        let planId: string;

        beforeEach(async () => {
            const customer = await adapter.customers.create({
                externalId: `sub-test-${Date.now()}`,
                email: 'sub@example.com'
            });
            customerId = customer.id;

            const plan = await adapter.plans.create({
                name: 'Subscription Plan',
                features: [],
                entitlements: [],
                limits: {}
            });
            planId = plan.id;
        });

        it('should create and retrieve a subscription', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const created = await adapter.subscriptions.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd
            });

            expect(created.id).toBeDefined();
            expect(created.customerId).toBe(customerId);
            expect(created.planId).toBe(planId);
            expect(created.status).toBe('active');

            const found = await adapter.subscriptions.findById(created.id);
            expect(found).not.toBeNull();
        });

        it('should find subscriptions by customer', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            await adapter.subscriptions.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd
            });

            const found = await adapter.subscriptions.findByCustomerId(customerId);
            expect(found.length).toBeGreaterThanOrEqual(1);
        });

        it('should update subscription metadata', async () => {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const created = await adapter.subscriptions.create({
                customerId,
                planId,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd
            });

            const updated = await adapter.subscriptions.update(created.id, {
                metadata: { updated: true }
            });

            expect(updated.metadata).toEqual({ updated: true });
        });
    });

    describe('payments storage', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await adapter.customers.create({
                externalId: `pay-test-${Date.now()}`,
                email: 'pay@example.com'
            });
            customerId = customer.id;
        });

        it('should create and retrieve a payment', async () => {
            const created = await adapter.payments.create({
                customerId,
                amount: 9999,
                currency: 'usd',
                status: 'pending',
                provider: 'stripe'
            });

            expect(created.id).toBeDefined();
            expect(created.amount).toBe(9999);
            expect(created.currency).toBe('usd');
            expect(created.status).toBe('pending');

            const found = await adapter.payments.findById(created.id);
            expect(found).not.toBeNull();
        });

        it('should find payments by customer', async () => {
            await adapter.payments.create({
                customerId,
                amount: 5000,
                currency: 'usd',
                status: 'succeeded',
                provider: 'stripe'
            });

            const found = await adapter.payments.findByCustomerId(customerId);
            expect(found.length).toBeGreaterThanOrEqual(1);
        });

        it('should update payment status', async () => {
            const created = await adapter.payments.create({
                customerId,
                amount: 7500,
                currency: 'usd',
                status: 'pending',
                provider: 'stripe'
            });

            const updated = await adapter.payments.update(created.id, {
                status: 'succeeded'
            });

            expect(updated.status).toBe('succeeded');
        });
    });

    describe('transaction support', () => {
        it('should execute operations in a transaction', async () => {
            const result = await adapter.transaction(async () => {
                const customer = await adapter.customers.create({
                    externalId: 'tx-test-1',
                    email: 'tx@example.com'
                });
                return customer;
            });

            expect(result.id).toBeDefined();

            const found = await adapter.customers.findById(result.id);
            expect(found).not.toBeNull();
        });
    });

    describe('livemode filtering', () => {
        it('should respect livemode setting', async () => {
            // Create with livemode=true adapter
            await adapter.customers.create({
                externalId: 'live-1',
                email: 'live@example.com'
            });

            // Get the db and create a test mode adapter
            const db = getTestDatabase();
            const testAdapter = createQZPayDrizzleAdapter(db, { livemode: false });

            // Create with livemode=false
            await testAdapter.customers.create({
                externalId: 'test-1',
                email: 'test@example.com'
            });

            // Each adapter should only see its own mode's data
            const liveCustomers = await adapter.customers.list({});
            const testCustomers = await testAdapter.customers.list({});

            expect(liveCustomers.data.every((c) => c.livemode === true)).toBe(true);
            expect(testCustomers.data.every((c) => c.livemode === false)).toBe(true);
        });
    });
});
