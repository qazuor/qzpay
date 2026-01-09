/**
 * Payment provider selection prompt
 */
import * as p from '@clack/prompts';
import type { ProviderConfig } from '../types/config.js';

export async function collectProviderSelection(): Promise<ProviderConfig | symbol> {
    const provider = await p.select({
        message: 'Payment provider',
        options: [
            { value: 'stripe', label: 'Stripe', hint: 'Recommended for most use cases' },
            { value: 'mercadopago', label: 'MercadoPago', hint: 'Best for Latin America' },
            { value: 'both', label: 'Both', hint: 'Multi-provider setup' }
        ]
    });

    if (p.isCancel(provider)) return provider;

    const providerType = provider as 'stripe' | 'mercadopago' | 'both';

    return {
        type: providerType,
        stripe: providerType === 'stripe' || providerType === 'both',
        mercadopago: providerType === 'mercadopago' || providerType === 'both'
    };
}
