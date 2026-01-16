/**
 * Stripe Main Adapter Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { QZPayStripeCheckoutAdapter } from '../src/adapters/checkout.adapter.js';
import { QZPayStripeCustomerAdapter } from '../src/adapters/customer.adapter.js';
import { QZPayStripePaymentAdapter } from '../src/adapters/payment.adapter.js';
import { QZPayStripePriceAdapter } from '../src/adapters/price.adapter.js';
import { QZPayStripeSubscriptionAdapter } from '../src/adapters/subscription.adapter.js';
import { QZPayStripeVendorAdapter } from '../src/adapters/vendor.adapter.js';
import { QZPayStripeWebhookAdapter } from '../src/adapters/webhook.adapter.js';
import { QZPayStripeAdapter, createQZPayStripeAdapter } from '../src/stripe.adapter.js';

// Mock Stripe
vi.mock('stripe', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            customers: {},
            subscriptions: {},
            paymentIntents: {},
            refunds: {},
            checkout: { sessions: {} },
            prices: {},
            products: {},
            accounts: {},
            accountLinks: {},
            payouts: {},
            transfers: {},
            webhooks: {}
        }))
    };
});

describe('QZPayStripeAdapter', () => {
    const config = {
        secretKey: 'sk_test_123',
        webhookSecret: 'whsec_test123'
    };

    describe('constructor', () => {
        it('should create adapter with required config', () => {
            const adapter = new QZPayStripeAdapter(config);

            expect(adapter.provider).toBe('stripe');
            expect(adapter.customers).toBeInstanceOf(QZPayStripeCustomerAdapter);
            expect(adapter.subscriptions).toBeInstanceOf(QZPayStripeSubscriptionAdapter);
            expect(adapter.payments).toBeInstanceOf(QZPayStripePaymentAdapter);
            expect(adapter.checkout).toBeInstanceOf(QZPayStripeCheckoutAdapter);
            expect(adapter.prices).toBeInstanceOf(QZPayStripePriceAdapter);
            expect(adapter.webhooks).toBeInstanceOf(QZPayStripeWebhookAdapter);
        });

        it('should throw error when secret key does not start with sk_', () => {
            expect(() => {
                new QZPayStripeAdapter({
                    secretKey: 'invalid_key',
                    webhookSecret: 'whsec_test123'
                });
            }).toThrow("Invalid Stripe secret key format. Expected key starting with 'sk_'");
        });

        it('should throw error when webhook secret does not start with whsec_', () => {
            expect(() => {
                new QZPayStripeAdapter({
                    secretKey: 'sk_test_123',
                    webhookSecret: 'invalid_secret'
                });
            }).toThrow("Invalid Stripe webhook secret format. Expected secret starting with 'whsec_'");
        });

        it('should accept valid live secret key', () => {
            const adapter = new QZPayStripeAdapter({
                secretKey: 'sk_live_123',
                webhookSecret: 'whsec_test123'
            });

            expect(adapter.provider).toBe('stripe');
        });

        it('should accept valid test secret key', () => {
            const adapter = new QZPayStripeAdapter({
                secretKey: 'sk_test_123',
                webhookSecret: 'whsec_test123'
            });

            expect(adapter.provider).toBe('stripe');
        });

        it('should not create vendor adapter without connect config', () => {
            const adapter = new QZPayStripeAdapter(config);

            expect(adapter.vendors).toBeUndefined();
        });

        it('should create vendor adapter with connect config', () => {
            const adapter = new QZPayStripeAdapter(config, {
                platformAccountId: 'acct_platform'
            });

            expect(adapter.vendors).toBeInstanceOf(QZPayStripeVendorAdapter);
        });

        it('should pass API version when provided', async () => {
            const Stripe = vi.mocked((await import('stripe')).default);

            new QZPayStripeAdapter({
                ...config,
                apiVersion: '2024-06-20' as never
            });

            expect(Stripe).toHaveBeenCalledWith(
                'sk_test_123',
                expect.objectContaining({
                    apiVersion: '2024-06-20'
                })
            );
        });

        it('should pass stripe options when provided', async () => {
            const Stripe = vi.mocked((await import('stripe')).default);

            new QZPayStripeAdapter({
                ...config,
                stripeOptions: {
                    maxNetworkRetries: 3,
                    timeout: 30000
                }
            });

            expect(Stripe).toHaveBeenCalledWith(
                'sk_test_123',
                expect.objectContaining({
                    maxNetworkRetries: 3,
                    timeout: 30000
                })
            );
        });
    });

    describe('getStripeClient', () => {
        it('should return the underlying Stripe client', () => {
            const adapter = new QZPayStripeAdapter(config);

            const client = adapter.getStripeClient();

            expect(client).toBeDefined();
            expect(client.customers).toBeDefined();
        });
    });
});

describe('createQZPayStripeAdapter', () => {
    it('should create an adapter instance', () => {
        const adapter = createQZPayStripeAdapter({
            secretKey: 'sk_test_123',
            webhookSecret: 'whsec_123'
        });

        expect(adapter).toBeInstanceOf(QZPayStripeAdapter);
    });

    it('should create an adapter with connect config', () => {
        const adapter = createQZPayStripeAdapter(
            {
                secretKey: 'sk_test_123',
                webhookSecret: 'whsec_123'
            },
            {
                platformAccountId: 'acct_123',
                applicationFeePercent: 10
            }
        );

        expect(adapter).toBeInstanceOf(QZPayStripeAdapter);
        expect(adapter.vendors).toBeInstanceOf(QZPayStripeVendorAdapter);
    });
});
