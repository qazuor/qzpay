/**
 * Vendor type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type {
    QZPayCreateVendorInput,
    QZPayCurrency,
    QZPayMetadata,
    QZPayPayoutSchedule,
    QZPayUpdateVendorInput,
    QZPayVendor,
    QZPayVendorPayout,
    QZPayVendorStatus
} from '@qazuor/qzpay-core';
import type {
    QZPayBillingVendor,
    QZPayBillingVendorInsert,
    QZPayBillingVendorPayout,
    QZPayBillingVendorPayoutInsert
} from '../schema/index.js';

/**
 * Map Drizzle vendor to Core vendor
 */
export function mapDrizzleVendorToCore(drizzle: QZPayBillingVendor): QZPayVendor {
    const providerAccountIds: Record<string, string> = {};

    if (drizzle.stripeAccountId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerAccountIds['stripe'] = drizzle.stripeAccountId;
    }
    if (drizzle.mpMerchantId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerAccountIds['mercadopago'] = drizzle.mpMerchantId;
    }

    // Parse payoutSchedule from JSONB
    const payoutSchedule = drizzle.payoutSchedule as QZPayPayoutSchedule | null;

    return {
        id: drizzle.id,
        externalId: drizzle.externalId,
        name: drizzle.name ?? '',
        email: drizzle.email,
        status: drizzle.onboardingStatus as QZPayVendorStatus,
        commissionRate: Number(drizzle.commissionRate),
        payoutSchedule: payoutSchedule ?? {
            interval: 'weekly',
            dayOfWeek: 1
        },
        providerAccountIds,
        metadata: (drizzle.metadata as QZPayMetadata) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt,
        deletedAt: drizzle.deletedAt ?? null
    };
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCoreVendorCreateToDrizzle(input: QZPayCreateVendorInput & { id: string }, livemode: boolean): QZPayBillingVendorInsert {
    return {
        id: input.id,
        externalId: input.externalId,
        name: input.name,
        email: input.email,
        onboardingStatus: 'pending',
        commissionRate: String(input.commissionRate ?? 0),
        payoutSchedule: input.payoutSchedule ?? null,
        canReceivePayments: false,
        metadata: input.metadata ?? {},
        livemode
    };
}

/**
 * Map Core vendor update to Drizzle
 */
export function mapCoreVendorUpdateToDrizzle(input: QZPayUpdateVendorInput): Partial<QZPayBillingVendorInsert> {
    const result: Partial<QZPayBillingVendorInsert> = {};

    if (input.name !== undefined) {
        result.name = input.name;
    }
    if (input.email !== undefined) {
        result.email = input.email;
    }
    if (input.commissionRate !== undefined) {
        result.commissionRate = String(input.commissionRate);
    }
    if (input.payoutSchedule !== undefined) {
        result.payoutSchedule = input.payoutSchedule;
    }
    if (input.metadata !== undefined) {
        result.metadata = input.metadata;
    }

    return result;
}

/**
 * Map Drizzle vendor payout to Core vendor payout
 */
export function mapDrizzleVendorPayoutToCore(drizzle: QZPayBillingVendorPayout): QZPayVendorPayout {
    const providerPayoutIds: Record<string, string> = {};

    if (drizzle.providerPayoutId) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        providerPayoutIds['provider'] = drizzle.providerPayoutId;
    }

    return {
        id: drizzle.id,
        vendorId: drizzle.vendorId,
        amount: drizzle.amount,
        currency: drizzle.currency as QZPayCurrency,
        status: drizzle.status as QZPayVendorPayout['status'],
        periodStart: drizzle.periodStart ?? new Date(),
        periodEnd: drizzle.periodEnd ?? new Date(),
        providerPayoutIds,
        paidAt: drizzle.paidAt ?? null,
        createdAt: drizzle.createdAt
    };
}

/**
 * Map Core vendor payout to Drizzle insert
 */
export function mapCoreVendorPayoutToDrizzle(payout: QZPayVendorPayout, provider: string): QZPayBillingVendorPayoutInsert {
    const providerPayoutId = Object.values(payout.providerPayoutIds)[0] ?? null;

    return {
        id: payout.id,
        vendorId: payout.vendorId,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        provider,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
        providerPayoutId,
        paidAt: payout.paidAt ?? null
    };
}
