/**
 * Customer types for QZPay
 */

export interface QZPayCustomer {
    id: string;
    externalId: string;
    email: string;
    name: string | null;
    phone: string | null;
    providerCustomerIds: Record<string, string>;
    metadata: Record<string, unknown>;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayCreateCustomerInput {
    externalId: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown>;
}

export interface QZPayUpdateCustomerInput {
    email?: string;
    name?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown>;
}
