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
 * `create()` supports two flows, selected by whether the orchestrator resolved
 * a `providerPriceId` (an MP `preapproval_plan` id):
 *
 * 1. **Plan-based (preferred).** When `providerPriceId` is present the body
 *    carries `preapproval_plan_id` and NO inline `auto_recurring` — amount,
 *    cadence and `free_trial` are inherited from the plan. MP's hosted checkout
 *    can only authorize a card-first trial through this flow; a direct
 *    preapproval that carries an inline `free_trial` fails card authorization
 *    (HOS-191).
 * 2. **Ad-hoc fallback.** With no plan id, it builds a direct preapproval with
 *    inline `auto_recurring` (the legacy path, kept for non-plan providers and
 *    for callers that intentionally opt out of plans).
 *
 * In both flows the preapproval is "pending" until the user authorizes on
 * `initPoint`; the caller persists `id` (as `mp_subscription_id`) and redirects.
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
    /**
     * When set, subscribes to an existing MP `preapproval_plan`; `auto_recurring`
     * is then omitted and its values (amount, cadence, `free_trial`) are inherited
     * from the plan. Mutually exclusive with an inline `auto_recurring`.
     */
    preapproval_plan_id?: string;
    auto_recurring?: {
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
    external_reference?: string;
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

    /**
     * Update a MercadoPago preapproval.
     *
     * Only the fields present in `input` are sent to MP (partial-update
     * semantics); omitted fields are left untouched on the provider side.
     * `input.externalReference` maps to preapproval `external_reference` —
     * used to retroactively link a hosted subscription to a local entity
     * resolved after the preapproval was created (HOS-191).
     *
     * The preapproval `reason` (buyer-visible description) is set from
     * `input.reason` when present; otherwise, on a plan change (`input.planId`
     * present) it falls back to the synthetic `"Plan updated to: ${planId}"`.
     * Callers that hold a human plan name SHOULD pass `input.reason` so buyers
     * do not see an opaque plan id.
     */
    async update(providerSubscriptionId: string, input: QZPayUpdateSubscriptionInput): Promise<QZPayProviderSubscription> {
        return wrapAdapterMethod('Update subscription', async () => {
            const body: PreApprovalUpdateBody = {};

            if (input.reason !== undefined) {
                body.reason = input.reason;
            } else if (input.planId !== undefined) {
                body.reason = `Plan updated to: ${input.planId}`;
            }

            if (input.cancelAt !== undefined) {
                body.status = 'cancelled';
            }

            if (input.transactionAmount !== undefined) {
                body.auto_recurring = { transaction_amount: input.transactionAmount };
            }

            if (input.externalReference !== undefined) {
                body.external_reference = input.externalReference;
            }

            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: body as unknown as Parameters<PreApproval['update']>[0]['body']
            });

            return this.retrieve(providerSubscriptionId);
        });
    }

    /**
     * Cancel a MercadoPago preapproval.
     *
     * Branches on `cancelAtPeriodEnd`:
     * - `true`  → PUT `{ status: 'paused' }`: stops charging immediately while
     *             keeping the preapproval alive so it can be reactivated if the
     *             user changes their mind before the period expires (reversible
     *             soft-cancel, analogous to Stripe `cancel_at_period_end`).
     * - `false` → PUT `{ status: 'cancelled' }`: permanently terminates the
     *             preapproval (irreversible hard-cancel, today's default).
     */
    async cancel(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
        return wrapAdapterMethod('Cancel subscription', async () => {
            const status = cancelAtPeriodEnd ? 'paused' : 'cancelled';
            await this.preapprovalApi.update({
                id: providerSubscriptionId,
                body: { status }
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

    /**
     * Reverse a period-end soft-cancel: PUT `{ status: 'authorized' }`, which
     * re-authorizes a preapproval that {@link cancel}(id, true) paused. This is
     * the exact inverse of the reversible soft-cancel (paused → authorized), so
     * MercadoPago resumes charging on the next cycle. A `cancelled` (hard-cancel)
     * preapproval is terminal and MercadoPago rejects this transition — the core
     * `uncancel` guards that off before reaching the adapter.
     */
    async uncancel(providerSubscriptionId: string): Promise<void> {
        return wrapAdapterMethod('Uncancel subscription', async () => {
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
        const billingInterval = providerInput.input.billingInterval ?? 'monthly';
        const reason = `${providerInput.plan.name} - ${billingInterval === 'annual' ? 'Anual' : 'Mensual'}`;

        const body: PreApprovalCreateBody = {
            payer_email: payerEmail,
            external_reference: providerInput.externalReference,
            reason
        };

        if (providerInput.backUrl !== undefined) {
            body.back_url = providerInput.backUrl;
        }

        if (providerInput.notificationUrl !== undefined) {
            body.notification_url = providerInput.notificationUrl;
        }

        // Plan-based flow (preferred): reference the MP preapproval_plan and let
        // amount, cadence and free_trial be inherited from it. Omitting
        // `auto_recurring` is required — sending both is rejected by MP, and the
        // plan-based flow is the only one that authorizes a card-first trial
        // (HOS-191). MP returns an `init_point` for the redirect authorization.
        const planId = providerInput.providerPriceId?.trim();
        if (planId) {
            body.preapproval_plan_id = planId;
            return body;
        }

        // Ad-hoc fallback: no plan id resolved → build a direct preapproval with
        // inline auto_recurring (legacy path).
        const payerFirstName = this.resolveFirstName(providerInput);
        const payerLastName = providerInput.customer.lastName?.trim() || DEFAULT_LAST_NAME;
        const { intervalFrequency, intervalType } = this.toMercadoPagoInterval(providerInput.price);
        const freeTrial = this.buildFreeTrial(providerInput.input.freeTrialDays);

        body.payer = { email: payerEmail, first_name: payerFirstName, last_name: payerLastName };
        body.auto_recurring = {
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
        };

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
        if (preapproval.external_reference) {
            result.externalReference = preapproval.external_reference;
        }
        if (preapproval.payer_email) {
            result.payerEmail = preapproval.payer_email;
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
