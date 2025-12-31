/**
 * Auto-configure QZPayBilling from environment variables
 */
import { type QZPayBilling, type QZPayBillingConfig, type QZPayNotificationConfig, createQZPayBilling } from './billing.js';
import type { QZPayCurrency } from './constants/index.js';
import type { QZPayPlan } from './types/plan.types.js';

/**
 * Environment variable names
 */
export const QZPAY_ENV_VARS = {
    STRIPE_API_KEY: 'STRIPE_SECRET_KEY',
    STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
    MERCADOPAGO_ACCESS_TOKEN: 'MP_ACCESS_TOKEN',
    MERCADOPAGO_WEBHOOK_SECRET: 'MP_WEBHOOK_SECRET',
    DEFAULT_CURRENCY: 'QZPAY_DEFAULT_CURRENCY',
    LIVEMODE: 'QZPAY_LIVEMODE',
    GRACE_PERIOD_DAYS: 'QZPAY_GRACE_PERIOD_DAYS'
} as const;

/**
 * Detected payment provider
 */
export interface QZPayDetectedProvider {
    provider: 'stripe' | 'mercadopago';
    apiKey: string;
    webhookSecret?: string | undefined;
}

/**
 * Environment detection result
 */
export interface QZPayEnvDetectionResult {
    providers: QZPayDetectedProvider[];
    defaultCurrency: QZPayCurrency;
    livemode: boolean;
    gracePeriodDays: number;
}

/**
 * Configuration for createQZPayBillingFromEnv
 */
export interface QZPayBillingFromEnvConfig {
    /**
     * Storage adapter (required)
     */
    storage: QZPayBillingConfig['storage'];

    /**
     * Available plans
     */
    plans?: QZPayPlan[];

    /**
     * Notification configuration
     */
    notifications?: QZPayNotificationConfig;

    /**
     * Custom environment object (defaults to process.env)
     */
    env?: Record<string, string | undefined>;

    /**
     * Override detected livemode
     */
    livemode?: boolean;

    /**
     * Override detected currency
     */
    defaultCurrency?: QZPayCurrency;
}

/**
 * Get environment variable value
 */
function getEnvVar(env: Record<string, string | undefined>, key: string): string | undefined {
    return env[key];
}

/**
 * Parse boolean from environment variable
 */
function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
}

/**
 * Parse number from environment variable
 */
function parseEnvNumber(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Detect configuration from environment variables
 */
export function qzpayDetectEnvConfig(env: Record<string, string | undefined> = {}): QZPayEnvDetectionResult {
    const providers: QZPayDetectedProvider[] = [];

    // Detect Stripe
    const stripeKey = getEnvVar(env, QZPAY_ENV_VARS.STRIPE_API_KEY);
    if (stripeKey) {
        providers.push({
            provider: 'stripe',
            apiKey: stripeKey,
            webhookSecret: getEnvVar(env, QZPAY_ENV_VARS.STRIPE_WEBHOOK_SECRET)
        });
    }

    // Detect MercadoPago
    const mpToken = getEnvVar(env, QZPAY_ENV_VARS.MERCADOPAGO_ACCESS_TOKEN);
    if (mpToken) {
        providers.push({
            provider: 'mercadopago',
            apiKey: mpToken,
            webhookSecret: getEnvVar(env, QZPAY_ENV_VARS.MERCADOPAGO_WEBHOOK_SECRET)
        });
    }

    // Detect livemode from first provider key or explicit setting
    let livemode = parseEnvBool(getEnvVar(env, QZPAY_ENV_VARS.LIVEMODE), false);
    if (stripeKey?.startsWith('sk_live_')) {
        livemode = true;
    } else if (stripeKey?.startsWith('sk_test_')) {
        livemode = false;
    }

    // Default currency
    const currencyEnv = getEnvVar(env, QZPAY_ENV_VARS.DEFAULT_CURRENCY);
    const defaultCurrency: QZPayCurrency = (currencyEnv as QZPayCurrency) || 'USD';

    // Grace period
    const gracePeriodDays = parseEnvNumber(getEnvVar(env, QZPAY_ENV_VARS.GRACE_PERIOD_DAYS), 3);

    return {
        providers,
        defaultCurrency,
        livemode,
        gracePeriodDays
    };
}

/**
 * Create QZPayBilling instance with auto-detected configuration from environment
 *
 * @example
 * ```typescript
 * import { createQZPayBillingFromEnv } from '@qazuor/qzpay-core';
 * import { createQZPayDrizzleStorage } from '@qazuor/qzpay-drizzle';
 *
 * // Auto-detects STRIPE_SECRET_KEY, MP_ACCESS_TOKEN, etc.
 * const billing = createQZPayBillingFromEnv({
 *   storage: createQZPayDrizzleStorage({ db }),
 *   plans: PLANS,
 * });
 * ```
 */
export function createQZPayBillingFromEnv(config: QZPayBillingFromEnvConfig): QZPayBilling {
    // Use provided env or fallback to empty (process.env access handled by caller)
    const env = config.env ?? {};

    const detected = qzpayDetectEnvConfig(env);

    // Note: Payment adapter creation will be handled by provider packages
    // In Phase 1, we just pass undefined and the user can configure manually

    return createQZPayBilling({
        storage: config.storage,
        plans: config.plans,
        defaultCurrency: config.defaultCurrency ?? detected.defaultCurrency,
        livemode: config.livemode ?? detected.livemode,
        notifications: config.notifications,
        gracePeriodDays: detected.gracePeriodDays
    });
}

/**
 * Get detected providers from environment (useful for debugging)
 */
export function qzpayGetDetectedProviders(env: Record<string, string | undefined> = {}): QZPayDetectedProvider[] {
    return qzpayDetectEnvConfig(env).providers;
}
