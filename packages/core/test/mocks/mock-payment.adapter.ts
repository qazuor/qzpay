/**
 * Mock payment adapter for testing
 */
import { vi } from 'vitest';
import type {
    QZPayCheckoutSessionParams,
    QZPayCustomerPortalSession,
    QZPayPaymentAdapter,
    QZPayPaymentIntent,
    QZPayPaymentMethod
} from '../../src/adapters/payment.adapter.js';

/**
 * Configuration for mock payment behavior
 */
export interface QZPayMockPaymentConfig {
    /**
     * Whether payments should succeed by default
     */
    shouldSucceed?: boolean;

    /**
     * Delay in ms before resolving operations
     */
    delay?: number;

    /**
     * Custom error message when failing
     */
    errorMessage?: string;
}

/**
 * Create a mock payment adapter for testing
 */
export function createMockPaymentAdapter(config?: QZPayMockPaymentConfig): QZPayPaymentAdapter {
    const shouldSucceed = config?.shouldSucceed ?? true;
    const delay = config?.delay ?? 0;
    const errorMessage = config?.errorMessage ?? 'Payment failed';

    const maybeDelay = async (): Promise<void> => {
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    };

    const maybeThrow = (): void => {
        if (!shouldSucceed) {
            throw new Error(errorMessage);
        }
    };

    let intentCounter = 0;
    let methodCounter = 0;
    let sessionCounter = 0;

    return {
        createPaymentIntent: vi.fn(async (params) => {
            await maybeDelay();
            maybeThrow();

            const intent: QZPayPaymentIntent = {
                id: `pi_test_${++intentCounter}`,
                amount: params.amount,
                currency: params.currency,
                status: 'requires_payment_method',
                clientSecret: `pi_test_${intentCounter}_secret_${Date.now()}`,
                metadata: params.metadata
            };

            return intent;
        }),

        confirmPaymentIntent: vi.fn(async (intentId) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: intentId,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                clientSecret: `${intentId}_secret`
            };
        }),

        cancelPaymentIntent: vi.fn(async (intentId) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: intentId,
                amount: 1000,
                currency: 'USD',
                status: 'canceled',
                clientSecret: `${intentId}_secret`
            };
        }),

        createCustomer: vi.fn(async (params) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: `cus_provider_${Date.now()}`,
                email: params.email,
                name: params.name,
                metadata: params.metadata
            };
        }),

        updateCustomer: vi.fn(async (customerId, params) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: customerId,
                email: params.email ?? 'updated@example.com',
                name: params.name,
                metadata: params.metadata
            };
        }),

        deleteCustomer: vi.fn(async () => {
            await maybeDelay();
            maybeThrow();
        }),

        createPaymentMethod: vi.fn(async () => {
            await maybeDelay();
            maybeThrow();

            const method: QZPayPaymentMethod = {
                id: `pm_test_${++methodCounter}`,
                type: 'card',
                card: {
                    brand: 'visa',
                    last4: '4242',
                    expMonth: 12,
                    expYear: 2030
                }
            };

            return method;
        }),

        attachPaymentMethod: vi.fn(async (paymentMethodId) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: paymentMethodId,
                type: 'card',
                card: {
                    brand: 'visa',
                    last4: '4242',
                    expMonth: 12,
                    expYear: 2030
                }
            };
        }),

        detachPaymentMethod: vi.fn(async () => {
            await maybeDelay();
            maybeThrow();
        }),

        listPaymentMethods: vi.fn(async () => {
            await maybeDelay();
            maybeThrow();

            return [
                {
                    id: 'pm_test_default',
                    type: 'card',
                    card: {
                        brand: 'visa',
                        last4: '4242',
                        expMonth: 12,
                        expYear: 2030
                    }
                }
            ];
        }),

        createCheckoutSession: vi.fn(async (params: QZPayCheckoutSessionParams) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: `cs_test_${++sessionCounter}`,
                url: `https://checkout.test.com/session/${sessionCounter}`,
                status: 'open' as const,
                mode: params.mode,
                customerId: params.customerId
            };
        }),

        createCustomerPortalSession: vi.fn(async (params) => {
            await maybeDelay();
            maybeThrow();

            const session: QZPayCustomerPortalSession = {
                id: `bps_test_${Date.now()}`,
                url: `https://billing.test.com/portal/${params.customerId}`,
                returnUrl: params.returnUrl
            };

            return session;
        }),

        createRefund: vi.fn(async (params) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: `re_test_${Date.now()}`,
                paymentIntentId: params.paymentIntentId,
                amount: params.amount,
                status: 'succeeded',
                reason: params.reason
            };
        }),

        getRefund: vi.fn(async (refundId) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: refundId,
                paymentIntentId: 'pi_test_1',
                amount: 1000,
                status: 'succeeded'
            };
        }),

        constructWebhookEvent: vi.fn(async (payload, _signature) => {
            await maybeDelay();
            maybeThrow();

            return {
                id: `evt_webhook_${Date.now()}`,
                type: 'payment_intent.succeeded',
                data: JSON.parse(typeof payload === 'string' ? payload : payload.toString()),
                created: Date.now()
            };
        }),

        getProviderName: vi.fn(() => 'mock')
    };
}

/**
 * Create a mock payment adapter that always fails
 */
export function createFailingPaymentAdapter(errorMessage = 'Payment failed'): QZPayPaymentAdapter {
    return createMockPaymentAdapter({
        shouldSucceed: false,
        errorMessage
    });
}

/**
 * Create a mock payment adapter with artificial delay
 */
export function createDelayedPaymentAdapter(delayMs: number): QZPayPaymentAdapter {
    return createMockPaymentAdapter({
        delay: delayMs
    });
}

/**
 * Reset all mock functions in a payment adapter
 */
export function resetMockPaymentAdapter(adapter: QZPayPaymentAdapter): void {
    for (const value of Object.values(adapter)) {
        if (typeof value === 'function' && 'mockClear' in value) {
            (value as ReturnType<typeof vi.fn>).mockClear();
        }
    }
}
