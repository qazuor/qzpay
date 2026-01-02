/**
 * QZPayBilling factory and main entry point
 */
import type { QZPayEmailAdapter } from './adapters/email.adapter.js';
import type { QZPayPaymentAdapter } from './adapters/payment.adapter.js';
import type { QZPayStorageAdapter } from './adapters/storage.adapter.js';
import type { QZPayBillingEvent, QZPayCurrency } from './constants/index.js';
import { QZPayEventEmitter, type QZPayEventEmitterOptions } from './events/event-emitter.js';
import type { QZPayCustomerEntitlement } from './types/entitlements.types.js';
import type { QZPayEventMap, QZPayTypedEventHandler } from './types/events.types.js';
import type { QZPayInvoice } from './types/invoice.types.js';
import type { QZPayCustomerLimit } from './types/limits.types.js';
import type { QZPayPayment } from './types/payment.types.js';
import type { QZPayPlan, QZPayPrice } from './types/plan.types.js';
import type { QZPayPromoCode } from './types/promo-code.types.js';
import type { QZPaySubscription } from './types/subscription.types.js';

/**
 * Subscription service input types
 */
export interface QZPayCreateSubscriptionServiceInput {
    customerId: string;
    planId: string;
    priceId?: string;
    quantity?: number;
    trialDays?: number;
    promoCodeId?: string;
    metadata?: Record<string, unknown>;
}

export interface QZPayUpdateSubscriptionServiceInput {
    planId?: string;
    priceId?: string;
    quantity?: number;
    metadata?: Record<string, unknown>;
}

export interface QZPayCancelSubscriptionOptions {
    cancelAtPeriodEnd?: boolean;
    reason?: string;
}

/**
 * Invoice service input types
 */
export interface QZPayCreateInvoiceServiceInput {
    customerId: string;
    subscriptionId?: string;
    lines: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        priceId?: string;
    }>;
    dueDate?: Date;
    metadata?: Record<string, unknown>;
}

/**
 * Payment service input types
 */
export interface QZPayProcessPaymentInput {
    customerId: string;
    amount: number;
    currency: QZPayCurrency;
    invoiceId?: string;
    subscriptionId?: string;
    paymentMethodId?: string;
    metadata?: Record<string, unknown>;
}

export interface QZPayRefundPaymentInput {
    paymentId: string;
    amount?: number;
    reason?: string;
}

/**
 * Notification configuration
 */
export interface QZPayNotificationConfig {
    /**
     * Events that should NOT send automatic emails
     */
    suppress?: QZPayBillingEvent[] | undefined;

    /**
     * Custom email adapter
     */
    adapter?: QZPayEmailAdapter | undefined;
}

/**
 * Configuration for createQZPayBilling
 */
export interface QZPayBillingConfig {
    /**
     * Storage adapter for persisting data
     */
    storage: QZPayStorageAdapter;

    /**
     * Payment provider adapter
     */
    paymentAdapter?: QZPayPaymentAdapter | undefined;

    /**
     * Available plans
     */
    plans?: QZPayPlan[] | undefined;

    /**
     * Default currency for new subscriptions
     */
    defaultCurrency?: QZPayCurrency | undefined;

    /**
     * Whether in live mode (production)
     */
    livemode?: boolean | undefined;

    /**
     * Notification configuration
     */
    notifications?: QZPayNotificationConfig | undefined;

    /**
     * Grace period configuration in days
     */
    gracePeriodDays?: number | undefined;

    /**
     * Retry configuration for failed payments
     */
    retryConfig?:
        | {
              maxRetries?: number | undefined;
              retryIntervalDays?: number | undefined;
          }
        | undefined;
}

/**
 * Customer service interface
 */
export interface QZPayCustomerService {
    create: (input: Parameters<QZPayStorageAdapter['customers']['create']>[0]) => ReturnType<QZPayStorageAdapter['customers']['create']>;
    get: (id: string) => ReturnType<QZPayStorageAdapter['customers']['findById']>;
    getByExternalId: (externalId: string) => ReturnType<QZPayStorageAdapter['customers']['findByExternalId']>;
    update: (
        id: string,
        input: Parameters<QZPayStorageAdapter['customers']['update']>[1]
    ) => ReturnType<QZPayStorageAdapter['customers']['update']>;
    delete: (id: string) => ReturnType<QZPayStorageAdapter['customers']['delete']>;
    list: (options?: Parameters<QZPayStorageAdapter['customers']['list']>[0]) => ReturnType<QZPayStorageAdapter['customers']['list']>;
    syncUser: (input: Parameters<QZPayStorageAdapter['customers']['create']>[0]) => ReturnType<QZPayStorageAdapter['customers']['create']>;
}

