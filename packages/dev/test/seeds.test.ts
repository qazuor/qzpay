/**
 * Seed Templates Tests
 */
import { describe, expect, it } from 'vitest';
import { getSeedTemplateById, listSeedTemplates, seedTemplates } from '../src/seeds/index.js';

describe('seedTemplates', () => {
    describe('saas template', () => {
        const template = seedTemplates.saas;

        it('should have correct metadata', () => {
            expect(template.id).toBe('saas');
            expect(template.name).toBe('SaaS Basic');
            expect(template.description).toBeDefined();
            expect(template.description.length).toBeGreaterThan(0);
        });

        it('should have entitlement definitions', () => {
            expect(template.data.entitlementDefinitions).toBeDefined();
            const entitlements = template.data.entitlementDefinitions!;

            expect(entitlements.api_access).toBeDefined();
            expect(entitlements.api_access.key).toBe('api_access');
            expect(entitlements.api_access.name).toBe('API Access');

            expect(entitlements.priority_support).toBeDefined();
            expect(entitlements.advanced_analytics).toBeDefined();
            expect(entitlements.sso_saml).toBeDefined();
            expect(entitlements.custom_branding).toBeDefined();
        });

        it('should have limit definitions', () => {
            expect(template.data.limitDefinitions).toBeDefined();
            const limits = template.data.limitDefinitions!;

            expect(limits.projects).toBeDefined();
            expect(limits.projects.key).toBe('projects');
            expect(limits.projects.name).toBe('Projects');

            expect(limits.storage_gb).toBeDefined();
            expect(limits.team_members).toBeDefined();
            expect(limits.api_calls_monthly).toBeDefined();
        });

        it('should have three plans (free, pro, enterprise)', () => {
            expect(template.data.plans).toBeDefined();
            const plans = template.data.plans!;

            expect(plans.plan_free).toBeDefined();
            expect(plans.plan_free.name).toBe('Free');
            expect(plans.plan_free.active).toBe(true);

            expect(plans.plan_pro).toBeDefined();
            expect(plans.plan_pro.name).toBe('Pro');

            expect(plans.plan_enterprise).toBeDefined();
            expect(plans.plan_enterprise.name).toBe('Enterprise');
        });

        it('should have prices for each plan', () => {
            expect(template.data.prices).toBeDefined();
            const prices = template.data.prices!;

            // Free plan pricing
            expect(prices.price_free_monthly).toBeDefined();
            expect(prices.price_free_monthly.planId).toBe('plan_free');
            expect(prices.price_free_monthly.unitAmount).toBe(0);

            // Pro plan pricing
            expect(prices.price_pro_monthly).toBeDefined();
            expect(prices.price_pro_monthly.planId).toBe('plan_pro');
            expect(prices.price_pro_yearly).toBeDefined();
            expect(prices.price_pro_yearly.planId).toBe('plan_pro');

            // Enterprise plan pricing
            expect(prices.price_enterprise_monthly).toBeDefined();
            expect(prices.price_enterprise_yearly).toBeDefined();
        });

        it('should have valid price-plan relationships', () => {
            const plans = template.data.plans!;
            const prices = template.data.prices!;

            for (const price of Object.values(prices)) {
                expect(plans[price.planId]).toBeDefined();
            }
        });

        it('should have sample customers', () => {
            expect(template.data.customers).toBeDefined();
            const customers = template.data.customers!;

            expect(customers.cus_john).toBeDefined();
            expect(customers.cus_john.email).toBe('john.doe@example.com');

            expect(customers.cus_jane).toBeDefined();
            expect(customers.cus_bob).toBeDefined();
        });

        it('should have valid entitlement references in plans', () => {
            const plans = template.data.plans!;
            const entitlements = template.data.entitlementDefinitions!;

            for (const plan of Object.values(plans)) {
                for (const entitlementKey of plan.entitlements) {
                    expect(entitlements[entitlementKey]).toBeDefined();
                }
            }
        });

        it('should have valid limit references in plans', () => {
            const plans = template.data.plans!;
            const limits = template.data.limitDefinitions!;

            for (const plan of Object.values(plans)) {
                for (const limitKey of Object.keys(plan.limits)) {
                    expect(limits[limitKey]).toBeDefined();
                }
            }
        });

        it('should have increasing prices for higher tiers', () => {
            const prices = template.data.prices!;

            // Pro should be more expensive than Free
            expect(prices.price_pro_monthly.unitAmount).toBeGreaterThan(prices.price_free_monthly.unitAmount);

            // Enterprise should be more expensive than Pro
            expect(prices.price_enterprise_monthly.unitAmount).toBeGreaterThan(prices.price_pro_monthly.unitAmount);

            // Yearly should provide discount (less per month)
            const proMonthly = prices.price_pro_monthly.unitAmount;
            const proYearly = prices.price_pro_yearly.unitAmount / 12;
            expect(proYearly).toBeLessThan(proMonthly);
        });
    });

    describe('api template', () => {
        const template = seedTemplates.api;

        it('should have correct metadata', () => {
            expect(template.id).toBe('api');
            expect(template.name).toBe('API/Developer');
            expect(template.description).toBeDefined();
        });

        it('should have data property', () => {
            expect(template.data).toBeDefined();
            expect(typeof template.data).toBe('object');
        });
    });

    describe('ecommerce template', () => {
        const template = seedTemplates.ecommerce;

        it('should have correct metadata', () => {
            expect(template.id).toBe('ecommerce');
            expect(template.name).toBe('E-commerce/Subscription Box');
            expect(template.description).toBeDefined();
        });

        it('should have data property', () => {
            expect(template.data).toBeDefined();
            expect(typeof template.data).toBe('object');
        });
    });

    describe('empty template', () => {
        const template = seedTemplates.empty;

        it('should have correct metadata', () => {
            expect(template.id).toBe('empty');
            expect(template.name).toBe('Empty');
            expect(template.description).toBe('Start with no data');
        });

        it('should have empty data', () => {
            expect(template.data).toEqual({});
        });
    });
});

