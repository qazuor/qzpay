/**
 * Environment Generator
 *
 * Generates the `.env.example` file with all required environment variables
 * based on the selected providers, storage, and framework options.
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';

/**
 * Generate `.env.example` file content with environment variable templates.
 *
 * Creates a complete environment template including:
 * - Application settings (NODE_ENV)
 * - Database connection (for Drizzle)
 * - Payment provider credentials (Stripe/MercadoPago)
 * - Server configuration (for Hono/NestJS)
 * - Marketplace settings (for Stripe Connect)
 *
 * @param config - The complete initialization configuration
 * @returns Generated environment file content
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: 'My billing' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: false },
 *   plans: { tiers: [] }
 * };
 *
 * const content = generateEnv(config);
 * // Returns .env template with DATABASE_URL, STRIPE_* variables, etc.
 * ```
 */
export function generateEnv(config: InitConfig): string {
    const lines: string[] = [
        `# ${config.project.name} Environment Variables`,
        `# ${config.project.description || 'QZPay Billing Configuration'}`,
        '',
        '# Application',
        'NODE_ENV=development',
        ''
    ];

    if (config.storage.type === 'drizzle') {
        lines.push('# Database (PostgreSQL)');
        lines.push('DATABASE_URL=postgresql://user:password@localhost:5432/dbname');
        lines.push('');
    }

    if (config.provider.stripe) {
        lines.push('# Stripe');
        lines.push('# Get your keys at: https://dashboard.stripe.com/apikeys');
        lines.push('STRIPE_SECRET_KEY=sk_test_...');
        lines.push('STRIPE_WEBHOOK_SECRET=whsec_...');
        lines.push('STRIPE_PUBLISHABLE_KEY=pk_test_...');
        lines.push('');
    }

    if (config.provider.mercadopago) {
        lines.push('# MercadoPago');
        lines.push('# Get your keys at: https://www.mercadopago.com/developers/panel/app');
        lines.push('MERCADOPAGO_ACCESS_TOKEN=APP_USR-...');
        lines.push('MERCADOPAGO_WEBHOOK_SECRET=...');
        lines.push('MERCADOPAGO_PUBLIC_KEY=APP_USR-...');
        lines.push('');
    }

    if (config.framework.type !== 'none') {
        lines.push('# Server');
        lines.push('PORT=3000');
        lines.push('HOST=localhost');
        lines.push('');
        lines.push('# Security');
        lines.push('JWT_SECRET=your-super-secret-key-change-in-production');
        lines.push('');
    }

    if (config.features.marketplace) {
        lines.push('# Marketplace (Stripe Connect)');
        lines.push('STRIPE_CONNECT_CLIENT_ID=ca_...');
        lines.push('');
    }

    return lines.join('\n');
}
