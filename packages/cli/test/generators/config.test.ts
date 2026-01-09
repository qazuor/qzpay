/**
 * Tests for config generator
 */
import { describe, expect, it } from 'vitest';
import { generateConfig } from '../../src/generators/config.js';
import { fullConfig, libraryConfig, minimalConfig } from '../fixtures/config.js';

describe('generateConfig', () => {
    describe('imports', () => {
        it('should import QZPayBilling from core', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("import { QZPayBilling } from '@qazuor/qzpay-core'");
        });

        it('should import Drizzle when storage is drizzle', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("import { QZPayDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle'");
            expect(result).toContain("import { drizzle } from 'drizzle-orm/postgres-js'");
            expect(result).toContain("import postgres from 'postgres'");
        });

        it('should import Stripe adapter when provider is stripe', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe'");
            expect(result).toContain("import Stripe from 'stripe'");
        });

        it('should import MercadoPago adapter when provider is mercadopago', () => {
            const result = generateConfig(libraryConfig);
            expect(result).toContain("import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago'");
        });

        it('should import both adapters when provider is both', () => {
            const result = generateConfig(fullConfig);
            expect(result).toContain("import { QZPayStripeAdapter } from '@qazuor/qzpay-stripe'");
            expect(result).toContain("import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago'");
        });
    });

    describe('environment variables', () => {
        it('should include DATABASE_URL for drizzle storage', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("getEnvVar('DATABASE_URL')");
        });

        it('should include STRIPE_SECRET_KEY for stripe provider', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("getEnvVar('STRIPE_SECRET_KEY')");
            expect(result).toContain("getEnvVar('STRIPE_WEBHOOK_SECRET')");
        });

        it('should include MERCADOPAGO_ACCESS_TOKEN for mercadopago provider', () => {
            const result = generateConfig(libraryConfig);
            expect(result).toContain("getEnvVar('MERCADOPAGO_ACCESS_TOKEN')");
            expect(result).toContain("getEnvVar('MERCADOPAGO_WEBHOOK_SECRET')");
        });
    });

    describe('adapters', () => {
        it('should create storage adapter', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('new QZPayDrizzleStorageAdapter');
            expect(result).toContain('livemode: isProduction');
        });

        it('should create Stripe adapter', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('new QZPayStripeAdapter');
            expect(result).toContain('client: stripe');
        });

        it('should create MercadoPago adapter', () => {
            const result = generateConfig(libraryConfig);
            expect(result).toContain('createQZPayMercadoPagoAdapter');
            expect(result).toContain('accessToken: mpAccessToken');
        });
    });

    describe('billing instance', () => {
        it('should create QZPayBilling instance', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('new QZPayBilling');
            expect(result).toContain('storage: storageAdapter');
        });

        it('should use stripe adapter as primary when stripe is selected', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('provider: stripeAdapter');
        });

        it('should use mp adapter as primary when only mercadopago is selected', () => {
            const result = generateConfig(libraryConfig);
            expect(result).toContain('provider: mpAdapter');
        });
    });

    describe('event listeners', () => {
        it('should include subscription.created listener', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("billing.on('subscription.created'");
        });

        it('should include subscription.canceled listener', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("billing.on('subscription.canceled'");
        });

        it('should include payment.succeeded listener', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain("billing.on('payment.succeeded'");
        });

        it('should include invoice.paid listener when usage-based is enabled', () => {
            const result = generateConfig(fullConfig);
            expect(result).toContain("billing.on('invoice.paid'");
        });

        it('should not include invoice.paid listener when usage-based is disabled', () => {
            const result = generateConfig(minimalConfig);
            expect(result).not.toContain("billing.on('invoice.paid'");
        });
    });

    describe('project metadata', () => {
        it('should include project name in header comment', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('test-billing - QZPay Configuration');
        });

        it('should include project description', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('Test billing system');
        });

        it('should use PascalCase project name in event logs', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('[TestBilling]');
        });
    });

    describe('export', () => {
        it('should export billing as default', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('export default billing');
        });

        it('should export db when using drizzle', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('export const db');
        });

        it('should export stripe client when using stripe', () => {
            const result = generateConfig(minimalConfig);
            expect(result).toContain('export const stripe');
        });
    });
});
