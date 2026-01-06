/**
 * Audit Logs Repository Integration Tests
 *
 * Tests the audit logs repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayAuditLogsRepository } from '../src/repositories/audit-logs.repository.js';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayAuditLogsRepository', () => {
    let repository: QZPayAuditLogsRepository;
    let customersRepository: QZPayCustomersRepository;
    let testCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayAuditLogsRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
        const customer = await customersRepository.create({
            externalId: 'ext-audit-customer',
            email: 'audit-test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    describe('create', () => {
        it('should create an audit log entry', async () => {
            const log = await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                actorId: 'user_123',
                changes: { email: 'audit-test@example.com' },
                livemode: true
            });

            expect(log.id).toBeDefined();
            expect(log.entityType).toBe('customer');
            expect(log.entityId).toBe(testCustomerId);
            expect(log.action).toBe('create');
            expect(log.actorType).toBe('user');
            expect(log.actorId).toBe('user_123');
        });

        it('should create audit log with IP and user agent', async () => {
            const log = await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'api',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                livemode: true
            });

            expect(log.ipAddress).toBe('192.168.1.1');
            expect(log.userAgent).toBe('Mozilla/5.0');
        });
    });

    describe('createMany', () => {
        it('should create multiple audit log entries', async () => {
            const logs = await repository.createMany([
                {
                    entityType: 'customer',
                    entityId: testCustomerId,
                    action: 'create',
                    actorType: 'system',
                    livemode: true
                },
                {
                    entityType: 'customer',
                    entityId: testCustomerId,
                    action: 'update',
                    actorType: 'system',
                    livemode: true
                }
            ]);

            expect(logs).toHaveLength(2);
        });

        it('should return empty array for empty input', async () => {
            const logs = await repository.createMany([]);
            expect(logs).toHaveLength(0);
        });
    });

    describe('findById', () => {
        it('should find audit log by ID', async () => {
            const created = await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
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
    });

    describe('findByEntity', () => {
        it('should find audit logs for an entity', async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                livemode: true
            });
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'user',
                livemode: true
            });

            const result = await repository.findByEntity('customer', testCustomerId);

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should paginate results', async () => {
            for (let i = 0; i < 5; i++) {
                await repository.create({
                    entityType: 'customer',
                    entityId: testCustomerId,
                    action: `action_${i}`,
                    actorType: 'system',
                    livemode: true
                });
            }

            const page1 = await repository.findByEntity('customer', testCustomerId, { limit: 2, offset: 0 });
            const page2 = await repository.findByEntity('customer', testCustomerId, { limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page2.data).toHaveLength(2);
            expect(page1.total).toBe(5);
        });
    });

    describe('findByActor', () => {
        it('should find audit logs by actor', async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                actorId: 'specific_user',
                livemode: true
            });
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'user',
                actorId: 'specific_user',
                livemode: true
            });

            const result = await repository.findByActor('user', 'specific_user');

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should filter by date range', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'admin',
                actorId: 'admin_1',
                livemode: true
            });

            const result = await repository.findByActor('admin', 'admin_1', {
                startDate: yesterday,
                endDate: tomorrow
            });

            expect(result.data).toHaveLength(1);
        });
    });

    describe('findByAction', () => {
        it('should find audit logs by action', async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'delete',
                actorType: 'admin',
                livemode: true
            });

            const result = await repository.findByAction('delete');

            expect(result.data).toHaveLength(1);
            expect(result.data[0].action).toBe('delete');
        });

        it('should filter by entity type', async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'user',
                livemode: true
            });
            await repository.create({
                entityType: 'subscription',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'user',
                livemode: true
            });

            const result = await repository.findByAction('update', { entityType: 'customer' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].entityType).toBe('customer');
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                actorId: 'user_1',
                livemode: true
            });
            await repository.create({
                entityType: 'subscription',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'system',
                livemode: true
            });
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'delete',
                actorType: 'admin',
                actorId: 'admin_1',
                livemode: false
            });
        });

        it('should search by entity type', async () => {
            const result = await repository.search({ entityType: 'customer' });
            expect(result.data).toHaveLength(2);
        });

        it('should search by action', async () => {
            const result = await repository.search({ action: 'create' });
            expect(result.data).toHaveLength(1);
        });

        it('should search by actor type', async () => {
            const result = await repository.search({ actorType: 'system' });
            expect(result.data).toHaveLength(1);
        });

        it('should search by livemode', async () => {
            const liveResult = await repository.search({ livemode: true });
            const testResult = await repository.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should combine multiple filters', async () => {
            const result = await repository.search({
                entityType: 'customer',
                actorType: 'user',
                livemode: true
            });

            expect(result.data).toHaveLength(1);
        });
    });

    describe('getActivitySummary', () => {
        it('should get activity summary for entity', async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'user',
                livemode: true
            });
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'update',
                actorType: 'user',
                livemode: true
            });
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'view',
                actorType: 'user',
                livemode: true
            });

            const summary = await repository.getActivitySummary('customer', testCustomerId);

            expect(summary).toHaveLength(2);
            const updateSummary = summary.find((s) => s.action === 'update');
            expect(updateSummary?.count).toBe(2);
        });
    });

    describe('getRecentActivity', () => {
        it('should get recent activity', async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                livemode: true
            });

            const recent = await repository.getRecentActivity({ limit: 10 });

            expect(recent.length).toBeGreaterThanOrEqual(1);
        });

        it('should filter by entity type', async () => {
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                livemode: true
            });
            await repository.create({
                entityType: 'subscription',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                livemode: true
            });

            const recent = await repository.getRecentActivity({ entityType: 'customer' });

            expect(recent.every((r) => r.entityType === 'customer')).toBe(true);
        });
    });

    describe('getActionCounts', () => {
        it('should get action counts for period', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                livemode: true
            });
            await repository.create({
                entityType: 'customer',
                entityId: testCustomerId,
                action: 'create',
                actorType: 'user',
                livemode: true
            });

            const counts = await repository.getActionCounts(yesterday, tomorrow, true);

            expect(counts.length).toBeGreaterThanOrEqual(1);
            const createCount = counts.find((c) => c.action === 'create' && c.entityType === 'customer');
            expect(createCount?.count).toBe(2);
        });
    });

    describe('logCreate', () => {
        it('should log a create action', async () => {
            const log = await repository.logCreate({
                entityType: 'customer',
                entityId: testCustomerId,
                actorType: 'user',
                actorId: 'user_123',
                changes: { email: 'new@example.com' }
            });

            expect(log.action).toBe('create');
            expect(log.changes).toEqual({ email: 'new@example.com' });
        });
    });

    describe('logUpdate', () => {
        it('should log an update action with previous values', async () => {
            const log = await repository.logUpdate({
                entityType: 'customer',
                entityId: testCustomerId,
                actorType: 'user',
                actorId: 'user_123',
                changes: { email: 'new@example.com' },
                previousValues: { email: 'old@example.com' }
            });

            expect(log.action).toBe('update');
            expect(log.changes).toEqual({ email: 'new@example.com' });
            expect(log.previousValues).toEqual({ email: 'old@example.com' });
        });
    });

    describe('logDelete', () => {
        it('should log a delete action', async () => {
            const log = await repository.logDelete({
                entityType: 'customer',
                entityId: testCustomerId,
                actorType: 'admin',
                actorId: 'admin_1',
                previousValues: { email: 'deleted@example.com' }
            });

            expect(log.action).toBe('delete');
            expect(log.previousValues).toEqual({ email: 'deleted@example.com' });
        });
    });

    describe('logAction', () => {
        it('should log a custom action', async () => {
            const log = await repository.logAction({
                entityType: 'subscription',
                entityId: testCustomerId,
                action: 'pause',
                actorType: 'user',
                actorId: 'user_123',
                changes: { status: 'paused' }
            });

            expect(log.action).toBe('pause');
            expect(log.entityType).toBe('subscription');
        });
    });
});
