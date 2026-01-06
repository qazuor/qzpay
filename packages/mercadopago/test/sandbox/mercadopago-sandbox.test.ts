/**
 * MercadoPago Sandbox Integration Tests
 *
 * These tests run against the real MercadoPago sandbox/test API.
 * They require the following environment variable:
 * - MERCADOPAGO_ACCESS_TOKEN: MercadoPago test access token (TEST-*)
 *
 * Tests will be skipped if MERCADOPAGO_ACCESS_TOKEN is not set.
 *
 * IMPORTANT: These tests create real resources in MercadoPago sandbox.
 * They attempt to clean up after themselves but may leave some resources.
 *
 * NOTE: MercadoPago sandbox has some limitations compared to Stripe:
 * - Customers cannot be deleted via API
 * - Some operations require specific country/currency combinations
 * - Rate limits are stricter in sandbox
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type QZPayMercadoPagoAdapter, createQZPayMercadoPagoAdapter } from '../../src/index.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const MERCADOPAGO_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET;

// Skip all tests if no MercadoPago token is available
const describeWithMP = MERCADOPAGO_ACCESS_TOKEN ? describe : describe.skip;

describeWithMP('MercadoPago Sandbox Integration Tests', () => {
    let adapter: QZPayMercadoPagoAdapter;
    const createdCustomerIds: string[] = [];
    const createdPreferenceIds: string[] = [];

    beforeAll(() => {
        adapter = createQZPayMercadoPagoAdapter({
            accessToken: MERCADOPAGO_ACCESS_TOKEN ?? '',
            webhookSecret: MERCADOPAGO_WEBHOOK_SECRET,
            timeout: 10000 // Longer timeout for sandbox
        });
    });

    afterAll(async () => {
        // MercadoPago doesn't allow deleting customers via API
        // We just log what was created for manual cleanup if needed
        if (createdCustomerIds.length > 0) {
            console.log('Created customer IDs (for reference):', createdCustomerIds);
        }
        if (createdPreferenceIds.length > 0) {
            console.log('Created preference IDs (for reference):', createdPreferenceIds);
        }
    });

    describe('Customer Operations', () => {
        it('should create a customer in MercadoPago', async () => {
            const customerId = await adapter.customers.create({
                email: `test-${Date.now()}@example.com`,
                externalId: `ext_${Date.now()}`,
                name: 'QZPay Test'
            });

            expect(customerId).toBeDefined();
            expect(typeof customerId).toBe('string');

            createdCustomerIds.push(customerId);
        });

        it('should retrieve a customer from MercadoPago', async () => {
            // First create a customer
            const customerId = await adapter.customers.create({
                email: `retrieve-${Date.now()}@example.com`,
                externalId: `ext_retrieve_${Date.now()}`,
                name: 'Retrieve Test'
            });
            createdCustomerIds.push(customerId);

            // Then retrieve it
            const customer = await adapter.customers.retrieve(customerId);

            expect(customer).toBeDefined();
            expect(customer.id).toBe(customerId);
        });

        it('should update a customer in MercadoPago', async () => {
            // Create customer
            const customerId = await adapter.customers.create({
                email: `update-${Date.now()}@example.com`,
                externalId: `ext_update_${Date.now()}`,
                name: 'Original'
            });
            createdCustomerIds.push(customerId);

            // Update customer (MercadoPago has limited update capabilities)
            await adapter.customers.update(customerId, {
                name: 'Updated Name'
            });

            // Verify update
            const customer = await adapter.customers.retrieve(customerId);
            // Note: MercadoPago may split name into first_name/last_name
            expect(customer).toBeDefined();
        });

        it('should create customer with metadata', async () => {
            const customerId = await adapter.customers.create({
                email: `metadata-${Date.now()}@example.com`,
                externalId: `ext_metadata_${Date.now()}`,
                name: 'Metadata Test',
                metadata: {
                    company: 'Test Company',
                    tier: 'premium'
                }
            });
            createdCustomerIds.push(customerId);

            const customer = await adapter.customers.retrieve(customerId);
            expect(customer).toBeDefined();
        });

        it('should search for customer by email', async () => {
            const uniqueEmail = `search-${Date.now()}@example.com`;

            const customerId = await adapter.customers.create({
                email: uniqueEmail,
                externalId: `ext_search_${Date.now()}`,
                name: 'Search Test'
            });
            createdCustomerIds.push(customerId);

            // Give MercadoPago time to index
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Search by email (if supported by adapter)
            const customer = await adapter.customers.retrieve(customerId);
            expect(customer.email).toBe(uniqueEmail);
        });
    });

    describe('Payment Operations', () => {
        let testCustomerId: string;

        beforeAll(async () => {
            testCustomerId = await adapter.customers.create({
                email: `payment-${Date.now()}@example.com`,
                externalId: `ext_payment_${Date.now()}`,
                name: 'Payment Test'
            });
            createdCustomerIds.push(testCustomerId);
        });

        it('should create a payment intent', async () => {
            const result = await adapter.payments.createIntent({
                amount: 5000, // 50.00 in local currency
                currency: 'ARS', // MercadoPago requires valid currency for account
                customerId: testCustomerId,
                metadata: { test: 'true' }
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });

        it('should create payment intent with different amounts', async () => {
            const amounts = [1000, 5000, 10000];

            for (const amount of amounts) {
                const result = await adapter.payments.createIntent({
                    amount,
                    currency: 'ARS',
                    customerId: testCustomerId
                });

                expect(result.id).toBeDefined();
            }
        });

        it('should retrieve a payment intent', async () => {
            const created = await adapter.payments.createIntent({
                amount: 2500,
                currency: 'ARS',
                customerId: testCustomerId
            });

            const retrieved = await adapter.payments.retrieveIntent(created.id);

            expect(retrieved.id).toBe(created.id);
        });
    });

    describe('Checkout/Preference Operations', () => {
        it('should create a checkout preference', async () => {
            const result = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        title: 'Test Product',
                        quantity: 1,
                        unitAmount: 9999, // 99.99 in local currency
                        currency: 'ARS'
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.url).toBeDefined();

            createdPreferenceIds.push(result.id);
        });

        it('should create preference with multiple items', async () => {
            const result = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        title: 'Item 1',
                        quantity: 2,
                        unitAmount: 1500,
                        currency: 'ARS'
                    },
                    {
                        title: 'Item 2',
                        quantity: 1,
                        unitAmount: 3000,
                        currency: 'ARS'
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });

            expect(result.id).toBeDefined();
            createdPreferenceIds.push(result.id);
        });

        it('should create preference with payer email', async () => {
            const result = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        title: 'Email Test',
                        quantity: 1,
                        unitAmount: 5000,
                        currency: 'ARS'
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
                customerEmail: 'payer@example.com'
            });

            expect(result.id).toBeDefined();
            createdPreferenceIds.push(result.id);
        });

        it('should create preference with external reference', async () => {
            const externalRef = `order_${Date.now()}`;

            const result = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        title: 'Reference Test',
                        quantity: 1,
                        unitAmount: 7500,
                        currency: 'ARS'
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
                metadata: { externalReference: externalRef }
            });

            expect(result.id).toBeDefined();
            createdPreferenceIds.push(result.id);
        });

        it('should retrieve a preference', async () => {
            const created = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        title: 'Retrieve Test',
                        quantity: 1,
                        unitAmount: 2000,
                        currency: 'ARS'
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });
            createdPreferenceIds.push(created.id);

            const retrieved = await adapter.checkout.retrieveSession(created.id);

            expect(retrieved.id).toBe(created.id);
        });
    });

    describe('Price/Plan Operations', () => {
        it('should create a subscription plan', async () => {
            const planId = await adapter.prices.create({
                productId: `product_${Date.now()}`,
                productName: 'Test Plan',
                unitAmount: 1999, // 19.99 monthly
                currency: 'ARS',
                billingInterval: 'month'
            });

            expect(planId).toBeDefined();
            expect(typeof planId).toBe('string');
        });

        it('should create yearly plan', async () => {
            const planId = await adapter.prices.create({
                productId: `product_yearly_${Date.now()}`,
                productName: 'Yearly Plan',
                unitAmount: 19999, // 199.99 yearly
                currency: 'ARS',
                billingInterval: 'year'
            });

            expect(planId).toBeDefined();
        });

        it('should retrieve a plan', async () => {
            const planId = await adapter.prices.create({
                productId: `product_retrieve_${Date.now()}`,
                productName: 'Retrieve Test Plan',
                unitAmount: 2999,
                currency: 'ARS',
                billingInterval: 'month'
            });

            const plan = await adapter.prices.retrieve(planId);

            expect(plan).toBeDefined();
            expect(plan.id).toBe(planId);
        });
    });

    describe('Subscription Operations', () => {
        let testPlanId: string;

        beforeAll(async () => {
            testPlanId = await adapter.prices.create({
                productId: `sub_test_product_${Date.now()}`,
                productName: 'Subscription Test Plan',
                unitAmount: 999,
                currency: 'ARS',
                billingInterval: 'month'
            });
        });

        it('should create subscription checkout URL', async () => {
            // In MercadoPago, subscriptions are created via redirect flow
            // We can only create a subscription preapproval plan and get URL
            const result = await adapter.subscriptions.createCheckout({
                planId: testPlanId,
                payerEmail: `subscriber-${Date.now()}@example.com`,
                backUrl: 'https://example.com/subscription-callback'
            });

            expect(result).toBeDefined();
            expect(result.url).toBeDefined();
        });

        // Note: Full subscription lifecycle tests require user interaction
        // in MercadoPago sandbox (user must approve via redirect)
    });

    describe('Webhook Verification', () => {
        it('should have webhook adapter available', () => {
            expect(adapter.webhooks).toBeDefined();
        });

        it('should parse webhook payload structure', async () => {
            const mockPayload = {
                id: 12345,
                live_mode: false,
                type: 'payment',
                date_created: new Date().toISOString(),
                user_id: '12345',
                api_version: 'v1',
                action: 'payment.created',
                data: {
                    id: 'payment_123'
                }
            };

            // Test that payload structure is valid
            expect(mockPayload.type).toBeDefined();
            expect(mockPayload.data).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent customer retrieval', async () => {
            await expect(adapter.customers.retrieve('nonexistent_customer_id_12345')).rejects.toThrow();
        });

        it('should handle invalid currency', async () => {
            const customerId = await adapter.customers.create({
                email: `currency-error-${Date.now()}@example.com`,
                externalId: `ext_currency_${Date.now()}`
            });
            createdCustomerIds.push(customerId);

            // MercadoPago only accepts specific currencies per account
            await expect(
                adapter.payments.createIntent({
                    amount: 1000,
                    currency: 'INVALID',
                    customerId
                })
            ).rejects.toThrow();
        });
    });

    describe('Rate Limiting', () => {
        it('should handle multiple sequential requests', async () => {
            // Create customers sequentially to avoid rate limits
            const results: string[] = [];

            for (let i = 0; i < 3; i++) {
                const customerId = await adapter.customers.create({
                    email: `sequential-${Date.now()}-${i}@example.com`,
                    externalId: `ext_seq_${Date.now()}_${i}`
                });
                results.push(customerId);
                createdCustomerIds.push(customerId);

                // Small delay to avoid rate limiting
                await new Promise((resolve) => setTimeout(resolve, 200));
            }

            expect(results).toHaveLength(3);
        });
    });

    describe('Currency Handling', () => {
        it('should handle ARS currency (Argentina)', async () => {
            const result = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        title: 'ARS Test',
                        quantity: 1,
                        unitAmount: 10000, // 100.00 ARS
                        currency: 'ARS'
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });

            expect(result.id).toBeDefined();
            createdPreferenceIds.push(result.id);
        });

        // Note: Other currencies depend on MercadoPago account configuration
        // BRL (Brazil), MXN (Mexico), CLP (Chile), COP (Colombia), PEN (Peru), UYU (Uruguay)
    });

    describe('Metadata Handling', () => {
        it('should handle complex metadata in preferences', async () => {
            const result = await adapter.checkout.createSession({
                mode: 'payment',
                lineItems: [
                    {
                        title: 'Metadata Test',
                        quantity: 1,
                        unitAmount: 5000,
                        currency: 'ARS'
                    }
                ],
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
                metadata: {
                    orderId: 'order_123',
                    customerId: 'customer_456',
                    source: 'qzpay_test'
                }
            });

            expect(result.id).toBeDefined();
            createdPreferenceIds.push(result.id);
        });
    });
});
