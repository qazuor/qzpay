/**
 * React Test Mock Helpers
 */
import type { QZPayBilling, QZPayCustomer } from '@qazuor/qzpay-core';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { QZPayProvider } from '../../src/context/QZPayContext.js';

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
            set: vi.fn(),
            recordUsage: vi.fn()
        },
        plans: {
            list: vi.fn(),
            get: vi.fn(),
            getActive: vi.fn(),
            getPrices: vi.fn()
        },
        getPlans: vi.fn().mockReturnValue([]),
        getPlan: vi.fn(),
        isLivemode: vi.fn().mockReturnValue(false),
        on: vi.fn().mockReturnValue(() => {}),
        once: vi.fn().mockReturnValue(() => {})
    } as unknown as QZPayBilling;
}

/**
 * Create mock customer data
 */
export function createMockCustomer(overrides: Partial<QZPayCustomer> = {}): QZPayCustomer {
    return {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test Customer',
        externalId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
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
        priceId: 'price_123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
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
        entitlementKey: 'feature_api_access',
        source: 'plan',
        sourceId: 'plan_123',
        expiresAt: null,
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
        limitKey: 'api_calls',
        currentValue: 50,
        maxValue: 100,
        resetPeriod: 'monthly',
        resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
        entitlements: [],
        limits: [],
        metadata: {},
        active: true,
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
 * Wrapper component for tests
 */
interface WrapperProps {
    children: ReactNode;
    billing?: QZPayBilling;
    initialCustomer?: QZPayCustomer | null;
}

export function TestWrapper({ children, billing, initialCustomer }: WrapperProps) {
    const mockBilling = billing ?? createMockBilling();
    return (
        <QZPayProvider billing={mockBilling} initialCustomer={initialCustomer ?? undefined}>
            {children}
        </QZPayProvider>
    );
}

/**
 * Create a wrapper function for renderHook
 */
export function createWrapper(billing?: QZPayBilling, initialCustomer?: QZPayCustomer | null) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <TestWrapper billing={billing} initialCustomer={initialCustomer}>
                {children}
            </TestWrapper>
        );
    };
}
