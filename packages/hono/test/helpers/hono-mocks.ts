/**
 * Hono Test Mock Helpers
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
            update: vi.fn(),
            delete: vi.fn(),
            list: vi.fn(),
            listAll: vi.fn()
        },
        subscriptions: {
            create: vi.fn(),
            get: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            list: vi.fn(),
            listForCustomer: vi.fn(),
            getByCustomerId: vi.fn(),
            listAll: vi.fn()
        },
        payments: {
            create: vi.fn(),
            get: vi.fn(),
            process: vi.fn(),
            refund: vi.fn(),
            capture: vi.fn(),
            list: vi.fn(),
            listForCustomer: vi.fn(),
            getByCustomerId: vi.fn(),
            listAll: vi.fn()
        },
        invoices: {
            get: vi.fn(),
            create: vi.fn(),
            pay: vi.fn(),
            void: vi.fn(),
            list: vi.fn(),
            listForCustomer: vi.fn(),
            getByCustomerId: vi.fn(),
            listForSubscription: vi.fn(),
            listAll: vi.fn()
        },
        plans: {
            create: vi.fn(),
            get: vi.fn(),
            update: vi.fn(),
            archive: vi.fn(),
            list: vi.fn(),
            listAll: vi.fn(),
            getActive: vi.fn(),
            getPrices: vi.fn()
        },
        promoCodes: {
            create: vi.fn(),
            get: vi.fn(),
            getByCode: vi.fn(),
            deactivate: vi.fn(),
            validate: vi.fn(),
            apply: vi.fn(),
            list: vi.fn(),
            listAll: vi.fn()
        },
        entitlements: {
            check: vi.fn(),
            grant: vi.fn(),
            revoke: vi.fn(),
            listForCustomer: vi.fn(),
            getByCustomerId: vi.fn(),
            listAll: vi.fn()
        },
        limits: {
            get: vi.fn(),
            check: vi.fn(),
            increment: vi.fn(),
            reset: vi.fn(),
            set: vi.fn(),
            listForCustomer: vi.fn(),
            getByCustomerId: vi.fn(),
            recordUsage: vi.fn(),
            listAll: vi.fn()
        }
    } as unknown as QZPayBilling;
}

/**
 * Create a mock payment adapter
 */
export function createMockPaymentAdapter(provider = 'stripe', webhookSupport = true): QZPayPaymentAdapter {
    const webhooks = webhookSupport
        ? {
              verifySignature: vi.fn().mockReturnValue(true),
              constructEvent: vi.fn().mockReturnValue({
                  id: 'evt_123',
                  type: 'payment.created',
                  data: { id: 'pay_123' },
                  created: new Date()
              } as QZPayWebhookEvent)
          }
        : undefined;

    return {
        provider,
        customers: {} as never,
        subscriptions: {} as never,
        payments: {} as never,
        checkout: {} as never,
        prices: {} as never,
        webhooks
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

/**
 * Create mock promo code data
 */
export function createMockPromoCode(overrides: Record<string, unknown> = {}) {
    return {
        id: 'promo_123',
        code: 'DISCOUNT20',
        discountType: 'percentage',
        discountValue: 20,
        active: true,
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
 * Create mock list response
 */
export function createMockListResponse<T>(items: T[], hasMore = false) {
    return {
        data: items,
        hasMore,
        total: items.length
    };
}
