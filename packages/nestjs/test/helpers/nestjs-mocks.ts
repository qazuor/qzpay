/**
 * NestJS Test Mock Helpers
 */
import type { QZPayBilling, QZPayPaymentAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { vi } from 'vitest';

/**
 * Create a mock QZPayBilling instance
 */
export function createMockBilling(): QZPayBilling {
    return {
        customers: {
            create: vi.fn(),
            get: vi.fn(),
            getByExternalId: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            list: vi.fn()
        },
        subscriptions: {
            create: vi.fn(),
            get: vi.fn(),
            getByCustomerId: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            list: vi.fn()
        },
        payments: {
            process: vi.fn(),
            get: vi.fn(),
            getByCustomerId: vi.fn(),
            refund: vi.fn(),
            list: vi.fn()
        },
        invoices: {
            create: vi.fn(),
            get: vi.fn(),
            getByCustomerId: vi.fn(),
            markPaid: vi.fn(),
            list: vi.fn()
        },
        entitlements: {
            check: vi.fn(),
            getByCustomerId: vi.fn(),
            grant: vi.fn(),
            revoke: vi.fn()
        },
        limits: {
            check: vi.fn(),
            getByCustomerId: vi.fn(),
            increment: vi.fn(),
            set: vi.fn()
        },
        getPlans: vi.fn().mockReturnValue([]),
        getPlan: vi.fn(),
        isLivemode: vi.fn().mockReturnValue(false),
        on: vi.fn().mockReturnValue(() => {}),
        once: vi.fn().mockReturnValue(() => {}),
        getPaymentAdapter: vi.fn()
    } as unknown as QZPayBilling;
}

/**
 * Create a mock payment adapter
 */
export function createMockPaymentAdapter(provider = 'stripe'): QZPayPaymentAdapter {
    return {
        provider,
        customers: {} as never,
        subscriptions: {} as never,
        payments: {} as never,
        checkout: {} as never,
        prices: {} as never,
        webhooks: {
            verifySignature: vi.fn().mockReturnValue(true),
            constructEvent: vi.fn().mockReturnValue({
                id: 'evt_123',
                type: 'payment.created',
                data: { id: 'pay_123' },
                created: new Date()
            } as QZPayWebhookEvent)
        }
    } as QZPayPaymentAdapter;
}

/**
 * Create a mock webhook event
 */
export function createMockWebhookEvent(type = 'payment.created', data: Record<string, unknown> = { id: 'test_123' }): QZPayWebhookEvent {
    return {
        id: `evt_${Date.now()}`,
        type,
        data,
        created: new Date()
    };
}

/**
 * Create mock customer data
 */
export function createMockCustomer(overrides: Record<string, unknown> = {}) {
    return {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test Customer',
        metadata: {},
        createdAt: new Date(),
        ...overrides
    };
}

/**
 * Create mock subscription data
 */
export function createMockSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub_123',
        customerId: 'cus_123',
        planId: 'plan_123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        metadata: {},
        createdAt: new Date(),
        ...overrides
    };
}

/**
 * Create mock payment data
 */
export function createMockPayment(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pay_123',
        customerId: 'cus_123',
        amount: 2999,
        currency: 'usd',
        status: 'succeeded',
        metadata: {},
        createdAt: new Date(),
        ...overrides
    };
}

/**
 * Create mock invoice data
 */
export function createMockInvoice(overrides: Record<string, unknown> = {}) {
    return {
        id: 'inv_123',
        customerId: 'cus_123',
        subscriptionId: 'sub_123',
        amount: 2999,
        currency: 'usd',
        status: 'paid',
        metadata: {},
        createdAt: new Date(),
        ...overrides
    };
}

/**
 * Create mock entitlement data
 */
export function createMockEntitlement(overrides: Record<string, unknown> = {}) {
    return {
        id: 'ent_123',
        customerId: 'cus_123',
        featureId: 'feature_api_access',
        granted: true,
        metadata: {},
        createdAt: new Date(),
        ...overrides
    };
}

/**
 * Create mock limit data
 */
export function createMockLimit(overrides: Record<string, unknown> = {}) {
    return {
        id: 'limit_123',
        customerId: 'cus_123',
        featureId: 'feature_api_calls',
        currentValue: 500,
        maxValue: 1000,
        metadata: {},
        createdAt: new Date(),
        ...overrides
    };
}

/**
 * Create mock execution context for NestJS guards
 */
export function createMockExecutionContext(requestOverrides: Record<string, unknown> = {}): {
    switchToHttp: () => { getRequest: () => Record<string, unknown> };
    getHandler: () => () => void;
} {
    const request = {
        customer: { id: 'cus_123' },
        user: { customerId: 'cus_123' },
        ...requestOverrides
    };

    return {
        switchToHttp: () => ({
            getRequest: () => request
        }),
        getHandler: () => () => {}
    };
}

/**
 * Create mock reflector for NestJS guards
 */
export function createMockReflector(metadata: Record<string, unknown> = {}): {
    get: <T>(key: string | symbol, target: unknown) => T | undefined;
} {
    return {
        get: <T>(key: string | symbol) => metadata[String(key)] as T | undefined
    };
}

/**
 * Create mock plan data
 */
export function createMockPlan(overrides: Record<string, unknown> = {}) {
    return {
        id: 'plan_123',
        name: 'Premium Plan',
        description: 'Premium features',
        prices: [],
        features: [],
        metadata: {},
        active: true,
        createdAt: new Date(),
        ...overrides
    };
}
