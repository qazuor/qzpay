/**
 * Subscription type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type {
    QZPayBillingInterval,
    QZPayCreateSubscriptionInput,
    QZPayMetadata,
    QZPaySubscription,
    QZPaySubscriptionStatus,
    QZPayUpdateSubscriptionInput
} from '@qazuor/qzpay-core';
import type { QZPayBillingSubscription, QZPayBillingSubscriptionInsert } from '../schema/index.js';

/**
 * Map Drizzle subscription to Core subscription
 */
export function mapDrizzleSubscriptionToCore(drizzle: QZPayBillingSubscription): QZPaySubscription {
    const providerSubscriptionIds: Record<string, string> = {};

    if (drizzle.stripeSubscriptionId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerSubscriptionIds['stripe'] = drizzle.stripeSubscriptionId;
    }
    if (drizzle.mpSubscriptionId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerSubscriptionIds['mercadopago'] = drizzle.mpSubscriptionId;
    }

    return {
        id: drizzle.id,
        customerId: drizzle.customerId,
        planId: drizzle.planId,
        status: drizzle.status as QZPaySubscriptionStatus,
        interval: drizzle.billingInterval as QZPayBillingInterval,
        intervalCount: drizzle.intervalCount ?? 1,
        quantity: 1, // Schema doesn't have quantity field, default to 1
        currentPeriodStart: drizzle.currentPeriodStart,
        currentPeriodEnd: drizzle.currentPeriodEnd,
        trialStart: drizzle.trialStart ?? null,
        trialEnd: drizzle.trialEnd ?? null,
        cancelAt: drizzle.cancelAt ?? null,
        canceledAt: drizzle.canceledAt ?? null,
        cancelAtPeriodEnd: drizzle.cancelAtPeriodEnd ?? false,
        providerSubscriptionIds,
        metadata: (drizzle.metadata as QZPayMetadata) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt,
        deletedAt: drizzle.deletedAt ?? null
    };
}

/**
 * Map Core create input to Drizzle insert.
 *
 * Splits `input.providerSubscriptionIds` (record keyed by provider name) into
 * the dedicated `stripeSubscriptionId` / `mpSubscriptionId` columns. Usually
 * omitted at create time (the provider call happens AFTER the local insert
 * and is reconciled via the update path), but supported for backfills /
 * manual reconciliation.
 */
export function mapCoreSubscriptionCreateToDrizzle(
    input: QZPayCreateSubscriptionInput & { id: string },
    defaults: {
        livemode: boolean;
        billingInterval: string;
        intervalCount: number;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        status?: string;
        trialStart?: Date | null;
        trialEnd?: Date | null;
    }
): QZPayBillingSubscriptionInsert {
    const insert: QZPayBillingSubscriptionInsert = {
        id: input.id,
        customerId: input.customerId,
        planId: input.planId,
        status: defaults.status ?? 'active',
        billingInterval: defaults.billingInterval,
        intervalCount: defaults.intervalCount,
        currentPeriodStart: defaults.currentPeriodStart,
        currentPeriodEnd: defaults.currentPeriodEnd,
        trialStart: defaults.trialStart ?? null,
        trialEnd: defaults.trialEnd ?? null,
        promoCodeId: input.promoCodeId ?? null,
        metadata: input.metadata ?? {},
        livemode: defaults.livemode
    };

    if (input.providerSubscriptionIds) {
        const stripeId = input.providerSubscriptionIds.stripe;
        const mpId = input.providerSubscriptionIds.mercadopago;
        if (stripeId !== undefined) {
            insert.stripeSubscriptionId = stripeId;
        }
        if (mpId !== undefined) {
            insert.mpSubscriptionId = mpId;
        }
    }

    return insert;
}

/**
 * Map Core update input to Drizzle partial update.
 *
 * Splits `input.providerSubscriptionIds` into the dedicated columns. This is
 * the writeback path used by `billing.subscriptions.linkProviderId()` after
 * a provider preapproval / subscription is confirmed (e.g. via webhook).
 */
export function mapCoreSubscriptionUpdateToDrizzle(input: QZPayUpdateSubscriptionInput): Partial<QZPayBillingSubscriptionInsert> {
    const update: Partial<QZPayBillingSubscriptionInsert> = {};

    if (input.planId !== undefined) {
        update.planId = input.planId;
    }
    if (input.metadata !== undefined) {
        update.metadata = input.metadata;
    }
    if (input.status !== undefined) {
        update.status = input.status;
    }
    if (input.canceledAt !== undefined) {
        update.canceledAt = input.canceledAt;
    }
    if (input.cancelAt !== undefined) {
        update.cancelAt = input.cancelAt;
    }
    if (input.currentPeriodStart !== undefined) {
        update.currentPeriodStart = input.currentPeriodStart;
    }
    if (input.currentPeriodEnd !== undefined) {
        update.currentPeriodEnd = input.currentPeriodEnd;
    }
    if (input.trialEnd !== undefined) {
        update.trialEnd = input.trialEnd;
    }
    if (input.providerSubscriptionIds) {
        const stripeId = input.providerSubscriptionIds.stripe;
        const mpId = input.providerSubscriptionIds.mercadopago;
        if (stripeId !== undefined) {
            update.stripeSubscriptionId = stripeId;
        }
        if (mpId !== undefined) {
            update.mpSubscriptionId = mpId;
        }
    }

    return update;
}
