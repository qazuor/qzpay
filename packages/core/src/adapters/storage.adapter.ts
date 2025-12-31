/**
 * Storage adapter interface for QZPay
 * Defines the contract for database operations
 */
import type {
    QZPayCreateCustomerInput,
    QZPayCreateInvoiceInput,
    QZPayCreatePlanInput,
    QZPayCreatePriceInput,
    QZPayCreatePromoCodeInput,
    QZPayCreateSubscriptionInput,
    QZPayCreateVendorInput,
    QZPayCustomer,
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayEntitlement,
    QZPayGrantEntitlementInput,
    QZPayIncrementLimitInput,
    QZPayInvoice,
    QZPayLimit,
    QZPayPayment,
    QZPayPlan,
    QZPayPrice,
    QZPayPromoCode,
    QZPaySetLimitInput,
    QZPaySubscription,
    QZPayUpdateCustomerInput,
    QZPayUpdateSubscriptionInput,
    QZPayUpdateVendorInput,
    QZPayUsageRecord,
    QZPayVendor,
    QZPayVendorPayout
} from '../types/index.js';

export interface QZPayStorageAdapter {
    // Customer operations
    customers: QZPayCustomerStorage;

    // Subscription operations
    subscriptions: QZPaySubscriptionStorage;

    // Payment operations
    payments: QZPayPaymentStorage;

    // Invoice operations
    invoices: QZPayInvoiceStorage;

    // Plan operations
    plans: QZPayPlanStorage;

    // Price operations
    prices: QZPayPriceStorage;

    // Promo code operations
    promoCodes: QZPayPromoCodeStorage;

    // Vendor operations (marketplace)
    vendors: QZPayVendorStorage;

    // Entitlement operations
    entitlements: QZPayEntitlementStorage;

    // Limit operations
    limits: QZPayLimitStorage;

    // Transaction support
    transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface QZPayCustomerStorage {
    create(input: QZPayCreateCustomerInput): Promise<QZPayCustomer>;
    update(id: string, input: QZPayUpdateCustomerInput): Promise<QZPayCustomer>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<QZPayCustomer | null>;
    findByExternalId(externalId: string): Promise<QZPayCustomer | null>;
    findByEmail(email: string): Promise<QZPayCustomer | null>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayCustomer>>;
}

export interface QZPaySubscriptionStorage {
    create(input: QZPayCreateSubscriptionInput & { id: string }): Promise<QZPaySubscription>;
    update(id: string, input: QZPayUpdateSubscriptionInput): Promise<QZPaySubscription>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<QZPaySubscription | null>;
    findByCustomerId(customerId: string): Promise<QZPaySubscription[]>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPaySubscription>>;
}

export interface QZPayPaymentStorage {
    create(payment: QZPayPayment): Promise<QZPayPayment>;
    update(id: string, payment: Partial<QZPayPayment>): Promise<QZPayPayment>;
    findById(id: string): Promise<QZPayPayment | null>;
    findByCustomerId(customerId: string): Promise<QZPayPayment[]>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPayment>>;
}

export interface QZPayInvoiceStorage {
    create(input: QZPayCreateInvoiceInput & { id: string }): Promise<QZPayInvoice>;
    update(id: string, invoice: Partial<QZPayInvoice>): Promise<QZPayInvoice>;
    findById(id: string): Promise<QZPayInvoice | null>;
    findByCustomerId(customerId: string): Promise<QZPayInvoice[]>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayInvoice>>;
}

export interface QZPayPlanStorage {
    create(input: QZPayCreatePlanInput & { id: string }): Promise<QZPayPlan>;
    update(id: string, plan: Partial<QZPayPlan>): Promise<QZPayPlan>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<QZPayPlan | null>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPlan>>;
}

export interface QZPayPriceStorage {
    create(input: QZPayCreatePriceInput & { id: string }): Promise<QZPayPrice>;
    update(id: string, price: Partial<QZPayPrice>): Promise<QZPayPrice>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<QZPayPrice | null>;
    findByPlanId(planId: string): Promise<QZPayPrice[]>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPrice>>;
}

export interface QZPayPromoCodeStorage {
    create(input: QZPayCreatePromoCodeInput & { id: string }): Promise<QZPayPromoCode>;
    update(id: string, promoCode: Partial<QZPayPromoCode>): Promise<QZPayPromoCode>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<QZPayPromoCode | null>;
    findByCode(code: string): Promise<QZPayPromoCode | null>;
    incrementRedemptions(id: string): Promise<void>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPromoCode>>;
}

export interface QZPayVendorStorage {
    create(input: QZPayCreateVendorInput & { id: string }): Promise<QZPayVendor>;
    update(id: string, input: QZPayUpdateVendorInput): Promise<QZPayVendor>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<QZPayVendor | null>;
    findByExternalId(externalId: string): Promise<QZPayVendor | null>;
    list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayVendor>>;
    createPayout(payout: QZPayVendorPayout): Promise<QZPayVendorPayout>;
    findPayoutsByVendorId(vendorId: string): Promise<QZPayVendorPayout[]>;
}

export interface QZPayEntitlementStorage {
    createDefinition(entitlement: QZPayEntitlement): Promise<QZPayEntitlement>;
    findDefinitionByKey(key: string): Promise<QZPayEntitlement | null>;
    listDefinitions(): Promise<QZPayEntitlement[]>;
    grant(input: QZPayGrantEntitlementInput): Promise<QZPayCustomerEntitlement>;
    revoke(customerId: string, entitlementKey: string): Promise<void>;
    findByCustomerId(customerId: string): Promise<QZPayCustomerEntitlement[]>;
    check(customerId: string, entitlementKey: string): Promise<boolean>;
}

export interface QZPayLimitStorage {
    createDefinition(limit: QZPayLimit): Promise<QZPayLimit>;
    findDefinitionByKey(key: string): Promise<QZPayLimit | null>;
    listDefinitions(): Promise<QZPayLimit[]>;
    set(input: QZPaySetLimitInput): Promise<QZPayCustomerLimit>;
    increment(input: QZPayIncrementLimitInput): Promise<QZPayCustomerLimit>;
    findByCustomerId(customerId: string): Promise<QZPayCustomerLimit[]>;
    check(customerId: string, limitKey: string): Promise<QZPayCustomerLimit | null>;
    recordUsage(record: QZPayUsageRecord): Promise<QZPayUsageRecord>;
}

export interface QZPayListOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Record<string, unknown>;
}

export interface QZPayPaginatedResult<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
