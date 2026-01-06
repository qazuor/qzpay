/**
 * Add-on Mapper Unit Tests
 *
 * Tests the add-on type mappers that convert between Drizzle and Core types.
 */
import { describe, expect, it } from 'vitest';
import {
    mapCoreAddonCreateToDrizzle,
    mapCoreAddonUpdateToDrizzle,
    mapCoreSubscriptionAddonCreateToDrizzle,
    mapCoreSubscriptionAddonUpdateToDrizzle,
    mapDrizzleAddonToCore,
    mapDrizzleSubscriptionAddonToCore
} from '../../src/mappers/addon.mapper.js';
import type { QZPayBillingAddon, QZPayBillingSubscriptionAddon } from '../../src/schema/index.js';

describe('Add-on Mapper', () => {
    describe('mapDrizzleAddonToCore', () => {
        it('should map add-on with all fields', () => {
            const now = new Date();

            const drizzle: QZPayBillingAddon = {
                id: 'addon-123',
                name: 'Extra Storage',
                description: '100GB additional storage',
                active: true,
                unitAmount: 500,
                currency: 'usd',
                billingInterval: 'month',
                billingIntervalCount: 1,
                compatiblePlanIds: ['plan-1', 'plan-2'],
                allowMultiple: true,
                maxQuantity: 10,
                entitlements: ['extra_storage'],
                limits: [{ key: 'storage_gb', value: 100, action: 'increment' }],
                metadata: { tier: 'premium' },
                livemode: true,
                createdAt: now,
                updatedAt: now,
                deletedAt: null
            };

            const core = mapDrizzleAddonToCore(drizzle);

            expect(core.id).toBe('addon-123');
            expect(core.name).toBe('Extra Storage');
            expect(core.description).toBe('100GB additional storage');
            expect(core.active).toBe(true);
            expect(core.unitAmount).toBe(500);
            expect(core.currency).toBe('usd');
            expect(core.billingInterval).toBe('month');
            expect(core.billingIntervalCount).toBe(1);
            expect(core.compatiblePlanIds).toEqual(['plan-1', 'plan-2']);
            expect(core.allowMultiple).toBe(true);
            expect(core.maxQuantity).toBe(10);
            expect(core.entitlements).toEqual(['extra_storage']);
            expect(core.limits).toEqual([{ key: 'storage_gb', value: 100, action: 'increment' }]);
            expect(core.metadata).toEqual({ tier: 'premium' });
        });

        it('should handle null optional fields', () => {
            const drizzle: QZPayBillingAddon = {
                id: 'addon-456',
                name: 'One-time Feature',
                description: null,
                active: false,
                unitAmount: 2000,
                currency: 'eur',
                billingInterval: 'one_time',
                billingIntervalCount: 1,
                compatiblePlanIds: null,
                allowMultiple: false,
                maxQuantity: null,
                entitlements: null,
                limits: null,
                metadata: null,
                livemode: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleAddonToCore(drizzle);

            expect(core.description).toBeNull();
            expect(core.compatiblePlanIds).toEqual([]);
            expect(core.maxQuantity).toBeNull();
            expect(core.entitlements).toEqual([]);
            expect(core.limits).toEqual([]);
            expect(core.metadata).toEqual({});
        });

        it('should map yearly billing interval', () => {
            const drizzle: QZPayBillingAddon = {
                id: 'addon-789',
                name: 'Annual Support',
                description: null,
                active: true,
                unitAmount: 12000,
                currency: 'usd',
                billingInterval: 'year',
                billingIntervalCount: 1,
                compatiblePlanIds: [],
                allowMultiple: false,
                maxQuantity: null,
                entitlements: [],
                limits: [],
                metadata: {},
                livemode: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleAddonToCore(drizzle);

            expect(core.billingInterval).toBe('year');
        });
    });

    describe('mapCoreAddonCreateToDrizzle', () => {
        it('should map create input with all fields', () => {
            const input = {
                id: 'new-addon-1',
                name: 'Priority Support',
                description: '24/7 priority support',
                unitAmount: 3000,
                currency: 'usd',
                billingInterval: 'month' as const,
                billingIntervalCount: 1,
                compatiblePlanIds: ['plan-pro'],
                allowMultiple: false,
                maxQuantity: 1,
                entitlements: ['priority_support'],
                limits: [{ key: 'support_tickets', value: 100, action: 'set' as const }],
                metadata: { level: 'premium' }
            };

            const drizzle = mapCoreAddonCreateToDrizzle(input, true);

            expect(drizzle.id).toBe('new-addon-1');
            expect(drizzle.name).toBe('Priority Support');
            expect(drizzle.description).toBe('24/7 priority support');
            expect(drizzle.active).toBe(true);
            expect(drizzle.unitAmount).toBe(3000);
            expect(drizzle.currency).toBe('usd');
            expect(drizzle.billingInterval).toBe('month');
            expect(drizzle.billingIntervalCount).toBe(1);
            expect(drizzle.compatiblePlanIds).toEqual(['plan-pro']);
            expect(drizzle.allowMultiple).toBe(false);
            expect(drizzle.maxQuantity).toBe(1);
            expect(drizzle.entitlements).toEqual(['priority_support']);
            expect(drizzle.limits).toEqual([{ key: 'support_tickets', value: 100, action: 'set' }]);
            expect(drizzle.livemode).toBe(true);
        });

        it('should handle minimal input with defaults', () => {
            const input = {
                id: 'new-addon-2',
                name: 'Basic Feature',
                unitAmount: 100,
                currency: 'usd',
                billingInterval: 'month' as const
            };

            const drizzle = mapCoreAddonCreateToDrizzle(input, false);

            expect(drizzle.description).toBeNull();
            expect(drizzle.billingIntervalCount).toBe(1);
            expect(drizzle.compatiblePlanIds).toEqual([]);
            expect(drizzle.allowMultiple).toBe(false);
            expect(drizzle.maxQuantity).toBeNull();
            expect(drizzle.entitlements).toEqual([]);
            expect(drizzle.limits).toEqual([]);
            expect(drizzle.metadata).toEqual({});
            expect(drizzle.livemode).toBe(false);
        });

        it('should map one-time billing interval', () => {
            const input = {
                id: 'new-addon-3',
                name: 'One-time Setup',
                unitAmount: 5000,
                currency: 'usd',
                billingInterval: 'one_time' as const
            };

            const drizzle = mapCoreAddonCreateToDrizzle(input, true);

            expect(drizzle.billingInterval).toBe('one_time');
        });
    });

    describe('mapCoreAddonUpdateToDrizzle', () => {
        it('should map all update fields', () => {
            const update = {
                name: 'Updated Name',
                description: 'Updated description',
                unitAmount: 1000,
                active: false,
                compatiblePlanIds: ['plan-1', 'plan-2', 'plan-3'],
                allowMultiple: true,
                maxQuantity: 5,
                entitlements: ['ent1', 'ent2'],
                limits: [{ key: 'limit1', value: 50, action: 'increment' as const }],
                metadata: { updated: true }
            };

            const drizzle = mapCoreAddonUpdateToDrizzle(update);

            expect(drizzle.name).toBe('Updated Name');
            expect(drizzle.description).toBe('Updated description');
            expect(drizzle.unitAmount).toBe(1000);
            expect(drizzle.active).toBe(false);
            expect(drizzle.compatiblePlanIds).toEqual(['plan-1', 'plan-2', 'plan-3']);
            expect(drizzle.allowMultiple).toBe(true);
            expect(drizzle.maxQuantity).toBe(5);
            expect(drizzle.entitlements).toEqual(['ent1', 'ent2']);
            expect(drizzle.limits).toEqual([{ key: 'limit1', value: 50, action: 'increment' }]);
            expect(drizzle.metadata).toEqual({ updated: true });
        });

        it('should handle partial updates', () => {
            const update = {
                active: false,
                unitAmount: 2500
            };

            const drizzle = mapCoreAddonUpdateToDrizzle(update);

            expect(drizzle.active).toBe(false);
            expect(drizzle.unitAmount).toBe(2500);
            expect(drizzle.name).toBeUndefined();
            expect(drizzle.description).toBeUndefined();
        });

        it('should return empty object for no updates', () => {
            const drizzle = mapCoreAddonUpdateToDrizzle({});

            expect(drizzle).toEqual({});
        });
    });

    describe('mapDrizzleSubscriptionAddonToCore', () => {
        it('should map subscription add-on with all fields', () => {
            const now = new Date();
            const added = new Date('2024-01-01');
            const expires = new Date('2024-12-31');

            const drizzle: QZPayBillingSubscriptionAddon = {
                id: 'sub-addon-123',
                subscriptionId: 'sub-123',
                addOnId: 'addon-123',
                quantity: 3,
                unitAmount: 500,
                currency: 'usd',
                status: 'active',
                addedAt: added,
                canceledAt: null,
                expiresAt: expires,
                metadata: { notes: 'test' },
                createdAt: now,
                updatedAt: now
            };

            const core = mapDrizzleSubscriptionAddonToCore(drizzle);

            expect(core.id).toBe('sub-addon-123');
            expect(core.subscriptionId).toBe('sub-123');
            expect(core.addOnId).toBe('addon-123');
            expect(core.quantity).toBe(3);
            expect(core.unitAmount).toBe(500);
            expect(core.currency).toBe('usd');
            expect(core.status).toBe('active');
            expect(core.addedAt).toEqual(added);
            expect(core.canceledAt).toBeNull();
            expect(core.expiresAt).toEqual(expires);
            expect(core.metadata).toEqual({ notes: 'test' });
        });

        it('should handle canceled status', () => {
            const canceled = new Date('2024-06-15');

            const drizzle: QZPayBillingSubscriptionAddon = {
                id: 'sub-addon-456',
                subscriptionId: 'sub-456',
                addOnId: 'addon-456',
                quantity: 1,
                unitAmount: 1000,
                currency: 'eur',
                status: 'canceled',
                addedAt: new Date('2024-01-01'),
                canceledAt: canceled,
                expiresAt: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const core = mapDrizzleSubscriptionAddonToCore(drizzle);

            expect(core.status).toBe('canceled');
            expect(core.canceledAt).toEqual(canceled);
            expect(core.expiresAt).toBeNull();
            expect(core.metadata).toEqual({});
        });

        it('should handle pending status', () => {
            const drizzle: QZPayBillingSubscriptionAddon = {
                id: 'sub-addon-789',
                subscriptionId: 'sub-789',
                addOnId: 'addon-789',
                quantity: 2,
                unitAmount: 750,
                currency: 'gbp',
                status: 'pending',
                addedAt: new Date(),
                canceledAt: null,
                expiresAt: null,
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const core = mapDrizzleSubscriptionAddonToCore(drizzle);

            expect(core.status).toBe('pending');
        });
    });

    describe('mapCoreSubscriptionAddonCreateToDrizzle', () => {
        it('should map create input with all fields', () => {
            const input = {
                id: 'new-sub-addon-1',
                subscriptionId: 'sub-123',
                addOnId: 'addon-123',
                quantity: 2,
                unitAmount: 1500,
                currency: 'usd',
                metadata: { source: 'api' }
            };

            const drizzle = mapCoreSubscriptionAddonCreateToDrizzle(input);

            expect(drizzle.id).toBe('new-sub-addon-1');
            expect(drizzle.subscriptionId).toBe('sub-123');
            expect(drizzle.addOnId).toBe('addon-123');
            expect(drizzle.quantity).toBe(2);
            expect(drizzle.unitAmount).toBe(1500);
            expect(drizzle.currency).toBe('usd');
            expect(drizzle.status).toBe('active');
            expect(drizzle.metadata).toEqual({ source: 'api' });
        });

        it('should handle missing metadata', () => {
            const input = {
                id: 'new-sub-addon-2',
                subscriptionId: 'sub-456',
                addOnId: 'addon-456',
                quantity: 1,
                unitAmount: 500,
                currency: 'eur'
            };

            const drizzle = mapCoreSubscriptionAddonCreateToDrizzle(input);

            expect(drizzle.metadata).toEqual({});
            expect(drizzle.status).toBe('active');
        });
    });

    describe('mapCoreSubscriptionAddonUpdateToDrizzle', () => {
        it('should map all update fields', () => {
            const update = {
                quantity: 5,
                status: 'canceled' as const,
                canceledAt: new Date('2024-06-01'),
                expiresAt: new Date('2024-12-31'),
                metadata: { reason: 'downgrade' }
            };

            const drizzle = mapCoreSubscriptionAddonUpdateToDrizzle(update);

            expect(drizzle.quantity).toBe(5);
            expect(drizzle.status).toBe('canceled');
            expect(drizzle.canceledAt).toEqual(new Date('2024-06-01'));
            expect(drizzle.expiresAt).toEqual(new Date('2024-12-31'));
            expect(drizzle.metadata).toEqual({ reason: 'downgrade' });
        });

        it('should handle partial updates', () => {
            const update = {
                quantity: 3,
                metadata: { updated: true }
            };

            const drizzle = mapCoreSubscriptionAddonUpdateToDrizzle(update);

            expect(drizzle.quantity).toBe(3);
            expect(drizzle.metadata).toEqual({ updated: true });
            expect(drizzle.status).toBeUndefined();
            expect(drizzle.canceledAt).toBeUndefined();
        });

        it('should return empty object for no updates', () => {
            const drizzle = mapCoreSubscriptionAddonUpdateToDrizzle({});

            expect(drizzle).toEqual({});
        });

        it('should handle status change to active', () => {
            const update = {
                status: 'active' as const
            };

            const drizzle = mapCoreSubscriptionAddonUpdateToDrizzle(update);

            expect(drizzle.status).toBe('active');
        });
    });
});
