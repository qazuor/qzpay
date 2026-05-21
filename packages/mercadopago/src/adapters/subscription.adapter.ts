import type {
    QZPayPaymentSubscriptionAdapter,
    QZPayProviderCreateSubscriptionInput,
    QZPayProviderSubscription,
    QZPayUpdateSubscriptionInput
} from '@qazuor/qzpay-core';
/**
 * MercadoPago Subscription Adapter
 * Uses the Preapproval API for recurring (subscription) charges.
 *
 * Each `create()` invocation creates an "ad-hoc" preapproval (no
 * preapproval_plan_id): MP saves the user's card on the hosted page, then
 * charges them automatically per the cadence we set inline. This is the
 * pattern recommended for SaaS subscriptions where the amount and cadence
 * can vary per customer (promo extensions, plan changes, etc.).
 */
import { type MercadoPagoConfig, PreApproval } from 'mercadopago';
import { MERCADOPAGO_SUBSCRIPTION_STATUS, fromMercadoPagoInterval } from '../types.js';
import { wrapAdapterMethod } from '../utils/error-mapper.js';
import { sanitizeEmail } from '../utils/sanitize.utils.js';

/**
 * Local type for the MercadoPago Preapproval create body. The official SDK
 * types under-specify the request (no `payer`, no `notification_url`, no
 * `back_url`, no `free_trial`), even though the API documents and accepts
 * them. We mirror the documented shape here and feed the SDK via an
 * `as unknown as` cast at the call site — typed boundary, no `any`.
 */
type PreApprovalCreateBody = {
    payer_email: string;
    payer?: { email: string; first_name: string; last_name: string };
    external_reference?: string;
    reason: string;
    back_url?: string;
    notification_url?: string;
    status?: string;
    card_token_id?: string;
    auto_recurring: {
        frequency: number;
        frequency_type: 'days' | 'months';
        transaction_amount: number;
        currency_id: string;
        free_trial?: { frequency: number; frequency_type: 'days' };
    };
};

type PreApprovalUpdateBody = {
    status?: string;
    reason?: string;
    auto_recurring?: {
        transaction_amount?: number;
        frequency?: number;
        frequency_type?: 'days' | 'months';
        currency_id?: string;
    };
};

/**
 * Local extension for the MercadoPago Preapproval response. The SDK omits
 * `init_point` and `sandbox_init_point` from its response type even though
 * the API returns them — they are the URLs we redirect the user to.
 */
type PreApprovalGetResponse = Awaited<ReturnType<PreApproval['get']>> & {
    init_point?: string;
    sandbox_init_point?: string;
};

const DEFAULT_LAST_NAME = ' ';

export class QZPayMercadoPagoSubscriptionAdapter implements QZPayPaymentSubscriptionAdapter {
    private readonly preapprovalApi: PreApproval;

    constructor(client: MercadoPagoConfig) {
        this.preapprovalApi = new PreApproval(client);
    }

    /**
     * Create a MercadoPago preapproval (recurring authorization).
     *
     * The preapproval is "pending" until the user authorizes on `initPoint`.
     * The caller should persist `id` (as `mp_subscription_id`) and redirect
     * the user to `initPoint` (or `sandboxInitPoint` in test mode).
     */
    async create(providerInput: QZPayProviderCreateSubscriptionInput): Promise<QZPayProviderSubscription> {
        return wrapAdapterMethod('Create subscription', async () => {
            const body = this.buildCreateBody(providerInput);

            const response = await this.preapprovalApi.create({
                body: body as unknown as Parameters<PreApproval['create']>[0]['body'],
                requestOptions: { idempotencyKey: providerInput.idempotencyKey }
            });

            return this.mapToProviderSubscription(response as PreApprovalGetResponse);
        });
    }

