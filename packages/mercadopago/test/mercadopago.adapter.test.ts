/**
 * MercadoPago Main Adapter Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoCheckoutAdapter } from '../src/adapters/checkout.adapter.js';
import { QZPayMercadoPagoCustomerAdapter } from '../src/adapters/customer.adapter.js';
import { QZPayMercadoPagoPaymentAdapter } from '../src/adapters/payment.adapter.js';
import { QZPayMercadoPagoPriceAdapter } from '../src/adapters/price.adapter.js';
import { QZPayMercadoPagoSubscriptionAdapter } from '../src/adapters/subscription.adapter.js';
import { QZPayMercadoPagoWebhookAdapter } from '../src/adapters/webhook.adapter.js';
import { QZPayMercadoPagoAdapter, createQZPayMercadoPagoAdapter } from '../src/mercadopago.adapter.js';

// Mock mercadopago module
vi.mock('mercadopago', () => ({
    MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
    Customer: vi.fn().mockImplementation(() => ({})),
    Payment: vi.fn().mockImplementation(() => ({})),
    PaymentRefund: vi.fn().mockImplementation(() => ({})),
    PreApproval: vi.fn().mockImplementation(() => ({})),
    PreApprovalPlan: vi.fn().mockImplementation(() => ({})),
    Preference: vi.fn().mockImplementation(() => ({})),
    CardToken: vi.fn().mockImplementation(() => ({}))
}));

describe('QZPayMercadoPagoAdapter', () => {
    const config = {
        accessToken: 'APP_USR-test-token-12345',
        webhookSecret: 'webhook_secret_123'
    };

    describe('constructor', () => {
        it('should create adapter with required config', () => {
            const adapter = new QZPayMercadoPagoAdapter(config);

            expect(adapter.provider).toBe('mercadopago');
            expect(adapter.customers).toBeInstanceOf(QZPayMercadoPagoCustomerAdapter);
            expect(adapter.subscriptions).toBeInstanceOf(QZPayMercadoPagoSubscriptionAdapter);
            expect(adapter.payments).toBeInstanceOf(QZPayMercadoPagoPaymentAdapter);
            expect(adapter.checkout).toBeInstanceOf(QZPayMercadoPagoCheckoutAdapter);
            expect(adapter.prices).toBeInstanceOf(QZPayMercadoPagoPriceAdapter);
            expect(adapter.webhooks).toBeInstanceOf(QZPayMercadoPagoWebhookAdapter);
        });

        it('should throw error when access token does not start with APP_USR-', () => {
            expect(() => {
                new QZPayMercadoPagoAdapter({
                    accessToken: 'invalid_token',
                    webhookSecret: 'secret_123'
                });
            }).toThrow(/APP_USR-/);
        });

        it('should accept valid APP_USR- access token', () => {
            const adapter = new QZPayMercadoPagoAdapter({
                accessToken: 'APP_USR-production-token-123',
                webhookSecret: 'secret_123'
            });

            expect(adapter.provider).toBe('mercadopago');
        });

        // SPEC-123 A3: current MercadoPago no longer emits the legacy
        // `TEST-` prefix — both sandbox and production tokens use
        // `APP_USR-`. The adapter now rejects `TEST-` to surface
        // mis-configurations early.
        it('should reject legacy TEST- access token (stale prefix)', () => {
            expect(() => {
                new QZPayMercadoPagoAdapter({
                    accessToken: 'TEST-sandbox-token-123',
                    webhookSecret: 'secret_123'
                });
            }).toThrow(/APP_USR-/);
        });

        it('should use default timeout when not specified', async () => {
            const { MercadoPagoConfig } = await import('mercadopago');
            new QZPayMercadoPagoAdapter(config);

            expect(MercadoPagoConfig).toHaveBeenCalledWith({
                accessToken: config.accessToken,
                options: {
                    timeout: 5000
                }
            });
        });

        it('should use custom timeout when specified', async () => {
            const { MercadoPagoConfig } = await import('mercadopago');
            new QZPayMercadoPagoAdapter({ ...config, timeout: 10000 });

            expect(MercadoPagoConfig).toHaveBeenCalledWith({
                accessToken: config.accessToken,
                options: {
                    timeout: 10000
                }
            });
        });

        it('should include integratorId when provided', async () => {
            const { MercadoPagoConfig } = await import('mercadopago');
            new QZPayMercadoPagoAdapter({
                ...config,
                integratorId: 'integrator_123'
            });

            expect(MercadoPagoConfig).toHaveBeenCalledWith({
                accessToken: config.accessToken,
                options: expect.objectContaining({
                    integratorId: 'integrator_123'
                })
            });
        });

        it('should include platformId when provided', async () => {
            const { MercadoPagoConfig } = await import('mercadopago');
            new QZPayMercadoPagoAdapter({
                ...config,
                platformId: 'platform_123'
            });

            expect(MercadoPagoConfig).toHaveBeenCalledWith({
                accessToken: config.accessToken,
                options: expect.objectContaining({
                    platformId: 'platform_123'
                })
            });
        });

        // SPEC-123 A5: sandbox mode is now an explicit config flag, not
        // inferred from the access token shape (current MP uses APP_USR-
        // for both sandbox and production tokens, so the old `includes('TEST')`
        // heuristic always returned false in practice).
        it('should use sandbox mode when explicitly configured', () => {
            const adapter = new QZPayMercadoPagoAdapter({
                accessToken: 'APP_USR-sandbox-token-123',
                webhookSecret: 'secret',
                sandbox: true
            });

            expect(adapter.checkout).toBeInstanceOf(QZPayMercadoPagoCheckoutAdapter);
        });

        it('should default to production mode when sandbox is unset', () => {
            const adapter = new QZPayMercadoPagoAdapter({
                accessToken: 'APP_USR-production-token',
                webhookSecret: 'secret'
            });

            expect(adapter.checkout).toBeInstanceOf(QZPayMercadoPagoCheckoutAdapter);
        });
    });

    describe('getMercadoPagoClient', () => {
        it('should return the underlying client', () => {
            const adapter = new QZPayMercadoPagoAdapter(config);

            const client = adapter.getMercadoPagoClient();

            expect(client).toBeDefined();
        });
    });
});

describe('createQZPayMercadoPagoAdapter', () => {
    it('should create an adapter instance', () => {
        const adapter = createQZPayMercadoPagoAdapter({
            accessToken: 'APP_USR-test-token',
            webhookSecret: 'secret_123'
        });

        expect(adapter).toBeInstanceOf(QZPayMercadoPagoAdapter);
    });

    it('should work without optional config', () => {
        const adapter = createQZPayMercadoPagoAdapter({
            accessToken: 'APP_USR-test-token'
        });

        expect(adapter).toBeInstanceOf(QZPayMercadoPagoAdapter);
    });
});