describe('getSeedTemplateById', () => {
    it('should return saas template by id', () => {
        const template = getSeedTemplateById('saas');

        expect(template).toBeDefined();
        expect(template?.id).toBe('saas');
    });

    it('should return api template by id', () => {
        const template = getSeedTemplateById('api');

        expect(template).toBeDefined();
        expect(template?.id).toBe('api');
    });

    it('should return ecommerce template by id', () => {
        const template = getSeedTemplateById('ecommerce');

        expect(template).toBeDefined();
        expect(template?.id).toBe('ecommerce');
    });

    it('should return empty template by id', () => {
        const template = getSeedTemplateById('empty');

        expect(template).toBeDefined();
        expect(template?.id).toBe('empty');
    });

    it('should return undefined for unknown id', () => {
        const template = getSeedTemplateById('unknown');

        expect(template).toBeUndefined();
    });

    it('should be case-sensitive', () => {
        const template = getSeedTemplateById('SAAS');

        expect(template).toBeUndefined();
    });
});

describe('listSeedTemplates', () => {
    it('should return all template IDs', () => {
        const ids = listSeedTemplates();

        expect(ids).toContain('saas');
        expect(ids).toContain('api');
        expect(ids).toContain('ecommerce');
        expect(ids).toContain('empty');
    });

    it('should return at least 4 templates', () => {
        const ids = listSeedTemplates();

        expect(ids.length).toBeGreaterThanOrEqual(4);
    });

    it('should return unique IDs', () => {
        const ids = listSeedTemplates();
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
    });
});

