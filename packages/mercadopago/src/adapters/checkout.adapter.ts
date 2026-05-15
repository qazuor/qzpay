import type { QZPayCreateCheckoutInput, QZPayPaymentCheckoutAdapter, QZPayProviderCheckout } from '@qazuor/qzpay-core';
/**
 * MercadoPago Checkout Adapter
 * Uses Preference API for checkout sessions
 */
import { type MercadoPagoConfig, PreApprovalPlan, Preference } from 'mercadopago';
import { wrapAdapterMethod } from '../utils/error-mapper.js';

/**
 * Default `items[].category_id` value applied when the caller does not
 * supply one. `'services'` is MercadoPago's canonical category for
 * digital SaaS / subscriptions and is recommended by the MP quality
 * checklist for SaaS integrations.
 */
const DEFAULT_ITEM_CATEGORY_ID = 'services';

/**
 * Payer-info shape forwarded to MercadoPago. MP rejects empty strings on
 * `last_name`, so callers must always supply a non-empty value (a single
 * space is acceptable as a fallback).
 */
interface MercadoPagoPayerInfo {
    readonly email: string;
    readonly first_name: string;
    readonly last_name: string;
}

/**
 * Derive `payer` fields for a MercadoPago preference from the available
 * customer info. Mirrors the logic used in the Hospeda direct-SDK path
 * (SPEC-109 Phase 1) so the adapter is on parity.
 *
 * Priority:
 * 1. Explicit `payerFirstName` + `payerLastName` if both provided.
 * 2. Split `customerName` on the first space (rest of string becomes
 *    last_name).
 * 3. Fallback: email local-part as first_name, single space as last_name.
 *
 * Returns `undefined` when no email is available — in which case the
 * adapter omits the `payer` block entirely (back-compat with callers
 * that don't pass any customer info).
 */
function buildPayer({
    customerEmail,
    customerName,
    payerFirstName,
    payerLastName
}: {
    readonly customerEmail?: string | undefined;
    readonly customerName?: string | undefined;
    readonly payerFirstName?: string | undefined;
    readonly payerLastName?: string | undefined;
}): MercadoPagoPayerInfo | undefined {
    if (!customerEmail) {
        return undefined;
    }

    if (payerFirstName && payerLastName) {
        return { email: customerEmail, first_name: payerFirstName, last_name: payerLastName };
    }

    if (customerName) {
        const trimmed = customerName.trim();
        const firstSpaceIdx = trimmed.indexOf(' ');
        if (trimmed.length === 0) {
            // Fall through to email-local-part fallback below.
        } else if (firstSpaceIdx === -1) {
            return { email: customerEmail, first_name: trimmed, last_name: ' ' };
        } else {
            return {
                email: customerEmail,
                first_name: trimmed.slice(0, firstSpaceIdx),
                last_name: trimmed.slice(firstSpaceIdx + 1).trim() || ' '
            };
        }
    }

    const localPart = customerEmail.split('@')[0] || customerEmail;
    return { email: customerEmail, first_name: localPart, last_name: ' ' };
}

/**
 * MercadoPago `statement_descriptor` must be 1-11 characters using only
 * ASCII uppercase letters, digits or spaces. Anything else is rejected
 * by MP at preference creation time. Validating client-side surfaces
 * misconfiguration before the HTTP round-trip.
 */
function validateStatementDescriptor(value: string): string {
    if (!/^[A-Z0-9 ]{1,11}$/.test(value)) {
        throw new Error(`Invalid statement_descriptor "${value}". Must be 1-11 ASCII uppercase letters, digits or spaces.`);
    }
    return value;
}

export class QZPayMercadoPagoCheckoutAdapter implements QZPayPaymentCheckoutAdapter {
    private readonly preferenceApi: Preference;
    private readonly planApi: PreApprovalPlan;
    private readonly useSandbox: boolean;

    constructor(client: MercadoPagoConfig, useSandbox = false) {
        this.preferenceApi = new Preference(client);
        this.planApi = new PreApprovalPlan(client);
        this.useSandbox = useSandbox;
    }

