/**
 * Payment type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayCurrency, QZPayMetadata, QZPayPayment, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import type { QZPayBillingPayment, QZPayBillingPaymentInsert } from '../schema/index.js';

/**
 * Map Drizzle payment to Core payment
 */
export function mapDrizzlePaymentToCore(drizzle: QZPayBillingPayment): QZPayPayment {
    // Parse providerPaymentIds from JSONB
    const providerPaymentIds = (drizzle.providerPaymentIds as Record<string, string>) ?? {};

    return {
        id: drizzle.id,
        customerId: drizzle.customerId,
        subscriptionId: drizzle.subscriptionId ?? null,
        invoiceId: drizzle.invoiceId ?? null,
        amount: drizzle.amount,
        currency: drizzle.currency as QZPayCurrency,
        status: drizzle.status as QZPayPaymentStatus,
        paymentMethodId: drizzle.paymentMethodId ?? null,
        providerPaymentIds,
        failureCode: drizzle.failureCode ?? null,
        failureMessage: drizzle.failureMessage ?? null,
        metadata: (drizzle.metadata as QZPayMetadata) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Core payment to Drizzle insert
 */
export function mapCorePaymentToDrizzle(payment: QZPayPayment): QZPayBillingPaymentInsert {
    // Get first provider for the provider field
    const providers = Object.keys(payment.providerPaymentIds);
    const provider = providers[0] ?? 'unknown';

    return {
        id: payment.id,
        customerId: payment.customerId,
        subscriptionId: payment.subscriptionId ?? null,
        invoiceId: payment.invoiceId ?? null,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        provider,
        providerPaymentIds: payment.providerPaymentIds,
        paymentMethodId: payment.paymentMethodId ?? null,
        failureCode: payment.failureCode ?? null,
        failureMessage: payment.failureMessage ?? null,
        metadata: payment.metadata ?? {},
        livemode: payment.livemode
    };
}

/**
 * Map Core payment partial update to Drizzle
 */
export function mapCorePaymentUpdateToDrizzle(update: Partial<QZPayPayment>): Partial<QZPayBillingPaymentInsert> {
    const result: Partial<QZPayBillingPaymentInsert> = {};

    if (update.status !== undefined) {
        result.status = update.status;
    }
    if (update.failureCode !== undefined) {
        result.failureCode = update.failureCode;
    }
    if (update.failureMessage !== undefined) {
        result.failureMessage = update.failureMessage;
    }
    if (update.metadata !== undefined) {
        result.metadata = update.metadata;
    }

    return result;
}
