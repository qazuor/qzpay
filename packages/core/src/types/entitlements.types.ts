/**
 * Entitlements types for QZPay
 */

import type { QZPaySourceType } from './common.types.js';

export interface QZPayEntitlement {
    id: string;
    key: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface QZPayCustomerEntitlement {
    customerId: string;
    entitlementKey: string;
    grantedAt: Date;
    expiresAt: Date | null;
    source: QZPaySourceType;
    sourceId: string | null;
}

export interface QZPayEntitlementCheck {
    customerId: string;
    entitlementKey: string;
    hasAccess: boolean;
    expiresAt: Date | null;
}

export interface QZPayGrantEntitlementInput {
    customerId: string;
    entitlementKey: string;
    expiresAt?: Date;
    /** Source type for the entitlement grant. Defaults to 'manual' in mapper if not provided. */
    source?: QZPaySourceType;
    /**
     * ID of the source entity that granted this entitlement.
     * Must be a valid UUID. The DB column is uuid type and will reject non-UUID values at runtime.
     * Typically the QZPaySubscriptionAddOn.id.
     */
    sourceId?: string;
}

export interface QZPayRevokeEntitlementInput {
    customerId: string;
    entitlementKey: string;
}
