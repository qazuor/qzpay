import type {
    QZPayCreateSubscriptionInput,
    QZPayPaymentSubscriptionAdapter,
    QZPayProviderSubscription,
    QZPayUpdateSubscriptionInput
} from '@qazuor/qzpay-core';
/**
 * MercadoPago Subscription Adapter
 * Uses Preapproval API for subscriptions
 */
import { Customer, type MercadoPagoConfig, PreApproval } from 'mercadopago';
import { MERCADOPAGO_SUBSCRIPTION_STATUS, fromMercadoPagoInterval } from '../types.js';
import { wrapAdapterMethod } from '../utils/error-mapper.js';
import { sanitizeEmail } from '../utils/sanitize.utils.js';

export class QZPayMercadoPagoSubscriptionAdapter implements QZPayPaymentSubscriptionAdapter {
    private readonly preapprovalApi: PreApproval;
    private readonly customerApi: Customer;

    constructor(client: MercadoPagoConfig) {
        this.preapprovalApi = new PreApproval(client);
        this.customerApi = new Customer(client);
    }

    async create(
        providerCustomerId: string,
        _input: QZPayCreateSubscriptionInput,
        providerPriceId: string
    ): Promise<QZPayProviderSubscription> {
        return wrapAdapterMethod('Create subscription', async () => {
            // Fetch customer to get their email (required by MercadoPago)
            const customer = await this.customerApi.get({ customerId: providerCustomerId });

            if (!customer.email) {
                throw new Error('Customer email is required for MercadoPago subscriptions');
            }

            // Sanitize email before creating subscription
            const sanitizedEmail = sanitizeEmail(customer.email);

            const response = await this.preapprovalApi.create({
                body: {
                    preapproval_plan_id: providerPriceId,
                    payer_email: sanitizedEmail,
                    external_reference: providerCustomerId
                }
            });

            return this.mapToProviderSubscription(response);
        });
    }

    async update(providerSubscriptionId: string, input: QZPayUpdateSubscriptionInput): Promise<QZPayProviderSubscription> {
        return wrapAdapterMethod('Update subscription', async () => {
            const body: Parameters<PreApproval['update']>[0]['body'] = {};

            if (input.planId !== undefined) {
                body.reason = `Plan updated to: ${input.planId}`;
            }

            if (input.cancelAt !== undefined) {
                body.status = 'cancelled';
            }

            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body
            });

            // Use retrieve to get full response since update response is partial
            return this.retrieve(providerSubscriptionId);
        });
    }

    async cancel(providerSubscriptionId: string, _cancelAtPeriodEnd: boolean): Promise<void> {
        return wrapAdapterMethod('Cancel subscription', async () => {
            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: {
                    status: 'cancelled'
                }
            });
        });
    }

    async pause(providerSubscriptionId: string): Promise<void> {
        return wrapAdapterMethod('Pause subscription', async () => {
            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: {
                    status: 'paused'
                }
            });
        });
    }

    async resume(providerSubscriptionId: string): Promise<void> {
        return wrapAdapterMethod('Resume subscription', async () => {
            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: {
                    status: 'authorized'
                }
            });
        });
    }

    async retrieve(providerSubscriptionId: string): Promise<QZPayProviderSubscription> {
        return wrapAdapterMethod('Retrieve subscription', async () => {
            const response = await this.preapprovalApi.get({
                id: providerSubscriptionId
            });

            return this.mapToProviderSubscription(response);
        });
    }

    private mapToProviderSubscription(preapproval: Awaited<ReturnType<PreApproval['get']>>): QZPayProviderSubscription {
        const autoRecurring = preapproval.auto_recurring;
        const status = this.mapStatus(preapproval.status ?? 'pending');
        const startDate = preapproval.date_created ? new Date(preapproval.date_created) : new Date();
        const periodEnd = this.calculatePeriodEnd(startDate, autoRecurring);
        const canceledAt = preapproval.status === 'cancelled' ? new Date(preapproval.last_modified ?? Date.now()) : null;

        return {
            id: preapproval.id ?? '',
            status,
            currentPeriodStart: startDate,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            canceledAt,
            trialStart: null,
            trialEnd: null,
            metadata: {}
        };
    }

    private calculatePeriodEnd(startDate: Date, autoRecurring?: { frequency?: number; frequency_type?: string }): Date {
        const periodEnd = new Date(startDate);

        if (!autoRecurring) {
            return periodEnd;
        }

        const { interval, intervalCount } = fromMercadoPagoInterval(autoRecurring.frequency ?? 1, autoRecurring.frequency_type ?? 'months');

        const intervalActions: Record<string, () => void> = {
            day: () => periodEnd.setDate(periodEnd.getDate() + intervalCount),
            week: () => periodEnd.setDate(periodEnd.getDate() + intervalCount * 7),
            month: () => periodEnd.setMonth(periodEnd.getMonth() + intervalCount),
            year: () => periodEnd.setFullYear(periodEnd.getFullYear() + intervalCount)
        };

        intervalActions[interval]?.();

        return periodEnd;
    }

    private mapStatus(mpStatus: string): string {
        const statusMap: Record<string, string> = MERCADOPAGO_SUBSCRIPTION_STATUS;
        return statusMap[mpStatus] ?? mpStatus;
    }
}