    async create(input: QZPayCreateCheckoutInput, providerPriceIds: string[]): Promise<QZPayProviderCheckout> {
        return wrapAdapterMethod('Create checkout session', async () => {
            // Fetch price information for each line item
            const items = await Promise.all(
                providerPriceIds.map(async (priceId, index) => {
                    const plan = await this.planApi.get({ preApprovalPlanId: priceId });
                    const autoRecurring = plan.auto_recurring;

                    if (!autoRecurring) {
                        throw new Error(`Price ${priceId} does not have recurring configuration`);
                    }

                    return {
                        id: priceId,
                        title: input.lineItems?.[index]?.description ?? `Item ${index + 1}`,
                        category_id: input.lineItems?.[index]?.categoryId ?? DEFAULT_ITEM_CATEGORY_ID,
                        quantity: input.lineItems?.[index]?.quantity ?? 1,
                        unit_price: autoRecurring.transaction_amount ?? 0,
                        currency_id: (autoRecurring.currency_id ?? 'USD').toUpperCase()
                    };
                })
            );

            // Build body without undefined values
            const body: Parameters<Preference['create']>[0]['body'] = {
                items,
                back_urls: {
                    success: input.successUrl,
                    failure: input.cancelUrl,
                    pending: input.successUrl
                },
                auto_return: 'approved',
                metadata: {
                    qzpay_mode: input.mode,
                    qzpay_customer_id: input.customerId ?? null
                }
            };

            // Add optional notification URL
            if (input.notificationUrl) {
                body.notification_url = input.notificationUrl;
            }

            // SPEC-125: full payer info (email + first_name + last_name) so
            // MP's fraud engine can score the transaction properly. MP's
            // quality checklist treats missing payer fields as a high-risk
            // signal.
            const payer = buildPayer({
                customerEmail: input.customerEmail,
                customerName: input.customerName,
                payerFirstName: input.payerFirstName,
                payerLastName: input.payerLastName
            });
            if (payer) {
                body.payer = payer;
            }

            // Add optional external reference
            if (input.customerId) {
                body.external_reference = input.customerId;
            }

            // Add expiration if specified
            if (input.expiresInMinutes !== undefined) {
                body.expires = true;
                body.expiration_date_from = new Date().toISOString();
                body.expiration_date_to = new Date(Date.now() + input.expiresInMinutes * 60 * 1000).toISOString();
            }

            // SPEC-125: statement_descriptor controls the text shown on the
            // cardholder's bank statement. Validate format before sending.
            if (input.statementDescriptor) {
                body.statement_descriptor = validateStatementDescriptor(input.statementDescriptor);
            }

            // SPEC-125: caller-supplied idempotency key (e.g. a local order
            // UUID). When omitted, MP auto-generates its own.
            const response = await this.preferenceApi.create(
                input.idempotencyKey ? { body, requestOptions: { idempotencyKey: input.idempotencyKey } } : { body }
            );

            return this.mapToProviderCheckout(response);
        });
    }

    async retrieve(providerSessionId: string): Promise<QZPayProviderCheckout> {
        return wrapAdapterMethod('Retrieve checkout session', async () => {
            const response = await this.preferenceApi.get({
                preferenceId: providerSessionId
            });

            return this.mapToProviderCheckout(response);
        });
    }

    async expire(providerSessionId: string): Promise<void> {
        return wrapAdapterMethod('Expire checkout session', async () => {
            // MercadoPago doesn't have a direct expire API
            // We update the expiration date to now
            await this.preferenceApi.update({
                id: providerSessionId,
                updatePreferenceRequest: {
                    items: [], // Required field, keep existing
                    expires: true,
                    expiration_date_to: new Date().toISOString()
                }
            });
        });
    }

    private mapToProviderCheckout(preference: Awaited<ReturnType<Preference['get']>>): QZPayProviderCheckout {
        const checkoutUrl = this.useSandbox ? preference.sandbox_init_point : preference.init_point;

        // Determine status based on dates
        let status = 'open';
        const expirationDate = preference.expiration_date_to;
        if (expirationDate && new Date(expirationDate) < new Date()) {
            status = 'expired';
        }

        return {
            id: preference.id ?? '',
            url: checkoutUrl ?? '',
            status,
            paymentIntentId: null, // MercadoPago creates payment after checkout
            subscriptionId: null,
            customerId: preference.external_reference ?? null,
            metadata: this.extractMetadata(preference.metadata)
        };
    }

    private extractMetadata(metadata: Record<string, unknown> | undefined): Record<string, string> {
        if (!metadata) return {};
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined && value !== null) {
                result[key] = String(value);
            }
        }
        return result;
    }
}
