/**
 * Features selection prompt
 */
import * as p from '@clack/prompts';
import type { FeaturesConfig } from '../types/config.js';

export async function collectFeatureSelection(): Promise<FeaturesConfig | symbol> {
    const features = await p.multiselect({
        message: 'Features to include',
        options: [
            { value: 'subscriptions', label: 'Subscriptions', hint: 'Recurring billing' },
            { value: 'one-time', label: 'One-time payments', hint: 'Single purchases' },
            { value: 'usage-based', label: 'Usage-based billing', hint: 'Metered usage' },
            { value: 'marketplace', label: 'Marketplace', hint: 'Multi-vendor support' },
            { value: 'addons', label: 'Add-ons', hint: 'Subscription add-ons' }
        ],
        required: true,
        initialValues: ['subscriptions']
    });

    if (p.isCancel(features)) return features;

    const featuresList = features as string[];

    return {
        subscriptions: featuresList.includes('subscriptions'),
        oneTime: featuresList.includes('one-time'),
        usageBased: featuresList.includes('usage-based'),
        marketplace: featuresList.includes('marketplace'),
        addons: featuresList.includes('addons')
    };
}
