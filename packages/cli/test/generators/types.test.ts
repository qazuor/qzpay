/**
 * Tests for types generator
 */
import { describe, expect, it } from 'vitest';
import { generateTypes } from '../../src/generators/types.js';
import { fullConfig, minimalConfig } from '../fixtures/config.js';

describe('generateTypes', () => {
    describe('plan tier type', () => {
        it('should generate plan tier union type', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain("export type TestBillingPlanTier = 'free' | 'pro' | 'enterprise'");
        });

        it('should use correct tier names from config', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain("'basic' | 'professional' | 'agency'");
        });
    });

    describe('tier names constant', () => {
        it('should generate tier names record', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('TEST_BILLING_TIER_NAMES');
            expect(result).toContain("free: 'Free'");
            expect(result).toContain("pro: 'Pro'");
            expect(result).toContain("enterprise: 'Enterprise'");
        });
    });

    describe('addon types', () => {
        it('should generate addon types when addons feature is enabled', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain('export type FullBillingAddOn =');
            expect(result).toContain('addon_extra_users');
            expect(result).toContain('addon_priority_support');
            expect(result).toContain('FULL_BILLING_ADDON_NAMES');
        });

        it('should not generate addon types when addons feature is disabled', () => {
            const result = generateTypes(minimalConfig);
            expect(result).not.toContain('AddOn =');
            expect(result).not.toContain('ADDON_NAMES');
        });
    });

    describe('service types', () => {
        it('should generate service types when oneTime feature is enabled', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain('export type FullBillingService =');
            expect(result).toContain('service_setup');
            expect(result).toContain('service_migration');
            expect(result).toContain('FULL_BILLING_SERVICE_NAMES');
        });

        it('should not generate service types when oneTime feature is disabled', () => {
            const result = generateTypes(minimalConfig);
            expect(result).not.toContain('Service =');
            expect(result).not.toContain('SERVICE_NAMES');
        });
    });

    describe('customer interface', () => {
        it('should generate customer interface', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('export interface TestBillingCustomer');
            expect(result).toContain('id: string');
            expect(result).toContain('email: string');
            expect(result).toContain('name: string');
            expect(result).toContain('planTier: TestBillingPlanTier');
        });

        it('should include activeAddOns when addons is enabled', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain('activeAddOns: FullBillingAddOn[]');
        });

        it('should not include activeAddOns when addons is disabled', () => {
            const result = generateTypes(minimalConfig);
            expect(result).not.toContain('activeAddOns');
        });
    });

    describe('plan limits interface', () => {
        it('should generate plan limits interface', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('export interface TestBillingPlanLimits');
            expect(result).toContain('maxItems: number');
            expect(result).toContain('maxUsers: number');
            expect(result).toContain('storageGb: number');
            expect(result).toContain('apiRequestsPerMonth: number');
        });

        it('should include features object', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('features: {');
            expect(result).toContain('analytics: boolean');
            expect(result).toContain('customBranding: boolean');
            expect(result).toContain('prioritySupport: boolean');
            expect(result).toContain('apiAccess: boolean');
        });
    });

    describe('plan limits constant', () => {
        it('should generate plan limits record', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('TEST_BILLING_PLAN_LIMITS');
            expect(result).toContain('free: {');
            expect(result).toContain('pro: {');
            expect(result).toContain('enterprise: {');
        });

        it('should set -1 for unlimited on enterprise tier', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toMatch(/enterprise:[\s\S]*maxItems: -1/);
        });

        it('should set lower limits for free tier', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toMatch(/free:[\s\S]*maxItems: 5/);
        });
    });

    describe('pricing constant', () => {
        it('should generate pricing constant', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('TEST_BILLING_PRICING');
            expect(result).toContain('plans: {');
        });

        it('should include correct prices from config', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('free: { monthly: 0, yearly: 0 }');
            expect(result).toContain('pro: { monthly: 1999, yearly: 19990 }');
            expect(result).toContain('enterprise: { monthly: 9999, yearly: 99990 }');
        });

        it('should include addons pricing when addons is enabled', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain('addOns: {');
            expect(result).toContain('addon_extra_users: 499');
        });

        it('should include services pricing when oneTime is enabled', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain('services: {');
            expect(result).toContain('service_setup: 9900');
        });

        it('should not include addons pricing when addons is disabled', () => {
            const result = generateTypes(minimalConfig);
            expect(result).not.toContain('addOns:');
        });
    });

    describe('usage types', () => {
        it('should generate usage types when usageBased is enabled', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain('export type FullBillingUsageMetric =');
            expect(result).toContain("'api_calls' | 'storage_bytes' | 'active_users'");
            expect(result).toContain('export interface FullBillingUsageSummary');
        });

        it('should not generate usage types when usageBased is disabled', () => {
            const result = generateTypes(minimalConfig);
            expect(result).not.toContain('UsageMetric');
            expect(result).not.toContain('UsageSummary');
        });
    });

    describe('marketplace types', () => {
        it('should generate vendor interface when marketplace is enabled', () => {
            const result = generateTypes(fullConfig);
            expect(result).toContain('export interface FullBillingVendor');
            expect(result).toContain('stripeAccountId?: string');
            expect(result).toContain('onboarded: boolean');
        });

        it('should not generate vendor interface when marketplace is disabled', () => {
            const result = generateTypes(minimalConfig);
            expect(result).not.toContain('Vendor');
            expect(result).not.toContain('stripeAccountId');
        });
    });

    describe('naming conventions', () => {
        it('should use PascalCase for type names', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('TestBillingPlanTier');
            expect(result).toContain('TestBillingCustomer');
        });

        it('should use SCREAMING_SNAKE_CASE for constants', () => {
            const result = generateTypes(minimalConfig);
            expect(result).toContain('TEST_BILLING_PLAN_LIMITS');
            expect(result).toContain('TEST_BILLING_PRICING');
        });
    });
});
