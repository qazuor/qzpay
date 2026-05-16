/**
 * Checkout type mappers
 *
 * Maps between Drizzle schema rows and Core domain types.
 */
import type { QZPayCheckoutLineItem, QZPayCheckoutMode, QZPayCheckoutSession, QZPayCurrency, QZPayMetadata } from '@qazuor/qzpay-core';
import type { QZPayBillingCheckout, QZPayBillingCheckoutInsert } from '../schema/index.js';

/**
 * Map a Drizzle checkout row to a Core `QZPayCheckoutSession`.
 */
export function mapDrizzleCheckoutToCore(drizzle: QZPayBillingCheckout): QZPayCheckoutSession {
    return {
        id: drizzle.id,
        customerId: drizzle.customerId ?? null,
        customerEmail: drizzle.customerEmail ?? null,
        mode: drizzle.mode as QZPayCheckoutMode,
        status: drizzle.status as QZPayCheckoutSession['status'],
        currency: drizzle.currency as QZPayCurrency,
        lineItems: (drizzle.lineItems as QZPayCheckoutLineItem[]) ?? [],
        successUrl: drizzle.successUrl,
        cancelUrl: drizzle.cancelUrl,
        expiresAt: drizzle.expiresAt,
        paymentId: drizzle.paymentId ?? null,
        subscriptionId: drizzle.subscriptionId ?? null,
        providerSessionIds: (drizzle.providerSessionIds as Record<string, string>) ?? {},
        metadata: (drizzle.metadata as QZPayMetadata) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        completedAt: drizzle.completedAt ?? null
    };
}

/**
 * Map a Core `QZPayCheckoutSession` to a Drizzle insert record.
 *
 * `billing.checkout.create()` builds the full session (UUID, timestamps,
 * status='open', currency) BEFORE calling storage, so this mapper is a
 * straight projection — no defaults filled here.
 */
export function mapCoreCheckoutToDrizzle(session: QZPayCheckoutSession): QZPayBillingCheckoutInsert {
    return {
        id: session.id,
        customerId: session.customerId ?? null,
        customerEmail: session.customerEmail ?? null,
        mode: session.mode,
        status: session.status,
        currency: session.currency,
        lineItems: session.lineItems,
        successUrl: session.successUrl,
        cancelUrl: session.cancelUrl,
        expiresAt: session.expiresAt,
        paymentId: session.paymentId ?? null,
        subscriptionId: session.subscriptionId ?? null,
        providerSessionIds: session.providerSessionIds,
        metadata: session.metadata,
        livemode: session.livemode,
        createdAt: session.createdAt,
        completedAt: session.completedAt ?? null
    };
}

/**
 * Map a Core partial update to a Drizzle partial update.
 *
 * Used by `billing.checkout.update()` and webhook handlers to flip status,
 * write `providerSessionIds`, link `paymentId` / `subscriptionId`, mark
 * `completedAt`, etc.
 */
export function mapCoreCheckoutUpdateToDrizzle(input: Partial<QZPayCheckoutSession>): Partial<QZPayBillingCheckoutInsert> {
    const update: Partial<QZPayBillingCheckoutInsert> = {};
    if (input.customerId !== undefined) update.customerId = input.customerId;
    if (input.customerEmail !== undefined) update.customerEmail = input.customerEmail;
    if (input.mode !== undefined) update.mode = input.mode;
    if (input.status !== undefined) update.status = input.status;
    if (input.currency !== undefined) update.currency = input.currency;
    if (input.lineItems !== undefined) update.lineItems = input.lineItems;
    if (input.successUrl !== undefined) update.successUrl = input.successUrl;
    if (input.cancelUrl !== undefined) update.cancelUrl = input.cancelUrl;
    if (input.expiresAt !== undefined) update.expiresAt = input.expiresAt;
    if (input.paymentId !== undefined) update.paymentId = input.paymentId;
    if (input.subscriptionId !== undefined) update.subscriptionId = input.subscriptionId;
    if (input.providerSessionIds !== undefined) update.providerSessionIds = input.providerSessionIds;
    if (input.metadata !== undefined) update.metadata = input.metadata;
    if (input.livemode !== undefined) update.livemode = input.livemode;
    if (input.completedAt !== undefined) update.completedAt = input.completedAt;
    return update;
}
