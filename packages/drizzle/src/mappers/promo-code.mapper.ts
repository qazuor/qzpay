/**
 * Promo code type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type {
    QZPayCreatePromoCodeInput,
    QZPayCurrency,
    QZPayDiscountStackingMode,
    QZPayDiscountType,
    QZPayPromoCode,
    QZPayPromoCodeCondition
} from '@qazuor/qzpay-core';
import type { QZPayBillingPromoCode, QZPayBillingPromoCodeInsert } from '../schema/index.js';

/**
 * Configuration stored in the config JSONB field
 */
interface PromoCodeConfig {
    currency?: QZPayCurrency;
    stackingMode?: QZPayDiscountStackingMode;
    conditions?: QZPayPromoCodeCondition[];
    applicableProductIds?: string[];
    metadata?: Record<string, unknown>;
}

/**
 * Map Drizzle promo code to Core promo code
 */
export function mapDrizzlePromoCodeToCore(drizzle: QZPayBillingPromoCode): QZPayPromoCode {
    const config = (drizzle.config as PromoCodeConfig) ?? {};

    return {
        id: drizzle.id,
        code: drizzle.code,
        discountType: drizzle.type as QZPayDiscountType,
        discountValue: drizzle.value,
        currency: config.currency ?? null,
        stackingMode: config.stackingMode ?? 'none',
        conditions: config.conditions ?? [],
        maxRedemptions: drizzle.maxUses ?? null,
        currentRedemptions: drizzle.usedCount ?? 0,
        maxRedemptionsPerCustomer: drizzle.maxPerCustomer ?? null,
        validFrom: drizzle.startsAt ?? null,
        validUntil: drizzle.expiresAt ?? null,
        applicablePlanIds: drizzle.validPlans ?? [],
        applicableProductIds: config.applicableProductIds ?? [],
        active: drizzle.active ?? true,
        metadata: config.metadata ?? {},
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.createdAt, // Schema doesn't have updatedAt, use createdAt
        deletedAt: null // Schema doesn't support soft deletes
    };
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCorePromoCodeCreateToDrizzle(
    input: QZPayCreatePromoCodeInput & { id: string },
    livemode: boolean
): QZPayBillingPromoCodeInsert {
    // Build config object from fields not directly supported by schema
    const config: PromoCodeConfig = {};

    if (input.currency !== undefined) {
        config.currency = input.currency;
    }
    if (input.stackingMode !== undefined) {
        config.stackingMode = input.stackingMode;
    }
    if (input.conditions !== undefined) {
        config.conditions = input.conditions;
    }
    if (input.applicableProductIds !== undefined) {
        config.applicableProductIds = input.applicableProductIds;
    }
    if (input.metadata !== undefined) {
        config.metadata = input.metadata;
    }

    // Determine customer eligibility flags from conditions
    const hasFirstPurchaseCondition = input.conditions?.some((c) => c.type === 'first_purchase' && c.value === true) ?? false;

    return {
        id: input.id,
        code: input.code,
        type: input.discountType,
        value: input.discountValue,
        config,
        maxUses: input.maxRedemptions ?? null,
        usedCount: 0,
        maxPerCustomer: input.maxRedemptionsPerCustomer ?? null,
        validPlans: input.applicablePlanIds ?? [],
        newCustomersOnly: hasFirstPurchaseCondition,
        existingCustomersOnly: false, // Not directly supported by Core conditions
        startsAt: input.validFrom ?? null,
        expiresAt: input.validUntil ?? null,
        combinable: input.stackingMode !== undefined && input.stackingMode !== 'none',
        active: true,
        livemode
    };
}

/**
 * Map Core promo code partial update to Drizzle
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex mapping logic required for promo code updates
export function mapCorePromoCodeUpdateToDrizzle(update: Partial<QZPayPromoCode>): Partial<QZPayBillingPromoCodeInsert> {
    const result: Partial<QZPayBillingPromoCodeInsert> = {};

    if (update.active !== undefined) {
        result.active = update.active;
    }

    if (update.maxRedemptions !== undefined) {
        result.maxUses = update.maxRedemptions;
    }

    if (update.maxRedemptionsPerCustomer !== undefined) {
        result.maxPerCustomer = update.maxRedemptionsPerCustomer;
    }

    if (update.validFrom !== undefined) {
        result.startsAt = update.validFrom;
    }

    if (update.validUntil !== undefined) {
        result.expiresAt = update.validUntil;
    }

    if (update.applicablePlanIds !== undefined) {
        result.validPlans = update.applicablePlanIds;
    }

    if (update.stackingMode !== undefined) {
        result.combinable = update.stackingMode !== 'none';
    }

    // Update config object for fields stored in JSONB
    if (
        update.currency !== undefined ||
        update.stackingMode !== undefined ||
        update.conditions !== undefined ||
        update.applicableProductIds !== undefined ||
        update.metadata !== undefined
    ) {
        const config: PromoCodeConfig = {};

        if (update.currency !== undefined && update.currency !== null) {
            config.currency = update.currency;
        }
        if (update.stackingMode !== undefined) {
            config.stackingMode = update.stackingMode;
        }
        if (update.conditions !== undefined) {
            config.conditions = update.conditions;

            // Update customer eligibility flags based on conditions
            const hasFirstPurchaseCondition = update.conditions.some((c) => c.type === 'first_purchase' && c.value === true);

            result.newCustomersOnly = hasFirstPurchaseCondition;
            result.existingCustomersOnly = false; // Not directly supported by Core conditions
        }
        if (update.applicableProductIds !== undefined) {
            config.applicableProductIds = update.applicableProductIds;
        }
        if (update.metadata !== undefined) {
            config.metadata = update.metadata;
        }

        result.config = config;
    }

    return result;
}
