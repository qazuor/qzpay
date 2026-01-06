/**
 * Entitlements Repository Integration Tests
 *
 * Tests the entitlements repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayEntitlementsRepository } from '../../src/repositories/entitlements.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

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
        // Create a test customer for entitlements
        const customer = await customersRepository.create({
            externalId: `test-customer-${randomUUID()}`,
            email: 'entitlements-test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    describe('Entitlement Definitions', () => {
        describe('createDefinition', () => {
            it('should create an entitlement definition', async () => {
                const entDefId = randomUUID();
                const input = {
                    id: entDefId,
                    key: 'api_access',
                    name: 'API Access',
                    description: 'Full API access'
                };

                const definition = await repository.createDefinition(input);

                expect(definition.id).toBe(entDefId);
                expect(definition.key).toBe('api_access');
                expect(definition.name).toBe('API Access');
                expect(definition.description).toBe('Full API access');
                expect(definition.createdAt).toBeInstanceOf(Date);
                expect(definition.updatedAt).toBeInstanceOf(Date);
            });

            it('should create definition with null description', async () => {
                const entDefId = randomUUID();
                const input = {
                    id: entDefId,
                    key: 'premium',
                    name: 'Premium Access',
                    description: null
                };

                const definition = await repository.createDefinition(input);

                expect(definition.description).toBeNull();
            });
        });

        describe('findDefinitionById', () => {
            it('should find definition by ID', async () => {
                const entFindId = randomUUID();
                const created = await repository.createDefinition({
                    id: entFindId,
                    key: 'feature_x',
                    name: 'Feature X',
                    description: null
                });

                const found = await repository.findDefinitionById(created.id);

                expect(found).not.toBeNull();
                expect(found?.id).toBe(entFindId);
                expect(found?.key).toBe('feature_x');
            });

            it('should return null for non-existent ID', async () => {
                const nonExistentId = randomUUID();
                const found = await repository.findDefinitionById(nonExistentId);
                expect(found).toBeNull();
            });
        });

        describe('findDefinitionByKey', () => {
            it('should find definition by key', async () => {
                const entKeyId = randomUUID();
                await repository.createDefinition({
                    id: entKeyId,
                    key: 'advanced_reports',
                    name: 'Advanced Reports',
                    description: 'Access to advanced reporting'
                });

                const found = await repository.findDefinitionByKey('advanced_reports');

                expect(found).not.toBeNull();
                expect(found?.key).toBe('advanced_reports');
                expect(found?.name).toBe('Advanced Reports');
            });

            it('should return null for non-existent key', async () => {
                const found = await repository.findDefinitionByKey('non_existent');
                expect(found).toBeNull();
            });
        });

        describe('listDefinitions', () => {
            it('should list all definitions', async () => {
                const entList1Id = randomUUID();
                const entList2Id = randomUUID();
                await repository.createDefinition({
                    id: entList1Id,
                    key: 'api_access',
                    name: 'API Access',
                    description: null
                });
                await repository.createDefinition({
                    id: entList2Id,
                    key: 'premium',
                    name: 'Premium',
                    description: null
                });

                const definitions = await repository.listDefinitions();

                expect(definitions.length).toBeGreaterThanOrEqual(2);
                expect(definitions.some((d) => d.key === 'api_access')).toBe(true);
                expect(definitions.some((d) => d.key === 'premium')).toBe(true);
            });

            it('should return empty array when no definitions', async () => {
                const definitions = await repository.listDefinitions();
                expect(definitions).toEqual([]);
            });
        });

        describe('updateDefinition', () => {
            it('should update definition fields', async () => {
                const entUpdateId = randomUUID();
                const created = await repository.createDefinition({
                    id: entUpdateId,
                    key: 'feature_y',
                    name: 'Original Name',
                    description: 'Original description'
                });

                const updated = await repository.updateDefinition(created.id, {
                    name: 'Updated Name',
                    description: 'Updated description'
                });

                expect(updated.name).toBe('Updated Name');
                expect(updated.description).toBe('Updated description');
                expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
            });

            it('should throw error when updating non-existent definition', async () => {
                const nonExistentId = randomUUID();
                await expect(repository.updateDefinition(nonExistentId, { name: 'Test' })).rejects.toThrow();
            });
        });

        describe('deleteDefinition', () => {
            it('should delete a definition', async () => {
                const entDeleteId = randomUUID();
                const created = await repository.createDefinition({
                    id: entDeleteId,
                    key: 'temp_feature',
                    name: 'Temporary',
                    description: null
                });

                await repository.deleteDefinition(created.id);

                const found = await repository.findDefinitionById(created.id);
                expect(found).toBeNull();
            });

            it('should throw error when deleting non-existent definition', async () => {
                const nonExistentId = randomUUID();
                await expect(repository.deleteDefinition(nonExistentId)).rejects.toThrow();
            });
        });

        describe('searchDefinitions', () => {
            it('should paginate definitions', async () => {
                const entS1Id = randomUUID();
                const entS2Id = randomUUID();
                const entS3Id = randomUUID();
                await repository.createDefinition({ id: entS1Id, key: 'ent1', name: 'First', description: null });
                await repository.createDefinition({ id: entS2Id, key: 'ent2', name: 'Second', description: null });
                await repository.createDefinition({ id: entS3Id, key: 'ent3', name: 'Third', description: null });

                const page1 = await repository.searchDefinitions({ limit: 2, offset: 0 });
                const page2 = await repository.searchDefinitions({ limit: 2, offset: 2 });

                expect(page1.data).toHaveLength(2);
                expect(page1.total).toBe(3);
                expect(page2.data).toHaveLength(1);
            });
        });
    });

    describe('Customer Entitlements', () => {
        describe('grant', () => {
            it('should grant an entitlement to customer', async () => {
                const sourceId = randomUUID();
                const grant = await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'premium',
                    source: 'subscription',
                    sourceId,
                    livemode: true
                });

                expect(grant.id).toBeDefined();
                expect(grant.customerId).toBe(testCustomerId);
                expect(grant.entitlementKey).toBe('premium');
                expect(grant.source).toBe('subscription');
                expect(grant.sourceId).toBe(sourceId);
                expect(grant.grantedAt).toBeInstanceOf(Date);
            });

            it('should grant with expiration date', async () => {
                const expiresAt = new Date('2024-12-31');

                const grant = await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'trial',
                    source: 'manual',
                    expiresAt,
                    livemode: true
                });

                expect(grant.expiresAt).toEqual(expiresAt);
            });

            it('should update expiration if re-granting with later date', async () => {
                const firstExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
                const laterExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
                const newSourceId = randomUUID();

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'premium',
                    source: 'subscription',
                    expiresAt: firstExpires,
                    livemode: true
                });

                const updated = await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'premium',
                    source: 'subscription',
                    sourceId: newSourceId,
                    expiresAt: laterExpires,
                    livemode: true
                });

                expect(updated.expiresAt).toEqual(laterExpires);
                expect(updated.sourceId).toBe(newSourceId);
            });

            it('should not update if re-granting with earlier date', async () => {
                const laterExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
                const earlierExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

                const first = await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'premium',
                    source: 'subscription',
                    expiresAt: laterExpires,
                    livemode: true
                });

                const second = await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'premium',
                    source: 'subscription',
                    expiresAt: earlierExpires,
                    livemode: true
                });

                expect(second.id).toBe(first.id);
                expect(second.expiresAt).toEqual(laterExpires);
            });
        });

        describe('revoke', () => {
            it('should revoke an entitlement', async () => {
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'premium',
                    source: 'manual',
                    livemode: true
                });

                await repository.revoke(testCustomerId, 'premium');

                const found = await repository.findActiveGrant(testCustomerId, 'premium');
                expect(found).toBeNull();
            });

            it('should not error when revoking non-existent entitlement', async () => {
                await expect(repository.revoke(testCustomerId, 'non_existent')).resolves.not.toThrow();
            });
        });

        describe('revokeBySource', () => {
            it('should revoke all entitlements from a source', async () => {
                const sourceId = randomUUID();

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'ent1',
                    source: 'subscription',
                    sourceId,
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'ent2',
                    source: 'subscription',
                    sourceId,
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'ent3',
                    source: 'manual',
                    sourceId: randomUUID(),
                    livemode: true
                });

                const revokedCount = await repository.revokeBySource('subscription', sourceId);

                expect(revokedCount).toBe(2);

                const remaining = await repository.findByCustomerId(testCustomerId);
                expect(remaining).toHaveLength(1);
                expect(remaining[0].entitlementKey).toBe('ent3');
            });

            it('should return 0 when no entitlements match source', async () => {
                const nonExistentSourceId = randomUUID();
                const count = await repository.revokeBySource('subscription', nonExistentSourceId);
                expect(count).toBe(0);
            });
        });

        describe('findActiveGrant', () => {
            it('should find active grant without expiration', async () => {
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'api_access',
                    source: 'subscription',
                    livemode: true
                });

                const grant = await repository.findActiveGrant(testCustomerId, 'api_access');

                expect(grant).not.toBeNull();
                expect(grant?.entitlementKey).toBe('api_access');
            });

            it('should find active grant with future expiration', async () => {
                const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'trial',
                    source: 'manual',
                    expiresAt: futureDate,
                    livemode: true
                });

                const grant = await repository.findActiveGrant(testCustomerId, 'trial');
                expect(grant).not.toBeNull();
            });

            it('should not find expired grant', async () => {
                const pastDate = new Date('2020-01-01');

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'expired',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });

                const grant = await repository.findActiveGrant(testCustomerId, 'expired');
                expect(grant).toBeNull();
            });
        });

        describe('check', () => {
            it('should return true for active entitlement', async () => {
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'feature_x',
                    source: 'subscription',
                    livemode: true
                });

                const hasIt = await repository.check(testCustomerId, 'feature_x');
                expect(hasIt).toBe(true);
            });

            it('should return false for non-existent entitlement', async () => {
                const hasIt = await repository.check(testCustomerId, 'non_existent');
                expect(hasIt).toBe(false);
            });

            it('should return false for expired entitlement', async () => {
                const pastDate = new Date('2020-01-01');

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'expired_feature',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });

                const hasIt = await repository.check(testCustomerId, 'expired_feature');
                expect(hasIt).toBe(false);
            });
        });

        describe('findByCustomerId', () => {
            it('should find all active entitlements for customer', async () => {
                const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'ent1',
                    source: 'subscription',
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'ent2',
                    source: 'manual',
                    expiresAt: futureDate,
                    livemode: true
                });

                const entitlements = await repository.findByCustomerId(testCustomerId);

                expect(entitlements).toHaveLength(2);
            });

            it('should exclude expired entitlements by default', async () => {
                const pastDate = new Date('2020-01-01');

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'active',
                    source: 'subscription',
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'expired',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });

                const entitlements = await repository.findByCustomerId(testCustomerId);

                expect(entitlements).toHaveLength(1);
                expect(entitlements[0].entitlementKey).toBe('active');
            });

            it('should include expired entitlements when requested', async () => {
                const pastDate = new Date('2020-01-01');

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'active',
                    source: 'subscription',
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'expired',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });

                const entitlements = await repository.findByCustomerId(testCustomerId, true);

                expect(entitlements).toHaveLength(2);
            });
        });

        describe('findCustomersByEntitlement', () => {
            it('should find all customers with specific entitlement', async () => {
                // Create actual customers first
                const cust1 = await customersRepository.create({
                    externalId: `find-ent-test-1-${randomUUID()}`,
                    email: 'find-ent-test-1@example.com',
                    livemode: true
                });
                const cust2 = await customersRepository.create({
                    externalId: `find-ent-test-2-${randomUUID()}`,
                    email: 'find-ent-test-2@example.com',
                    livemode: true
                });

                await repository.grant({
                    customerId: cust1.id,
                    entitlementKey: 'premium',
                    source: 'subscription',
                    livemode: true
                });
                await repository.grant({
                    customerId: cust2.id,
                    entitlementKey: 'premium',
                    source: 'subscription',
                    livemode: true
                });

                const customers = await repository.findCustomersByEntitlement('premium');

                expect(customers).toHaveLength(2);
                expect(customers.map((c) => c.customerId)).toContain(cust1.id);
                expect(customers.map((c) => c.customerId)).toContain(cust2.id);
            });
        });

        describe('countCustomerEntitlements', () => {
            it('should count active entitlements', async () => {
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'ent1', source: 'manual', livemode: true });
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'ent2', source: 'manual', livemode: true });

                const count = await repository.countCustomerEntitlements(testCustomerId);
                expect(count).toBe(2);
            });

            it('should exclude expired when counting by default', async () => {
                const pastDate = new Date('2020-01-01');

                await repository.grant({ customerId: testCustomerId, entitlementKey: 'active', source: 'manual', livemode: true });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'expired',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });

                const count = await repository.countCustomerEntitlements(testCustomerId);
                expect(count).toBe(1);
            });

            it('should include expired when requested', async () => {
                const pastDate = new Date('2020-01-01');

                await repository.grant({ customerId: testCustomerId, entitlementKey: 'active', source: 'manual', livemode: true });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'expired',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });

                const count = await repository.countCustomerEntitlements(testCustomerId, true);
                expect(count).toBe(2);
            });
        });

        describe('findExpiringSoon', () => {
            it('should find entitlements expiring within specified days', async () => {
                const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
                const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
                const in20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'exp5',
                    source: 'manual',
                    expiresAt: in5Days,
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'exp10',
                    source: 'manual',
                    expiresAt: in10Days,
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'exp20',
                    source: 'manual',
                    expiresAt: in20Days,
                    livemode: true
                });

                const expiring = await repository.findExpiringSoon(7, true);

                expect(expiring).toHaveLength(1);
                expect(expiring[0].entitlementKey).toBe('exp5');
            });

            it('should not include already expired entitlements', async () => {
                const pastDate = new Date('2020-01-01');

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'already_expired',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });

                const expiring = await repository.findExpiringSoon(30, true);

                expect(expiring).toHaveLength(0);
            });
        });

        describe('deleteExpired', () => {
            it('should delete expired entitlements', async () => {
                const pastDate = new Date('2020-01-01');
                const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'expired',
                    source: 'manual',
                    expiresAt: pastDate,
                    livemode: true
                });
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'active',
                    source: 'manual',
                    expiresAt: futureDate,
                    livemode: true
                });

                const deletedCount = await repository.deleteExpired();

                expect(deletedCount).toBe(1);

                const remaining = await repository.findByCustomerId(testCustomerId, true);
                expect(remaining).toHaveLength(1);
                expect(remaining[0].entitlementKey).toBe('active');
            });

            it('should return 0 when no expired entitlements', async () => {
                const count = await repository.deleteExpired();
                expect(count).toBe(0);
            });
        });

        describe('searchCustomerEntitlements', () => {
            it('should filter by customerId', async () => {
                // Create actual customers first
                const cust1 = await customersRepository.create({
                    externalId: `search-test-1-${randomUUID()}`,
                    email: 'search-test-1@example.com',
                    livemode: true
                });
                const cust2 = await customersRepository.create({
                    externalId: `search-test-2-${randomUUID()}`,
                    email: 'search-test-2@example.com',
                    livemode: true
                });

                await repository.grant({ customerId: cust1.id, entitlementKey: 'ent1', source: 'manual', livemode: true });
                await repository.grant({ customerId: cust2.id, entitlementKey: 'ent2', source: 'manual', livemode: true });

                const result = await repository.searchCustomerEntitlements({ customerId: cust1.id });

                expect(result.data).toHaveLength(1);
                expect(result.data[0].customerId).toBe(cust1.id);
            });

            it('should filter by source', async () => {
                await repository.grant({
                    customerId: testCustomerId,
                    entitlementKey: 'sub_ent',
                    source: 'subscription',
                    sourceId: randomUUID(),
                    livemode: true
                });
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'man_ent', source: 'manual', livemode: true });

                const result = await repository.searchCustomerEntitlements({ source: 'subscription' });

                expect(result.data).toHaveLength(1);
                expect(result.data[0].source).toBe('subscription');
            });

            it('should filter by livemode', async () => {
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'live', source: 'manual', livemode: true });
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'test', source: 'manual', livemode: false });

                const liveResult = await repository.searchCustomerEntitlements({ livemode: true });
                const testResult = await repository.searchCustomerEntitlements({ livemode: false });

                expect(liveResult.data).toHaveLength(1);
                expect(liveResult.data[0].livemode).toBe(true);
                expect(testResult.data).toHaveLength(1);
                expect(testResult.data[0].livemode).toBe(false);
            });

            it('should paginate results', async () => {
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'ent1', source: 'manual', livemode: true });
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'ent2', source: 'manual', livemode: true });
                await repository.grant({ customerId: testCustomerId, entitlementKey: 'ent3', source: 'manual', livemode: true });

                const page1 = await repository.searchCustomerEntitlements({ limit: 2, offset: 0 });
                const page2 = await repository.searchCustomerEntitlements({ limit: 2, offset: 2 });

                expect(page1.data).toHaveLength(2);
                expect(page1.total).toBe(3);
                expect(page2.data).toHaveLength(1);
            });
        });
    });
});
