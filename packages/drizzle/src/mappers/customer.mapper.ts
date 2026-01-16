/**
 * Customer type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayCreateCustomerInput, QZPayCustomer, QZPayMetadata, QZPayUpdateCustomerInput } from '@qazuor/qzpay-core';
import type { QZPayBillingCustomer, QZPayBillingCustomerInsert } from '../schema/index.js';

/**
 * Extended customer type that includes Drizzle-specific fields
 */
export interface QZPayExtendedCustomer extends QZPayCustomer {
    segment: string | null;
    tier: string | null;
    billingAddress: Record<string, unknown> | null;
    shippingAddress: Record<string, unknown> | null;
    taxId: string | null;
    taxIdType: string | null;
    preferredLanguage: string | null;
}

/**
 * Map Drizzle customer to Core customer (with extended fields)
 */
export function mapDrizzleCustomerToCore(drizzle: QZPayBillingCustomer): QZPayExtendedCustomer {
    const providerCustomerIds: Record<string, string> = {};

    if (drizzle.stripeCustomerId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerCustomerIds['stripe'] = drizzle.stripeCustomerId;
    }
    if (drizzle.mpCustomerId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerCustomerIds['mercadopago'] = drizzle.mpCustomerId;
    }

    return {
        id: drizzle.id,
        externalId: drizzle.externalId,
        email: drizzle.email,
        name: drizzle.name ?? null,
        phone: drizzle.phone ?? null,
        providerCustomerIds,
        metadata: (drizzle.metadata as QZPayMetadata) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt,
        deletedAt: drizzle.deletedAt ?? null,
        segment: drizzle.segment ?? null,
        tier: drizzle.tier ?? null,
        billingAddress: (drizzle.billingAddress as Record<string, unknown>) ?? null,
        shippingAddress: (drizzle.shippingAddress as Record<string, unknown>) ?? null,
        taxId: drizzle.taxId ?? null,
        taxIdType: drizzle.taxIdType ?? null,
        preferredLanguage: drizzle.preferredLanguage ?? null
    };
}

/**
 * Extended create input type that includes Drizzle-specific fields
 */
export interface QZPayExtendedCreateCustomerInput extends QZPayCreateCustomerInput {
    stripeCustomerId?: string | null;
    mpCustomerId?: string | null;
    segment?: string | null;
    tier?: string | null;
    billingAddress?: Record<string, unknown> | null;
    shippingAddress?: Record<string, unknown> | null;
    taxId?: string | null;
    taxIdType?: string | null;
    preferredLanguage?: string | null;
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCoreCustomerCreateToDrizzle(input: QZPayExtendedCreateCustomerInput, livemode: boolean): QZPayBillingCustomerInsert {
    const result: QZPayBillingCustomerInsert = {
        externalId: input.externalId,
        email: input.email,
        livemode
    };

    // Only set optional fields if explicitly provided
    if (input.name !== undefined) {
        result.name = input.name;
    }
    if (input.phone !== undefined) {
        result.phone = input.phone;
    }
    if (input.stripeCustomerId !== undefined) {
        result.stripeCustomerId = input.stripeCustomerId;
    }
    if (input.mpCustomerId !== undefined) {
        result.mpCustomerId = input.mpCustomerId;
    }
    if (input.segment !== undefined) {
        result.segment = input.segment;
    }
    if (input.tier !== undefined) {
        result.tier = input.tier;
    }
    if (input.billingAddress !== undefined) {
        result.billingAddress = input.billingAddress;
    }
    if (input.shippingAddress !== undefined) {
        result.shippingAddress = input.shippingAddress;
    }
    if (input.taxId !== undefined) {
        result.taxId = input.taxId;
    }
    if (input.taxIdType !== undefined) {
        result.taxIdType = input.taxIdType;
    }
    if (input.preferredLanguage !== undefined) {
        result.preferredLanguage = input.preferredLanguage;
    }
    if (input.metadata !== undefined) {
        result.metadata = input.metadata;
    }

    return result;
}

/**
 * Extended update input type that includes Drizzle-specific fields
 */
export interface QZPayExtendedUpdateCustomerInput extends QZPayUpdateCustomerInput {
    stripeCustomerId?: string | null;
    mpCustomerId?: string | null;
    segment?: string | null;
    tier?: string | null;
    billingAddress?: Record<string, unknown> | null;
    shippingAddress?: Record<string, unknown> | null;
    taxId?: string | null;
    taxIdType?: string | null;
    preferredLanguage?: string | null;
}

/**
 * Map Core update input to Drizzle partial update
 */
export function mapCoreCustomerUpdateToDrizzle(input: QZPayExtendedUpdateCustomerInput): Partial<QZPayBillingCustomerInsert> {
    const update: Partial<QZPayBillingCustomerInsert> = {};

    if (input.email !== undefined) {
        update.email = input.email;
    }
    if (input.name !== undefined) {
        update.name = input.name;
    }
    if (input.phone !== undefined) {
        update.phone = input.phone;
    }
    if (input.metadata !== undefined) {
        update.metadata = input.metadata;
    }
    if (input.stripeCustomerId !== undefined) {
        update.stripeCustomerId = input.stripeCustomerId;
    }
    if (input.mpCustomerId !== undefined) {
        update.mpCustomerId = input.mpCustomerId;
    }
    if (input.segment !== undefined) {
        update.segment = input.segment;
    }
    if (input.tier !== undefined) {
        update.tier = input.tier;
    }
    if (input.billingAddress !== undefined) {
        update.billingAddress = input.billingAddress;
    }
    if (input.shippingAddress !== undefined) {
        update.shippingAddress = input.shippingAddress;
    }
    if (input.taxId !== undefined) {
        update.taxId = input.taxId;
    }
    if (input.taxIdType !== undefined) {
        update.taxIdType = input.taxIdType;
    }
    if (input.preferredLanguage !== undefined) {
        update.preferredLanguage = input.preferredLanguage;
    }

    return update;
}
