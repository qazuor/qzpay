/**
 * Payment method type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type {
    QZPayBillingDetails,
    QZPayCardBrand,
    QZPayCardDetails,
    QZPayCreatePaymentMethodInput,
    QZPayPaymentMethod,
    QZPayPaymentMethodStatus,
    QZPayPaymentMethodType,
    QZPayUpdatePaymentMethodInput
} from '@qazuor/qzpay-core';
import type { QZPayBillingPaymentMethod, QZPayBillingPaymentMethodInsert } from '../schema/index.js';

/**
 * Map Drizzle payment method type to Core type
 */
function mapDrizzleTypeToCore(type: string): QZPayPaymentMethodType {
    switch (type) {
        case 'card':
            return 'card';
        case 'bank_account':
            return 'bank_account';
        case 'sepa_debit':
            return 'sepa_debit';
        case 'ideal':
            return 'ideal';
        default:
            return 'other';
    }
}

/**
 * Map Drizzle brand to Core card brand
 */
function mapDrizzleBrandToCore(brand: string | null): QZPayCardBrand {
    switch (brand?.toLowerCase()) {
        case 'visa':
            return 'visa';
        case 'mastercard':
            return 'mastercard';
        case 'amex':
        case 'american express':
            return 'amex';
        case 'discover':
            return 'discover';
        case 'diners':
        case 'diners club':
            return 'diners';
        case 'jcb':
            return 'jcb';
        case 'unionpay':
            return 'unionpay';
        default:
            return 'unknown';
    }
}

/**
 * Determine payment method status based on expiration
 */
function determinePaymentMethodStatus(drizzle: QZPayBillingPaymentMethod): QZPayPaymentMethodStatus {
    if (drizzle.type === 'card' && drizzle.expMonth && drizzle.expYear) {
        const now = new Date();
        const expDate = new Date(drizzle.expYear, drizzle.expMonth, 0, 23, 59, 59, 999);
        if (now > expDate) {
            return 'expired';
        }
    }
    return 'active';
}

/**
 * Map Drizzle payment method to Core payment method
 */
export function mapDrizzlePaymentMethodToCore(drizzle: QZPayBillingPaymentMethod): QZPayPaymentMethod {
    const type = mapDrizzleTypeToCore(drizzle.type);
    const status = determinePaymentMethodStatus(drizzle);

    // Build card details if this is a card payment method
    let card: QZPayCardDetails | null = null;
    if (type === 'card' && drizzle.lastFour) {
        card = {
            brand: mapDrizzleBrandToCore(drizzle.brand),
            last4: drizzle.lastFour,
            expMonth: drizzle.expMonth ?? 0,
            expYear: drizzle.expYear ?? 0,
            funding: 'unknown',
            country: null
        };
    }

    // Build provider payment method IDs map
    const providerPaymentMethodIds: Record<string, string> = {};
    if (drizzle.provider && drizzle.providerPaymentMethodId) {
        providerPaymentMethodIds[drizzle.provider] = drizzle.providerPaymentMethodId;
    }

    // Parse billing details from JSON
    const billingDetails = drizzle.billingDetails as QZPayBillingDetails | null;

    return {
        id: drizzle.id,
        customerId: drizzle.customerId,
        type,
        status,
        isDefault: drizzle.isDefault ?? false,
        card,
        bankAccount: null, // Bank account details not stored in current schema
        billingDetails,
        providerPaymentMethodIds,
        metadata: (drizzle.metadata as Record<string, unknown>) ?? {},
        livemode: drizzle.livemode,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.createdAt // Schema doesn't have updatedAt, using createdAt
    };
}

/**
 * Map Core create input to Drizzle insert
 */
export function mapCorePaymentMethodCreateToDrizzle(
    input: QZPayCreatePaymentMethodInput & { id: string },
    livemode: boolean,
    cardDetails?: { last4: string; brand: string; expMonth: number; expYear: number }
): QZPayBillingPaymentMethodInsert {
    return {
        id: input.id,
        customerId: input.customerId,
        provider: input.provider,
        providerPaymentMethodId: input.providerPaymentMethodId,
        type: input.type,
        lastFour: cardDetails?.last4 ?? null,
        brand: cardDetails?.brand ?? null,
        expMonth: cardDetails?.expMonth ?? null,
        expYear: cardDetails?.expYear ?? null,
        isDefault: input.setAsDefault ?? false,
        billingDetails: input.billingDetails ?? null,
        livemode,
        metadata: input.metadata ?? {}
    };
}

/**
 * Map Core update input to Drizzle partial update
 */
export function mapCorePaymentMethodUpdateToDrizzle(input: QZPayUpdatePaymentMethodInput): Partial<QZPayBillingPaymentMethodInsert> {
    const update: Partial<QZPayBillingPaymentMethodInsert> = {};

    if (input.billingDetails !== undefined) {
        update.billingDetails = input.billingDetails;
    }
    if (input.metadata !== undefined) {
        update.metadata = input.metadata;
    }

    return update;
}