/**
 * Subscription service interface
 */
export interface QZPaySubscriptionService {
    /**
     * Create a new subscription
     */
    create: (input: QZPayCreateSubscriptionServiceInput) => Promise<QZPaySubscription>;

    /**
     * Get a subscription by ID
     */
    get: (id: string) => Promise<QZPaySubscription | null>;

    /**
     * Get all subscriptions for a customer
     */
    getByCustomerId: (customerId: string) => Promise<QZPaySubscription[]>;

    /**
     * Update a subscription
     */
    update: (id: string, input: QZPayUpdateSubscriptionServiceInput) => Promise<QZPaySubscription>;

    /**
     * Cancel a subscription
     */
    cancel: (id: string, options?: QZPayCancelSubscriptionOptions) => Promise<QZPaySubscription>;

    /**
     * Pause a subscription
     */
    pause: (id: string) => Promise<QZPaySubscription>;

    /**
     * Resume a paused subscription
     */
    resume: (id: string) => Promise<QZPaySubscription>;

    /**
     * List subscriptions with pagination
     */
    list: (
        options?: Parameters<QZPayStorageAdapter['subscriptions']['list']>[0]
    ) => ReturnType<QZPayStorageAdapter['subscriptions']['list']>;
}

/**
 * Invoice service interface
 */
export interface QZPayInvoiceService {
    /**
     * Create a new invoice
     */
    create: (input: QZPayCreateInvoiceServiceInput) => Promise<QZPayInvoice>;

    /**
     * Get an invoice by ID
     */
    get: (id: string) => Promise<QZPayInvoice | null>;

    /**
     * Get invoices for a customer
     */
    getByCustomerId: (customerId: string) => Promise<QZPayInvoice[]>;

    /**
     * Mark an invoice as paid
     */
    markPaid: (id: string, paymentId: string) => Promise<QZPayInvoice>;

    /**
     * Void an invoice
     */
    void: (id: string) => Promise<QZPayInvoice>;

    /**
     * List invoices with pagination
     */
    list: (options?: Parameters<QZPayStorageAdapter['invoices']['list']>[0]) => ReturnType<QZPayStorageAdapter['invoices']['list']>;
}

/**
 * Payment service interface
 */
export interface QZPayPaymentService {
    /**
     * Process a payment
     */
    process: (input: QZPayProcessPaymentInput) => Promise<QZPayPayment>;

    /**
     * Get a payment by ID
     */
    get: (id: string) => Promise<QZPayPayment | null>;

    /**
     * Get payments for a customer
     */
    getByCustomerId: (customerId: string) => Promise<QZPayPayment[]>;

    /**
     * Refund a payment
     */
    refund: (input: QZPayRefundPaymentInput) => Promise<QZPayPayment>;

    /**
     * List payments with pagination
     */
    list: (options?: Parameters<QZPayStorageAdapter['payments']['list']>[0]) => ReturnType<QZPayStorageAdapter['payments']['list']>;
}

/**
 * Plan service interface
 */
export interface QZPayPlanService {
    /**
     * Get a plan by ID
     */
    get: (id: string) => Promise<QZPayPlan | null>;

    /**
     * Get all active plans
     */
    getActive: () => Promise<QZPayPlan[]>;

    /**
     * Get prices for a plan
     */
    getPrices: (planId: string) => Promise<QZPayPrice[]>;

    /**
     * List all plans
     */
    list: (options?: Parameters<QZPayStorageAdapter['plans']['list']>[0]) => ReturnType<QZPayStorageAdapter['plans']['list']>;
}

/**
 * Promo code service interface
 */
export interface QZPayPromoCodeService {
    /**
     * Validate a promo code
     */
    validate: (code: string, customerId?: string, planId?: string) => Promise<QZPayPromoCodeValidationResult>;

    /**
     * Apply a promo code to a subscription
     */
    apply: (code: string, subscriptionId: string) => Promise<void>;

    /**
     * Get a promo code by code string
     */
    getByCode: (code: string) => Promise<QZPayPromoCode | null>;

    /**
     * List promo codes
     */
    list: (options?: Parameters<QZPayStorageAdapter['promoCodes']['list']>[0]) => ReturnType<QZPayStorageAdapter['promoCodes']['list']>;
}

