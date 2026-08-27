/**
 * Vendor types for QZPay (marketplace scenarios)
 */
import type { QZPayCurrency, QZPayVendorStatus } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

export interface QZPayVendor {
    id: string;
    externalId: string;
    name: string;
    email: string;
    status: QZPayVendorStatus;
    /**
     * Whether the vendor has completed onboarding far enough to be paid.
     *
     * Storage sets this to `true` when onboarding reaches `completed`. It was
     * previously readable only from the storage row, never from the domain
     * object, which made `QZPayVendorFilters.canReceivePayments` impossible for
     * a non-SQL adapter to honour.
     */
    canReceivePayments: boolean;
    commissionRate: number;
    payoutSchedule: QZPayPayoutSchedule;
    providerAccountIds: Record<string, string>;
    metadata: QZPayMetadata;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayPayoutSchedule {
    interval: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
}

export interface QZPayCreateVendorInput {
    externalId: string;
    name: string;
    email: string;
    commissionRate?: number;
    payoutSchedule?: QZPayPayoutSchedule;
    metadata?: QZPayMetadata;
}

export interface QZPayUpdateVendorInput {
    name?: string;
    email?: string;
    commissionRate?: number;
    payoutSchedule?: QZPayPayoutSchedule;
    metadata?: QZPayMetadata;
}

export interface QZPayVendorPayout {
    id: string;
    vendorId: string;
    amount: number;
    currency: QZPayCurrency;
    status: 'pending' | 'processing' | 'paid' | 'failed';
    periodStart: Date;
    periodEnd: Date;
    providerPayoutIds: Record<string, string>;
    paidAt: Date | null;
    createdAt: Date;
}

export interface QZPaySplitPayment {
    vendorId: string;
    amount: number;
    platformFee: number;
}
