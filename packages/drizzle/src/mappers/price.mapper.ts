/**
 * Price type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayBillingInterval, QZPayCreatePriceInput, QZPayCurrency, QZPayPrice } from '@qazuor/qzpay-core';
import type { QZPayBillingPrice, QZPayBillingPriceInsert } from '../schema/index.js';

/**
 * Map Drizzle price to Core price
 */
export function mapDrizzlePriceToCore(drizzle: QZPayBillingPrice): QZPayPrice {
    const providerPriceIds: Record<string, string> = {};

    if (drizzle.stripePriceId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerPriceIds['stripe'] = drizzle.stripePriceId;
    }
    if (drizzle.mpPriceId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerPriceIds['mercadopago'] = drizzle.mpPriceId;
    }

    return {
        id: drizzle.id,
        planId: drizzle.planId,
        nickname: drizzle.nickname ?? null,
        currency: drizzle.currency as QZPayCurrency,
        unitAmount: drizzle.unitAmount,
        billingInterval: drizzle.billingInterval as QZPayBillingInterval,
        intervalCount: drizzle.intervalCount,
        trialDays: drizzle.trialDays ?? null,
        active: drizzle.active,
        providerPriceIds,
        metadata: (drizzle.metadata as Record<string, unknown>) ?? {},
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCorePriceCreateToDrizzle(input: QZPayCreatePriceInput & { id: string }, livemode: boolean): QZPayBillingPriceInsert {
    return {
        id: input.id,
        planId: input.planId,
        nickname: input.nickname ?? null,
        currency: input.currency,
        unitAmount: input.unitAmount,
        billingInterval: input.billingInterval,
        intervalCount: input.intervalCount ?? 1,
        trialDays: input.trialDays ?? null,
        active: true,
        metadata: input.metadata ?? {},
        livemode
    };
}

/**
 * Map Core price partial update to Drizzle
 */
export function mapCorePriceUpdateToDrizzle(update: Partial<QZPayPrice>): Partial<QZPayBillingPriceInsert> {
    const result: Partial<QZPayBillingPriceInsert> = {};

    if (update.nickname !== undefined) {
        result.nickname = update.nickname;
    }
    if (update.active !== undefined) {
        result.active = update.active;
    }
    if (update.metadata !== undefined) {
        result.metadata = update.metadata;
    }

    return result;
}