/**
 * Promo code validation result
 */
export interface QZPayPromoCodeValidationResult {
    valid: boolean;
    promoCode: QZPayPromoCode | null;
    error?: string;
    discountAmount?: number;
    discountPercent?: number;
}

/**
 * Entitlement service interface
 */
export interface QZPayEntitlementService {
    /**
     * Check if customer has an entitlement
     */
    check: (customerId: string, entitlementKey: string) => Promise<boolean>;

    /**
     * Get all entitlements for a customer
     */
    getByCustomerId: (customerId: string) => Promise<QZPayCustomerEntitlement[]>;

    /**
     * Grant an entitlement to a customer
     */
    grant: (customerId: string, entitlementKey: string, source?: string, sourceId?: string) => Promise<QZPayCustomerEntitlement>;

    /**
     * Revoke an entitlement from a customer
     */
    revoke: (customerId: string, entitlementKey: string) => Promise<void>;
}

/**
 * Limit service interface
 */
export interface QZPayLimitService {
    /**
     * Check if customer is within a limit
     */
    check: (customerId: string, limitKey: string) => Promise<QZPayLimitCheckResult>;

    /**
     * Get all limits for a customer
     */
    getByCustomerId: (customerId: string) => Promise<QZPayCustomerLimit[]>;

    /**
     * Increment a limit usage
     */
    increment: (customerId: string, limitKey: string, amount?: number) => Promise<QZPayCustomerLimit>;

    /**
     * Set a limit value
     */
    set: (customerId: string, limitKey: string, maxValue: number) => Promise<QZPayCustomerLimit>;

    /**
     * Record usage
     */
    recordUsage: (customerId: string, limitKey: string, quantity: number, action?: 'set' | 'increment') => Promise<void>;
}

/**
 * Limit check result
 */
export interface QZPayLimitCheckResult {
    allowed: boolean;
    currentValue: number;
    maxValue: number;
    remaining: number;
}

/**
 * Metrics service interface (placeholder for Phase 2+)
 */
export interface QZPayMetricsService {
    readonly _placeholder?: never;
}

/**
 * Main QZPayBilling interface
 */
export interface QZPayBilling {
    /**
     * Customer management
     */
    readonly customers: QZPayCustomerService;

    /**
     * Subscription management
     */
    readonly subscriptions: QZPaySubscriptionService;

    /**
     * Payment management
     */
    readonly payments: QZPayPaymentService;

    /**
     * Invoice management
     */
    readonly invoices: QZPayInvoiceService;

    /**
     * Plan management
     */
    readonly plans: QZPayPlanService;

    /**
     * Promo code management
     */
    readonly promoCodes: QZPayPromoCodeService;

    /**
     * Entitlement management
     */
    readonly entitlements: QZPayEntitlementService;

    /**
     * Limit management
     */
    readonly limits: QZPayLimitService;

    /**
     * Metrics and analytics (Phase 2+)
     */
    readonly metrics: QZPayMetricsService;

    /**
     * Subscribe to billing events
     */
    on: <K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>) => () => void;

    /**
     * Subscribe to billing events (fires only once)
     */
    once: <K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>) => () => void;

    /**
     * Unsubscribe from billing events
     */
    off: <K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>) => void;

    /**
     * Get available plans
     */
    getPlans: () => QZPayPlan[];

    /**
     * Get a plan by ID
     */
    getPlan: (planId: string) => QZPayPlan | undefined;

    /**
     * Check if in live mode
     */
    isLivemode: () => boolean;

    /**
     * Get the storage adapter
     */
    getStorage: () => QZPayStorageAdapter;

    /**
     * Get the payment adapter
     */
    getPaymentAdapter: () => QZPayPaymentAdapter | undefined;
}

/**
 * Internal billing implementation
 */
class QZPayBillingImpl implements QZPayBilling {
    private readonly storage: QZPayStorageAdapter;
    private readonly paymentAdapter: QZPayPaymentAdapter | undefined;
    private readonly configPlans: QZPayPlan[];
    private readonly livemode: boolean;
    private readonly emitter: QZPayEventEmitter;
    private readonly planMap: Map<string, QZPayPlan>;

    constructor(config: QZPayBillingConfig) {
        this.storage = config.storage;
        this.paymentAdapter = config.paymentAdapter;
        this.configPlans = config.plans ?? [];
        this.livemode = config.livemode ?? false;

        const emitterOptions: QZPayEventEmitterOptions = {
            livemode: this.livemode
        };
        this.emitter = new QZPayEventEmitter(emitterOptions);

        this.planMap = new Map(this.configPlans.map((plan) => [plan.id, plan]));
    }

