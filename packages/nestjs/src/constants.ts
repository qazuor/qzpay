/**
 * QZPay NestJS Constants
 * Injection tokens and metadata keys
 */

/**
 * Injection token for the QZPayBilling instance
 */
export const QZPAY_BILLING_TOKEN = Symbol('QZPAY_BILLING');

/**
 * Injection token for QZPay module options
 */
export const QZPAY_OPTIONS_TOKEN = Symbol('QZPAY_OPTIONS');

/**
 * Metadata key for required entitlements
 */
export const REQUIRED_ENTITLEMENT_KEY = 'qzpay:required-entitlement';

/**
 * Metadata key for required subscription status
 */
export const REQUIRED_SUBSCRIPTION_KEY = 'qzpay:required-subscription';

/**
 * Metadata key for rate limit configuration
 */
export const RATE_LIMIT_KEY = 'qzpay:rate-limit';

/**
 * Metadata key for webhook provider
 */
export const WEBHOOK_PROVIDER_KEY = 'qzpay:webhook-provider';