describe('template data structure validation', () => {
    it('all templates should have required properties', () => {
        for (const template of Object.values(seedTemplates)) {
            expect(template).toHaveProperty('id');
            expect(template).toHaveProperty('name');
            expect(template).toHaveProperty('description');
            expect(template).toHaveProperty('data');

            expect(typeof template.id).toBe('string');
            expect(typeof template.name).toBe('string');
            expect(typeof template.description).toBe('string');
            expect(typeof template.data).toBe('object');
        }
    });

    it('all entitlement definitions should have required fields', () => {
        for (const template of Object.values(seedTemplates)) {
            if (template.data.entitlementDefinitions) {
                for (const ent of Object.values(template.data.entitlementDefinitions)) {
                    expect(ent).toHaveProperty('id');
                    expect(ent).toHaveProperty('key');
                    expect(ent).toHaveProperty('name');
                    expect(ent).toHaveProperty('createdAt');
                    expect(ent).toHaveProperty('updatedAt');
                }
            }
        }
    });

    it('all limit definitions should have required fields', () => {
        for (const template of Object.values(seedTemplates)) {
            if (template.data.limitDefinitions) {
                for (const lim of Object.values(template.data.limitDefinitions)) {
                    expect(lim).toHaveProperty('id');
                    expect(lim).toHaveProperty('key');
                    expect(lim).toHaveProperty('name');
                    expect(lim).toHaveProperty('defaultValue');
                    expect(lim).toHaveProperty('createdAt');
                    expect(lim).toHaveProperty('updatedAt');
                }
            }
        }
    });

    it('all plans should have required fields', () => {
        for (const template of Object.values(seedTemplates)) {
            if (template.data.plans) {
                for (const plan of Object.values(template.data.plans)) {
                    expect(plan).toHaveProperty('id');
                    expect(plan).toHaveProperty('name');
                    expect(plan).toHaveProperty('active');
                    expect(plan).toHaveProperty('prices');
                    expect(plan).toHaveProperty('features');
                    expect(plan).toHaveProperty('entitlements');
                    expect(plan).toHaveProperty('limits');
                    expect(plan).toHaveProperty('metadata');
                    expect(plan).toHaveProperty('createdAt');
                    expect(plan).toHaveProperty('updatedAt');

                    expect(Array.isArray(plan.prices)).toBe(true);
                    expect(Array.isArray(plan.features)).toBe(true);
                    expect(Array.isArray(plan.entitlements)).toBe(true);
                    expect(typeof plan.limits).toBe('object');
                    expect(typeof plan.metadata).toBe('object');
                }
            }
        }
    });

    it('all prices should have required fields', () => {
        for (const template of Object.values(seedTemplates)) {
            if (template.data.prices) {
                for (const price of Object.values(template.data.prices)) {
                    expect(price).toHaveProperty('id');
                    expect(price).toHaveProperty('planId');
                    expect(price).toHaveProperty('currency');
                    expect(price).toHaveProperty('unitAmount');
                    expect(price).toHaveProperty('billingInterval');
                    expect(price).toHaveProperty('intervalCount');
                    expect(price).toHaveProperty('active');
                    expect(price).toHaveProperty('providerPriceIds');
                    expect(price).toHaveProperty('metadata');
                    expect(price).toHaveProperty('createdAt');
                    expect(price).toHaveProperty('updatedAt');

                    expect(typeof price.unitAmount).toBe('number');
                    expect(price.unitAmount).toBeGreaterThanOrEqual(0);
                    expect(typeof price.active).toBe('boolean');
                }
            }
        }
    });

    it('all customers should have required fields', () => {
        for (const template of Object.values(seedTemplates)) {
            if (template.data.customers) {
                for (const customer of Object.values(template.data.customers)) {
                    expect(customer).toHaveProperty('id');
                    expect(customer).toHaveProperty('externalId');
                    expect(customer).toHaveProperty('email');
                    expect(customer).toHaveProperty('providerCustomerIds');
                    expect(customer).toHaveProperty('metadata');
                    expect(customer).toHaveProperty('livemode');
                    expect(customer).toHaveProperty('createdAt');
                    expect(customer).toHaveProperty('updatedAt');

                    expect(typeof customer.email).toBe('string');
                    expect(customer.email).toContain('@');
                    expect(typeof customer.livemode).toBe('boolean');
                }
            }
        }
    });
});