    get customers(): QZPayCustomerService {
        return {
            create: async (input) => {
                const customer = await this.storage.customers.create(input);
                await this.emitter.emit('customer.created', customer);
                return customer;
            },
            get: (id) => this.storage.customers.findById(id),
            getByExternalId: (externalId) => this.storage.customers.findByExternalId(externalId),
            update: async (id, input) => {
                const customer = await this.storage.customers.update(id, input);
                if (customer) {
                    await this.emitter.emit('customer.updated', customer);
                }
                return customer;
            },
            delete: async (id) => {
                await this.storage.customers.delete(id);
                const customer = await this.storage.customers.findById(id);
                if (customer) {
                    await this.emitter.emit('customer.deleted', customer);
                }
            },
            list: (options) => this.storage.customers.list(options),
            syncUser: async (input) => {
                const existing = await this.storage.customers.findByExternalId(input.externalId ?? '');
                if (existing) {
                    const updated = await this.storage.customers.update(existing.id, input);
                    if (updated) {
                        await this.emitter.emit('customer.updated', updated);
                    }
                    return updated ?? existing;
                }
                const customer = await this.storage.customers.create(input);
                await this.emitter.emit('customer.created', customer);
                return customer;
            }
        };
    }

    get subscriptions(): QZPaySubscriptionService {
        const storage = this.storage;
        const emitter = this.emitter;
        const planMap = this.planMap;

        return {
            create: async (input) => {
                const plan = planMap.get(input.planId);
                const price = plan?.prices.find((p) => p.id === input.priceId) ?? plan?.prices[0];

                // Build create input, only including defined values
                const createInput: Parameters<typeof storage.subscriptions.create>[0] = {
                    id: crypto.randomUUID(),
                    customerId: input.customerId,
                    planId: input.planId
                };
                if (input.quantity !== undefined) createInput.quantity = input.quantity;
                if (input.metadata !== undefined) createInput.metadata = input.metadata;
                if (input.trialDays !== undefined) createInput.trialDays = input.trialDays;
                else if (price?.trialDays != null) createInput.trialDays = price.trialDays;

                const subscription = await storage.subscriptions.create(createInput);
                await emitter.emit('subscription.created', subscription);
                return subscription;
            },
            get: (id) => storage.subscriptions.findById(id),
            getByCustomerId: (customerId) => storage.subscriptions.findByCustomerId(customerId),
            update: async (id, input) => {
                // Build update input, only including defined values
                const updateInput: Parameters<typeof storage.subscriptions.update>[1] = {};
                if (input.planId !== undefined) updateInput.planId = input.planId;
                if (input.metadata !== undefined) updateInput.metadata = input.metadata;

                const subscription = await storage.subscriptions.update(id, updateInput);
                await emitter.emit('subscription.updated', subscription);
                return subscription;
            },
            cancel: async (id, options) => {
                const now = new Date();
                // Build update input for cancellation
                const updateInput: Parameters<typeof storage.subscriptions.update>[1] = {
                    canceledAt: now
                };
                if (!options?.cancelAtPeriodEnd) {
                    updateInput.status = 'canceled';
                }
                if (options?.reason) {
                    updateInput.metadata = { cancelReason: options.reason };
                }
                const subscription = await storage.subscriptions.update(id, updateInput);
                await emitter.emit('subscription.canceled', subscription);
                return subscription;
            },
            pause: async (id) => {
                const subscription = await storage.subscriptions.update(id, { status: 'paused' });
                await emitter.emit('subscription.paused', subscription);
                return subscription;
            },
            resume: async (id) => {
                const subscription = await storage.subscriptions.update(id, { status: 'active' });
                await emitter.emit('subscription.resumed', subscription);
                return subscription;
            },
            list: (options) => storage.subscriptions.list(options)
        };
    }