    async update(providerSubscriptionId: string, input: QZPayUpdateSubscriptionInput): Promise<QZPayProviderSubscription> {
        return wrapAdapterMethod('Update subscription', async () => {
            const body: PreApprovalUpdateBody = {};

            if (input.planId !== undefined) {
                body.reason = `Plan updated to: ${input.planId}`;
            }

            if (input.cancelAt !== undefined) {
                body.status = 'cancelled';
            }

            if (input.transactionAmount !== undefined) {
                body.auto_recurring = { transaction_amount: input.transactionAmount };
            }

            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: body as unknown as Parameters<PreApproval['update']>[0]['body']
            });

            return this.retrieve(providerSubscriptionId);
        });
    }

    async cancel(providerSubscriptionId: string, _cancelAtPeriodEnd: boolean): Promise<void> {
        return wrapAdapterMethod('Cancel subscription', async () => {
            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: { status: 'cancelled' }
            });
        });
    }

    async pause(providerSubscriptionId: string): Promise<void> {
        return wrapAdapterMethod('Pause subscription', async () => {
            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: { status: 'paused' }
            });
        });
    }

    async resume(providerSubscriptionId: string): Promise<void> {
        return wrapAdapterMethod('Resume subscription', async () => {
            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: { status: 'authorized' }
            });
        });
    }

    async retrieve(providerSubscriptionId: string): Promise<QZPayProviderSubscription> {
        return wrapAdapterMethod('Retrieve subscription', async () => {
            const response = await this.preapprovalApi.get({ id: providerSubscriptionId });
            return this.mapToProviderSubscription(response as PreApprovalGetResponse);
        });
    }

    /**
     * Build the preapproval body from the orchestrator-resolved input. Encapsulated
     * for unit testability — tests assert against the exact shape we hand to MP.
     */
    private buildCreateBody(providerInput: QZPayProviderCreateSubscriptionInput): PreApprovalCreateBody {
        const payerEmail = sanitizeEmail(providerInput.customer.email);
        const payerFirstName = this.resolveFirstName(providerInput);
        const payerLastName = providerInput.customer.lastName?.trim() || DEFAULT_LAST_NAME;
        const billingInterval = providerInput.input.billingInterval ?? 'monthly';
        const reason = `${providerInput.plan.name} - ${billingInterval === 'annual' ? 'Anual' : 'Mensual'}`;
        const { intervalFrequency, intervalType } = this.toMercadoPagoInterval(providerInput.price);
        const freeTrial = this.buildFreeTrial(providerInput.input.freeTrialDays);

        const body: PreApprovalCreateBody = {
            payer_email: payerEmail,
            payer: { email: payerEmail, first_name: payerFirstName, last_name: payerLastName },
            external_reference: providerInput.externalReference,
            reason,
            auto_recurring: {
                frequency: intervalFrequency,
                frequency_type: intervalType,
                // MercadoPago expects decimal currency units (e.g. 100.00 ARS),
                // not the smallest currency unit. Internally qzpay carries
                // `unitAmount` in cents (per `price.types.ts:27` and the
                // sibling adapters at `payment.adapter.ts:76` and
                // `price.adapter.ts:24`); divide by 100 to convert.
                transaction_amount: providerInput.price.amount / 100,
                currency_id: providerInput.price.currency,
                ...(freeTrial !== undefined ? { free_trial: freeTrial } : {})
            }
        };

        if (providerInput.backUrl !== undefined) {
            body.back_url = providerInput.backUrl;
        }

        if (providerInput.notificationUrl !== undefined) {
            body.notification_url = providerInput.notificationUrl;
        }

        return body;
    }

    /**
     * Derive the payer first name with three-step fallback:
     * 1. Explicit `customer.firstName`
     * 2. Email local-part (the substring before the `@`)
     * 3. The literal `'Customer'` (only if email has no local-part, which should not happen post-sanitization)
     */
    private resolveFirstName(providerInput: QZPayProviderCreateSubscriptionInput): string {
        const explicit = providerInput.customer.firstName?.trim();
        if (explicit) {
            return explicit;
        }
        const localPart = providerInput.customer.email.split('@')[0]?.trim();
        return localPart || 'Customer';
    }

    /**
     * Map a qzpay price interval (`day` | `week` | `month` | `year`) to MP's
     * preapproval `auto_recurring` shape. MP only accepts `days` or `months` as
     * `frequency_type`, so weeks are converted to 7 days and years to 12 months.
     */
    private toMercadoPagoInterval(price: QZPayProviderCreateSubscriptionInput['price']): {
        intervalFrequency: number;
        intervalType: 'days' | 'months';
    } {
        const count = Math.max(price.intervalCount, 1);
        switch (price.interval) {
            case 'day':
                return { intervalFrequency: count, intervalType: 'days' };
            case 'week':
                return { intervalFrequency: count * 7, intervalType: 'days' };
            case 'year':
                return { intervalFrequency: count * 12, intervalType: 'months' };
            default:
                return { intervalFrequency: count, intervalType: 'months' };
        }
    }

    private buildFreeTrial(freeTrialDays: number | undefined): { frequency: number; frequency_type: 'days' } | undefined {
        if (freeTrialDays === undefined || freeTrialDays <= 0) {
            return undefined;
        }
        return { frequency: freeTrialDays, frequency_type: 'days' };
    }

    private mapToProviderSubscription(preapproval: PreApprovalGetResponse): QZPayProviderSubscription {
        const autoRecurring = preapproval.auto_recurring;
        const status = this.mapStatus(preapproval.status ?? 'pending');
        const startDate = preapproval.date_created ? new Date(preapproval.date_created) : new Date();
        const periodEnd = this.calculatePeriodEnd(startDate, autoRecurring);
        const canceledAt = preapproval.status === 'cancelled' ? new Date(preapproval.last_modified ?? Date.now()) : null;

        const result: QZPayProviderSubscription = {
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

        if (preapproval.init_point) {
            result.initPoint = preapproval.init_point;
        }
        if (preapproval.sandbox_init_point) {
            result.sandboxInitPoint = preapproval.sandbox_init_point;
        }

        return result;
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
