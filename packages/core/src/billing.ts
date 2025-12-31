/**
 * QZPayBilling factory and main entry point
 */
import type { QZPayEmailAdapter } from './adapters/email.adapter.js';
import type { QZPayPaymentAdapter } from './adapters/payment.adapter.js';
import type { QZPayStorageAdapter } from './adapters/storage.adapter.js';
import type { QZPayBillingEvent, QZPayCurrency } from './constants/index.js';
import { QZPayEventEmitter, type QZPayEventEmitterOptions } from './events/event-emitter.js';
import type { QZPayEventMap, QZPayTypedEventHandler } from './types/events.types.js';
import type { QZPayPlan } from './types/plan.types.js';

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
 * Subscription service interface (placeholder for Phase 2+)
 */
export interface QZPaySubscriptionService {
    readonly _placeholder?: never;
}

/**
 * Invoice service interface (placeholder for Phase 2+)
 */
export interface QZPayInvoiceService {
    readonly _placeholder?: never;
}

/**
 * Payment method service interface (placeholder for Phase 2+)
 */
export interface QZPayPaymentMethodService {
    readonly _placeholder?: never;
}

/**
 * Promo code service interface (placeholder for Phase 2+)
 */
export interface QZPayPromoCodeService {
    readonly _placeholder?: never;
}

/**
 * Usage service interface (placeholder for Phase 2+)
 */
export interface QZPayUsageService {
    readonly _placeholder?: never;
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
     * Subscription management (Phase 2+)
     */
    readonly subscriptions: QZPaySubscriptionService;

    /**
     * Invoice management (Phase 2+)
     */
    readonly invoices: QZPayInvoiceService;

    /**
     * Payment method management (Phase 2+)
     */
    readonly paymentMethods: QZPayPaymentMethodService;

    /**
     * Promo code management (Phase 2+)
     */
    readonly promoCodes: QZPayPromoCodeService;

    /**
     * Usage reporting (Phase 2+)
     */
    readonly usage: QZPayUsageService;

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
    private readonly plans: QZPayPlan[];
    private readonly livemode: boolean;
    private readonly emitter: QZPayEventEmitter;
    private readonly planMap: Map<string, QZPayPlan>;

    constructor(config: QZPayBillingConfig) {
        this.storage = config.storage;
        this.paymentAdapter = config.paymentAdapter;
        this.plans = config.plans ?? [];
        this.livemode = config.livemode ?? false;

        const emitterOptions: QZPayEventEmitterOptions = {
            livemode: this.livemode
        };
        this.emitter = new QZPayEventEmitter(emitterOptions);

        this.planMap = new Map(this.plans.map((plan) => [plan.id, plan]));
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
        return {};
    }

    get invoices(): QZPayInvoiceService {
        return {};
    }

    get paymentMethods(): QZPayPaymentMethodService {
        return {};
    }

    get promoCodes(): QZPayPromoCodeService {
        return {};
    }

    get usage(): QZPayUsageService {
        return {};
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
        return [...this.plans];
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
