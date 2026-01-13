/**
 * Mock Payment Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_CARDS, createMockPaymentAdapter } from '../src/adapters/mock-payment.adapter.js';

describe('createMockPaymentAdapter', () => {
    let adapter: ReturnType<typeof createMockPaymentAdapter>['adapter'];
    let setCardNumber: ReturnType<typeof createMockPaymentAdapter>['setCardNumber'];
    let getCardNumber: ReturnType<typeof createMockPaymentAdapter>['getCardNumber'];
    let reset: ReturnType<typeof createMockPaymentAdapter>['reset'];
    let complete3DS: ReturnType<typeof createMockPaymentAdapter>['complete3DS'];
    let completeCheckout: ReturnType<typeof createMockPaymentAdapter>['completeCheckout'];

    beforeEach(() => {
        const mock = createMockPaymentAdapter();
        adapter = mock.adapter;
        setCardNumber = mock.setCardNumber;
        getCardNumber = mock.getCardNumber;
        reset = mock.reset;
        complete3DS = mock.complete3DS;
        completeCheckout = mock.completeCheckout;
    });

    describe('adapter.provider', () => {
        it('should have mock provider', () => {
            expect(adapter.provider).toBe('mock');
        });
    });

    describe('adapter.customers', () => {
        describe('create', () => {
            it('should create a customer with email', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com'
                });

                expect(customerId).toMatch(/^mock_cus_\d+$/);
            });

            it('should create a customer with name', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com',
                    name: 'Test User'
                });

                const customer = await adapter.customers.retrieve(customerId);
                expect(customer.name).toBe('Test User');
            });

            it('should create a customer with metadata', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com',
                    metadata: { userId: 'user_123' }
                });

                const customer = await adapter.customers.retrieve(customerId);
                expect(customer.metadata).toEqual({ userId: 'user_123' });
            });

            it('should create unique IDs for each customer', async () => {
                const id1 = await adapter.customers.create({ email: 'test1@example.com' });
                const id2 = await adapter.customers.create({ email: 'test2@example.com' });

                expect(id1).not.toBe(id2);
            });
        });

        describe('update', () => {
            it('should update customer email', async () => {
                const customerId = await adapter.customers.create({
                    email: 'old@example.com'
                });

                await adapter.customers.update(customerId, {
                    email: 'new@example.com'
                });

                const customer = await adapter.customers.retrieve(customerId);
                expect(customer.email).toBe('new@example.com');
            });

            it('should update customer name', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com',
                    name: 'Old Name'
                });

                await adapter.customers.update(customerId, {
                    name: 'New Name'
                });

                const customer = await adapter.customers.retrieve(customerId);
                expect(customer.name).toBe('New Name');
            });

            it('should update customer metadata', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com',
                    metadata: { key: 'old' }
                });

                await adapter.customers.update(customerId, {
                    metadata: { key: 'new', extra: 'data' }
                });

                const customer = await adapter.customers.retrieve(customerId);
                expect(customer.metadata).toEqual({ key: 'new', extra: 'data' });
            });

            it('should set name to null when passed null', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com',
                    name: 'Test Name'
                });

                await adapter.customers.update(customerId, {
                    name: null
                });

                const customer = await adapter.customers.retrieve(customerId);
                expect(customer.name).toBeNull();
            });
        });

        describe('delete', () => {
            it('should delete a customer', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com'
                });

                await adapter.customers.delete(customerId);

                await expect(adapter.customers.retrieve(customerId)).rejects.toThrow();
            });
        });

        describe('retrieve', () => {
            it('should retrieve an existing customer', async () => {
                const customerId = await adapter.customers.create({
                    email: 'test@example.com',
                    name: 'Test User'
                });

                const customer = await adapter.customers.retrieve(customerId);

                expect(customer.id).toBe(customerId);
                expect(customer.email).toBe('test@example.com');
                expect(customer.name).toBe('Test User');
            });

            it('should throw error for non-existent customer', async () => {
                await expect(adapter.customers.retrieve('nonexistent')).rejects.toThrow('Customer nonexistent not found');
            });
        });
    });

    describe('adapter.subscriptions', () => {
        let customerId: string;

        beforeEach(async () => {
            customerId = await adapter.customers.create({
                email: 'test@example.com'
            });
        });

        describe('create', () => {
            it('should create a subscription with success card', async () => {
                setCardNumber(TEST_CARDS.SUCCESS);

                const subscription = await adapter.subscriptions.create(customerId, {}, 'price_123');

                expect(subscription.id).toMatch(/^mock_sub_\d+$/);
                expect(subscription.status).toBe('active');
            });

            it('should create subscription with trialing status when trialDays is set', async () => {
                const subscription = await adapter.subscriptions.create(customerId, { trialDays: 14 }, 'price_123');

                expect(subscription.status).toBe('trialing');
                expect(subscription.trialStart).toBeDefined();
                expect(subscription.trialEnd).toBeDefined();
            });

            it('should create subscription with metadata', async () => {
                const subscription = await adapter.subscriptions.create(customerId, { metadata: { planId: 'pro' } }, 'price_123');

                expect(subscription.metadata).toEqual({ planId: 'pro' });
            });

            it('should throw error with declined card', async () => {
                setCardNumber(TEST_CARDS.DECLINED);

                await expect(adapter.subscriptions.create(customerId, {}, 'price_123')).rejects.toThrow();
            });

            it('should throw error with insufficient funds card', async () => {
                setCardNumber(TEST_CARDS.INSUFFICIENT_FUNDS);

                await expect(adapter.subscriptions.create(customerId, {}, 'price_123')).rejects.toThrow('Your card has insufficient funds');
            });

            it('should set period dates', async () => {
                const subscription = await adapter.subscriptions.create(customerId, {}, 'price_123');

                expect(subscription.currentPeriodStart).toBeInstanceOf(Date);
                expect(subscription.currentPeriodEnd).toBeInstanceOf(Date);
                expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThan(subscription.currentPeriodStart.getTime());
            });
        });

        describe('update', () => {
            it('should update subscription metadata', async () => {
                const subscription = await adapter.subscriptions.create(customerId, { metadata: { key: 'old' } }, 'price_123');

                const updated = await adapter.subscriptions.update(subscription.id, {
                    metadata: { key: 'new' }
                });

                expect(updated.metadata).toEqual({ key: 'new' });
            });

            it('should throw error for non-existent subscription', async () => {
                await expect(adapter.subscriptions.update('nonexistent', {})).rejects.toThrow('Subscription nonexistent not found');
            });
        });

        describe('cancel', () => {
            it('should cancel subscription immediately', async () => {
                const subscription = await adapter.subscriptions.create(customerId, {}, 'price_123');

                await adapter.subscriptions.cancel(subscription.id, false);

                const updated = await adapter.subscriptions.retrieve(subscription.id);
                expect(updated.status).toBe('canceled');
                expect(updated.canceledAt).toBeInstanceOf(Date);
                expect(updated.cancelAtPeriodEnd).toBe(false);
            });

            it('should schedule cancellation at period end', async () => {
                const subscription = await adapter.subscriptions.create(customerId, {}, 'price_123');

                await adapter.subscriptions.cancel(subscription.id, true);

                const updated = await adapter.subscriptions.retrieve(subscription.id);
                expect(updated.status).toBe('active');
                expect(updated.cancelAtPeriodEnd).toBe(true);
            });
        });

        describe('pause', () => {
            it('should pause a subscription', async () => {
                const subscription = await adapter.subscriptions.create(customerId, {}, 'price_123');

                await adapter.subscriptions.pause(subscription.id);

                const updated = await adapter.subscriptions.retrieve(subscription.id);
                expect(updated.status).toBe('paused');
            });
        });

        describe('resume', () => {
            it('should resume a paused subscription', async () => {
                const subscription = await adapter.subscriptions.create(customerId, {}, 'price_123');

                await adapter.subscriptions.pause(subscription.id);
                await adapter.subscriptions.resume(subscription.id);

                const updated = await adapter.subscriptions.retrieve(subscription.id);
                expect(updated.status).toBe('active');
            });
        });

        describe('retrieve', () => {
            it('should retrieve an existing subscription', async () => {
                const subscription = await adapter.subscriptions.create(customerId, {}, 'price_123');

                const retrieved = await adapter.subscriptions.retrieve(subscription.id);

                expect(retrieved).toEqual(subscription);
            });

            it('should throw error for non-existent subscription', async () => {
                await expect(adapter.subscriptions.retrieve('nonexistent')).rejects.toThrow('Subscription nonexistent not found');
            });
        });
    });

    describe('adapter.payments', () => {
        let customerId: string;

        beforeEach(async () => {
            customerId = await adapter.customers.create({
                email: 'test@example.com'
            });
        });

        describe('create', () => {
            it('should create a successful payment', async () => {
                setCardNumber(TEST_CARDS.SUCCESS);

                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                });

                expect(payment.id).toMatch(/^mock_pi_\d+$/);
                expect(payment.status).toBe('succeeded');
                expect(payment.amount).toBe(1000);
                expect(payment.currency).toBe('USD');
            });

            it('should create payment requiring 3DS', async () => {
                setCardNumber(TEST_CARDS.REQUIRES_3DS);

                const payment = await adapter.payments.create(customerId, {
                    amount: 2000,
                    currency: 'EUR'
                });

                expect(payment.status).toBe('requires_action');
            });

            it('should throw error with declined card', async () => {
                setCardNumber(TEST_CARDS.DECLINED);

                await expect(
                    adapter.payments.create(customerId, {
                        amount: 1000,
                        currency: 'USD'
                    })
                ).rejects.toThrow('Your card was declined');
            });

            it('should throw error with expired card', async () => {
                setCardNumber(TEST_CARDS.EXPIRED_CARD);

                await expect(
                    adapter.payments.create(customerId, {
                        amount: 1000,
                        currency: 'USD'
                    })
                ).rejects.toThrow('Your card has expired');
            });

            it('should include metadata in payment', async () => {
                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD',
                    metadata: { orderId: 'order_123' }
                });

                expect(payment.metadata).toEqual({ orderId: 'order_123' });
            });

            it('should default metadata to empty object', async () => {
                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                });

                expect(payment.metadata).toEqual({});
            });
        });

        describe('capture', () => {
            it('should capture a payment', async () => {
                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                });

                const captured = await adapter.payments.capture(payment.id);

                expect(captured.status).toBe('succeeded');
            });

            it('should throw error for non-existent payment', async () => {
                await expect(adapter.payments.capture('nonexistent')).rejects.toThrow('Payment nonexistent not found');
            });
        });

        describe('cancel', () => {
            it('should cancel a payment', async () => {
                setCardNumber(TEST_CARDS.REQUIRES_3DS);
                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                });

                await adapter.payments.cancel(payment.id);

                const retrieved = await adapter.payments.retrieve(payment.id);
                expect(retrieved.status).toBe('canceled');
            });
        });

        describe('refund', () => {
            it('should create a full refund', async () => {
                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                });

                const refund = await adapter.payments.refund({}, payment.id);

                expect(refund.id).toMatch(/^mock_re_\d+$/);
                expect(refund.status).toBe('succeeded');
                expect(refund.amount).toBe(1000);
            });

            it('should create a partial refund', async () => {
                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                });

                const refund = await adapter.payments.refund({ amount: 500 }, payment.id);

                expect(refund.amount).toBe(500);
            });

            it('should throw error for non-existent payment', async () => {
                await expect(adapter.payments.refund({}, 'nonexistent')).rejects.toThrow('Payment nonexistent not found');
            });
        });

        describe('retrieve', () => {
            it('should retrieve an existing payment', async () => {
                const payment = await adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                });

                const retrieved = await adapter.payments.retrieve(payment.id);

                expect(retrieved).toEqual(payment);
            });

            it('should throw error for non-existent payment', async () => {
                await expect(adapter.payments.retrieve('nonexistent')).rejects.toThrow('Payment nonexistent not found');
            });
        });
    });

    describe('adapter.checkout', () => {
        describe('create', () => {
            it('should create a checkout session', async () => {
                const checkout = await adapter.checkout.create({}, ['price_123']);

                expect(checkout.id).toMatch(/^mock_cs_\d+$/);
                expect(checkout.url).toMatch(/^https:\/\/mock\.qzpay\.dev\/checkout\//);
                expect(checkout.status).toBe('open');
                expect(checkout.paymentIntentId).toBeNull();
                expect(checkout.subscriptionId).toBeNull();
            });

            it('should create checkout with customer ID', async () => {
                const checkout = await adapter.checkout.create({ customerId: 'cus_123' }, ['price_123']);

                expect(checkout.customerId).toBe('cus_123');
            });

            it('should create checkout with metadata', async () => {
                const checkout = await adapter.checkout.create({ metadata: { source: 'web' } }, ['price_123']);

                expect(checkout.metadata).toEqual({ source: 'web' });
            });
        });

        describe('retrieve', () => {
            it('should retrieve an existing checkout session', async () => {
                const checkout = await adapter.checkout.create({}, ['price_123']);

                const retrieved = await adapter.checkout.retrieve(checkout.id);

                expect(retrieved).toEqual(checkout);
            });

            it('should throw error for non-existent checkout', async () => {
                await expect(adapter.checkout.retrieve('nonexistent')).rejects.toThrow('Checkout nonexistent not found');
            });
        });

        describe('expire', () => {
            it('should expire a checkout session', async () => {
                const checkout = await adapter.checkout.create({}, ['price_123']);

                await adapter.checkout.expire(checkout.id);

                const retrieved = await adapter.checkout.retrieve(checkout.id);
                expect(retrieved.status).toBe('expired');
            });
        });
    });

    describe('adapter.prices', () => {
        let productId: string;

        beforeEach(async () => {
            productId = await adapter.prices.createProduct('Test Product', 'Description');
        });

        describe('create', () => {
            it('should create a one-time price', async () => {
                const priceId = await adapter.prices.create(
                    {
                        unitAmount: 1000,
                        currency: 'USD'
                    },
                    productId
                );

                expect(priceId).toMatch(/^mock_price_\d+$/);

                const price = await adapter.prices.retrieve(priceId);
                expect(price.unitAmount).toBe(1000);
                expect(price.currency).toBe('USD');
                expect(price.recurring).toBeNull();
            });

            it('should create a recurring price', async () => {
                const priceId = await adapter.prices.create(
                    {
                        unitAmount: 1900,
                        currency: 'USD',
                        billingInterval: 'month',
                        intervalCount: 1
                    },
                    productId
                );

                const price = await adapter.prices.retrieve(priceId);
                expect(price.recurring).toEqual({
                    interval: 'month',
                    intervalCount: 1
                });
            });

            it('should create price with different intervals', async () => {
                const intervals = ['day', 'week', 'month', 'year'] as const;

                for (const interval of intervals) {
                    const priceId = await adapter.prices.create(
                        {
                            unitAmount: 1000,
                            currency: 'USD',
                            billingInterval: interval
                        },
                        productId
                    );

                    const price = await adapter.prices.retrieve(priceId);
                    expect(price.recurring?.interval).toBe(interval);
                }
            });
        });

        describe('archive', () => {
            it('should archive a price', async () => {
                const priceId = await adapter.prices.create(
                    {
                        unitAmount: 1000,
                        currency: 'USD'
                    },
                    productId
                );

                await adapter.prices.archive(priceId);

                const price = await adapter.prices.retrieve(priceId);
                expect(price.active).toBe(false);
            });
        });

        describe('retrieve', () => {
            it('should retrieve an existing price', async () => {
                const priceId = await adapter.prices.create(
                    {
                        unitAmount: 1000,
                        currency: 'USD'
                    },
                    productId
                );

                const price = await adapter.prices.retrieve(priceId);

                expect(price.id).toBe(priceId);
            });

            it('should throw error for non-existent price', async () => {
                await expect(adapter.prices.retrieve('nonexistent')).rejects.toThrow('Price nonexistent not found');
            });
        });

        describe('createProduct', () => {
            it('should create a product with name', async () => {
                const productId = await adapter.prices.createProduct('Product Name');

                expect(productId).toMatch(/^mock_prod_\d+$/);
            });

            it('should create a product with name and description', async () => {
                const productId = await adapter.prices.createProduct('Product Name', 'Product Description');

                expect(productId).toMatch(/^mock_prod_\d+$/);
            });
        });
    });

    describe('adapter.webhooks', () => {
        describe('constructEvent', () => {
            it('should construct event from string payload', () => {
                const payload = JSON.stringify({
                    type: 'payment_intent.succeeded',
                    data: { id: 'pi_123' }
                });

                const event = adapter.webhooks.constructEvent(payload, 'sig_123');

                expect(event.id).toMatch(/^mock_evt_\d+$/);
                expect(event.type).toBe('payment_intent.succeeded');
                expect(event.data).toEqual({ id: 'pi_123' });
                expect(event.created).toBeInstanceOf(Date);
            });

            it('should construct event from buffer payload', () => {
                const payload = Buffer.from(
                    JSON.stringify({
                        type: 'subscription.created',
                        data: { id: 'sub_123' }
                    })
                );

                const event = adapter.webhooks.constructEvent(payload, 'sig_123');

                expect(event.type).toBe('subscription.created');
                expect(event.data).toEqual({ id: 'sub_123' });
            });

            it('should handle event without type', () => {
                const payload = JSON.stringify({
                    data: { id: 'test' }
                });

                const event = adapter.webhooks.constructEvent(payload, 'sig_123');

                expect(event.type).toBe('unknown');
            });

            it('should handle event without data', () => {
                const payload = JSON.stringify({
                    type: 'test.event'
                });

                const event = adapter.webhooks.constructEvent(payload, 'sig_123');

                expect(event.data).toEqual({});
            });
        });

        describe('verifySignature', () => {
            it('should always return true', () => {
                const result = adapter.webhooks.verifySignature('payload', 'signature');

                expect(result).toBe(true);
            });
        });
    });

    describe('setCardNumber', () => {
        it('should change payment outcome', async () => {
            const customerId = await adapter.customers.create({
                email: 'test@example.com'
            });

            setCardNumber(TEST_CARDS.SUCCESS);
            const payment1 = await adapter.payments.create(customerId, {
                amount: 1000,
                currency: 'USD'
            });
            expect(payment1.status).toBe('succeeded');

            setCardNumber(TEST_CARDS.REQUIRES_3DS);
            const payment2 = await adapter.payments.create(customerId, {
                amount: 1000,
                currency: 'USD'
            });
            expect(payment2.status).toBe('requires_action');

            setCardNumber(TEST_CARDS.DECLINED);
            await expect(
                adapter.payments.create(customerId, {
                    amount: 1000,
                    currency: 'USD'
                })
            ).rejects.toThrow();
        });
    });

    describe('getCardNumber', () => {
        it('should return current card number', () => {
            expect(getCardNumber()).toBe(TEST_CARDS.SUCCESS);

            setCardNumber(TEST_CARDS.DECLINED);
            expect(getCardNumber()).toBe(TEST_CARDS.DECLINED);
        });
    });

    describe('reset', () => {
        it('should clear all data', async () => {
            const customerId = await adapter.customers.create({
                email: 'test@example.com'
            });

            reset();

            await expect(adapter.customers.retrieve(customerId)).rejects.toThrow();
        });

        it('should reset card number to initial value', () => {
            setCardNumber(TEST_CARDS.DECLINED);
            reset();

            expect(getCardNumber()).toBe(TEST_CARDS.SUCCESS);
        });
    });

    describe('complete3DS', () => {
        it('should complete 3DS authentication', async () => {
            setCardNumber(TEST_CARDS.REQUIRES_3DS);

            const customerId = await adapter.customers.create({
                email: 'test@example.com'
            });

            const payment = await adapter.payments.create(customerId, {
                amount: 1000,
                currency: 'USD'
            });

            expect(payment.status).toBe('requires_action');

            complete3DS(payment.id);

            const updated = await adapter.payments.retrieve(payment.id);
            expect(updated.status).toBe('succeeded');
        });

        it('should not affect payment that does not require 3DS', async () => {
            const customerId = await adapter.customers.create({
                email: 'test@example.com'
            });

            const payment = await adapter.payments.create(customerId, {
                amount: 1000,
                currency: 'USD'
            });

            expect(payment.status).toBe('succeeded');

            complete3DS(payment.id);

            const updated = await adapter.payments.retrieve(payment.id);
            expect(updated.status).toBe('succeeded');
        });
    });

    describe('completeCheckout', () => {
        it('should complete a checkout session', async () => {
            const checkout = await adapter.checkout.create({}, ['price_123']);

            expect(checkout.status).toBe('open');

            completeCheckout(checkout.id);

            const updated = await adapter.checkout.retrieve(checkout.id);
            expect(updated.status).toBe('complete');
        });

        it('should complete checkout with subscription ID', async () => {
            const checkout = await adapter.checkout.create({}, ['price_123']);

            completeCheckout(checkout.id, { subscriptionId: 'sub_123' });

            const updated = await adapter.checkout.retrieve(checkout.id);
            expect(updated.subscriptionId).toBe('sub_123');
        });

        it('should complete checkout with payment intent ID', async () => {
            const checkout = await adapter.checkout.create({}, ['price_123']);

            completeCheckout(checkout.id, { paymentIntentId: 'pi_123' });

            const updated = await adapter.checkout.retrieve(checkout.id);
            expect(updated.paymentIntentId).toBe('pi_123');
        });

        it('should not affect expired checkout', async () => {
            const checkout = await adapter.checkout.create({}, ['price_123']);

            await adapter.checkout.expire(checkout.id);
            completeCheckout(checkout.id);

            const updated = await adapter.checkout.retrieve(checkout.id);
            expect(updated.status).toBe('expired');
        });
    });

    describe('custom time function', () => {
        it('should use custom getCurrentTime function', async () => {
            const fixedDate = new Date('2025-01-01T00:00:00Z');
            const getCurrentTime = vi.fn(() => fixedDate);

            const { adapter: customAdapter } = createMockPaymentAdapter({
                getCurrentTime
            });

            const customerId = await customAdapter.customers.create({
                email: 'test@example.com'
            });

            await customAdapter.subscriptions.create(customerId, {}, 'price_123');

            expect(getCurrentTime).toHaveBeenCalled();
        });
    });

    describe('initial card number configuration', () => {
        it('should use custom initial card number', () => {
            const { getCardNumber } = createMockPaymentAdapter({
                initialCardNumber: TEST_CARDS.DECLINED
            });

            expect(getCardNumber()).toBe(TEST_CARDS.DECLINED);
        });

        it('should reset to custom initial card number', () => {
            const { setCardNumber, reset, getCardNumber } = createMockPaymentAdapter({
                initialCardNumber: TEST_CARDS.REQUIRES_3DS
            });

            setCardNumber(TEST_CARDS.SUCCESS);
            expect(getCardNumber()).toBe(TEST_CARDS.SUCCESS);

            reset();
            expect(getCardNumber()).toBe(TEST_CARDS.REQUIRES_3DS);
        });
    });
});
