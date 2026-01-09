/**
 * Tests for env generator
 */
import { describe, expect, it } from 'vitest';
import { generateEnv } from '../../src/generators/env.js';
import { fullConfig, libraryConfig, minimalConfig, nestjsConfig } from '../fixtures/config.js';

describe('generateEnv', () => {
    describe('header', () => {
        it('should include project name in header', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('# test-billing Environment Variables');
        });

        it('should include project description', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('# Test billing system');
        });
    });

    describe('application variables', () => {
        it('should include NODE_ENV', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('NODE_ENV=development');
        });
    });

    describe('database variables', () => {
        it('should include DATABASE_URL for drizzle storage', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('# Database (PostgreSQL)');
            expect(result).toContain('DATABASE_URL=postgresql://');
        });

        it('should not include DATABASE_URL for in-memory storage', () => {
            const result = generateEnv(libraryConfig);
            expect(result).not.toContain('DATABASE_URL');
        });
    });

    describe('stripe variables', () => {
        it('should include Stripe keys when provider is stripe', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('# Stripe');
            expect(result).toContain('STRIPE_SECRET_KEY=sk_test_');
            expect(result).toContain('STRIPE_WEBHOOK_SECRET=whsec_');
            expect(result).toContain('STRIPE_PUBLISHABLE_KEY=pk_test_');
        });

        it('should include Stripe dashboard link', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('https://dashboard.stripe.com/apikeys');
        });

        it('should not include Stripe keys when provider is mercadopago only', () => {
            const result = generateEnv(libraryConfig);
            expect(result).not.toContain('STRIPE_SECRET_KEY');
        });
    });

    describe('mercadopago variables', () => {
        it('should include MercadoPago keys when provider is mercadopago', () => {
            const result = generateEnv(libraryConfig);
            expect(result).toContain('# MercadoPago');
            expect(result).toContain('MERCADOPAGO_ACCESS_TOKEN=APP_USR-');
            expect(result).toContain('MERCADOPAGO_WEBHOOK_SECRET=');
            expect(result).toContain('MERCADOPAGO_PUBLIC_KEY=APP_USR-');
        });

        it('should include MercadoPago developers link', () => {
            const result = generateEnv(libraryConfig);
            expect(result).toContain('https://www.mercadopago.com/developers');
        });

        it('should not include MercadoPago keys when provider is stripe only', () => {
            const result = generateEnv(minimalConfig);
            expect(result).not.toContain('MERCADOPAGO_ACCESS_TOKEN');
        });
    });

    describe('server variables', () => {
        it('should include server variables when framework is hono', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('# Server');
            expect(result).toContain('PORT=3000');
            expect(result).toContain('HOST=localhost');
        });

        it('should include server variables when framework is nestjs', () => {
            const result = generateEnv(nestjsConfig);
            expect(result).toContain('PORT=3000');
        });

        it('should not include server variables when framework is none', () => {
            const result = generateEnv(libraryConfig);
            expect(result).not.toContain('PORT=3000');
        });

        it('should include JWT_SECRET when framework is set', () => {
            const result = generateEnv(minimalConfig);
            expect(result).toContain('# Security');
            expect(result).toContain('JWT_SECRET=');
        });
    });

    describe('marketplace variables', () => {
        it('should include Stripe Connect variables when marketplace is enabled', () => {
            const result = generateEnv(fullConfig);
            expect(result).toContain('# Marketplace (Stripe Connect)');
            expect(result).toContain('STRIPE_CONNECT_CLIENT_ID=ca_');
        });

        it('should not include Stripe Connect variables when marketplace is disabled', () => {
            const result = generateEnv(minimalConfig);
            expect(result).not.toContain('STRIPE_CONNECT_CLIENT_ID');
        });
    });

    describe('both providers', () => {
        it('should include both Stripe and MercadoPago when both is selected', () => {
            const result = generateEnv(fullConfig);
            expect(result).toContain('STRIPE_SECRET_KEY');
            expect(result).toContain('MERCADOPAGO_ACCESS_TOKEN');
        });
    });
});
