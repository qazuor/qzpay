/**
 * Customer type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayCreateCustomerInput, QZPayCustomer, QZPayUpdateCustomerInput } from '@qazuor/qzpay-core';
import type { QZPayBillingCustomer, QZPayBillingCustomerInsert } from '../schema/index.js';

/**
 * Map Drizzle customer to Core customer
 */
export function mapDrizzleCustomerToCore(drizzle: QZPayBillingCustomer): QZPayCustomer {
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
        phone: null, // Not in current Drizzle schema
        providerCustomerIds,
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
export function mapCoreCustomerCreateToDrizzle(input: QZPayCreateCustomerInput, livemode: boolean): QZPayBillingCustomerInsert {
    return {
        externalId: input.externalId,
        email: input.email,
        name: input.name ?? null,
        metadata: input.metadata ?? {},
        livemode
    };
}

/**
 * Map Core update input to Drizzle partial update
 */
export function mapCoreCustomerUpdateToDrizzle(input: QZPayUpdateCustomerInput): Partial<QZPayBillingCustomerInsert> {
    const update: Partial<QZPayBillingCustomerInsert> = {};

    if (input.email !== undefined) {
        update.email = input.email;
    }
    if (input.name !== undefined) {
        update.name = input.name;
    }
    if (input.metadata !== undefined) {
        update.metadata = input.metadata;
    }

    return update;
}
