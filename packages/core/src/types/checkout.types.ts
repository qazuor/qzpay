/**
 * Checkout types for QZPay
 */
import type { QZPayCheckoutMode, QZPayCurrency } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

export interface QZPayCheckoutSession {
    id: string;
    customerId: string | null;
    customerEmail: string | null;
    mode: QZPayCheckoutMode;
    status: 'open' | 'complete' | 'expired';
    currency: QZPayCurrency;
    lineItems: QZPayCheckoutLineItem[];
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
    paymentId: string | null;
    subscriptionId: string | null;
    providerSessionIds: Record<string, string>;
    metadata: QZPayMetadata;
    livemode: boolean;
    createdAt: Date;
    completedAt: Date | null;
}

export interface QZPayCheckoutLineItem {
    priceId: string;
    quantity: number;
    description?: string;
    /**
     * Provider-specific category code for this line item (e.g. MercadoPago
     * uses `items[].category_id` for fraud-engine scoring — `'services'` is
     * the canonical value for digital SaaS / subscriptions).
     *
     * When omitted, the adapter applies a sensible default (currently
     * `'services'` in the MercadoPago adapter).
     */
    categoryId?: string;
}

export interface QZPayCreateCheckoutInput {
    mode: QZPayCheckoutMode;
    lineItems: QZPayCheckoutLineItem[];
    successUrl: string;
    cancelUrl: string;
    customerId?: string;
    customerEmail?: string;
    /**
     * Customer's full display name. The adapter splits it on the first
     * space to populate `payer.first_name` / `payer.last_name` when the
     * caller did not pass them explicitly.
     */
    customerName?: string;
    /**
     * Explicit first name for the payer. Takes precedence over splitting
     * `customerName`. Required by some providers (e.g. MercadoPago's
     * quality checklist) to maximize approval rate.
     */
    payerFirstName?: string;
    /**
     * Explicit last name for the payer. See `payerFirstName`. Some
     * providers reject empty strings, so the adapter falls back to a
     * single space when no surname is available.
     */
    payerLastName?: string;
    promoCodeId?: string;
    allowPromoCodes?: boolean;
    metadata?: QZPayMetadata;
    expiresInMinutes?: number;
    notificationUrl?: string;
    /**
     * Caller-supplied idempotency key forwarded to the provider as
     * `X-Idempotency-Key`. When omitted, the adapter does not send the
     * header.
     */
    idempotencyKey?: string;
    /**
     * Provider-side statement descriptor (text shown on the cardholder's
     * bank statement). Format is provider-specific — MercadoPago expects
     * 1-11 ASCII uppercase characters, digits or spaces, and the adapter
     * validates this at runtime.
     */
    statementDescriptor?: string;
}

export interface QZPayCheckoutResult {
    session: QZPayCheckoutSession;
    url: string;
}
