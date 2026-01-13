/**
 * Mock Payment Adapter for QZPay
 *
 * Simulates payment provider responses for testing and development
 * without requiring real API keys.
 */
import type {
    QZPayPaymentAdapter,
    QZPayProviderCheckout,
    QZPayProviderCustomer,
    QZPayProviderPayment,
    QZPayProviderPrice,
    QZPayProviderRefund,
    QZPayProviderSubscription,
    QZPayWebhookEvent
} from '@qazuor/qzpay-core';
import { CARD_ERRORS, TEST_CARDS, getPaymentOutcome } from '../test-cards.js';

/**
 * Configuration options for the mock payment adapter
 */
export interface MockPaymentAdapterConfig {
    /**
     * Function to get the current time. Useful for time simulation in tests.
     * Defaults to () => new Date()
     */
    getCurrentTime?: () => Date;

    /**
     * Initial card number to use for payment simulation.
     * Defaults to TEST_CARDS.SUCCESS
     */
    initialCardNumber?: string;
}

/**
 * Internal state for the mock adapter
 */
interface MockStore {
    customers: Map<string, QZPayProviderCustomer>;
    subscriptions: Map<string, QZPayProviderSubscription>;
    payments: Map<string, QZPayProviderPayment>;
    checkouts: Map<string, QZPayProviderCheckout>;
    prices: Map<string, QZPayProviderPrice>;
    products: Map<string, { id: string; name: string; description?: string }>;
    currentCardNumber: string;
}

let idCounter = 0;
const generateId = (prefix: string): string => `mock_${prefix}_${++idCounter}`;

/**
 * Create a mock payment adapter for testing and development
 *
 * @example
 * ```typescript
 * import { createMockPaymentAdapter, TEST_CARDS } from '@qazuor/qzpay-dev';
 *
 * const { adapter, setCardNumber, reset } = createMockPaymentAdapter();
 *
 * // Simulate a declined card
 * setCardNumber(TEST_CARDS.DECLINED);
 *
 * // Use with QZPayBilling
 * const billing = new QZPayBilling({
 *   payment: adapter,
 *   storage: createMemoryStorageAdapter(),
 * });
 * ```
 */
