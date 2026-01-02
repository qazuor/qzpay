/**
 * Customers Repository Integration Tests
 *
 * Tests the customers repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayCustomersRepository', () => {
    let repository: QZPayCustomersRepository;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('create', () => {
        it('should create a new customer', async () => {
            const input = {
                externalId: 'ext-123',
                email: 'test@example.com',
                name: 'Test User',
                livemode: true
            };

            const customer = await repository.create(input);

            expect(customer.id).toBeDefined();
            expect(customer.externalId).toBe('ext-123');
            expect(customer.email).toBe('test@example.com');
            expect(customer.name).toBe('Test User');
            expect(customer.livemode).toBe(true);
            expect(customer.createdAt).toBeInstanceOf(Date);
            expect(customer.updatedAt).toBeInstanceOf(Date);
            expect(customer.deletedAt).toBeNull();
        });

        it('should create customer with provider IDs', async () => {
            const input = {
                externalId: 'ext-456',
                email: 'stripe@example.com',
                stripeCustomerId: 'cus_stripe123',
                mpCustomerId: 'mp_customer456',
                livemode: true
            };

            const customer = await repository.create(input);

            expect(customer.stripeCustomerId).toBe('cus_stripe123');
            expect(customer.mpCustomerId).toBe('mp_customer456');
        });

        it('should create customer with metadata', async () => {
            const input = {
                externalId: 'ext-789',
                email: 'meta@example.com',
                metadata: { source: 'api', tier: 'premium' },
                livemode: true
            };

            const customer = await repository.create(input);

            expect(customer.metadata).toEqual({ source: 'api', tier: 'premium' });
        });
    });

    describe('findById', () => {
        it('should find customer by ID', async () => {
            const created = await repository.create({
                externalId: 'ext-find-1',
                email: 'find@example.com',
                livemode: true
            });

            const found = await repository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.email).toBe('find@example.com');
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });

        it('should not find soft-deleted customers', async () => {
            const created = await repository.create({
                externalId: 'ext-deleted-1',
                email: 'deleted@example.com',
                livemode: true
            });

            await repository.softDelete(created.id);
            const found = await repository.findById(created.id);

            expect(found).toBeNull();
        });
    });

    describe('findByExternalId', () => {
        it('should find customer by external ID and livemode', async () => {
            await repository.create({
                externalId: 'ext-external-1',
                email: 'external@example.com',
                livemode: true
            });

            const found = await repository.findByExternalId('ext-external-1', true);

            expect(found).not.toBeNull();
            expect(found?.externalId).toBe('ext-external-1');
        });

        it('should distinguish between livemode and test mode', async () => {
            await repository.create({
                externalId: 'same-external-id',
                email: 'live@example.com',
                livemode: true
            });
            await repository.create({
                externalId: 'same-external-id',
                email: 'test@example.com',
                livemode: false
            });

            const liveCustomer = await repository.findByExternalId('same-external-id', true);
            const testCustomer = await repository.findByExternalId('same-external-id', false);

            expect(liveCustomer?.email).toBe('live@example.com');
            expect(testCustomer?.email).toBe('test@example.com');
        });
    });

    describe('findByStripeCustomerId', () => {
        it('should find customer by Stripe customer ID', async () => {
            await repository.create({
                externalId: 'ext-stripe-1',
                email: 'stripe@example.com',
                stripeCustomerId: 'cus_test123',
                livemode: true
            });

            const found = await repository.findByStripeCustomerId('cus_test123');

            expect(found).not.toBeNull();
            expect(found?.stripeCustomerId).toBe('cus_test123');
        });
    });

    describe('findByMpCustomerId', () => {
        it('should find customer by MercadoPago customer ID', async () => {
            await repository.create({
                externalId: 'ext-mp-1',
                email: 'mp@example.com',
                mpCustomerId: 'mp_cust_789',
                livemode: true
            });

            const found = await repository.findByMpCustomerId('mp_cust_789');

            expect(found).not.toBeNull();
            expect(found?.mpCustomerId).toBe('mp_cust_789');
        });
    });

    describe('findByEmail', () => {
        it('should find customers by email', async () => {
            await repository.create({
                externalId: 'ext-email-1',
                email: 'multi@example.com',
                livemode: true
            });
            await repository.create({
                externalId: 'ext-email-2',
                email: 'multi@example.com',
                livemode: false
            });

            const found = await repository.findByEmail('multi@example.com', true);

            expect(found).toHaveLength(1);
            expect(found[0].externalId).toBe('ext-email-1');
        });
    });

    describe('update', () => {
        it('should update customer fields', async () => {
            const created = await repository.create({
                externalId: 'ext-update-1',
                email: 'original@example.com',
                name: 'Original Name',
                livemode: true
            });

            const updated = await repository.update(created.id, {
                name: 'Updated Name',
                email: 'updated@example.com'
            });

            expect(updated.name).toBe('Updated Name');
            expect(updated.email).toBe('updated@example.com');
            expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });

        it('should throw error when updating non-existent customer', async () => {
            await expect(repository.update('00000000-0000-0000-0000-000000000000', { name: 'Test' })).rejects.toThrow();
        });
    });

    describe('updateStripeCustomerId', () => {
        it('should update Stripe customer ID', async () => {
            const created = await repository.create({
                externalId: 'ext-stripe-update-1',
                email: 'stripe-update@example.com',
                livemode: true
            });

            const updated = await repository.updateStripeCustomerId(created.id, 'cus_new123');

            expect(updated.stripeCustomerId).toBe('cus_new123');
        });
    });

    describe('updateMpCustomerId', () => {
        it('should update MercadoPago customer ID', async () => {
            const created = await repository.create({
                externalId: 'ext-mp-update-1',
                email: 'mp-update@example.com',
                livemode: true
            });

            const updated = await repository.updateMpCustomerId(created.id, 'mp_new456');

            expect(updated.mpCustomerId).toBe('mp_new456');
        });
    });

    describe('softDelete', () => {
        it('should soft delete a customer', async () => {
            const created = await repository.create({
                externalId: 'ext-soft-delete-1',
                email: 'softdelete@example.com',
                livemode: true
            });

            await repository.softDelete(created.id);

            const found = await repository.findById(created.id);
            expect(found).toBeNull();
        });

        it('should throw error when deleting non-existent customer', async () => {
            await expect(repository.softDelete('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            // Create test customers for search
            await repository.create({
                externalId: 'search-1',
                email: 'alice@example.com',
                name: 'Alice Smith',
                livemode: true
            });
            await repository.create({
                externalId: 'search-2',
                email: 'bob@example.com',
                name: 'Bob Johnson',
                livemode: true
            });
            await repository.create({
                externalId: 'search-3',
                email: 'charlie@example.com',
                name: 'Charlie Brown',
                livemode: false
            });
        });

        it('should search by email', async () => {
            const result = await repository.search({ query: 'alice' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].email).toBe('alice@example.com');
        });

        it('should search by name', async () => {
            const result = await repository.search({ query: 'Johnson' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].name).toBe('Bob Johnson');
        });

        it('should filter by livemode', async () => {
            const liveResult = await repository.search({ livemode: true });
            const testResult = await repository.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should paginate results', async () => {
            const page1 = await repository.search({ limit: 1, offset: 0, livemode: true });
            const page2 = await repository.search({ limit: 1, offset: 1, livemode: true });

            expect(page1.data).toHaveLength(1);
            expect(page1.total).toBe(2);
            expect(page2.data).toHaveLength(1);
            expect(page2.data[0].id).not.toBe(page1.data[0].id);
        });
    });

    describe('updateMetadata', () => {
        it('should update customer metadata', async () => {
            const created = await repository.create({
                externalId: 'ext-meta-1',
                email: 'metadata@example.com',
                metadata: { initial: true },
                livemode: true
            });

            const updated = await repository.updateMetadata(created.id, {
                updated: true,
                count: 42
            });

            expect(updated.metadata).toEqual({ updated: true, count: 42 });
        });
    });

    describe('count', () => {
        it('should count all customers', async () => {
            await repository.create({ externalId: 'count-1', email: 'a@test.com', livemode: true });
            await repository.create({ externalId: 'count-2', email: 'b@test.com', livemode: true });
            await repository.create({ externalId: 'count-3', email: 'c@test.com', livemode: false });

            const total = await repository.count();
            const live = await repository.count(true);
            const test = await repository.count(false);

            expect(total).toBe(3);
            expect(live).toBe(2);
            expect(test).toBe(1);
        });
    });

    describe('externalIdExists', () => {
        it('should check if external ID exists', async () => {
            await repository.create({
                externalId: 'exists-check',
                email: 'exists@example.com',
                livemode: true
            });

            expect(await repository.externalIdExists('exists-check', true)).toBe(true);
            expect(await repository.externalIdExists('exists-check', false)).toBe(false);
            expect(await repository.externalIdExists('not-exists', true)).toBe(false);
        });
    });
});
