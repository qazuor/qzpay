/**
 * Payment type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayCurrency, QZPayPayment, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import type { QZPayBillingPayment, QZPayBillingPaymentInsert } from '../schema/index.js';

/**
 * Map Drizzle payment to Core payment
 */
export function mapDrizzlePaymentToCore(drizzle: QZPayBillingPayment): QZPayPayment {
    const providerPaymentIds: Record<string, string> = {};

    if (drizzle.providerPaymentId) {
        // Use bracket notation for index signature access
        providerPaymentIds[drizzle.provider] = drizzle.providerPaymentId;
    }

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
        metadata: (drizzle.metadata as Record<string, unknown>) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Core payment to Drizzle insert
 */
export function mapCorePaymentToDrizzle(payment: QZPayPayment): QZPayBillingPaymentInsert {
    // Get first provider and its payment ID
    const providers = Object.keys(payment.providerPaymentIds);
    const provider = providers[0];
    const providerPaymentId = provider ? payment.providerPaymentIds[provider] : null;

    return {
        id: payment.id,
        customerId: payment.customerId,
        subscriptionId: payment.subscriptionId ?? null,
        invoiceId: payment.invoiceId ?? null,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        provider: provider ?? 'unknown',
        providerPaymentId: providerPaymentId ?? null,
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
