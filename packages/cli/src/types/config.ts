/**
 * CLI Configuration Types
 *
 * These types define the configuration options for the QZPay CLI scaffolding tool.
 * They are used throughout the CLI to maintain type safety and provide IDE support.
 *
 * @packageDocumentation
 */

/**
 * Complete configuration for initializing a QZPay billing project.
 * This is the main configuration object assembled from all user prompts.
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: 'My billing system' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: false },
 *   plans: { tiers: [{ name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 }] }
 * };
 * ```
 */
export interface InitConfig {
    /** Project metadata and output settings */
    project: ProjectConfig;
    /** Payment provider configuration */
    provider: ProviderConfig;
    /** Storage adapter configuration */
    storage: StorageConfig;
    /** Framework integration settings */
    framework: FrameworkConfig;
    /** Enabled billing features */
    features: FeaturesConfig;
    /** Plan tier configuration */
    plans: PlansConfig;
}

/**
 * Project metadata configuration.
 *
 * @example
 * ```typescript
 * const project: ProjectConfig = {
 *   name: 'my-saas-billing',
 *   outputDir: './billing',
 *   description: 'Billing system for My SaaS'
 * };
 * ```
 */
export interface ProjectConfig {
    /**
     * Project name in kebab-case.
     * Used for naming generated types and constants.
     * @example 'my-billing' becomes 'MyBilling' (PascalCase) and 'MY_BILLING' (SCREAMING_SNAKE)
     */
    name: string;

    /**
     * Output directory for generated files.
     * Can be relative or absolute path.
     * @example './billing' or '/home/user/projects/billing'
     */
    outputDir: string;

    /**
     * Optional project description.
     * Included in generated file headers and documentation.
     */
    description: string;
}

/**
 * Payment provider configuration.
 *
 * @example
 * ```typescript
 * // Stripe only
 * const stripe: ProviderConfig = { type: 'stripe', stripe: true, mercadopago: false };
 *
 * // Both providers
 * const both: ProviderConfig = { type: 'both', stripe: true, mercadopago: true };
 * ```
 */
export interface ProviderConfig {
    /**
     * Selected provider type.
     * - 'stripe': Stripe payment processing
     * - 'mercadopago': MercadoPago for Latin America
     * - 'both': Multi-provider setup
     */
    type: 'stripe' | 'mercadopago' | 'both';

    /** Whether Stripe adapter should be generated */
    stripe: boolean;

    /** Whether MercadoPago adapter should be generated */
    mercadopago: boolean;
}

/**
 * Storage adapter configuration.
 *
 * @example
 * ```typescript
 * // Production setup
 * const storage: StorageConfig = { type: 'drizzle' };
 *
 * // Development/testing
 * const storage: StorageConfig = { type: 'in-memory' };
 * ```
 */
export interface StorageConfig {
    /**
     * Storage adapter type.
     * - 'drizzle': PostgreSQL with Drizzle ORM (production-ready)
     * - 'in-memory': In-memory storage (development/testing only)
     */
    type: 'drizzle' | 'in-memory';
}

/**
 * Framework integration configuration.
 *
 * @example
 * ```typescript
 * // Hono web framework
 * const framework: FrameworkConfig = { type: 'hono' };
 *
 * // Library only (no HTTP layer)
 * const framework: FrameworkConfig = { type: 'none' };
 * ```
 */
export interface FrameworkConfig {
    /**
     * Framework type.
     * - 'hono': Generates routes.ts and webhooks.ts for Hono
     * - 'nestjs': Generates module, service, and controller for NestJS
     * - 'none': Library-only, no HTTP layer generated
     */
    type: 'hono' | 'nestjs' | 'none';
}

/**
 * Billing features configuration.
 * Each feature flag controls what code is generated.
 *
 * @example
 * ```typescript
 * // SaaS with subscriptions and add-ons
 * const features: FeaturesConfig = {
 *   subscriptions: true,
 *   oneTime: false,
 *   usageBased: false,
 *   marketplace: false,
 *   addons: true
 * };
 * ```
 */
export interface FeaturesConfig {
    /**
     * Enable subscription/recurring billing.
     * Generates subscription management functions and routes.
     */
    subscriptions: boolean;

    /**
     * Enable one-time payments.
     * Generates service purchase functions and routes.
     */
    oneTime: boolean;

    /**
     * Enable usage-based billing.
     * Generates usage tracking, limit checking, and overage handling.
     */
    usageBased: boolean;

    /**
     * Enable marketplace/multi-vendor support.
     * Generates vendor types and Stripe Connect integration.
     */
    marketplace: boolean;

    /**
     * Enable subscription add-ons.
     * Generates add-on management functions and routes.
     */
    addons: boolean;
}

/**
 * Plan configuration with tier definitions.
 *
 * @example
 * ```typescript
 * const plans: PlansConfig = {
 *   tiers: [
 *     { name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 },
 *     { name: 'pro', displayName: 'Pro', monthlyPrice: 1999, yearlyPrice: 19990 }
 *   ]
 * };
 * ```
 */
export interface PlansConfig {
    /** Array of plan tier definitions */
    tiers: PlanTier[];
}

/**
 * Individual plan tier definition.
 *
 * @example
 * ```typescript
 * const proTier: PlanTier = {
 *   name: 'pro',           // Used in code: 'pro' tier
 *   displayName: 'Pro',    // Shown to users: "Pro Plan"
 *   monthlyPrice: 1999,    // $19.99/month
 *   yearlyPrice: 19990     // $199.90/year (2 months free)
 * };
 * ```
 */
export interface PlanTier {
    /**
     * Internal tier name in lowercase.
     * Used in type definitions and as object keys.
     * @example 'free', 'pro', 'enterprise'
     */
    name: string;

    /**
     * Human-readable tier name.
     * Used in UI and plan creation.
     * @example 'Free', 'Pro', 'Enterprise'
     */
    displayName: string;

    /**
     * Monthly price in cents (smallest currency unit).
     * Set to 0 for free tiers.
     * @example 1999 = $19.99
     */
    monthlyPrice: number;

    /**
     * Yearly price in cents (smallest currency unit).
     * Set to 0 for free tiers.
     * @example 19990 = $199.90
     */
    yearlyPrice: number;
}
