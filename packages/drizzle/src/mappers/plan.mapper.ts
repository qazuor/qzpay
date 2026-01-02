/**
 * Plan type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayCreatePlanInput, QZPayPlan, QZPayPlanFeature } from '@qazuor/qzpay-core';
import type { QZPayBillingPlan, QZPayBillingPlanInsert, QZPayBillingPrice } from '../schema/index.js';
import { mapDrizzlePriceToCore } from './price.mapper.js';

/**
 * Map Drizzle plan to Core plan
 */
export function mapDrizzlePlanToCore(drizzle: QZPayBillingPlan, prices: QZPayBillingPrice[] = []): QZPayPlan {
    return {
        id: drizzle.id,
        name: drizzle.name,
        description: drizzle.description ?? null,
        active: drizzle.active,
        prices: prices.map(mapDrizzlePriceToCore),
        features: (drizzle.features as QZPayPlanFeature[]) ?? [],
        entitlements: drizzle.entitlements ?? [],
        limits: (drizzle.limits as Record<string, number>) ?? {},
        metadata: (drizzle.metadata as Record<string, unknown>) ?? {},
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt,
        deletedAt: drizzle.deletedAt ?? null
    };
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCorePlanCreateToDrizzle(input: QZPayCreatePlanInput & { id: string }, livemode: boolean): QZPayBillingPlanInsert {
    return {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        active: true,
        features: input.features ?? [],
        entitlements: input.entitlements ?? [],
        limits: input.limits ?? {},
        metadata: input.metadata ?? {},
        livemode
    };
}

/**
 * Map Core plan partial update to Drizzle
 */
export function mapCorePlanUpdateToDrizzle(update: Partial<QZPayPlan>): Partial<QZPayBillingPlanInsert> {
    const result: Partial<QZPayBillingPlanInsert> = {};

    if (update.name !== undefined) {
        result.name = update.name;
    }
    if (update.description !== undefined) {
        result.description = update.description;
    }
    if (update.active !== undefined) {
        result.active = update.active;
    }
    if (update.features !== undefined) {
        result.features = update.features;
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
