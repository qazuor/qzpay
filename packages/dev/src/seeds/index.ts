/**
 * Seed Templates for QZPay Development
 *
 * Pre-configured data sets that can be loaded into the memory storage adapter
 * for testing and development purposes.
 *
 * @example
 * ```typescript
 * import { createMemoryStorageAdapter, seedTemplates } from '@qazuor/qzpay-dev';
 *
 * const { adapter, seed } = createMemoryStorageAdapter();
 *
 * // Load the SaaS template
 * seed(seedTemplates.saas);
 *
 * // Or load the API/Developer template
 * seed(seedTemplates.api);
 * ```
 */
import type { MemoryStorageSnapshot } from '../adapters/memory-storage.adapter.js';
import { apiTemplate } from './api.template.js';
import { ecommerceTemplate } from './ecommerce.template.js';
import { saasTemplate } from './saas.template.js';

/**
 * Interface for seed template metadata
 */
export interface SeedTemplate {
    /** Unique identifier for the template */
    id: string;
    /** Human-readable name */
    name: string;
    /** Description of what the template contains */
    description: string;
    /** The actual data to seed */
    data: Partial<MemoryStorageSnapshot>;
}

/**
 * Collection of pre-built seed templates
 */
export const seedTemplates = {
    /**
     * SaaS Basic Template
     * Common B2B SaaS with Free, Pro, Enterprise tiers
     */
    saas: saasTemplate,

    /**
     * API/Developer Template
     * Usage-based API pricing model with rate limits
     */
    api: apiTemplate,

    /**
     * E-commerce/Subscription Box Template
     * Product subscription model with shipping entitlements
     */
    ecommerce: ecommerceTemplate,

    /**
     * Empty template for starting from scratch
     */
    empty: {
        id: 'empty',
        name: 'Empty',
        description: 'Start with no data',
        data: {}
    } satisfies SeedTemplate
} as const;

/**
 * Get a seed template by ID
 */
export function getSeedTemplateById(id: string): SeedTemplate | undefined {
    return Object.values(seedTemplates).find((t) => t.id === id);
}

/**
 * List all available seed template IDs
 */
export function listSeedTemplates(): string[] {
    return Object.keys(seedTemplates);
}

export type { MemoryStorageSnapshot };
