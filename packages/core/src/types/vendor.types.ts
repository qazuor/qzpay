/**
 * Vendor types for QZPay (marketplace scenarios)
 */
import type { QZPayCurrency, QZPayVendorStatus } from '../constants/index.js';

export interface QZPayVendor {
    id: string;
    externalId: string;
    name: string;
    email: string;
    status: QZPayVendorStatus;
    commissionRate: number;
    payoutSchedule: QZPayPayoutSchedule;
    providerAccountIds: Record<string, string>;
    metadata: Record<string, unknown>;
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
    metadata?: Record<string, unknown>;
}

export interface QZPayUpdateVendorInput {
    name?: string;
    email?: string;
    commissionRate?: number;
    payoutSchedule?: QZPayPayoutSchedule;
    metadata?: Record<string, unknown>;
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
