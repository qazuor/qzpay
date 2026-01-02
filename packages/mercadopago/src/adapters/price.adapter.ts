import type { QZPayCreatePriceInput, QZPayPaymentPriceAdapter, QZPayProviderPrice } from '@qazuor/qzpay-core';
/**
 * MercadoPago Price Adapter
 * Uses PreApprovalPlan API for plans/prices
 */
import { type MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';
import { fromMercadoPagoInterval, toMercadoPagoInterval } from '../types.js';

export class QZPayMercadoPagoPriceAdapter implements QZPayPaymentPriceAdapter {
    private readonly planApi: PreApprovalPlan;

    constructor(client: MercadoPagoConfig) {
        this.planApi = new PreApprovalPlan(client);
    }

    async create(input: QZPayCreatePriceInput, providerProductId: string): Promise<string> {
        const { frequency, frequencyType } = toMercadoPagoInterval(input.billingInterval, input.intervalCount ?? 1);

        const autoRecurring: Parameters<PreApprovalPlan['create']>[0]['body']['auto_recurring'] = {
            frequency,
            frequency_type: frequencyType,
            transaction_amount: input.unitAmount / 100, // Convert cents to decimal
            currency_id: input.currency.toUpperCase(),
            billing_day: 1 // Bill on first day of period
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
                auto_recurring: autoRecurring
            }
        });

        if (!response.id) {
            throw new Error('Failed to create MercadoPago plan');
        }

        return response.id;
    }

    async archive(providerPriceId: string): Promise<void> {
        // MercadoPago doesn't have archive, we update status
        await this.planApi.update({
            id: providerPriceId,
            updatePreApprovalPlanRequest: {
                status: 'inactive'
            }
        });
    }

    async retrieve(providerPriceId: string): Promise<QZPayProviderPrice> {
        const response = await this.planApi.get({
            preApprovalPlanId: providerPriceId
        });

        return this.mapToProviderPrice(response);
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
