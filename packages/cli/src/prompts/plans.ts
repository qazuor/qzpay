/**
 * Plan configuration prompts
 */
import * as p from '@clack/prompts';
import type { PlanTier, PlansConfig } from '../types/config.js';

export async function collectPlanConfiguration(): Promise<PlansConfig | symbol> {
    const usePredefined = await p.confirm({
        message: 'Use predefined plan structure?',
        initialValue: true
    });

    if (p.isCancel(usePredefined)) return usePredefined;

    if (usePredefined) {
        const structure = await p.select({
            message: 'Plan structure',
            options: [
                { value: 'freemium', label: 'Freemium', hint: 'Free + Pro + Enterprise' },
                { value: 'tiered', label: 'Tiered', hint: 'Basic + Professional + Agency' },
                { value: 'usage', label: 'Usage-based', hint: 'Starter + Growth + Business + Enterprise' }
            ]
        });

        if (p.isCancel(structure)) return structure;

        return getPredefinedPlans(structure as string);
    }

    return collectCustomPlans();
}

async function collectCustomPlans(): Promise<PlansConfig | symbol> {
    const plans: PlanTier[] = [];
    let addMore = true;

    p.log.info('Define your plan tiers. Prices are in cents (e.g., 2999 = $29.99)');

    while (addMore) {
        const plan = await p.group({
            name: () =>
                p.text({
                    message: 'Plan name (lowercase)',
                    placeholder: 'professional',
                    validate: (v) => {
                        if (!v) return 'Name required';
                        if (!/^[a-z][a-z0-9-]*$/.test(v)) return 'Use lowercase letters, numbers, hyphens';
                        return undefined;
                    }
                }),
            displayName: () =>
                p.text({
                    message: 'Display name',
                    placeholder: 'Professional'
                }),
            monthlyPrice: () =>
                p.text({
                    message: 'Monthly price (in cents, 0 for free)',
                    placeholder: '2999',
                    validate: (v) => {
                        if (v === '') return undefined;
                        if (Number.isNaN(Number(v))) return 'Must be a number';
                        if (Number(v) < 0) return 'Cannot be negative';
                        return undefined;
                    }
                }),
            yearlyPrice: () =>
                p.text({
                    message: 'Yearly price (in cents, 0 for free)',
                    placeholder: '29990',
                    validate: (v) => {
                        if (v === '') return undefined;
                        if (Number.isNaN(Number(v))) return 'Must be a number';
                        if (Number(v) < 0) return 'Cannot be negative';
                        return undefined;
                    }
                })
        });

        if (p.isCancel(plan)) return plan;

        plans.push({
            name: plan.name,
            displayName: plan.displayName || plan.name,
            monthlyPrice: Number(plan.monthlyPrice) || 0,
            yearlyPrice: Number(plan.yearlyPrice) || 0
        });

        const continueAdding = await p.confirm({
            message: 'Add another plan?',
            initialValue: plans.length < 3
        });

        if (p.isCancel(continueAdding)) return continueAdding;
        addMore = continueAdding;
    }

    return { tiers: plans };
}

function getPredefinedPlans(structure: string): PlansConfig {
    switch (structure) {
        case 'freemium':
            return {
                tiers: [
                    { name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 },
                    { name: 'pro', displayName: 'Pro', monthlyPrice: 1999, yearlyPrice: 19990 },
                    { name: 'enterprise', displayName: 'Enterprise', monthlyPrice: 9999, yearlyPrice: 99990 }
                ]
            };
        case 'tiered':
            return {
                tiers: [
                    { name: 'basic', displayName: 'Basic', monthlyPrice: 999, yearlyPrice: 9990 },
                    { name: 'professional', displayName: 'Professional', monthlyPrice: 2999, yearlyPrice: 29990 },
                    { name: 'agency', displayName: 'Agency', monthlyPrice: 9999, yearlyPrice: 99990 }
                ]
            };
        default:
            return {
                tiers: [
                    { name: 'starter', displayName: 'Starter', monthlyPrice: 1900, yearlyPrice: 19000 },
                    { name: 'growth', displayName: 'Growth', monthlyPrice: 4900, yearlyPrice: 49000 },
                    { name: 'business', displayName: 'Business', monthlyPrice: 14900, yearlyPrice: 149000 },
                    { name: 'enterprise', displayName: 'Enterprise', monthlyPrice: 0, yearlyPrice: 0 }
                ]
            };
    }
}
