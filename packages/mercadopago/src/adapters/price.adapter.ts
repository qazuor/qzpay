import type { QZPayCreatePriceInput, QZPayPaymentPriceAdapter, QZPayProviderPrice } from '@qazuor/qzpay-core';
/**
 * MercadoPago Price Adapter
 * Uses PreApprovalPlan API for plans/prices
 */
import { type MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';
import { fromMercadoPagoInterval, toMercadoPagoInterval } from '../types.js';
import { wrapAdapterMethod } from '../utils/error-mapper.js';

/**
 * Whether `value` is a well-formed absolute `http:`/`https:` URL. Used to validate
 * a `preapproval_plan` `back_url` before handing it to MercadoPago.
 */
function isAbsoluteHttpUrl(value: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

export class QZPayMercadoPagoPriceAdapter implements QZPayPaymentPriceAdapter {
    private readonly planApi: PreApprovalPlan;

    /**
     * @param client - Configured MercadoPago SDK client.
     * @param defaultBackUrl - Optional fallback `back_url` used when a
     *   `QZPayCreatePriceInput` does not carry its own `backUrl`. See
     *   `QZPayMercadoPagoConfig.defaultPlanBackUrl`.
     */
    constructor(
        client: MercadoPagoConfig,
        private readonly defaultBackUrl?: string
    ) {
        this.planApi = new PreApprovalPlan(client);
    }

    async create(input: QZPayCreatePriceInput, providerProductId: string): Promise<string> {
        return wrapAdapterMethod('Create price', async () => {
            const { frequency, frequencyType } = toMercadoPagoInterval(input.billingInterval, input.intervalCount ?? 1);

            // MercadoPago requires a `back_url` when creating a `preapproval_plan`
            // and rejects the call with "Back url is required" otherwise. Resolve it
            // (per-request `input.backUrl` first, then the adapter default) and fail
            // early with a clear message rather than letting MP return its opaque 400.
            const backUrl = this.resolveBackUrl(input.backUrl);

            // No `billing_day` is set: without it, MercadoPago anchors the charge
            // cycle to the subscription's own start date (the trial end when a
            // free_trial is present), billing on that rolling monthly anniversary
            // for the full amount. Setting `billing_day` instead forces a fixed
            // calendar day and prorates the first period — undesirable as a default.
            // (A future caller-configurable billing day would add an optional field
            // here rather than reintroducing a hardcode.)
            const autoRecurring: Parameters<PreApprovalPlan['create']>[0]['body']['auto_recurring'] = {
                frequency,
                frequency_type: frequencyType,
                transaction_amount: input.unitAmount / 100, // Convert cents to decimal
                currency_id: input.currency.toUpperCase()
            };

            // Add free trial only if specified
            if (input.trialDays) {
                autoRecurring.free_trial = {
                    frequency: input.trialDays,
                    frequency_type: 'days'
                };
            }

            const response = await this.planApi.create({
                body: {
                    reason: providerProductId, // Use product ID as plan name
                    back_url: backUrl,
                    auto_recurring: autoRecurring
                }
            });

            if (!response.id) {
                throw new Error('Failed to create MercadoPago plan');
            }

            return response.id;
        });
    }

    /**
     * Resolve and validate the `back_url` for a `preapproval_plan` creation.
     *
     * Precedence: the per-request `QZPayCreatePriceInput.backUrl` (which carries the
     * checkout's own return URL) wins over the adapter-level `defaultBackUrl`. The
     * result must be a non-empty absolute `http(s)` URL.
     *
     * @throws {Error} When neither source yields a valid absolute `http(s)` URL —
     *   thrown before the MercadoPago call so the failure is actionable instead of
     *   MercadoPago's opaque "Back url is required" 400.
     */
    private resolveBackUrl(requestBackUrl?: string): string {
        const candidate = requestBackUrl?.trim() || this.defaultBackUrl?.trim();

        if (!candidate) {
            throw new Error(
                'MercadoPago preapproval_plan requires a back_url. Pass `QZPayCreatePriceInput.backUrl` or configure `defaultPlanBackUrl` on the adapter.'
            );
        }

        if (!isAbsoluteHttpUrl(candidate)) {
            throw new Error(`MercadoPago preapproval_plan back_url must be an absolute http(s) URL. Received: "${candidate}".`);
        }

        return candidate;
    }

    async archive(providerPriceId: string): Promise<void> {
        return wrapAdapterMethod('Archive price', async () => {
            // MercadoPago doesn't have archive, we update status
            await this.planApi.update({
                id: providerPriceId,
                updatePreApprovalPlanRequest: {
                    status: 'inactive'
                }
            });
        });
    }

    async retrieve(providerPriceId: string): Promise<QZPayProviderPrice> {
        return wrapAdapterMethod('Retrieve price', async () => {
            const response = await this.planApi.get({
                preApprovalPlanId: providerPriceId
            });

            return this.mapToProviderPrice(response);
        });
    }

    async createProduct(name: string, _description?: string): Promise<string> {
        // MercadoPago doesn't have separate products, plans are self-contained
        // We return the name as the product ID to be used in plan creation
        return name;
    }

    private mapToProviderPrice(plan: Awaited<ReturnType<PreApprovalPlan['get']>>): QZPayProviderPrice {
        const autoRecurring = plan.auto_recurring;

        const { interval, intervalCount } = autoRecurring
            ? fromMercadoPagoInterval(autoRecurring.frequency ?? 1, autoRecurring.frequency_type ?? 'months')
            : { interval: 'month' as const, intervalCount: 1 };

        return {
            id: plan.id ?? '',
            active: plan.status === 'active',
            unitAmount: Math.round((autoRecurring?.transaction_amount ?? 0) * 100), // Convert to cents
            currency: (autoRecurring?.currency_id ?? 'USD').toUpperCase(),
            recurring: {
                interval,
                intervalCount
            }
        };
    }
}
