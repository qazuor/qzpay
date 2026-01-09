/**
 * Tests for services generator
 */
import { describe, expect, it } from 'vitest';
import { generateServices } from '../../src/generators/services.js';
import { fullConfig, minimalConfig } from '../fixtures/config.js';

describe('generateServices', () => {
    describe('imports', () => {
        it('should import billing from config', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain("import { billing } from './qzpay.config.js'");
        });

        it('should import types', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain("import type { TestBillingCustomer, TestBillingPlanTier, TestBillingPlanLimits } from './types.js'");
        });

        it('should import getPriceId', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('import { getPriceId');
        });

        it('should import getAddOnPriceId when addons is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('getAddOnPriceId');
        });

        it('should import getServicePriceId when oneTime is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('getServicePriceId');
        });
    });

    describe('customer management', () => {
        it('should generate registerCustomer function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export async function registerCustomer');
            expect(result).toContain('billing.customers.create');
        });

        it('should use first plan tier as default', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain("planTier: data.planTier || 'free'");
        });

        it('should generate getCustomer function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export async function getCustomer');
            expect(result).toContain('billing.customers.get');
        });

        it('should generate getCustomerLimits function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export function getCustomerLimits');
            expect(result).toContain('TEST_BILLING_PLAN_LIMITS[planTier]');
        });
    });

    describe('subscription management', () => {
        it('should generate subscribeToPlan function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export async function subscribeToPlan');
            expect(result).toContain('billing.checkout.createSession');
        });

        it('should generate changePlan function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export async function changePlan');
            expect(result).toContain('billing.subscriptions.changePlan');
        });

        it('should generate cancelSubscription function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export async function cancelSubscription');
            expect(result).toContain('billing.subscriptions.cancel');
        });
    });

    describe('addon management', () => {
        it('should generate addAddOn function when addons is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('export async function addAddOn');
            expect(result).toContain('billing.addons.addToSubscription');
        });

        it('should generate removeAddOn function when addons is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('export async function removeAddOn');
            expect(result).toContain('billing.addons.removeFromSubscription');
        });

        it('should not generate addon functions when addons is disabled', () => {
            const result = generateServices(minimalConfig);
            expect(result).not.toContain('addAddOn');
            expect(result).not.toContain('removeAddOn');
        });
    });

    describe('one-time purchases', () => {
        it('should generate purchaseService function when oneTime is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('export async function purchaseService');
            expect(result).toContain("mode: 'payment'");
        });

        it('should not generate purchaseService when oneTime is disabled', () => {
            const result = generateServices(minimalConfig);
            expect(result).not.toContain('purchaseService');
        });
    });

    describe('usage tracking', () => {
        it('should generate trackUsage function when usageBased is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('export async function trackUsage');
            expect(result).toContain('billing.limits.recordUsage');
        });

        it('should generate checkUsageLimit function when usageBased is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('export async function checkUsageLimit');
            expect(result).toContain('billing.limits.check');
        });

        it('should generate getUsageSummary function when usageBased is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('export async function getUsageSummary');
            expect(result).toContain('billing.limits.getByCustomerId');
        });

        it('should not generate usage functions when usageBased is disabled', () => {
            const result = generateServices(minimalConfig);
            expect(result).not.toContain('trackUsage');
            expect(result).not.toContain('checkUsageLimit');
            expect(result).not.toContain('getUsageSummary');
        });
    });

    describe('payment management', () => {
        it('should always generate getPaymentHistory function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export async function getPaymentHistory');
            expect(result).toContain('billing.payments.list');
        });

        it('should always generate getInvoices function', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('export async function getInvoices');
            expect(result).toContain('billing.invoices.list');
        });
    });

    describe('section headers', () => {
        it('should include Customer Management section', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('// Customer Management');
        });

        it('should include Subscription Management section', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('// Subscription Management');
        });

        it('should include Payment Management section', () => {
            const result = generateServices(minimalConfig);
            expect(result).toContain('// Payment Management');
        });

        it('should include Add-on Management section when addons is enabled', () => {
            const result = generateServices(fullConfig);
            expect(result).toContain('// Add-on Management');
        });
    });
});
