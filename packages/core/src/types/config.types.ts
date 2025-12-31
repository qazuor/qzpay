/**
 * Configuration types for QZPay
 */
import type { QZPayCurrency, QZPayPaymentProvider } from '../constants/index.js';

export interface QZPayConfig {
    providers: QZPayProviderConfig[];
    defaultCurrency: QZPayCurrency;
    livemode: boolean;
    webhookSecret?: string;
    storage?: QZPayStorageConfig;
    email?: QZPayEmailConfig;
}

export interface QZPayProviderConfig {
    provider: QZPayPaymentProvider;
    apiKey: string;
    webhookSecret?: string;
    options?: Record<string, unknown>;
}

export interface QZPayStorageConfig {
    type: 'drizzle' | 'custom';
    options?: Record<string, unknown>;
}

export interface QZPayEmailConfig {
    type: 'resend' | 'sendgrid' | 'custom';
    apiKey?: string;
    from?: string;
    options?: Record<string, unknown>;
}

export interface QZPayEnvConfig {
    QZPAY_STRIPE_API_KEY?: string;
    QZPAY_STRIPE_WEBHOOK_SECRET?: string;
    QZPAY_MERCADOPAGO_API_KEY?: string;
    QZPAY_MERCADOPAGO_WEBHOOK_SECRET?: string;
    QZPAY_DEFAULT_CURRENCY?: QZPayCurrency;
    QZPAY_LIVEMODE?: string;
    QZPAY_WEBHOOK_SECRET?: string;
}
