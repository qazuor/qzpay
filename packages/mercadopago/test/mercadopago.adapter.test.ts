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
    Preference: vi.fn().mockImplementation(() => ({}))
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

        it('should detect sandbox mode from TEST token', () => {
            const adapter = new QZPayMercadoPagoAdapter({
                accessToken: 'TEST-12345-token',
                webhookSecret: 'secret'
            });

            // Checkout adapter should be in sandbox mode
            expect(adapter.checkout).toBeInstanceOf(QZPayMercadoPagoCheckoutAdapter);
        });

        it('should detect production mode from non-TEST token', () => {
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
