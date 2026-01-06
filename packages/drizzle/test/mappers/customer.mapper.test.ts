/**
 * Customer Mapper Unit Tests
 *
 * Tests the customer type mappers that convert between Drizzle and Core types.
 */
import { describe, expect, it } from 'vitest';
import {
    mapCoreCustomerCreateToDrizzle,
    mapCoreCustomerUpdateToDrizzle,
    mapDrizzleCustomerToCore
} from '../../src/mappers/customer.mapper.js';
import type { QZPayBillingCustomer } from '../../src/schema/index.js';

describe('Customer Mapper', () => {
    describe('mapDrizzleCustomerToCore', () => {
        it('should map basic customer fields', () => {
            const now = new Date('2024-01-01');

            const drizzle: QZPayBillingCustomer = {
                id: 'cust-123',
                externalId: 'ext-123',
                email: 'test@example.com',
                name: 'Test User',
                stripeCustomerId: null,
                mpCustomerId: null,
                preferredLanguage: 'en',
                segment: 'premium',
                tier: 'gold',
                billingAddress: { city: 'NYC', country: 'US' },
                shippingAddress: { city: 'SF', country: 'US' },
                taxId: 'TAX123',
                taxIdType: 'vat',
                livemode: true,
                metadata: { foo: 'bar' },
                version: 'v1',
                createdAt: now,
                updatedAt: now,
                deletedAt: null
            };

            const core = mapDrizzleCustomerToCore(drizzle);

            expect(core.id).toBe('cust-123');
            expect(core.externalId).toBe('ext-123');
            expect(core.email).toBe('test@example.com');
            expect(core.name).toBe('Test User');
            expect(core.preferredLanguage).toBe('en');
            expect(core.segment).toBe('premium');
            expect(core.tier).toBe('gold');
            expect(core.billingAddress).toEqual({ city: 'NYC', country: 'US' });
            expect(core.shippingAddress).toEqual({ city: 'SF', country: 'US' });
            expect(core.taxId).toBe('TAX123');
            expect(core.taxIdType).toBe('vat');
            expect(core.livemode).toBe(true);
            expect(core.metadata).toEqual({ foo: 'bar' });
            expect(core.createdAt).toEqual(now);
            expect(core.updatedAt).toEqual(now);
            expect(core.deletedAt).toBeNull();
        });

        it('should map provider customer IDs', () => {
            const drizzle: QZPayBillingCustomer = {
                id: 'cust-456',
                externalId: 'ext-456',
                email: 'provider@example.com',
                name: null,
                stripeCustomerId: 'cus_stripe123',
                mpCustomerId: 'mp_customer456',
                preferredLanguage: null,
                segment: null,
                tier: null,
                billingAddress: {},
                shippingAddress: null,
                taxId: null,
                taxIdType: null,
                livemode: true,
                metadata: {},
                version: 'v1',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleCustomerToCore(drizzle);

            expect(core.providerCustomerIds).toEqual({
                stripe: 'cus_stripe123',
                mercadopago: 'mp_customer456'
            });
        });

        it('should handle only Stripe customer ID', () => {
            const drizzle: QZPayBillingCustomer = {
                id: 'cust-789',
                externalId: 'ext-789',
                email: 'stripe@example.com',
                name: 'Stripe Only',
                stripeCustomerId: 'cus_stripe789',
                mpCustomerId: null,
                preferredLanguage: null,
                segment: null,
                tier: null,
                billingAddress: {},
                shippingAddress: null,
                taxId: null,
                taxIdType: null,
                livemode: true,
                metadata: {},
                version: 'v1',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleCustomerToCore(drizzle);

            expect(core.providerCustomerIds).toEqual({
                stripe: 'cus_stripe789'
            });
        });

        it('should handle only MercadoPago customer ID', () => {
            const drizzle: QZPayBillingCustomer = {
                id: 'cust-1011',
                externalId: 'ext-1011',
                email: 'mp@example.com',
                name: 'MP Only',
                stripeCustomerId: null,
                mpCustomerId: 'mp_1011',
                preferredLanguage: null,
                segment: null,
                tier: null,
                billingAddress: {},
                shippingAddress: null,
                taxId: null,
                taxIdType: null,
                livemode: true,
                metadata: {},
                version: 'v1',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleCustomerToCore(drizzle);

            expect(core.providerCustomerIds).toEqual({
                mercadopago: 'mp_1011'
            });
        });

        it('should handle null name', () => {
            const drizzle: QZPayBillingCustomer = {
                id: 'cust-nullname',
                externalId: 'ext-nullname',
                email: 'nullname@example.com',
                name: null,
                stripeCustomerId: null,
                mpCustomerId: null,
                preferredLanguage: null,
                segment: null,
                tier: null,
                billingAddress: {},
                shippingAddress: null,
                taxId: null,
                taxIdType: null,
                livemode: true,
                metadata: {},
                version: 'v1',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleCustomerToCore(drizzle);

            expect(core.name).toBeNull();
        });

        it('should handle empty addresses', () => {
            const drizzle: QZPayBillingCustomer = {
                id: 'cust-addr',
                externalId: 'ext-addr',
                email: 'addr@example.com',
                name: 'Address Test',
                stripeCustomerId: null,
                mpCustomerId: null,
                preferredLanguage: null,
                segment: null,
                tier: null,
                billingAddress: {},
                shippingAddress: null,
                taxId: null,
                taxIdType: null,
                livemode: true,
                metadata: {},
                version: 'v1',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleCustomerToCore(drizzle);

            expect(core.billingAddress).toEqual({});
            expect(core.shippingAddress).toBeNull();
        });

        it('should handle test mode customer', () => {
            const drizzle: QZPayBillingCustomer = {
                id: 'cust-test',
                externalId: 'ext-test',
                email: 'test@example.com',
                name: 'Test Mode',
                stripeCustomerId: null,
                mpCustomerId: null,
                preferredLanguage: null,
                segment: null,
                tier: null,
                billingAddress: {},
                shippingAddress: null,
                taxId: null,
                taxIdType: null,
                livemode: false,
                metadata: {},
                version: 'v1',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };

            const core = mapDrizzleCustomerToCore(drizzle);

            expect(core.livemode).toBe(false);
        });
    });

    describe('mapCoreCustomerCreateToDrizzle', () => {
        it('should map core create input to drizzle insert', () => {
            const coreInput = {
                externalId: 'ext-new-1',
                email: 'new@example.com',
                name: 'New User',
                preferredLanguage: 'es',
                segment: 'starter',
                tier: 'bronze',
                billingAddress: { line1: '123 Main St', city: 'NYC' },
                shippingAddress: { line1: '456 Other St', city: 'SF' },
                taxId: 'TAX456',
                taxIdType: 'ein',
                metadata: { source: 'api' }
            };

            const drizzle = mapCoreCustomerCreateToDrizzle(coreInput, true);

            expect(drizzle.externalId).toBe('ext-new-1');
            expect(drizzle.email).toBe('new@example.com');
            expect(drizzle.name).toBe('New User');
            expect(drizzle.preferredLanguage).toBe('es');
            expect(drizzle.segment).toBe('starter');
            expect(drizzle.tier).toBe('bronze');
            expect(drizzle.billingAddress).toEqual({ line1: '123 Main St', city: 'NYC' });
            expect(drizzle.shippingAddress).toEqual({ line1: '456 Other St', city: 'SF' });
            expect(drizzle.taxId).toBe('TAX456');
            expect(drizzle.taxIdType).toBe('ein');
            expect(drizzle.livemode).toBe(true);
            expect(drizzle.metadata).toEqual({ source: 'api' });
        });

        it('should set livemode based on parameter', () => {
            const coreInput = {
                externalId: 'ext-test-1',
                email: 'test@example.com'
            };

            const live = mapCoreCustomerCreateToDrizzle(coreInput, true);
            const test = mapCoreCustomerCreateToDrizzle(coreInput, false);

            expect(live.livemode).toBe(true);
            expect(test.livemode).toBe(false);
        });

        it('should handle minimal input', () => {
            const coreInput = {
                externalId: 'ext-minimal',
                email: 'minimal@example.com'
            };

            const drizzle = mapCoreCustomerCreateToDrizzle(coreInput, true);

            expect(drizzle.externalId).toBe('ext-minimal');
            expect(drizzle.email).toBe('minimal@example.com');
            expect(drizzle.name).toBeUndefined();
            expect(drizzle.metadata).toBeUndefined();
        });

        it('should pass through provider IDs if present', () => {
            const coreInput = {
                externalId: 'ext-provider',
                email: 'provider@example.com',
                stripeCustomerId: 'cus_new_stripe',
                mpCustomerId: 'mp_new_mp'
            };

            const drizzle = mapCoreCustomerCreateToDrizzle(coreInput, true);

            expect(drizzle.stripeCustomerId).toBe('cus_new_stripe');
            expect(drizzle.mpCustomerId).toBe('mp_new_mp');
        });
    });

    describe('mapCoreCustomerUpdateToDrizzle', () => {
        it('should map all update fields', () => {
            const update = {
                name: 'Updated Name',
                email: 'updated@example.com',
                preferredLanguage: 'fr',
                segment: 'enterprise',
                tier: 'platinum',
                billingAddress: { city: 'Paris' },
                shippingAddress: { city: 'London' },
                taxId: 'NEW_TAX',
                taxIdType: 'vat',
                metadata: { updated: true }
            };

            const drizzle = mapCoreCustomerUpdateToDrizzle(update);

            expect(drizzle.name).toBe('Updated Name');
            expect(drizzle.email).toBe('updated@example.com');
            expect(drizzle.preferredLanguage).toBe('fr');
            expect(drizzle.segment).toBe('enterprise');
            expect(drizzle.tier).toBe('platinum');
            expect(drizzle.billingAddress).toEqual({ city: 'Paris' });
            expect(drizzle.shippingAddress).toEqual({ city: 'London' });
            expect(drizzle.taxId).toBe('NEW_TAX');
            expect(drizzle.taxIdType).toBe('vat');
            expect(drizzle.metadata).toEqual({ updated: true });
        });

        it('should handle partial updates', () => {
            const update = {
                name: 'Only Name',
                segment: 'vip'
            };

            const drizzle = mapCoreCustomerUpdateToDrizzle(update);

            expect(drizzle.name).toBe('Only Name');
            expect(drizzle.segment).toBe('vip');
            expect(drizzle.email).toBeUndefined();
            expect(drizzle.metadata).toBeUndefined();
        });

        it('should return empty object for no updates', () => {
            const drizzle = mapCoreCustomerUpdateToDrizzle({});

            expect(drizzle).toEqual({});
        });

        it('should handle provider ID updates', () => {
            const update = {
                stripeCustomerId: 'cus_updated',
                mpCustomerId: 'mp_updated'
            };

            const drizzle = mapCoreCustomerUpdateToDrizzle(update);

            expect(drizzle.stripeCustomerId).toBe('cus_updated');
            expect(drizzle.mpCustomerId).toBe('mp_updated');
        });

        it('should handle clearing optional fields', () => {
            const update = {
                name: null,
                segment: null,
                tier: null,
                shippingAddress: null,
                taxId: null,
                taxIdType: null
            };

            const drizzle = mapCoreCustomerUpdateToDrizzle(update);

            expect(drizzle.name).toBeNull();
            expect(drizzle.segment).toBeNull();
            expect(drizzle.tier).toBeNull();
            expect(drizzle.shippingAddress).toBeNull();
            expect(drizzle.taxId).toBeNull();
            expect(drizzle.taxIdType).toBeNull();
        });
    });
});
