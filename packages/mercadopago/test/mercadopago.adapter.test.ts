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

        it('should throw error when access token has an unrecognized prefix', () => {
            expect(() => {
                new QZPayMercadoPagoAdapter({
                    accessToken: 'invalid_token',
                    webhookSecret: 'secret_123'
                });
            }).toThrow(/Invalid MercadoPago access token format/);
        });

        it('should accept valid APP_USR- access token', () => {
            const adapter = new QZPayMercadoPagoAdapter({
                accessToken: 'APP_USR-production-token-123',
                webhookSecret: 'secret_123'
            });

            expect(adapter.provider).toBe('mercadopago');
        });

        // Some MercadoPago applications issue their Test credentials with a
        // `TEST-` prefix; the adapter accepts it alongside `APP_USR-`.
        it('should accept TEST- access token', () => {
            const adapter = new QZPayMercadoPagoAdapter({
                accessToken: 'TEST-sandbox-token-123',
                webhookSecret: 'secret_123'
            });

            expect(adapter.provider).toBe('mercadopago');
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

        it('should accept a valid absolute defaultPlanBackUrl', () => {
            const adapter = new QZPayMercadoPagoAdapter({
                ...config,
                defaultPlanBackUrl: 'https://hospeda.com.ar/es/suscriptores/checkout/success/'
            });

            expect(adapter.prices).toBeInstanceOf(QZPayMercadoPagoPriceAdapter);
        });

        // Fail fast at construction (like the access-token check) so a malformed
        // back_url is caught at boot, not only when the first plan is provisioned.
        it('should throw when defaultPlanBackUrl is not an absolute http(s) URL', () => {
            expect(() => {
                new QZPayMercadoPagoAdapter({ ...config, defaultPlanBackUrl: 'not-a-url' });
            }).toThrow(/defaultPlanBackUrl.*absolute http/i);
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

    // End-to-end wiring: the config `defaultPlanBackUrl` must actually reach the
    // `preapproval_plan` create body through the factory → adapter → price-adapter
    // chain. Constructing the price adapter directly (as price.adapter.test.ts does)
    // would not catch a dropped/reordered constructor argument at mercadopago.adapter.ts.
    it('should thread defaultPlanBackUrl through to the preapproval_plan create body', async () => {
        const { PreApprovalPlan } = await import('mercadopago');
        const planCreate = vi.fn().mockResolvedValue({ id: 'plan_wired' });
        vi.mocked(PreApprovalPlan).mockImplementation(() => ({ create: planCreate }) as never);

        const adapter = createQZPayMercadoPagoAdapter({
            accessToken: 'APP_USR-test-token',
            defaultPlanBackUrl: 'https://hospeda.com.ar/return/'
        });

        const planId = await adapter.prices.create(
            { planId: 'plan-uuid', unitAmount: 2999, currency: 'ARS', billingInterval: 'month' },
            'Premium Plan'
        );

        expect(planId).toBe('plan_wired');
        expect(planCreate).toHaveBeenCalledWith({
            body: expect.objectContaining({ back_url: 'https://hospeda.com.ar/return/' })
        });
    });
});
