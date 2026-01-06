/**
 * Subscription type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type {
    QZPayBillingInterval,
    QZPayCreateSubscriptionInput,
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
        cancelAtPeriodEnd: false, // Schema doesn't have this field, derive from cancelAt
        providerSubscriptionIds,
        metadata: (drizzle.metadata as Record<string, unknown>) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt,
        deletedAt: drizzle.deletedAt ?? null
    };
}

/**
 * Map Core create input to Drizzle insert
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
    return {
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
}

/**
 * Map Core update input to Drizzle partial update
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

    return update;
}
