/**
 * MercadoPago Mock Helpers
 * Provides mock implementations for MercadoPago SDK
 */
import { vi } from 'vitest';

/**
 * Mock MercadoPago Customer API
 */
export function createMockCustomerApi() {
    return {
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        get: vi.fn()
    };
}

/**
 * Mock MercadoPago Payment API
 */
export function createMockPaymentApi() {
    return {
        create: vi.fn(),
        capture: vi.fn(),
        cancel: vi.fn(),
        get: vi.fn()
    };
}

/**
 * Mock MercadoPago PaymentRefund API
 */
export function createMockRefundApi() {
    return {
        create: vi.fn()
    };
}

/**
 * Mock MercadoPago PreApproval API
 */
export function createMockPreApprovalApi() {
    return {
        create: vi.fn(),
        update: vi.fn(),
        get: vi.fn()
    };
}

/**
 * Mock MercadoPago PreApprovalPlan API
 */
export function createMockPreApprovalPlanApi() {
    return {
        create: vi.fn(),
        update: vi.fn(),
        get: vi.fn()
    };
}

/**
 * Mock MercadoPago Preference API
 */
export function createMockPreferenceApi() {
    return {
        create: vi.fn(),
        update: vi.fn(),
        get: vi.fn()
    };
}

/**
 * Create mock MercadoPago customer response
 */
export function createMockMPCustomer(overrides: Record<string, unknown> = {}) {
    return {
        id: 'cus_mp_123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        ...overrides
    };
}

/**
 * Create mock MercadoPago payment response
 */
export function createMockMPPayment(overrides: Record<string, unknown> = {}) {
    return {
        id: 12345678,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100.0,
        currency_id: 'USD',
        payer: {
            id: 'cus_mp_123',
            email: 'test@example.com'
        },
        metadata: {},
        date_created: new Date().toISOString(),
        date_approved: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Create mock MercadoPago refund response
 */
export function createMockMPRefund(overrides: Record<string, unknown> = {}) {
    return {
        id: 87654321,
        payment_id: 12345678,
        amount: 100.0,
        status: 'approved',
        date_created: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Create mock MercadoPago preapproval (subscription) response
 */
export function createMockMPPreapproval(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    return {
        id: 'preapproval_123',
        payer_id: 12345,
        status: 'authorized',
        reason: 'Monthly subscription',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 29.99,
            currency_id: 'USD',
            start_date: now.toISOString(),
            end_date: null
        },
        next_payment_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        date_created: now.toISOString(),
        last_modified: now.toISOString(),
        metadata: {},
        ...overrides
    };
}

/**
 * Create mock MercadoPago preapproval plan (price) response
 */
export function createMockMPPreapprovalPlan(overrides: Record<string, unknown> = {}) {
    return {
        id: 'plan_123',
        status: 'active',
        reason: 'Premium Plan',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 29.99,
            currency_id: 'USD',
            billing_day: null,
            free_trial: null
        },
        date_created: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Create mock MercadoPago preference (checkout) response
 */
export function createMockMPPreference(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pref_123',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_123',
        sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_123',
        items: [
            {
                id: 'item_1',
                title: 'Test Product',
                quantity: 1,
                unit_price: 100.0,
                currency_id: 'USD'
            }
        ],
        payer: {
            email: 'test@example.com'
        },
        external_reference: 'cus_123',
        metadata: {},
        date_created: new Date().toISOString(),
        expiration_date_to: null,
        ...overrides
    };
}

/**
 * Create mock MercadoPago webhook payload
 */
export function createMockMPWebhookPayload(type: string, action = 'created', overrides: Record<string, unknown> = {}) {
    return {
        id: 123456789,
        live_mode: false,
        type,
        date_created: new Date().toISOString(),
        user_id: 'user_123',
        api_version: 'v1',
        action,
        data: {
            id: 'data_id_123'
        },
        ...overrides
    };
}
