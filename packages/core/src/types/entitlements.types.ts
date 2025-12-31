/**
 * Entitlements types for QZPay
 */

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
    source: 'subscription' | 'purchase' | 'manual';
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
    source?: 'manual';
}

export interface QZPayRevokeEntitlementInput {
    customerId: string;
    entitlementKey: string;
}
