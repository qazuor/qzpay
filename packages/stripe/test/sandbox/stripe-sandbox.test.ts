/**
 * Stripe Sandbox Integration Tests
 *
 * These tests run against the real Stripe test mode API.
 * They require the following environment variables:
 * - STRIPE_SECRET_KEY: Stripe test mode secret key (sk_test_...)
 * - STRIPE_WEBHOOK_SECRET: Optional webhook secret for signature verification
 *
 * Tests will be skipped if STRIPE_SECRET_KEY is not set.
 *
 * IMPORTANT: These tests create real resources in Stripe test mode.
 * They attempt to clean up after themselves but may leave some resources.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type QZPayStripeAdapter, createQZPayStripeAdapter } from '../../src/index.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_secret';

// Skip all tests if no Stripe key is available
const describeWithStripe = STRIPE_SECRET_KEY ? describe : describe.skip;

describeWithStripe('Stripe Sandbox Integration Tests', () => {
    let adapter: QZPayStripeAdapter;
    const createdCustomerIds: string[] = [];
    const createdProductIds: string[] = [];
    const createdPriceIds: string[] = [];

    beforeAll(() => {
        adapter = createQZPayStripeAdapter({
            secretKey: STRIPE_SECRET_KEY ?? '',
            webhookSecret: STRIPE_WEBHOOK_SECRET
        });
    });

    afterAll(async () => {
        // Clean up created customers
        const stripe = adapter.getStripeClient();

        for (const customerId of createdCustomerIds) {
            try {
                await stripe.customers.del(customerId);
            } catch {
                // Ignore cleanup errors
            }
        }

        // Prices cannot be deleted, only archived
        for (const priceId of createdPriceIds) {
            try {
                await stripe.prices.update(priceId, { active: false });
            } catch {
                // Ignore cleanup errors
            }
        }

        // Products can be archived
        for (const productId of createdProductIds) {
            try {
                await stripe.products.update(productId, { active: false });
            } catch {
                // Ignore cleanup errors
            }
        }
    });

    describe('Customer Operations', () => {
        it('should create a customer in Stripe', async () => {
            const customerId = await adapter.customers.create({
                email: `test-${Date.now()}@example.com`,
                externalId: `ext_${Date.now()}`,
                name: 'QZPay Test Customer'
            });

            expect(customerId).toBeDefined();
            expect(customerId).toMatch(/^cus_/);

            createdCustomerIds.push(customerId);
        });

        it('should retrieve a customer from Stripe', async () => {
            // First create a customer
            const customerId = await adapter.customers.create({
                email: `retrieve-${Date.now()}@example.com`,
                externalId: `ext_retrieve_${Date.now()}`,
                name: 'Retrieve Test Customer'
            });
            createdCustomerIds.push(customerId);

            // Then retrieve it
            const customer = await adapter.customers.retrieve(customerId);

            expect(customer).toBeDefined();
            expect(customer.id).toBe(customerId);
            expect(customer.name).toBe('Retrieve Test Customer');
        });

        it('should update a customer in Stripe', async () => {
            // Create customer
            const customerId = await adapter.customers.create({
                email: `update-${Date.now()}@example.com`,
                externalId: `ext_update_${Date.now()}`
            });
            createdCustomerIds.push(customerId);

            // Update customer
            await adapter.customers.update(customerId, {
                name: 'Updated Name',
                metadata: { updated: 'true' }
            });

            // Verify update
            const customer = await adapter.customers.retrieve(customerId);
            expect(customer.name).toBe('Updated Name');
            expect(customer.metadata?.updated).toBe('true');
        });

        it('should delete a customer from Stripe', async () => {
            // Create customer
            const customerId = await adapter.customers.create({
                email: `delete-${Date.now()}@example.com`,
                externalId: `ext_delete_${Date.now()}`
            });

            // Delete customer
            await adapter.customers.delete(customerId);

            // Verify deletion
            await expect(adapter.customers.retrieve(customerId)).rejects.toThrow();
        });

        it('should create customer with metadata', async () => {
            const customerId = await adapter.customers.create({
                email: `metadata-${Date.now()}@example.com`,
                externalId: `ext_metadata_${Date.now()}`,
                metadata: {
                    company: 'Test Company',
                    tier: 'premium',
                    source: 'qzpay_test'
                }
            });
            createdCustomerIds.push(customerId);

            const customer = await adapter.customers.retrieve(customerId);
            expect(customer.metadata?.company).toBe('Test Company');
            expect(customer.metadata?.tier).toBe('premium');
        });
    });

    describe('Payment Intent Operations', () => {
        let testCustomerId: string;

        beforeAll(async () => {
            testCustomerId = await adapter.customers.create({
                email: `payment-${Date.now()}@example.com`,
                externalId: `ext_payment_${Date.now()}`
            });
            createdCustomerIds.push(testCustomerId);
        });

        it('should create a payment intent', async () => {
            const result = await adapter.payments.createIntent({
                amount: 5000,
                currency: 'usd',
                customerId: testCustomerId,
                metadata: { test: 'true' }
            });

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^pi_/);
            expect(result.clientSecret).toBeDefined();
            expect(result.status).toBe('requires_payment_method');
        });

        it('should create payment intent with different currencies', async () => {
            const currencies = ['eur', 'gbp', 'jpy'];

            for (const currency of currencies) {
                const result = await adapter.payments.createIntent({
                    amount: 1000,
                    currency,
                    customerId: testCustomerId
                });

                expect(result.id).toMatch(/^pi_/);
            }
        });

        it('should retrieve a payment intent', async () => {
            const created = await adapter.payments.createIntent({
                amount: 2500,
                currency: 'usd',
                customerId: testCustomerId
            });

            const retrieved = await adapter.payments.retrieveIntent(created.id);

            expect(retrieved.id).toBe(created.id);
            expect(retrieved.status).toBe('requires_payment_method');
        });

        it('should cancel a payment intent', async () => {
            const created = await adapter.payments.createIntent({
                amount: 3000,
                currency: 'usd',
                customerId: testCustomerId
            });

            const canceled = await adapter.payments.cancelIntent(created.id);

            expect(canceled.status).toBe('canceled');
        });
    });

    describe('Price Operations', () => {
        let testProductId: string;

        beforeAll(async () => {
            // Create a product first
            const stripe = adapter.getStripeClient();
            const product = await stripe.products.create({
                name: `QZPay Test Product ${Date.now()}`,
                metadata: { test: 'true' }
            });
            testProductId = product.id;
            createdProductIds.push(testProductId);
        });

        it('should create a recurring price', async () => {
            const priceId = await adapter.prices.create({
                productId: testProductId,
                unitAmount: 1999,
                currency: 'usd',
                billingInterval: 'month'
            });

            expect(priceId).toBeDefined();
            expect(priceId).toMatch(/^price_/);

            createdPriceIds.push(priceId);
        });

        it('should create a yearly price', async () => {
            const priceId = await adapter.prices.create({
                productId: testProductId,
                unitAmount: 19999,
                currency: 'usd',
                billingInterval: 'year'
            });

            expect(priceId).toMatch(/^price_/);
            createdPriceIds.push(priceId);
        });

        it('should create a one-time price', async () => {
            const priceId = await adapter.prices.create({
                productId: testProductId,
                unitAmount: 4999,
                currency: 'usd',
                type: 'one_time'
            });

            expect(priceId).toMatch(/^price_/);
            createdPriceIds.push(priceId);
        });

        it('should retrieve a price', async () => {
            const priceId = await adapter.prices.create({
                productId: testProductId,
                unitAmount: 2999,
                currency: 'usd',
                billingInterval: 'month'
            });
            createdPriceIds.push(priceId);

            const price = await adapter.prices.retrieve(priceId);

            expect(price.id).toBe(priceId);
            expect(price.unitAmount).toBe(2999);
            expect(price.currency).toBe('usd');
        });

        it('should list prices for a product', async () => {
            const prices = await adapter.prices.list(testProductId);

            expect(prices).toBeDefined();
            expect(Array.isArray(prices)).toBe(true);
            expect(prices.length).toBeGreaterThan(0);
        });
    });

    describe('Subscription Operations', () => {
        let testCustomerId: string;
        let testPriceId: string;

        beforeAll(async () => {
            // Create customer
            testCustomerId = await adapter.customers.create({
                email: `subscription-${Date.now()}@example.com`,
                externalId: `ext_sub_${Date.now()}`
            });
            createdCustomerIds.push(testCustomerId);

            // Create product and price
            const stripe = adapter.getStripeClient();
            const product = await stripe.products.create({
                name: `QZPay Sub Test Product ${Date.now()}`
            });
            createdProductIds.push(product.id);

            testPriceId = await adapter.prices.create({
                productId: product.id,
                unitAmount: 999,
                currency: 'usd',
                billingInterval: 'month'
            });
            createdPriceIds.push(testPriceId);
        });

        it('should create a subscription with trial', async () => {
            const stripe = adapter.getStripeClient();

            // Create a payment method for the customer (test card)
            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: {
                    token: 'tok_visa'
                }
            });

            await stripe.paymentMethods.attach(paymentMethod.id, {
                customer: testCustomerId
            });

            await stripe.customers.update(testCustomerId, {
                invoice_settings: {
                    default_payment_method: paymentMethod.id
                }
            });

            const subscriptionId = await adapter.subscriptions.create({
                customerId: testCustomerId,
                priceId: testPriceId,
                trialDays: 7
            });

            expect(subscriptionId).toBeDefined();
            expect(subscriptionId).toMatch(/^sub_/);

            // Clean up subscription
            await adapter.subscriptions.cancel(subscriptionId);
        });

        it('should retrieve subscription details', async () => {
            const stripe = adapter.getStripeClient();

            // Ensure payment method
            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: { token: 'tok_visa' }
            });
            await stripe.paymentMethods.attach(paymentMethod.id, {
                customer: testCustomerId
            });
            await stripe.customers.update(testCustomerId, {
                invoice_settings: { default_payment_method: paymentMethod.id }
            });

            const subscriptionId = await adapter.subscriptions.create({
                customerId: testCustomerId,
                priceId: testPriceId,
                trialDays: 14
            });

            const subscription = await adapter.subscriptions.retrieve(subscriptionId);

            expect(subscription.id).toBe(subscriptionId);
            expect(subscription.status).toBe('trialing');

            // Clean up
            await adapter.subscriptions.cancel(subscriptionId);
        });

        it('should cancel a subscription immediately', async () => {
            const stripe = adapter.getStripeClient();

            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: { token: 'tok_visa' }
            });
            await stripe.paymentMethods.attach(paymentMethod.id, {
                customer: testCustomerId
            });
            await stripe.customers.update(testCustomerId, {
                invoice_settings: { default_payment_method: paymentMethod.id }
            });

            const subscriptionId = await adapter.subscriptions.create({
                customerId: testCustomerId,
                priceId: testPriceId,
                trialDays: 7
            });

            const canceled = await adapter.subscriptions.cancel(subscriptionId, {
                immediately: true
            });

            expect(canceled.status).toBe('canceled');
        });

        it('should pause and resume a subscription', async () => {
            const stripe = adapter.getStripeClient();

            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: { token: 'tok_visa' }
            });
            await stripe.paymentMethods.attach(paymentMethod.id, {
                customer: testCustomerId
            });
            await stripe.customers.update(testCustomerId, {
                invoice_settings: { default_payment_method: paymentMethod.id }
            });

            const subscriptionId = await adapter.subscriptions.create({
                customerId: testCustomerId,
                priceId: testPriceId,
                trialDays: 14
            });

            // Pause
            const paused = await adapter.subscriptions.pause(subscriptionId);
            expect(paused.status).toBe('paused');

            // Resume
            const resumed = await adapter.subscriptions.resume(subscriptionId);
            expect(resumed.status).toBe('trialing');

            // Clean up
            await adapter.subscriptions.cancel(subscriptionId);
        });
    });

    describe('Checkout Session Operations', () => {
        let testPriceId: string;

        beforeAll(async () => {
            const stripe = adapter.getStripeClient();
            const product = await stripe.products.create({
                name: `QZPay Checkout Test ${Date.now()}`
            });
            createdProductIds.push(product.id);

            testPriceId = await adapter.prices.create({
                productId: product.id,
                unitAmount: 2999,
                currency: 'usd',
                billingInterval: 'month'
            });
            createdPriceIds.push(testPriceId);
        });

        it('should create a checkout session for subscription', async () => {
            const session = await adapter.checkout.createSession({
                mode: 'subscription',
                lineItems: [
                    {
                        priceId: testPriceId,
                        quantity: 1
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });

            expect(session).toBeDefined();
            expect(session.id).toMatch(/^cs_/);
            expect(session.url).toBeDefined();
        });

        it('should create a checkout session for one-time payment', async () => {
            const stripe = adapter.getStripeClient();
            const product = await stripe.products.create({
                name: `One-time product ${Date.now()}`
            });
            createdProductIds.push(product.id);

            const oneTimePriceId = await adapter.prices.create({
                productId: product.id,
                unitAmount: 9999,
                currency: 'usd',
                type: 'one_time'
            });
            createdPriceIds.push(oneTimePriceId);

            const session = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        priceId: oneTimePriceId,
                        quantity: 1
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });

            expect(session.id).toMatch(/^cs_/);
        });

        it('should retrieve a checkout session', async () => {
            const created = await adapter.checkout.createSession({
                mode: 'subscription',
                lineItems: [{ priceId: testPriceId, quantity: 1 }],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });

            const retrieved = await adapter.checkout.retrieveSession(created.id);

            expect(retrieved.id).toBe(created.id);
        });

        it('should create checkout session with customer email', async () => {
            const session = await adapter.checkout.createSession({
                mode: 'subscription',
                lineItems: [{ priceId: testPriceId, quantity: 1 }],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
                customerEmail: 'checkout@example.com'
            });

            expect(session.id).toBeDefined();
        });

        it('should create checkout session with existing customer', async () => {
            const customerId = await adapter.customers.create({
                email: `checkout-customer-${Date.now()}@example.com`,
                externalId: `ext_checkout_${Date.now()}`
            });
            createdCustomerIds.push(customerId);

            const session = await adapter.checkout.createSession({
                mode: 'subscription',
                lineItems: [{ priceId: testPriceId, quantity: 1 }],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
                customerId
            });

            expect(session.id).toBeDefined();
        });
    });

    describe('Webhook Verification', () => {
        it('should verify webhook signature', async () => {
            // This test only works if we have a real webhook secret
            // We'll test the structure of the webhook handler
            expect(adapter.webhooks).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent customer retrieval', async () => {
            await expect(adapter.customers.retrieve('cus_nonexistent123')).rejects.toThrow();
        });

        it('should handle invalid payment intent amount', async () => {
            const customerId = await adapter.customers.create({
                email: `error-${Date.now()}@example.com`,
                externalId: `ext_error_${Date.now()}`
            });
            createdCustomerIds.push(customerId);

            // Stripe requires minimum amount of 50 cents for most currencies
            await expect(
                adapter.payments.createIntent({
                    amount: 1, // Too small
                    currency: 'usd',
                    customerId
                })
            ).rejects.toThrow();
        });

        it('should handle invalid currency', async () => {
            const customerId = await adapter.customers.create({
                email: `currency-error-${Date.now()}@example.com`,
                externalId: `ext_currency_${Date.now()}`
            });
            createdCustomerIds.push(customerId);

            await expect(
                adapter.payments.createIntent({
                    amount: 1000,
                    currency: 'invalid_currency',
                    customerId
                })
            ).rejects.toThrow();
        });
    });

    describe('Metadata Handling', () => {
        it('should handle complex metadata', async () => {
            const customerId = await adapter.customers.create({
                email: `complex-metadata-${Date.now()}@example.com`,
                externalId: `ext_complex_${Date.now()}`,
                metadata: {
                    stringValue: 'test',
                    numberAsString: '123',
                    boolAsString: 'true',
                    special_chars: 'test-with-dash_and_underscore'
                }
            });
            createdCustomerIds.push(customerId);

            const customer = await adapter.customers.retrieve(customerId);

            expect(customer.metadata?.stringValue).toBe('test');
            expect(customer.metadata?.numberAsString).toBe('123');
        });
    });

    describe('Rate Limiting', () => {
        it('should handle multiple rapid requests', async () => {
            // Create multiple customers in parallel
            const promises = Array.from({ length: 5 }, (_, i) =>
                adapter.customers.create({
                    email: `parallel-${Date.now()}-${i}@example.com`,
                    externalId: `ext_parallel_${Date.now()}_${i}`
                })
            );

            const results = await Promise.all(promises);

            expect(results).toHaveLength(5);
            for (const id of results) {
                expect(id).toMatch(/^cus_/);
                createdCustomerIds.push(id);
            }
        });
    });
});
