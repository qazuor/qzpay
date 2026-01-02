/**
 * Entitlement type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayCustomerEntitlement, QZPayEntitlement, QZPayGrantEntitlementInput } from '@qazuor/qzpay-core';
import type {
    QZPayBillingCustomerEntitlement,
    QZPayBillingCustomerEntitlementInsert,
    QZPayBillingEntitlement,
    QZPayBillingEntitlementInsert
} from '../schema/index.js';

/**
 * Map Drizzle entitlement definition to Core entitlement
 */
export function mapDrizzleEntitlementToCore(drizzle: QZPayBillingEntitlement): QZPayEntitlement {
    return {
        id: drizzle.id,
        key: drizzle.key,
        name: drizzle.name,
        description: drizzle.description ?? null,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Core entitlement to Drizzle insert
 */
export function mapCoreEntitlementToDrizzle(entitlement: QZPayEntitlement): QZPayBillingEntitlementInsert {
    return {
        id: entitlement.id,
        key: entitlement.key,
        name: entitlement.name,
        description: entitlement.description ?? null
    };
}

/**
 * Map Drizzle customer entitlement to Core customer entitlement
 */
export function mapDrizzleCustomerEntitlementToCore(drizzle: QZPayBillingCustomerEntitlement): QZPayCustomerEntitlement {
    return {
        customerId: drizzle.customerId,
        entitlementKey: drizzle.entitlementKey,
        grantedAt: drizzle.grantedAt,
        expiresAt: drizzle.expiresAt ?? null,
        source: drizzle.source as QZPayCustomerEntitlement['source'],
        sourceId: drizzle.sourceId ?? null
    };
}

/**
 * Map Core grant input to Drizzle insert
 */
export function mapCoreGrantEntitlementToDrizzle(
    input: QZPayGrantEntitlementInput,
    livemode: boolean
): QZPayBillingCustomerEntitlementInsert {
    return {
        customerId: input.customerId,
        entitlementKey: input.entitlementKey,
        grantedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
        source: input.source ?? 'manual',
        sourceId: null,
        livemode
    };
}

/**
 * Map Core grant input with source to Drizzle insert
 */
export function mapCoreGrantEntitlementWithSourceToDrizzle(
    customerId: string,
    entitlementKey: string,
    source: QZPayCustomerEntitlement['source'],
    sourceId: string | null,
    expiresAt: Date | null,
    livemode: boolean
): QZPayBillingCustomerEntitlementInsert {
    return {
        customerId,
        entitlementKey,
        grantedAt: new Date(),
        expiresAt,
        source,
        sourceId,
        livemode
    };
}
