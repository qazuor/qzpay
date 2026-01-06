/**
 * Add-on type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type {
    QZPayAddOn,
    QZPayBillingInterval,
    QZPayCreateAddOnInput,
    QZPaySubscriptionAddOn,
    QZPayUpdateAddOnInput
} from '@qazuor/qzpay-core';
import type {
    QZPayBillingAddon,
    QZPayBillingAddonInsert,
    QZPayBillingSubscriptionAddon,
    QZPayBillingSubscriptionAddonInsert
} from '../schema/index.js';

/**
 * Map Drizzle add-on to Core add-on
 */
export function mapDrizzleAddonToCore(drizzle: QZPayBillingAddon): QZPayAddOn {
    return {
        id: drizzle.id,
        name: drizzle.name,
        description: drizzle.description ?? null,
        active: drizzle.active,
        unitAmount: drizzle.unitAmount,
        currency: drizzle.currency,
        billingInterval: drizzle.billingInterval as QZPayBillingInterval | 'one_time',
        billingIntervalCount: drizzle.billingIntervalCount,
        compatiblePlanIds: drizzle.compatiblePlanIds ?? [],
        allowMultiple: drizzle.allowMultiple,
        maxQuantity: drizzle.maxQuantity ?? null,
        entitlements: drizzle.entitlements ?? [],
        limits: (drizzle.limits as Array<{ key: string; value: number; action: 'set' | 'increment' }>) ?? [],
        metadata: (drizzle.metadata as Record<string, unknown>) ?? {},
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCoreAddonCreateToDrizzle(input: QZPayCreateAddOnInput & { id: string }, livemode: boolean): QZPayBillingAddonInsert {
    return {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        active: true,
        unitAmount: input.unitAmount,
        currency: input.currency,
        billingInterval: input.billingInterval,
        billingIntervalCount: input.billingIntervalCount ?? 1,
        compatiblePlanIds: input.compatiblePlanIds ?? [],
        allowMultiple: input.allowMultiple ?? false,
        maxQuantity: input.maxQuantity ?? null,
        entitlements: input.entitlements ?? [],
        limits: input.limits ?? [],
        metadata: input.metadata ?? {},
        livemode
    };
}

/**
 * Map Core add-on update to Drizzle
 */
export function mapCoreAddonUpdateToDrizzle(update: QZPayUpdateAddOnInput): Partial<QZPayBillingAddonInsert> {
    const result: Partial<QZPayBillingAddonInsert> = {};

    if (update.name !== undefined) {
        result.name = update.name;
    }
    if (update.description !== undefined) {
        result.description = update.description;
    }
    if (update.unitAmount !== undefined) {
        result.unitAmount = update.unitAmount;
    }
    if (update.active !== undefined) {
        result.active = update.active;
    }
    if (update.compatiblePlanIds !== undefined) {
        result.compatiblePlanIds = update.compatiblePlanIds;
    }
    if (update.allowMultiple !== undefined) {
        result.allowMultiple = update.allowMultiple;
    }
    if (update.maxQuantity !== undefined) {
        result.maxQuantity = update.maxQuantity;
    }
    if (update.entitlements !== undefined) {
        result.entitlements = update.entitlements;
    }
    if (update.limits !== undefined) {
        result.limits = update.limits;
    }
    if (update.metadata !== undefined) {
        result.metadata = update.metadata;
    }

    return result;
}

/**
 * Map Drizzle subscription add-on to Core subscription add-on
 */
export function mapDrizzleSubscriptionAddonToCore(drizzle: QZPayBillingSubscriptionAddon): QZPaySubscriptionAddOn {
    return {
        id: drizzle.id,
        subscriptionId: drizzle.subscriptionId,
        addOnId: drizzle.addOnId,
        quantity: drizzle.quantity,
        unitAmount: drizzle.unitAmount,
        currency: drizzle.currency,
        status: drizzle.status as 'active' | 'canceled' | 'pending',
        addedAt: drizzle.addedAt,
        canceledAt: drizzle.canceledAt ?? null,
        expiresAt: drizzle.expiresAt ?? null,
        metadata: (drizzle.metadata as Record<string, unknown>) ?? {},
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Core subscription add-on input to Drizzle insert
 */
export function mapCoreSubscriptionAddonCreateToDrizzle(input: {
    id: string;
    subscriptionId: string;
    addOnId: string;
    quantity: number;
    unitAmount: number;
    currency: string;
    metadata?: Record<string, unknown>;
}): QZPayBillingSubscriptionAddonInsert {
    return {
        id: input.id,
        subscriptionId: input.subscriptionId,
        addOnId: input.addOnId,
        quantity: input.quantity,
        unitAmount: input.unitAmount,
        currency: input.currency,
        status: 'active',
        metadata: input.metadata ?? {}
    };
}

/**
 * Map Core subscription add-on update to Drizzle
 */
export function mapCoreSubscriptionAddonUpdateToDrizzle(
    update: Partial<QZPaySubscriptionAddOn>
): Partial<QZPayBillingSubscriptionAddonInsert> {
    const result: Partial<QZPayBillingSubscriptionAddonInsert> = {};

    if (update.quantity !== undefined) {
        result.quantity = update.quantity;
    }
    if (update.status !== undefined) {
        result.status = update.status;
    }
    if (update.canceledAt !== undefined) {
        result.canceledAt = update.canceledAt;
    }
    if (update.expiresAt !== undefined) {
        result.expiresAt = update.expiresAt;
    }
    if (update.metadata !== undefined) {
        result.metadata = update.metadata;
    }

    return result;
}