export function createMockPaymentAdapter(config?: MockPaymentAdapterConfig): {
    adapter: QZPayPaymentAdapter;
    setCardNumber: (cardNumber: string) => void;
    getCardNumber: () => string;
    reset: () => void;
    complete3DS: (paymentId: string) => void;
    completeCheckout: (checkoutId: string, options?: { subscriptionId?: string; paymentIntentId?: string }) => void;
} {
    const getCurrentTime = config?.getCurrentTime ?? (() => new Date());

    const store: MockStore = {
        customers: new Map(),
        subscriptions: new Map(),
        payments: new Map(),
        checkouts: new Map(),
        prices: new Map(),
        products: new Map(),
        currentCardNumber: config?.initialCardNumber ?? TEST_CARDS.SUCCESS
    };

    const setCardNumber = (cardNumber: string): void => {
        store.currentCardNumber = cardNumber;
    };

    const getCardNumber = (): string => {
        return store.currentCardNumber;
    };

    const reset = (): void => {
        store.customers.clear();
        store.subscriptions.clear();
        store.payments.clear();
        store.checkouts.clear();
        store.prices.clear();
        store.products.clear();
        store.currentCardNumber = config?.initialCardNumber ?? TEST_CARDS.SUCCESS;
        idCounter = 0;
    };

    const complete3DS = (paymentId: string): void => {
        const payment = store.payments.get(paymentId);
        if (payment && payment.status === 'requires_action') {
            payment.status = 'succeeded';
        }
    };

    const completeCheckout = (checkoutId: string, options?: { subscriptionId?: string; paymentIntentId?: string }): void => {
        const checkout = store.checkouts.get(checkoutId);
        if (checkout && checkout.status === 'open') {
            checkout.status = 'complete';
            checkout.subscriptionId = options?.subscriptionId ?? null;
            checkout.paymentIntentId = options?.paymentIntentId ?? null;
        }
    };

    const adapter: QZPayPaymentAdapter = {
        // Note: 'mock' is not a standard provider, using type assertion
        provider: 'mock' as unknown as QZPayPaymentAdapter['provider'],

        customers: {
            async create(input): Promise<string> {
                const id = generateId('cus');
                const customer: QZPayProviderCustomer = {
                    id,
                    email: input.email,
                    name: input.name ?? null,
                    metadata: (input.metadata ?? {}) as Record<string, string>
                };
                store.customers.set(id, customer);
                return id;
            },

            async update(providerCustomerId, input): Promise<void> {
                const customer = store.customers.get(providerCustomerId);
                if (customer) {
                    if (input.email) customer.email = input.email;
                    if (input.name !== undefined) customer.name = input.name ?? null;
                    if (input.metadata) {
                        customer.metadata = input.metadata as Record<string, string>;
                    }
                }
            },

            async delete(providerCustomerId): Promise<void> {
                store.customers.delete(providerCustomerId);
            },

            async retrieve(providerCustomerId): Promise<QZPayProviderCustomer> {
                const customer = store.customers.get(providerCustomerId);
                if (!customer) {
                    throw new Error(`Customer ${providerCustomerId} not found`);
                }
                return customer;
            }
        },

        subscriptions: {
            async create(_providerCustomerId, input, _providerPriceId): Promise<QZPayProviderSubscription> {
                const id = generateId('sub');
                const now = getCurrentTime();
                const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                // Check if payment would succeed
                const outcome = getPaymentOutcome(store.currentCardNumber);
                if (outcome.status === 'failed') {
                    throw new Error(outcome.error?.message ?? 'Payment failed');
                }

                const subscription: QZPayProviderSubscription = {
                    id,
                    status: input.trialDays && input.trialDays > 0 ? 'trialing' : 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                    canceledAt: null,
                    trialStart: input.trialDays ? now : null,
                    trialEnd: input.trialDays ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000) : null,
                    metadata: (input.metadata ?? {}) as Record<string, string>
                };
                store.subscriptions.set(id, subscription);
                return subscription;
            },

            async update(providerSubscriptionId, input): Promise<QZPayProviderSubscription> {
                const subscription = store.subscriptions.get(providerSubscriptionId);
                if (!subscription) {
                    throw new Error(`Subscription ${providerSubscriptionId} not found`);
                }

                if (input.metadata) {
                    subscription.metadata = input.metadata as Record<string, string>;
                }

                return subscription;
            },

            async cancel(providerSubscriptionId, cancelAtPeriodEnd): Promise<void> {
                const subscription = store.subscriptions.get(providerSubscriptionId);
                if (subscription) {
                    subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
                    if (!cancelAtPeriodEnd) {
                        subscription.status = 'canceled';
                        subscription.canceledAt = getCurrentTime();
                    }
                }
            },

            async pause(providerSubscriptionId): Promise<void> {
                const subscription = store.subscriptions.get(providerSubscriptionId);
                if (subscription) {
                    subscription.status = 'paused';
                }
            },

            async resume(providerSubscriptionId): Promise<void> {
                const subscription = store.subscriptions.get(providerSubscriptionId);
                if (subscription) {
                    subscription.status = 'active';
                }
            },

            async retrieve(providerSubscriptionId): Promise<QZPayProviderSubscription> {
                const subscription = store.subscriptions.get(providerSubscriptionId);
                if (!subscription) {
                    throw new Error(`Subscription ${providerSubscriptionId} not found`);
                }
                return subscription;
            }
        },

        payments: {
            async create(_providerCustomerId, input): Promise<QZPayProviderPayment> {
                const id = generateId('pi');
                const outcome = getPaymentOutcome(store.currentCardNumber);

                // Throw error for failed payments (core billing expects this)
                if (outcome.status === 'failed' && outcome.error) {
                    throw new Error(outcome.error.message);
                }

                const payment: QZPayProviderPayment = {
                    id,
                    status: outcome.status,
                    amount: input.amount,
                    currency: input.currency,
                    metadata: (input.metadata ?? {}) as Record<string, string>
                };

                store.payments.set(id, payment);
                return payment;
            },

            async capture(providerPaymentId): Promise<QZPayProviderPayment> {
                const payment = store.payments.get(providerPaymentId);
                if (!payment) {
                    throw new Error(`Payment ${providerPaymentId} not found`);
                }
                payment.status = 'succeeded';
                return payment;
            },

            async cancel(providerPaymentId): Promise<void> {
                const payment = store.payments.get(providerPaymentId);
                if (payment) {
                    payment.status = 'canceled';
                }
            },

            async refund(input, providerPaymentId): Promise<QZPayProviderRefund> {
                const payment = store.payments.get(providerPaymentId);
                if (!payment) {
                    throw new Error(`Payment ${providerPaymentId} not found`);
                }

                const refundId = generateId('re');
                const refundAmount = input.amount ?? payment.amount;

                return {
                    id: refundId,
                    status: 'succeeded',
                    amount: refundAmount
                };
            },

            async retrieve(providerPaymentId): Promise<QZPayProviderPayment> {
                const payment = store.payments.get(providerPaymentId);
                if (!payment) {
                    throw new Error(`Payment ${providerPaymentId} not found`);
                }
                return payment;
            }
        },

        checkout: {
            async create(input, _providerPriceIds): Promise<QZPayProviderCheckout> {
                const id = generateId('cs');
                const checkout: QZPayProviderCheckout = {
                    id,
                    url: `https://mock.qzpay.dev/checkout/${id}`,
                    status: 'open',
                    paymentIntentId: null,
                    subscriptionId: null,
                    customerId: input.customerId ?? null,
                    metadata: (input.metadata ?? {}) as Record<string, string>
                };
                store.checkouts.set(id, checkout);
                return checkout;
            },

            async retrieve(providerSessionId): Promise<QZPayProviderCheckout> {
                const checkout = store.checkouts.get(providerSessionId);
                if (!checkout) {
                    throw new Error(`Checkout ${providerSessionId} not found`);
                }
                return checkout;
            },

            async expire(providerSessionId): Promise<void> {
                const checkout = store.checkouts.get(providerSessionId);
                if (checkout) {
                    checkout.status = 'expired';
                }
            }
        },

        prices: {
            async create(input, _providerProductId): Promise<string> {
                const id = generateId('price');
                const isRecurring = input.billingInterval && ['day', 'week', 'month', 'year'].includes(input.billingInterval);
                const price: QZPayProviderPrice = {
                    id,
                    active: true,
                    unitAmount: input.unitAmount,
                    currency: input.currency,
                    recurring: isRecurring
                        ? {
                              interval: input.billingInterval as 'day' | 'week' | 'month' | 'year',
                              intervalCount: input.intervalCount ?? 1
                          }
                        : null
                };
                store.prices.set(id, price);
                return id;
            },

            async archive(providerPriceId): Promise<void> {
                const price = store.prices.get(providerPriceId);
                if (price) {
                    price.active = false;
                }
            },

            async retrieve(providerPriceId): Promise<QZPayProviderPrice> {
                const price = store.prices.get(providerPriceId);
                if (!price) {
                    throw new Error(`Price ${providerPriceId} not found`);
                }
                return price;
            },

            async createProduct(name, description): Promise<string> {
                const id = generateId('prod');
                store.products.set(id, { id, name, ...(description !== undefined && { description }) });
                return id;
            }
        },

        webhooks: {
            constructEvent(payload, _signature): QZPayWebhookEvent {
                const data = typeof payload === 'string' ? payload : payload.toString();
                const parsed = JSON.parse(data);
                return {
                    id: generateId('evt'),
                    type: parsed.type ?? 'unknown',
                    data: parsed.data ?? {},
                    created: getCurrentTime()
                };
            },

            verifySignature(_payload, _signature): boolean {
                // Always valid in mock mode
                return true;
            }
        }
    };

    return {
        adapter,
        setCardNumber,
        getCardNumber,
        reset,
        complete3DS,
        completeCheckout
    };
}

// Re-export test cards and utilities for convenience
export { TEST_CARDS, CARD_ERRORS, getPaymentOutcome };