    get payments(): QZPayPaymentService {
        const storage = this.storage;
        const emitter = this.emitter;
        const paymentAdapter = this.paymentAdapter;

        return {
            process: async (input) => {
                const paymentId = crypto.randomUUID();
                const now = new Date();

                // Create payment record
                const payment = await storage.payments.create({
                    id: paymentId,
                    customerId: input.customerId,
                    amount: input.amount,
                    currency: input.currency,
                    status: 'pending',
                    invoiceId: input.invoiceId ?? null,
                    subscriptionId: input.subscriptionId ?? null,
                    paymentMethodId: input.paymentMethodId ?? null,
                    failureCode: null,
                    failureMessage: null,
                    metadata: input.metadata ?? {},
                    livemode: this.livemode,
                    createdAt: now,
                    updatedAt: now,
                    providerPaymentIds: {}
                });

                // Process with payment provider if available
                if (paymentAdapter) {
                    try {
                        // Get customer to find provider customer ID
                        const customer = await storage.customers.findById(input.customerId);
                        const providerCustomerId = customer?.providerCustomerIds[paymentAdapter.provider];

                        if (!providerCustomerId) {
                            throw new Error(`Customer ${input.customerId} not linked to ${paymentAdapter.provider}`);
                        }

                        // Build payment input, only including defined values
                        const paymentInput: Parameters<typeof paymentAdapter.payments.create>[1] = {
                            customerId: input.customerId,
                            amount: input.amount,
                            currency: input.currency
                        };
                        if (input.paymentMethodId !== undefined) paymentInput.paymentMethodId = input.paymentMethodId;
                        if (input.subscriptionId !== undefined) paymentInput.subscriptionId = input.subscriptionId;
                        if (input.invoiceId !== undefined) paymentInput.invoiceId = input.invoiceId;
                        if (input.metadata !== undefined) paymentInput.metadata = input.metadata;

                        const result = await paymentAdapter.payments.create(providerCustomerId, paymentInput);

                        const updated = await storage.payments.update(paymentId, {
                            status: 'succeeded',
                            providerPaymentIds: { [paymentAdapter.provider]: result.id }
                        });
                        await emitter.emit('payment.succeeded', updated);
                        return updated;
                    } catch {
                        const failed = await storage.payments.update(paymentId, { status: 'failed' });
                        await emitter.emit('payment.failed', failed);
                        return failed;
                    }
                }

                // No payment adapter - just mark as pending
                return payment;
            },
            get: (id) => storage.payments.findById(id),
            getByCustomerId: (customerId) => storage.payments.findByCustomerId(customerId),
            refund: async (input) => {
                const payment = await storage.payments.findById(input.paymentId);
                if (!payment) {
                    throw new Error(`Payment ${input.paymentId} not found`);
                }

                const refundAmount = input.amount ?? payment.amount;
                const updated = await storage.payments.update(input.paymentId, {
                    status: refundAmount >= payment.amount ? 'refunded' : 'partially_refunded',
                    metadata: { ...payment.metadata, refundReason: input.reason, refundedAmount: refundAmount }
                });
                await emitter.emit('payment.refunded', updated);
                return updated;
            },
            list: (options) => storage.payments.list(options)
        };
    }

    get invoices(): QZPayInvoiceService {
        const storage = this.storage;
        const emitter = this.emitter;

        return {
            create: async (input) => {
                const invoice = await storage.invoices.create({
                    id: crypto.randomUUID(),
                    customerId: input.customerId,
                    lines: input.lines
                });
                await emitter.emit('invoice.created', invoice);
                return invoice;
            },
            get: (id) => storage.invoices.findById(id),
            getByCustomerId: (customerId) => storage.invoices.findByCustomerId(customerId),
            markPaid: async (id, paymentId) => {
                const invoice = await storage.invoices.update(id, {
                    status: 'paid',
                    paidAt: new Date(),
                    metadata: { paymentId }
                });
                await emitter.emit('invoice.paid', invoice);
                return invoice;
            },
            void: async (id) => {
                const invoice = await storage.invoices.update(id, { status: 'void' });
                await emitter.emit('invoice.voided', invoice);
                return invoice;
            },
            list: (options) => storage.invoices.list(options)
        };
    }

    get plans(): QZPayPlanService {
        const storage = this.storage;
        const planMap = this.planMap;
        const configPlans = this.configPlans;

        return {
            get: async (id) => {
                // First check config plans (in-memory)
                const configPlan = planMap.get(id);
                if (configPlan) return configPlan;
                // Then check storage
                return storage.plans.findById(id);
            },
            getActive: async () => {
                const result = await storage.plans.list({ filters: { active: true } });
                const storagePlans = result.data.filter((p) => p.active);
                const activConfigPlans = configPlans.filter((p) => p.active);
                return [...activConfigPlans, ...storagePlans];
            },
            getPrices: async (planId) => {
                return storage.prices.findByPlanId(planId);
            },
            list: (options) => storage.plans.list(options)
        };
    }

