/**
 * Addons Repository Integration Tests
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayAddonsRepository } from '../../src/repositories/addons.repository.js';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { QZPayPricesRepository } from '../../src/repositories/prices.repository.js';
import { QZPaySubscriptionsRepository } from '../../src/repositories/subscriptions.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('QZPayAddonsRepository', () => {
    let repository: QZPayAddonsRepository;
    let customersRepository: QZPayCustomersRepository;
    let plansRepository: QZPayPlansRepository;
    let pricesRepository: QZPayPricesRepository;
    let subscriptionsRepository: QZPaySubscriptionsRepository;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        repository = new QZPayAddonsRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
        plansRepository = new QZPayPlansRepository(db);
        pricesRepository = new QZPayPricesRepository(db);
        subscriptionsRepository = new QZPaySubscriptionsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('Addon Operations', () => {
        describe('create', () => {
            it('should create a new add-on', async () => {
                const addonId = randomUUID();
                const planId = randomUUID();

                const input = {
                    id: addonId,
                    name: 'Extra Storage',
                    description: '100GB storage',
                    active: true,
                    unitAmount: 500,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [planId],
                    allowMultiple: true,
                    maxQuantity: 10,
                    entitlements: ['extra_storage'],
                    limits: [],
                    metadata: {},
                    livemode: true
                };

                const addon = await repository.create(input);

                expect(addon.id).toBe(addonId);
                expect(addon.name).toBe('Extra Storage');
                expect(addon.unitAmount).toBe(500);
            });
        });

        describe('findById', () => {
            it('should find addon by ID', async () => {
                const addonId = randomUUID();

                const created = await repository.create({
                    id: addonId,
                    name: 'Test',
                    description: null,
                    active: true,
                    unitAmount: 100,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: false,
                    maxQuantity: null,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                const found = await repository.findById(created.id);

                expect(found).not.toBeNull();
                expect(found?.id).toBe(addonId);
            });
        });

        describe('findActive', () => {
            it('should find only active addons', async () => {
                const activeAddonId = randomUUID();
                const inactiveAddonId = randomUUID();

                await repository.create({
                    id: activeAddonId,
                    name: 'Active',
                    description: null,
                    active: true,
                    unitAmount: 100,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: false,
                    maxQuantity: null,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });
                await repository.create({
                    id: inactiveAddonId,
                    name: 'Inactive',
                    description: null,
                    active: false,
                    unitAmount: 100,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: false,
                    maxQuantity: null,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                const active = await repository.findActive(true);

                expect(active.some((a) => a.id === activeAddonId)).toBe(true);
                expect(active.some((a) => a.id === inactiveAddonId)).toBe(false);
            });
        });

        describe('update', () => {
            it('should update addon fields', async () => {
                const addonId = randomUUID();

                const created = await repository.create({
                    id: addonId,
                    name: 'Original',
                    description: null,
                    active: true,
                    unitAmount: 100,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: false,
                    maxQuantity: null,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                const updated = await repository.update(created.id, {
                    name: 'Updated',
                    unitAmount: 200
                });

                expect(updated.name).toBe('Updated');
                expect(updated.unitAmount).toBe(200);
            });
        });

        describe('softDelete', () => {
            it('should soft delete addon', async () => {
                const addonId = randomUUID();

                const created = await repository.create({
                    id: addonId,
                    name: 'Delete Me',
                    description: null,
                    active: true,
                    unitAmount: 100,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: false,
                    maxQuantity: null,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                await repository.softDelete(created.id);

                const found = await repository.findById(created.id);
                expect(found).toBeNull();
            });
        });

        describe('activate / deactivate', () => {
            it('should activate addon', async () => {
                const addonId = randomUUID();

                const created = await repository.create({
                    id: addonId,
                    name: 'Test',
                    description: null,
                    active: false,
                    unitAmount: 100,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: false,
                    maxQuantity: null,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                const activated = await repository.activate(created.id);

                expect(activated.active).toBe(true);
            });
        });
    });

    describe('Subscription Addon Operations', () => {
        let testSubscriptionId: string;
        let testAddonId: string;

        beforeEach(async () => {
            // Create customer
            const customer = await customersRepository.create({
                externalId: `addon-test-${randomUUID()}`,
                email: 'addon-test@example.com',
                livemode: true
            });

            // Create plan
            const plan = await plansRepository.create({
                id: randomUUID(),
                name: 'Test Plan',
                active: true,
                livemode: true
            });

            // Create price
            const price = await pricesRepository.create({
                id: randomUUID(),
                planId: plan.id,
                unitAmount: 1999,
                currency: 'usd',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode: true
            });

            // Create subscription
            const subscription = await subscriptionsRepository.create({
                id: randomUUID(),
                customerId: customer.id,
                planId: plan.id,
                priceId: price.id,
                status: 'active',
                billingInterval: 'month',
                intervalCount: 1,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                livemode: true
            });
            testSubscriptionId = subscription.id;

            // Create addon
            const addon = await repository.create({
                id: randomUUID(),
                name: 'Test Addon',
                description: 'Test',
                active: true,
                unitAmount: 500,
                currency: 'usd',
                billingInterval: 'month',
                billingIntervalCount: 1,
                compatiblePlanIds: [plan.id],
                allowMultiple: true,
                maxQuantity: 10,
                entitlements: [],
                limits: [],
                metadata: {},
                livemode: true
            });
            testAddonId = addon.id;
        });

        describe('addToSubscription', () => {
            it('should add addon to subscription', async () => {
                const subAddonId = randomUUID();

                const input = {
                    id: subAddonId,
                    subscriptionId: testSubscriptionId,
                    addOnId: testAddonId,
                    quantity: 2,
                    unitAmount: 500,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                };

                const subAddon = await repository.addToSubscription(input);

                expect(subAddon.subscriptionId).toBe(testSubscriptionId);
                expect(subAddon.addOnId).toBe(testAddonId);
                expect(subAddon.quantity).toBe(2);
            });
        });

        describe('findBySubscriptionId', () => {
            it('should find all addons for subscription', async () => {
                // Create second addon
                const addon2 = await repository.create({
                    id: randomUUID(),
                    name: 'Addon 2',
                    description: null,
                    active: true,
                    unitAmount: 1000,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: true,
                    maxQuantity: 10,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                await repository.addToSubscription({
                    id: randomUUID(),
                    subscriptionId: testSubscriptionId,
                    addOnId: testAddonId,
                    quantity: 1,
                    unitAmount: 500,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                });
                await repository.addToSubscription({
                    id: randomUUID(),
                    subscriptionId: testSubscriptionId,
                    addOnId: addon2.id,
                    quantity: 1,
                    unitAmount: 1000,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                });

                const addons = await repository.findBySubscriptionId(testSubscriptionId);

                expect(addons).toHaveLength(2);
            });
        });

        describe('findActiveBySubscriptionId', () => {
            it('should find only active addons', async () => {
                const subAddonActiveId = randomUUID();
                const subAddonCanceledId = randomUUID();

                // Create addon 1
                const addon1 = await repository.create({
                    id: randomUUID(),
                    name: 'Addon 1 for Active Test',
                    description: null,
                    active: true,
                    unitAmount: 500,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: true,
                    maxQuantity: 10,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                // Create addon 2
                const addon2 = await repository.create({
                    id: randomUUID(),
                    name: 'Addon 2 for Active Test',
                    description: null,
                    active: true,
                    unitAmount: 500,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: true,
                    maxQuantity: 10,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                await repository.addToSubscription({
                    id: subAddonActiveId,
                    subscriptionId: testSubscriptionId,
                    addOnId: addon1.id,
                    quantity: 1,
                    unitAmount: 500,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                });
                await repository.addToSubscription({
                    id: subAddonCanceledId,
                    subscriptionId: testSubscriptionId,
                    addOnId: addon2.id,
                    quantity: 1,
                    unitAmount: 500,
                    currency: 'usd',
                    status: 'canceled',
                    metadata: {}
                });

                const active = await repository.findActiveBySubscriptionId(testSubscriptionId);

                expect(active).toHaveLength(1);
                expect(active[0].status).toBe('active');
            });
        });

        describe('updateSubscriptionAddon', () => {
            it('should update subscription addon quantity', async () => {
                const subAddonId = randomUUID();

                await repository.addToSubscription({
                    id: subAddonId,
                    subscriptionId: testSubscriptionId,
                    addOnId: testAddonId,
                    quantity: 1,
                    unitAmount: 500,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                });

                const updated = await repository.updateSubscriptionAddon(testSubscriptionId, testAddonId, {
                    quantity: 5
                });

                expect(updated.quantity).toBe(5);
            });
        });

        describe('removeFromSubscription', () => {
            it('should cancel subscription addon', async () => {
                const subAddonId = randomUUID();

                await repository.addToSubscription({
                    id: subAddonId,
                    subscriptionId: testSubscriptionId,
                    addOnId: testAddonId,
                    quantity: 1,
                    unitAmount: 500,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                });

                await repository.removeFromSubscription(testSubscriptionId, testAddonId);

                const found = await repository.findSubscriptionAddon(testSubscriptionId, testAddonId);
                expect(found).toBeNull();
            });
        });

        describe('calculateTotalAmount', () => {
            it('should calculate total addon amount', async () => {
                const subAddonId1 = randomUUID();
                const subAddonId2 = randomUUID();

                // Create addon 1
                const addon1 = await repository.create({
                    id: randomUUID(),
                    name: 'Addon 1 for Calc Test',
                    description: null,
                    active: true,
                    unitAmount: 500,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: true,
                    maxQuantity: 10,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                // Create addon 2
                const addon2 = await repository.create({
                    id: randomUUID(),
                    name: 'Addon 2 for Calc Test',
                    description: null,
                    active: true,
                    unitAmount: 1000,
                    currency: 'usd',
                    billingInterval: 'month',
                    billingIntervalCount: 1,
                    compatiblePlanIds: [],
                    allowMultiple: true,
                    maxQuantity: 10,
                    entitlements: [],
                    limits: [],
                    metadata: {},
                    livemode: true
                });

                await repository.addToSubscription({
                    id: subAddonId1,
                    subscriptionId: testSubscriptionId,
                    addOnId: addon1.id,
                    quantity: 2,
                    unitAmount: 500,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                });
                await repository.addToSubscription({
                    id: subAddonId2,
                    subscriptionId: testSubscriptionId,
                    addOnId: addon2.id,
                    quantity: 1,
                    unitAmount: 1000,
                    currency: 'usd',
                    status: 'active',
                    metadata: {}
                });

                const total = await repository.calculateTotalAmount(testSubscriptionId);

                expect(total.amount).toBe(2000); // (2 * 500) + (1 * 1000)
                expect(total.currency).toBe('usd');
            });

            it('should return 0 when no addons', async () => {
                const nonExistentId = randomUUID();
                const total = await repository.calculateTotalAmount(nonExistentId);

                expect(total.amount).toBe(0);
            });
        });
    });
});
