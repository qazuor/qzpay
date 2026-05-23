import type { QZPayPaymentCheckoutAdapter, QZPayProviderCheckout, QZPayProviderCreateCheckoutInput } from '@qazuor/qzpay-core';
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

    async create(roro: QZPayProviderCreateCheckoutInput): Promise<QZPayProviderCheckout> {
        const { input } = roro;
        return wrapAdapterMethod('Create checkout session', async () => {
            // Build items per resolved line item. Two paths:
            //   1) providerPriceId set → look up the MercadoPago PreApprovalPlan
            //      to read transaction_amount + currency_id (subscription mode
            //      with a pre-registered plan).
            //   2) providerPriceId unset → use the inline unitAmount + currency
            //      carried in the resolved line item (one-time payment mode for
            //      annual upfront, delta charges, etc. — no plan to fetch).
            const items = await Promise.all(
                roro.resolvedLineItems.map(async (resolved, index) => {
                    const lineItem = input.lineItems?.[index];
                    const quantity = lineItem?.quantity ?? 1;
                    const categoryId = lineItem?.categoryId ?? DEFAULT_ITEM_CATEGORY_ID;
                    const fallbackTitle = resolved.title || lineItem?.description || `Item ${index + 1}`;

                    if (resolved.providerPriceId) {
                        const plan = await this.planApi.get({ preApprovalPlanId: resolved.providerPriceId });
                        const autoRecurring = plan.auto_recurring;

                        if (!autoRecurring) {
                            throw new Error(`Price ${resolved.providerPriceId} does not have recurring configuration`);
                        }

                        return {
                            id: resolved.providerPriceId,
                            title: lineItem?.description ?? fallbackTitle,
                            category_id: categoryId,
                            quantity,
                            unit_price: autoRecurring.transaction_amount ?? 0,
                            currency_id: (autoRecurring.currency_id ?? 'USD').toUpperCase()
                        };
                    }

                    // One-time payment mode: no MP plan to look up. Use the inline
                    // amount + currency carried in resolved line item.
                    // MercadoPago expects decimal currency units (e.g. 100.00 ARS),
                    // not cents — `resolved.unitAmount` carries qzpay's canonical
                    // cents value, divide by 100 to convert. Same convention as
                    // `payment.adapter.ts:76` and `price.adapter.ts:24`.
                    return {
                        id: `item_${index + 1}`,
                        title: fallbackTitle,
                        category_id: categoryId,
                        quantity,
                        unit_price: resolved.unitAmount / 100,
                        currency_id: resolved.currency.toUpperCase()
                    };
                })
            );

            // Merge caller-supplied metadata with the qzpay diagnostics keys
            // BEFORE building the body. Putting the qzpay keys LAST guarantees
            // they cannot be overridden by a (mis-)named input.metadata field
            // — `qzpay_mode` and `qzpay_customer_id` are reserved diagnostics
            // the orchestrator and adapter rely on for cross-event correlation.
            //
            // Forwarding input.metadata to MP is what lets webhook handlers
            // dispatch on caller-supplied keys (e.g. Hospeda's
            // `annualSubscriptionId` flag on the annual-checkout path). MP
            // propagates the preference metadata to every resulting payment,
            // so the same key is available on `payment.metadata` in the
            // webhook payload as in the local checkout record.
            const callerMetadata = input.metadata && typeof input.metadata === 'object' ? (input.metadata as Record<string, unknown>) : {};
            const mergedMetadata: Record<string, unknown> = {
                ...callerMetadata,
                qzpay_mode: input.mode,
                qzpay_customer_id: input.customerId ?? null
            };

            // Build body without undefined values
            const body: Parameters<Preference['create']>[0]['body'] = {
                items,
                back_urls: {
                    success: input.successUrl,
                    failure: input.cancelUrl,
                    pending: input.successUrl
                },
                auto_return: 'approved',
                metadata: mergedMetadata
            };

            // Add optional notification URL — prefer the orchestrator-derived
            // value (roro.notificationUrl) when set, fall back to input.
            const notificationUrl = roro.notificationUrl ?? input.notificationUrl;
            if (notificationUrl) {
                body.notification_url = notificationUrl;
            }

            // SPEC-125: full payer info (email + first_name + last_name) so
            // MP's fraud engine can score the transaction properly. MP's
            // quality checklist treats missing payer fields as a high-risk
            // signal. The resolved customer record (when present) takes
            // precedence over the raw input fields.
            const payer = buildPayer({
                customerEmail: roro.customer?.email ?? input.customerEmail,
                customerName: input.customerName,
                payerFirstName: roro.customer?.firstName ?? input.payerFirstName,
                payerLastName: roro.customer?.lastName ?? input.payerLastName
            });
            if (payer) {
                body.payer = payer;
            }

            // External reference points at the LOCAL checkout UUID so webhooks
            // can find the matching local record. Falls back to input.customerId
            // for backwards-compat when the orchestrator provides no reference
            // (should not happen via billing.checkout but the adapter remains
            // permissive). Only emit the field when a value is actually present
            // — MP rejects empty strings on external_reference.
            const externalReference = roro.externalReference || input.customerId;
            if (externalReference) {
                body.external_reference = externalReference;
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

            // Caller-supplied idempotency key (typically the local checkout
            // UUID). When the orchestrator-set roro.idempotencyKey is present,
            // prefer it over input.idempotencyKey.
            const idempotencyKey = roro.idempotencyKey || input.idempotencyKey;
            const response = await this.preferenceApi.create(idempotencyKey ? { body, requestOptions: { idempotencyKey } } : { body });

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