    get promoCodes(): QZPayPromoCodeService {
        const storage = this.storage;

        return {
            validate: async (code, _customerId, _planId) => {
                const promoCode = await storage.promoCodes.findByCode(code);

                if (!promoCode) {
                    return { valid: false, promoCode: null, error: 'Promo code not found' };
                }

                if (!promoCode.active) {
                    return { valid: false, promoCode, error: 'Promo code is not active' };
                }

                if (promoCode.validUntil && new Date() > promoCode.validUntil) {
                    return { valid: false, promoCode, error: 'Promo code has expired' };
                }

                if (promoCode.maxRedemptions && promoCode.currentRedemptions >= promoCode.maxRedemptions) {
                    return { valid: false, promoCode, error: 'Promo code has reached max redemptions' };
                }

                // Calculate discount - build result object with only defined discount values
                const result: QZPayPromoCodeValidationResult = {
                    valid: true,
                    promoCode
                };
                if (promoCode.discountType === 'fixed_amount') {
                    result.discountAmount = promoCode.discountValue;
                } else if (promoCode.discountType === 'percentage') {
                    result.discountPercent = promoCode.discountValue;
                }
                return result;
            },
            apply: async (code, _subscriptionId) => {
                const promoCode = await storage.promoCodes.findByCode(code);
                if (promoCode) {
                    await storage.promoCodes.incrementRedemptions(promoCode.id);
                }
            },
            getByCode: (code) => storage.promoCodes.findByCode(code),
            list: (options) => storage.promoCodes.list(options)
        };
    }

    get entitlements(): QZPayEntitlementService {
        const storage = this.storage;

        return {
            check: (customerId, entitlementKey) => storage.entitlements.check(customerId, entitlementKey),
            getByCustomerId: (customerId) => storage.entitlements.findByCustomerId(customerId),
            grant: async (customerId, entitlementKey, _source, _sourceId) => {
                // External grants are always 'manual' source
                // Subscription/purchase entitlements are granted internally
                return storage.entitlements.grant({
                    customerId,
                    entitlementKey,
                    source: 'manual'
                });
            },
            revoke: (customerId, entitlementKey) => storage.entitlements.revoke(customerId, entitlementKey)
        };
    }

    get limits(): QZPayLimitService {
        const storage = this.storage;

        return {
            check: async (customerId, limitKey) => {
                const limit = await storage.limits.check(customerId, limitKey);
                if (!limit) {
                    return { allowed: true, currentValue: 0, maxValue: Infinity, remaining: Infinity };
                }
                const remaining = limit.maxValue - limit.currentValue;
                return {
                    allowed: remaining > 0,
                    currentValue: limit.currentValue,
                    maxValue: limit.maxValue,
                    remaining
                };
            },
            getByCustomerId: (customerId) => storage.limits.findByCustomerId(customerId),
            increment: async (customerId, limitKey, amount = 1) => {
                return storage.limits.increment({ customerId, limitKey, incrementBy: amount });
            },
            set: async (customerId, limitKey, maxValue) => {
                return storage.limits.set({ customerId, limitKey, maxValue });
            },
            recordUsage: async (customerId, limitKey, quantity, action = 'increment') => {
                await storage.limits.recordUsage({
                    id: crypto.randomUUID(),
                    customerId,
                    limitKey,
                    quantity,
                    action,
                    timestamp: new Date(),
                    metadata: {}
                });
            }
        };
    }

    get metrics(): QZPayMetricsService {
        return {};
    }

    on<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): () => void {
        return this.emitter.on(eventType, handler);
    }

    once<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): () => void {
        return this.emitter.once(eventType, handler);
    }

    off<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): void {
        this.emitter.off(eventType, handler);
    }

    getPlans(): QZPayPlan[] {
        return [...this.configPlans];
    }

    getPlan(planId: string): QZPayPlan | undefined {
        return this.planMap.get(planId);
    }

    isLivemode(): boolean {
        return this.livemode;
    }

    getStorage(): QZPayStorageAdapter {
        return this.storage;
    }

    getPaymentAdapter(): QZPayPaymentAdapter | undefined {
        return this.paymentAdapter;
    }
}

/**
 * Create a new QZPayBilling instance
 */
export function createQZPayBilling(config: QZPayBillingConfig): QZPayBilling {
    return new QZPayBillingImpl(config);
}
