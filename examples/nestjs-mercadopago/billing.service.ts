/**
 * QZPay Billing Service for NestJS + MercadoPago
 *
 * Provides billing operations using QZPay with MercadoPago.
 */
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { QZPayBilling, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { extractMP3DSPaymentInfo, isMP3DSRequired } from '@qazuor/qzpay-mercadopago';
import type {
    BillingModuleConfig,
    CreateCustomerDto,
    CreatePaymentDto,
    CreateSubscriptionDto,
    CustomerResponse,
    PaymentResponse,
    RefundPaymentDto,
    SubscriptionResponse
} from './types';
import { PLANS } from './types';

export const BILLING_CONFIG = 'BILLING_CONFIG';

@Injectable()
export class BillingService implements OnModuleInit {
    private readonly logger = new Logger(BillingService.name);
    private billing!: QZPayBilling;
    private mpAdapter!: QZPayMercadoPagoAdapter;

    constructor(@Inject(BILLING_CONFIG) private readonly config: BillingModuleConfig) {}

    async onModuleInit() {
        await this.initialize();
    }

    /**
     * Initialize QZPay with MercadoPago adapter
     */
    private async initialize() {
        // Dynamic imports to avoid bundling issues
        const { QZPayBilling } = await import('@qazuor/qzpay-core');
        const { createQZPayMercadoPagoAdapter } = await import('@qazuor/qzpay-mercadopago');

        // Create MercadoPago adapter
        this.mpAdapter = createQZPayMercadoPagoAdapter({
            accessToken: this.config.accessToken,
            webhookSecret: this.config.webhookSecret,
            timeout: this.config.timeout ?? 5000
        });

        // Create billing instance with in-memory storage (use drizzle for production)
        this.billing = new QZPayBilling({
            paymentAdapter: this.mpAdapter,
            // For this example, we use a minimal in-memory storage
            // In production, use @qazuor/qzpay-drizzle
            storage: this.createInMemoryStorage()
        });

        this.logger.log('QZPay billing initialized with MercadoPago');
    }

    /**
     * Get the underlying MercadoPago adapter
     */
    getMercadoPagoAdapter(): QZPayMercadoPagoAdapter {
        return this.mpAdapter;
    }

    // ==================== Customer Operations ====================

    /**
     * Create a new customer
     */
    async createCustomer(dto: CreateCustomerDto): Promise<CustomerResponse> {
        this.logger.log(`Creating customer: ${dto.email}`);

        const providerCustomerId = await this.mpAdapter.customers.create({
            email: dto.email,
            name: dto.name,
            externalId: dto.externalId
        });

        return {
            id: dto.externalId,
            email: dto.email,
            name: dto.name ?? null,
            providerCustomerId,
            createdAt: new Date()
        };
    }

    /**
     * Get customer by provider ID
     */
    async getCustomer(providerCustomerId: string): Promise<CustomerResponse | null> {
        try {
            const customer = await this.mpAdapter.customers.retrieve(providerCustomerId);
            return {
                id: customer.metadata?.externalId ?? providerCustomerId,
                email: customer.email,
                name: customer.name,
                providerCustomerId: customer.id,
                createdAt: new Date()
            };
        } catch {
            return null;
        }
    }

    // ==================== Subscription Operations ====================

    /**
     * Create a new subscription
     */
    async createSubscription(dto: CreateSubscriptionDto): Promise<SubscriptionResponse> {
        this.logger.log(`Creating subscription for customer: ${dto.customerId}`);

        const subscription = await this.mpAdapter.subscriptions.create(dto.customerId, {
            priceId: dto.priceId,
            trialDays: dto.trialDays
        });

        return this.mapSubscription(subscription);
    }

    /**
     * Get subscription by ID
     */
    async getSubscription(subscriptionId: string): Promise<SubscriptionResponse | null> {
        try {
            const subscription = await this.mpAdapter.subscriptions.retrieve(subscriptionId);
            return this.mapSubscription(subscription);
        } catch {
            return null;
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId: string): Promise<void> {
        this.logger.log(`Canceling subscription: ${subscriptionId}`);
        await this.mpAdapter.subscriptions.cancel(subscriptionId);
    }

    /**
     * Change subscription plan
     */
    async changePlan(subscriptionId: string, newPriceId: string): Promise<SubscriptionResponse> {
        this.logger.log(`Changing plan for subscription: ${subscriptionId}`);
        const subscription = await this.mpAdapter.subscriptions.update(subscriptionId, {
            priceId: newPriceId
        });
        return this.mapSubscription(subscription);
    }

    // ==================== Payment Operations ====================

    /**
     * Create a one-time payment
     */
    async createPayment(dto: CreatePaymentDto): Promise<PaymentResponse> {
        this.logger.log(`Creating payment for customer: ${dto.customerId}`);

        const payment = await this.mpAdapter.payments.create(dto.customerId, {
            amount: dto.amount,
            currency: dto.currency,
            paymentMethodId: dto.paymentMethodId,
            metadata: dto.description ? { description: dto.description } : undefined
        });

        // Check if 3DS is required
        const requires3DS = isMP3DSRequired(payment.status, (payment as { statusDetail?: string }).statusDetail);

        return {
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            customerId: dto.customerId,
            requires3DS,
            challengeUrl: requires3DS ? (payment as { initPoint?: string }).initPoint : undefined
        };
    }

    /**
     * Get payment by ID
     */
    async getPayment(paymentId: string): Promise<PaymentResponse | null> {
        try {
            const payment = await this.mpAdapter.payments.retrieve(paymentId);
            return {
                id: payment.id,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                customerId: payment.metadata?.customerId ?? ''
            };
        } catch {
            return null;
        }
    }

    /**
     * Refund a payment
     */
    async refundPayment(paymentId: string, dto: RefundPaymentDto): Promise<{ id: string; status: string; amount: number }> {
        this.logger.log(`Refunding payment: ${paymentId}`);
        return this.mpAdapter.payments.refund({ amount: dto.amount, reason: dto.reason }, paymentId);
    }

    // ==================== Webhook Operations ====================

    /**
     * Process webhook/IPN from MercadoPago
     */
    async processWebhook(
        payload: string,
        signature?: string,
        requestId?: string
    ): Promise<{ processed: boolean; event?: QZPayWebhookEvent }> {
        this.logger.log('Processing MercadoPago webhook');

        const event = await this.mpAdapter.webhooks.verifyAndParse(payload, signature, requestId);

        if (!event) {
            this.logger.warn('Invalid webhook signature');
            return { processed: false };
        }

        this.logger.log(`Webhook event type: ${event.type}`);

        // Handle different event types
        switch (event.type) {
            case 'payment.created':
            case 'payment.updated':
                await this.handlePaymentEvent(event);
                break;
            case 'subscription.created':
            case 'subscription.updated':
                await this.handleSubscriptionEvent(event);
                break;
            default:
                this.logger.debug(`Unhandled event type: ${event.type}`);
        }

        return { processed: true, event };
    }

    /**
     * Handle payment webhook events
     */
    private async handlePaymentEvent(event: QZPayWebhookEvent): Promise<void> {
        const info = extractMP3DSPaymentInfo(event);

        this.logger.log(`Payment ${info.paymentId} status: ${info.status}`);

        if (info.requires3DS) {
            this.logger.log(`Payment requires 3DS challenge: ${info.challengeUrl}`);
            // In production: notify user to complete 3DS
            return;
        }

        if (info.threeDSecure?.status === 'authenticated') {
            this.logger.log(`Payment ${info.paymentId} 3DS authenticated`);
            // In production: complete the order
        }

        if (info.threeDSecure?.status === 'failed') {
            this.logger.warn(`Payment ${info.paymentId} 3DS failed`);
            // In production: notify user of failure
        }
    }

    /**
     * Handle subscription webhook events
     */
    private async handleSubscriptionEvent(event: QZPayWebhookEvent): Promise<void> {
        const subscriptionId = String(event.data?.id ?? '');
        const status = String(event.data?.status ?? '');

        this.logger.log(`Subscription ${subscriptionId} status: ${status}`);

        // In production: update subscription status in database
    }

    // ==================== Plan Management ====================

    /**
     * Get available plans
     */
    getPlans() {
        return Object.values(PLANS);
    }

    /**
     * Get plan by ID
     */
    getPlan(planId: string) {
        return Object.values(PLANS).find((p) => p.id === planId);
    }

    // ==================== Helpers ====================

    // biome-ignore lint/suspicious/noExplicitAny: Subscription type varies by provider
    private mapSubscription(subscription: any): SubscriptionResponse {
        return {
            id: subscription.id,
            customerId: subscription.customerId ?? '',
            status: subscription.status,
            priceId: subscription.priceId ?? '',
            currentPeriodStart: subscription.currentPeriodStart ?? new Date(),
            currentPeriodEnd: subscription.currentPeriodEnd ?? new Date(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false
        };
    }

    /**
     * Create minimal in-memory storage for example
     * In production, use @qazuor/qzpay-drizzle
     */
    // biome-ignore lint/suspicious/noExplicitAny: Storage adapter type
    private createInMemoryStorage(): any {
        const store = {
            customers: new Map(),
            subscriptions: new Map(),
            payments: new Map(),
            invoices: new Map(),
            plans: new Map(),
            prices: new Map(),
            promoCodes: new Map(),
            entitlements: new Map(),
            limits: new Map(),
            addons: new Map(),
            events: new Map()
        };

        return {
            customers: {
                create: async (data: { id: string }) => {
                    store.customers.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.customers.get(id),
                findByExternalId: async () => null,
                findByEmail: async () => null,
                update: async (id: string, data: unknown) => {
                    store.customers.set(id, { ...store.customers.get(id), ...data });
                },
                delete: async (id: string) => {
                    store.customers.delete(id);
                },
                list: async () => ({ data: [...store.customers.values()], total: store.customers.size, hasMore: false })
            },
            subscriptions: {
                create: async (data: { id: string }) => {
                    store.subscriptions.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.subscriptions.get(id),
                findByCustomerId: async () => [],
                update: async (id: string, data: unknown) => {
                    store.subscriptions.set(id, { ...store.subscriptions.get(id), ...data });
                },
                list: async () => ({ data: [...store.subscriptions.values()], total: store.subscriptions.size, hasMore: false })
            },
            payments: {
                create: async (data: { id: string }) => {
                    store.payments.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.payments.get(id),
                findByCustomerId: async () => [],
                update: async (id: string, data: unknown) => {
                    store.payments.set(id, { ...store.payments.get(id), ...data });
                },
                list: async () => ({ data: [...store.payments.values()], total: store.payments.size, hasMore: false })
            },
            invoices: {
                create: async (data: { id: string }) => {
                    store.invoices.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.invoices.get(id),
                findByCustomerId: async () => [],
                update: async (id: string, data: unknown) => {
                    store.invoices.set(id, { ...store.invoices.get(id), ...data });
                },
                list: async () => ({ data: [...store.invoices.values()], total: store.invoices.size, hasMore: false })
            },
            plans: {
                create: async (data: { id: string }) => {
                    store.plans.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.plans.get(id),
                update: async (id: string, data: unknown) => {
                    store.plans.set(id, { ...store.plans.get(id), ...data });
                },
                list: async () => ({ data: [...store.plans.values()], total: store.plans.size, hasMore: false })
            },
            prices: {
                create: async (data: { id: string }) => {
                    store.prices.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.prices.get(id),
                findByPlanId: async () => [],
                update: async (id: string, data: unknown) => {
                    store.prices.set(id, { ...store.prices.get(id), ...data });
                },
                list: async () => ({ data: [...store.prices.values()], total: store.prices.size, hasMore: false })
            },
            promoCodes: {
                create: async (data: { id: string }) => {
                    store.promoCodes.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.promoCodes.get(id),
                findByCode: async () => null,
                update: async (id: string, data: unknown) => {
                    store.promoCodes.set(id, { ...store.promoCodes.get(id), ...data });
                },
                incrementRedemptions: async () => {},
                list: async () => ({ data: [...store.promoCodes.values()], total: store.promoCodes.size, hasMore: false })
            },
            entitlements: {
                check: async () => false,
                findByCustomerId: async () => [],
                grant: async () => {},
                revoke: async () => {}
            },
            limits: {
                check: async () => ({ allowed: true }),
                findByCustomerId: async () => [],
                increment: async () => {},
                set: async () => {},
                recordUsage: async () => {}
            },
            addons: {
                create: async (data: { id: string }) => {
                    store.addons.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.addons.get(id),
                findByPlanId: async () => [],
                update: async (id: string, data: unknown) => {
                    store.addons.set(id, { ...store.addons.get(id), ...data });
                },
                delete: async (id: string) => {
                    store.addons.delete(id);
                },
                list: async () => ({ data: [...store.addons.values()], total: store.addons.size, hasMore: false }),
                addToSubscription: async () => {},
                removeFromSubscription: async () => {},
                updateSubscriptionAddOn: async () => {},
                findBySubscriptionId: async () => [],
                findSubscriptionAddOn: async () => null
            },
            events: {
                create: async (data: { id: string }) => {
                    store.events.set(data.id, data);
                    return data;
                },
                findById: async (id: string) => store.events.get(id),
                list: async () => ({ data: [...store.events.values()], total: store.events.size, hasMore: false })
            }
        };
    }
}
