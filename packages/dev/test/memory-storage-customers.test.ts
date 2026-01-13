/**
 * Memory Storage Adapter Tests - Customers
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStorageAdapter } from '../src/adapters/memory-storage.adapter.js';

describe('adapter.customers', () => {
    let adapter: ReturnType<typeof createMemoryStorageAdapter>['adapter'];
    let _reset: ReturnType<typeof createMemoryStorageAdapter>['reset'];

    beforeEach(() => {
        const storage = createMemoryStorageAdapter();
        adapter = storage.adapter;
        _reset = storage.reset;
    });

    describe('create', () => {
        it('should create a customer with required fields', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            expect(customer.id).toMatch(/^mock_cus_\d+$/);
            expect(customer.externalId).toBe('user_123');
            expect(customer.email).toBe('test@example.com');
            expect(customer.name).toBeNull();
            expect(customer.phone).toBeNull();
            expect(customer.providerCustomerIds).toEqual({});
            expect(customer.metadata).toEqual({});
            expect(customer.livemode).toBe(false);
            expect(customer.createdAt).toBeInstanceOf(Date);
            expect(customer.updatedAt).toBeInstanceOf(Date);
            expect(customer.deletedAt).toBeNull();
        });

        it('should create a customer with optional fields', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com',
                name: 'Test User',
                phone: '+1-555-0123',
                metadata: { company: 'Acme Corp' }
            });

            expect(customer.name).toBe('Test User');
            expect(customer.phone).toBe('+1-555-0123');
            expect(customer.metadata).toEqual({ company: 'Acme Corp' });
        });

        it('should generate unique IDs', async () => {
            const customer1 = await adapter.customers.create({
                externalId: 'user_1',
                email: 'user1@example.com'
            });

            const customer2 = await adapter.customers.create({
                externalId: 'user_2',
                email: 'user2@example.com'
            });

            expect(customer1.id).not.toBe(customer2.id);
        });

        it('should set timestamps correctly', async () => {
            const before = new Date();
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });
            const after = new Date();

            expect(customer.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(customer.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
            expect(customer.updatedAt).toEqual(customer.createdAt);
        });
    });

    describe('update', () => {
        it('should update customer email', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'old@example.com'
            });

            const updated = await adapter.customers.update(customer.id, {
                email: 'new@example.com'
            });

            expect(updated.email).toBe('new@example.com');
        });

        it('should update customer name', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const updated = await adapter.customers.update(customer.id, {
                name: 'Updated Name'
            });

            expect(updated.name).toBe('Updated Name');
        });

        it('should update customer phone', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const updated = await adapter.customers.update(customer.id, {
                phone: '+1-555-9999'
            });

            expect(updated.phone).toBe('+1-555-9999');
        });

        it('should update customer metadata', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com',
                metadata: { key: 'old' }
            });

            const updated = await adapter.customers.update(customer.id, {
                metadata: { key: 'new', extra: 'data' }
            });

            expect(updated.metadata).toEqual({ key: 'new', extra: 'data' });
        });

        it('should update updatedAt timestamp', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const originalUpdatedAt = customer.updatedAt;

            // Wait a bit to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 10));

            const updated = await adapter.customers.update(customer.id, {
                name: 'New Name'
            });

            expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        });

        it('should preserve createdAt', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const updated = await adapter.customers.update(customer.id, {
                name: 'New Name'
            });

            expect(updated.createdAt).toEqual(customer.createdAt);
        });

        it('should throw error for non-existent customer', async () => {
            await expect(
                adapter.customers.update('nonexistent', {
                    email: 'test@example.com'
                })
            ).rejects.toThrow('Customer nonexistent not found');
        });
    });

    describe('delete', () => {
        it('should delete a customer', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            await adapter.customers.delete(customer.id);

            const result = await adapter.customers.findById(customer.id);
            expect(result).toBeNull();
        });

        it('should not throw error when deleting non-existent customer', async () => {
            await expect(adapter.customers.delete('nonexistent')).resolves.toBeUndefined();
        });
    });

    describe('findById', () => {
        it('should find an existing customer', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            const found = await adapter.customers.findById(customer.id);

            expect(found).toEqual(customer);
        });

        it('should return null for non-existent customer', async () => {
            const result = await adapter.customers.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('findByExternalId', () => {
        it('should find customer by external ID', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const found = await adapter.customers.findByExternalId('user_123');

            expect(found).toEqual(customer);
        });

        it('should return null for non-existent external ID', async () => {
            const result = await adapter.customers.findByExternalId('nonexistent');

            expect(result).toBeNull();
        });

        it('should find first matching customer when multiple exist', async () => {
            const customer1 = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test1@example.com'
            });

            await adapter.customers.create({
                externalId: 'user_456',
                email: 'test2@example.com'
            });

            const found = await adapter.customers.findByExternalId('user_123');

            expect(found?.id).toBe(customer1.id);
        });
    });

    describe('findByEmail', () => {
        it('should find customer by email', async () => {
            const customer = await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const found = await adapter.customers.findByEmail('test@example.com');

            expect(found).toEqual(customer);
        });

        it('should return null for non-existent email', async () => {
            const result = await adapter.customers.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });

        it('should be case-sensitive', async () => {
            await adapter.customers.create({
                externalId: 'user_123',
                email: 'test@example.com'
            });

            const found = await adapter.customers.findByEmail('TEST@EXAMPLE.COM');

            expect(found).toBeNull();
        });
    });

    describe('list', () => {
        it('should list all customers', async () => {
            await adapter.customers.create({
                externalId: 'user_1',
                email: 'test1@example.com'
            });

            await adapter.customers.create({
                externalId: 'user_2',
                email: 'test2@example.com'
            });

            const result = await adapter.customers.list();

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.hasMore).toBe(false);
        });

        it('should paginate results', async () => {
            for (let i = 0; i < 10; i++) {
                await adapter.customers.create({
                    externalId: `user_${i}`,
                    email: `test${i}@example.com`
                });
            }

            const page1 = await adapter.customers.list({ limit: 5, offset: 0 });
            expect(page1.data).toHaveLength(5);
            expect(page1.total).toBe(10);
            expect(page1.hasMore).toBe(true);
            expect(page1.offset).toBe(0);

            const page2 = await adapter.customers.list({ limit: 5, offset: 5 });
            expect(page2.data).toHaveLength(5);
            expect(page2.total).toBe(10);
            expect(page2.hasMore).toBe(false);
            expect(page2.offset).toBe(5);
        });

        it('should use default limit of 100', async () => {
            for (let i = 0; i < 150; i++) {
                await adapter.customers.create({
                    externalId: `user_${i}`,
                    email: `test${i}@example.com`
                });
            }

            const result = await adapter.customers.list();

            expect(result.data).toHaveLength(100);
            expect(result.total).toBe(150);
            expect(result.limit).toBe(100);
            expect(result.hasMore).toBe(true);
        });

        it('should handle empty results', async () => {
            const result = await adapter.customers.list();

            expect(result.data).toHaveLength(0);
            expect(result.total).toBe(0);
            expect(result.hasMore).toBe(false);
        });
    });
});
