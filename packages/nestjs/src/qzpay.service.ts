/**
 * QZPay Service
 * Main service wrapper for QZPayBilling in NestJS
 */
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type {
    QZPayBilling,
    QZPayCancelSubscriptionOptions,
    QZPayCreateInvoiceServiceInput,
    QZPayCreateSubscriptionServiceInput,
    QZPayCustomer,
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayEventMap,
    QZPayInvoice,
    QZPayLimitCheckResult,
    QZPayPayment,
    QZPayPlan,
    QZPayProcessPaymentInput,
    QZPayRefundPaymentInput,
    QZPaySubscription,
    QZPayTypedEventHandler,
    QZPayUpdateSubscriptionServiceInput
} from '@qazuor/qzpay-core';
import { QZPAY_BILLING_TOKEN } from './constants.js';

type CustomerCreateInput = Parameters<QZPayBilling['customers']['create']>[0];

@Injectable()
export class QZPayService implements OnModuleDestroy {
    private readonly eventUnsubscribers: Array<() => void> = [];

    constructor(
        @Inject(QZPAY_BILLING_TOKEN)
        private readonly billing: QZPayBilling
    ) {}

    onModuleDestroy() {
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
    }

    /**
     * Get the underlying QZPayBilling instance
     */
    getBilling(): QZPayBilling {
        return this.billing;
    }

    // ==================== Customer Operations ====================

    async createCustomer(input: CustomerCreateInput): Promise<QZPayCustomer> {
        return this.billing.customers.create(input);
    }

    async getCustomer(customerId: string): Promise<QZPayCustomer | null> {
        return this.billing.customers.get(customerId);
    }

    async getCustomerByExternalId(externalId: string): Promise<QZPayCustomer | null> {
        return this.billing.customers.getByExternalId(externalId);
    }

    async updateCustomer(customerId: string, input: Partial<CustomerCreateInput>): Promise<QZPayCustomer | null> {
        return this.billing.customers.update(customerId, input);
    }

    async deleteCustomer(customerId: string): Promise<void> {
        return this.billing.customers.delete(customerId);
    }

    // ==================== Subscription Operations ====================

    async createSubscription(input: QZPayCreateSubscriptionServiceInput): Promise<QZPaySubscription> {
        return this.billing.subscriptions.create(input);
    }

    async getSubscription(subscriptionId: string): Promise<QZPaySubscription | null> {
        return this.billing.subscriptions.get(subscriptionId);
    }

    async getSubscriptionsByCustomerId(customerId: string): Promise<QZPaySubscription[]> {
        return this.billing.subscriptions.getByCustomerId(customerId);
    }

    async getActiveSubscription(customerId: string): Promise<QZPaySubscription | null> {
        const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);
        return subscriptions.find((s) => s.status === 'active') ?? null;
    }

    async updateSubscription(subscriptionId: string, input: QZPayUpdateSubscriptionServiceInput): Promise<QZPaySubscription> {
        return this.billing.subscriptions.update(subscriptionId, input);
    }

    async cancelSubscription(subscriptionId: string, options?: QZPayCancelSubscriptionOptions): Promise<QZPaySubscription> {
        return this.billing.subscriptions.cancel(subscriptionId, options);
    }

    async pauseSubscription(subscriptionId: string): Promise<QZPaySubscription> {
        return this.billing.subscriptions.pause(subscriptionId);
    }

    async resumeSubscription(subscriptionId: string): Promise<QZPaySubscription> {
        return this.billing.subscriptions.resume(subscriptionId);
    }

    // ==================== Payment Operations ====================

    async processPayment(input: QZPayProcessPaymentInput): Promise<QZPayPayment> {
        return this.billing.payments.process(input);
    }

    async getPayment(paymentId: string): Promise<QZPayPayment | null> {
        return this.billing.payments.get(paymentId);
    }

    async getPaymentsByCustomerId(customerId: string): Promise<QZPayPayment[]> {
        return this.billing.payments.getByCustomerId(customerId);
    }

    async refundPayment(input: QZPayRefundPaymentInput): Promise<QZPayPayment> {
        return this.billing.payments.refund(input);
    }

    // ==================== Invoice Operations ====================

    async createInvoice(input: QZPayCreateInvoiceServiceInput): Promise<QZPayInvoice> {
        return this.billing.invoices.create(input);
    }

    async getInvoice(invoiceId: string): Promise<QZPayInvoice | null> {
        return this.billing.invoices.get(invoiceId);
    }

    async getInvoicesByCustomerId(customerId: string): Promise<QZPayInvoice[]> {
        return this.billing.invoices.getByCustomerId(customerId);
    }

    async markInvoicePaid(invoiceId: string, paymentId: string): Promise<QZPayInvoice> {
        return this.billing.invoices.markPaid(invoiceId, paymentId);
    }

    // ==================== Plan Operations ====================

    getPlans(): QZPayPlan[] {
        return this.billing.getPlans();
    }

    getPlan(planId: string): QZPayPlan | undefined {
        return this.billing.getPlan(planId);
    }

    // ==================== Entitlement Operations ====================

    async checkEntitlement(customerId: string, entitlementKey: string): Promise<boolean> {
        return this.billing.entitlements.check(customerId, entitlementKey);
    }

    async getEntitlements(customerId: string): Promise<QZPayCustomerEntitlement[]> {
        return this.billing.entitlements.getByCustomerId(customerId);
    }

    // ==================== Limit Operations ====================

    async checkLimit(customerId: string, limitKey: string): Promise<QZPayLimitCheckResult> {
        return this.billing.limits.check(customerId, limitKey);
    }

    async getLimits(customerId: string): Promise<QZPayCustomerLimit[]> {
        return this.billing.limits.getByCustomerId(customerId);
    }

    async incrementLimit(customerId: string, limitKey: string, amount = 1): Promise<QZPayCustomerLimit> {
        return this.billing.limits.increment(customerId, limitKey, amount);
    }

    async setLimit(customerId: string, limitKey: string, maxValue: number): Promise<QZPayCustomerLimit> {
        return this.billing.limits.set(customerId, limitKey, maxValue);
    }

    // ==================== Utility Methods ====================

    isLivemode(): boolean {
        return this.billing.isLivemode();
    }

    // ==================== Event Handling ====================

    /**
     * Subscribe to a billing event
     * @returns Unsubscribe function
     */
    on<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): () => void {
        const unsubscribe = this.billing.on(eventType, handler);
        this.eventUnsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Subscribe to a billing event (one-time)
     */
    once<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): () => void {
        const unsubscribe = this.billing.once(eventType, handler);
        this.eventUnsubscribers.push(unsubscribe);
        return unsubscribe;
    }
}
