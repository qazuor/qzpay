/**
 * Entitlements Repository Integration Tests
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayEntitlementsRepository } from '../src/repositories/entitlements.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayEntitlementsRepository', () => {
    let repository: QZPayEntitlementsRepository;
    let customersRepository: QZPayCustomersRepository;
    let testCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayEntitlementsRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
        // Create a test customer
        const customer = await customersRepository.create({
            externalId: 'test-customer',
            email: 'test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    // ==================== Entitlement Definitions ====================

    describe('createDefinition', () => {
        it('should create a new entitlement definition', async () => {
            const input = {
                id: crypto.randomUUID(),
                key: 'api_access',
                name: 'API Access',
                description: 'Access to the API'
            };

            const entitlement = await repository.createDefinition(input);

            expect(entitlement.id).toBe(input.id);
            expect(entitlement.key).toBe('api_access');
            expect(entitlement.name).toBe('API Access');
            expect(entitlement.description).toBe('Access to the API');
        });
    });

    describe('findDefinitionById', () => {
        it('should find entitlement definition by ID', async () => {
            const created = await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'premium_support',
                name: 'Premium Support'
            });

            const found = await repository.findDefinitionById(created.id);

            expect(found).not.toBeNull();
            expect(found?.key).toBe('premium_support');
        });

        it('should return null for non-existent ID', async () => {
            const found = await repository.findDefinitionById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findDefinitionByKey', () => {
        it('should find entitlement definition by key', async () => {
            await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'advanced_analytics',
                name: 'Advanced Analytics'
            });

            const found = await repository.findDefinitionByKey('advanced_analytics');

            expect(found).not.toBeNull();
            expect(found?.name).toBe('Advanced Analytics');
        });
    });

    describe('listDefinitions', () => {
        it('should list all entitlement definitions', async () => {
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'feature_a', name: 'Feature A' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'feature_b', name: 'Feature B' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'feature_c', name: 'Feature C' });

            const definitions = await repository.listDefinitions();

            expect(definitions).toHaveLength(3);
            // Should be ordered by key
            expect(definitions[0].key).toBe('feature_a');
            expect(definitions[1].key).toBe('feature_b');
            expect(definitions[2].key).toBe('feature_c');
        });
    });

    describe('updateDefinition', () => {
        it('should update entitlement definition', async () => {
            const created = await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'old_feature',
                name: 'Old Feature Name'
            });

            const updated = await repository.updateDefinition(created.id, {
                name: 'New Feature Name',
                description: 'Updated description'
            });

            expect(updated.name).toBe('New Feature Name');
            expect(updated.description).toBe('Updated description');
        });
    });

    describe('deleteDefinition', () => {
        it('should delete entitlement definition', async () => {
            const created = await repository.createDefinition({
                id: crypto.randomUUID(),
                key: 'to_delete',
                name: 'To Delete'
            });

            await repository.deleteDefinition(created.id);

            const found = await repository.findDefinitionById(created.id);
            expect(found).toBeNull();
        });

        it('should throw error when deleting non-existent definition', async () => {
            await expect(repository.deleteDefinition('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('searchDefinitions', () => {
        beforeEach(async () => {
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'search_a', name: 'Search A' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'search_b', name: 'Search B' });
            await repository.createDefinition({ id: crypto.randomUUID(), key: 'search_c', name: 'Search C' });
        });

        it('should search and paginate definitions', async () => {
            const page1 = await repository.searchDefinitions({ limit: 2, offset: 0 });
            const page2 = await repository.searchDefinitions({ limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page1.total).toBe(3);
            expect(page2.data).toHaveLength(1);
        });
    });

    // ==================== Customer Entitlements ====================

    describe('grant', () => {
        it('should grant entitlement to customer', async () => {
            const grant = await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'premium_feature',
                source: 'subscription',
                livemode: true
            });

            expect(grant.customerId).toBe(testCustomerId);
            expect(grant.entitlementKey).toBe('premium_feature');
            expect(grant.source).toBe('subscription');
        });

        it('should grant entitlement with expiration', async () => {
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

            const grant = await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'trial_feature',
                expiresAt,
                source: 'manual',
                livemode: true
            });

            expect(grant.expiresAt).toEqual(expiresAt);
        });

        it('should update expiration when granting existing entitlement with later expiration', async () => {
            const firstExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
            const secondExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature',
                expiresAt: firstExpiry,
                source: 'subscription',
                livemode: true
            });

            const updated = await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature',
                expiresAt: secondExpiry,
                source: 'manual',
                livemode: true
            });

            expect(updated.expiresAt).toEqual(secondExpiry);
            expect(updated.source).toBe('manual');
        });

        it('should keep existing entitlement when new grant has earlier expiration', async () => {
            const firstExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const secondExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

            const first = await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature',
                expiresAt: firstExpiry,
                source: 'subscription',
                livemode: true
            });

            const second = await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature',
                expiresAt: secondExpiry,
                source: 'manual',
                livemode: true
            });

            expect(second.id).toBe(first.id);
            expect(second.expiresAt).toEqual(firstExpiry);
        });
    });

    describe('revoke', () => {
        it('should revoke entitlement from customer', async () => {
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'to_revoke',
                source: 'manual',
                livemode: true
            });

            await repository.revoke(testCustomerId, 'to_revoke');

            const hasEntitlement = await repository.check(testCustomerId, 'to_revoke');
            expect(hasEntitlement).toBe(false);
        });
    });

    describe('revokeBySource', () => {
        it('should revoke all entitlements from a source', async () => {
            const sourceId = crypto.randomUUID();

            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature_1',
                source: 'subscription',
                sourceId,
                livemode: true
            });
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature_2',
                source: 'subscription',
                sourceId,
                livemode: true
            });

            const count = await repository.revokeBySource('subscription', sourceId);

            expect(count).toBe(2);

            const entitlements = await repository.findByCustomerId(testCustomerId);
            expect(entitlements).toHaveLength(0);
        });
    });

    describe('check', () => {
        it('should return true for active entitlement', async () => {
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'active_feature',
                source: 'manual',
                livemode: true
            });

            const hasEntitlement = await repository.check(testCustomerId, 'active_feature');

            expect(hasEntitlement).toBe(true);
        });

        it('should return false for non-existent entitlement', async () => {
            const hasEntitlement = await repository.check(testCustomerId, 'non_existent');

            expect(hasEntitlement).toBe(false);
        });

        it('should return false for expired entitlement', async () => {
            const expiredDate = new Date(Date.now() - 1000); // Already expired

            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'expired_feature',
                expiresAt: expiredDate,
                source: 'manual',
                livemode: true
            });

            const hasEntitlement = await repository.check(testCustomerId, 'expired_feature');

            expect(hasEntitlement).toBe(false);
        });
    });

    describe('findByCustomerId', () => {
        beforeEach(async () => {
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature_1',
                source: 'subscription',
                livemode: true
            });
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'feature_2',
                source: 'manual',
                livemode: true
            });
            // Expired entitlement
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'expired_feature',
                expiresAt: new Date(Date.now() - 1000),
                source: 'manual',
                livemode: true
            });
        });

        it('should find active entitlements for customer', async () => {
            const entitlements = await repository.findByCustomerId(testCustomerId);

            expect(entitlements).toHaveLength(2);
            expect(entitlements.map((e) => e.entitlementKey).sort()).toEqual(['feature_1', 'feature_2']);
        });

        it('should include expired entitlements when requested', async () => {
            const entitlements = await repository.findByCustomerId(testCustomerId, true);

            expect(entitlements).toHaveLength(3);
        });
    });

    describe('findCustomersByEntitlement', () => {
        it('should find all customers with specific entitlement', async () => {
            // Create another customer
            const customer2 = await customersRepository.create({
                externalId: 'customer-2',
                email: 'customer2@example.com',
                livemode: true
            });

            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'shared_feature',
                source: 'manual',
                livemode: true
            });
            await repository.grant({
                customerId: customer2.id,
                entitlementKey: 'shared_feature',
                source: 'manual',
                livemode: true
            });

            const customers = await repository.findCustomersByEntitlement('shared_feature');

            expect(customers).toHaveLength(2);
        });
    });

    describe('searchCustomerEntitlements', () => {
        beforeEach(async () => {
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'search_feature_1',
                source: 'subscription',
                livemode: true
            });
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'search_feature_2',
                source: 'manual',
                livemode: true
            });
        });

        it('should search by customer ID', async () => {
            const result = await repository.searchCustomerEntitlements({ customerId: testCustomerId });

            expect(result.data).toHaveLength(2);
        });

        it('should search by entitlement key', async () => {
            const result = await repository.searchCustomerEntitlements({ entitlementKey: 'search_feature_1' });

            expect(result.data).toHaveLength(1);
        });

        it('should search by source', async () => {
            const result = await repository.searchCustomerEntitlements({ source: 'subscription' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].source).toBe('subscription');
        });

        it('should paginate results', async () => {
            const page1 = await repository.searchCustomerEntitlements({ customerId: testCustomerId, limit: 1 });

            expect(page1.data).toHaveLength(1);
            expect(page1.total).toBe(2);
        });
    });

    describe('countCustomerEntitlements', () => {
        it('should count customer entitlements', async () => {
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'count_1',
                source: 'manual',
                livemode: true
            });
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'count_2',
                source: 'manual',
                livemode: true
            });

            const count = await repository.countCustomerEntitlements(testCustomerId);

            expect(count).toBe(2);
        });
    });

    describe('findExpiringSoon', () => {
        it('should find entitlements expiring within days', async () => {
            const expiringIn5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
            const expiringIn15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'expiring_soon',
                expiresAt: expiringIn5Days,
                source: 'manual',
                livemode: true
            });
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'not_expiring_soon',
                expiresAt: expiringIn15Days,
                source: 'manual',
                livemode: true
            });

            const expiringSoon = await repository.findExpiringSoon(7, true);

            expect(expiringSoon).toHaveLength(1);
            expect(expiringSoon[0].entitlementKey).toBe('expiring_soon');
        });
    });

    describe('deleteExpired', () => {
        it('should delete expired entitlements', async () => {
            const expiredDate = new Date(Date.now() - 1000);

            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'expired_1',
                expiresAt: expiredDate,
                source: 'manual',
                livemode: true
            });
            await repository.grant({
                customerId: testCustomerId,
                entitlementKey: 'not_expired',
                source: 'manual',
                livemode: true
            });

            const deletedCount = await repository.deleteExpired();

            expect(deletedCount).toBe(1);

            const remaining = await repository.findByCustomerId(testCustomerId, true);
            expect(remaining).toHaveLength(1);
            expect(remaining[0].entitlementKey).toBe('not_expired');
        });
    });
});
