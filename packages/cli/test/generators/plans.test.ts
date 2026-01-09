/**
 * Tests for plans generator
 */
import { describe, expect, it } from 'vitest';
import { generatePlans } from '../../src/generators/plans.js';
import { fullConfig, minimalConfig } from '../fixtures/config.js';

describe('generatePlans', () => {
    describe('header and imports', () => {
        it('should include header with project name', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain('TestBilling - Plan Initialization');
        });

        it('should import billing from config', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain("import { billing } from './qzpay.config.js'");
        });

        it('should import pricing constant', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain("import { TEST_BILLING_PRICING } from './types.js'");
        });
    });

    describe('exports', () => {
        it('should export planIds record', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain('export const planIds: Record<string, string> = {}');
        });

        it('should export priceIds record', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain('export const priceIds: Record<string, { monthly?: string; yearly?: string }> = {}');
        });

        it('should export addOnPlanIds when addons is enabled', () => {
            const result = generatePlans(fullConfig);
            expect(result).toContain('export const addOnPlanIds: Record<string, string> = {}');
            expect(result).toContain('export const addOnPriceIds: Record<string, string> = {}');
        });

        it('should export servicePlanIds when oneTime is enabled', () => {
            const result = generatePlans(fullConfig);
            expect(result).toContain('export const servicePlanIds: Record<string, string> = {}');
            expect(result).toContain('export const servicePriceIds: Record<string, string> = {}');
        });

        it('should not export addon/service ids when features are disabled', () => {
            const result = generatePlans(minimalConfig);
            expect(result).not.toContain('addOnPlanIds');
            expect(result).not.toContain('servicePlanIds');
        });
    });

    describe('initialization function', () => {
        it('should generate initialize function with correct name', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain('export async function initializeTestBillingPlans()');
        });

        it('should create plans for each tier', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain('const freePlan = await billing.plans.create');
            expect(result).toContain('const proPlan = await billing.plans.create');
            expect(result).toContain('const enterprisePlan = await billing.plans.create');
        });

        it('should create prices with correct amounts', () => {
            const result = generatePlans(minimalConfig);
            // Free tier has no prices (monthly: 0), so it's skipped
            expect(result).toContain('TEST_BILLING_PRICING.plans.pro.monthly');
            expect(result).toContain('TEST_BILLING_PRICING.plans.enterprise.monthly');
        });

        it('should skip price creation for free tier', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain('// Free tier - no monthly price');
        });

        it('should create monthly and yearly prices', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain("billingInterval: 'month'");
            expect(result).toContain("billingInterval: 'year'");
        });
    });

    describe('addon initialization', () => {
        it('should create addon plans when addons is enabled', () => {
            const result = generatePlans(fullConfig);
            expect(result).toContain('Creating add-on plans');
            expect(result).toContain('FULL_BILLING_PRICING.addOns');
        });

        it('should not create addon plans when addons is disabled', () => {
            const result = generatePlans(minimalConfig);
            expect(result).not.toContain('Creating add-on plans');
        });
    });

    describe('service initialization', () => {
        it('should create service products when oneTime is enabled', () => {
            const result = generatePlans(fullConfig);
            expect(result).toContain('Creating service products');
            expect(result).toContain('FULL_BILLING_PRICING.services');
        });

        it('should not create services when oneTime is disabled', () => {
            const result = generatePlans(minimalConfig);
            expect(result).not.toContain('Creating service products');
        });
    });

    describe('helper functions', () => {
        it('should export getPriceId helper', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain("export function getPriceId(tier: string, interval: 'monthly' | 'yearly')");
        });

        it('should export getAddOnPriceId when addons is enabled', () => {
            const result = generatePlans(fullConfig);
            expect(result).toContain('export function getAddOnPriceId(addOn: string)');
        });

        it('should export getServicePriceId when oneTime is enabled', () => {
            const result = generatePlans(fullConfig);
            expect(result).toContain('export function getServicePriceId(service: string)');
        });
    });

    describe('self-execution', () => {
        it('should include auto-run statement', () => {
            const result = generatePlans(minimalConfig);
            expect(result).toContain('initializeTestBillingPlans().catch(console.error)');
        });
    });
});
