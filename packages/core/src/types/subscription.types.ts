/**
 * Subscription types for QZPay
 */
import type { QZPayBillingInterval, QZPayCancelAt, QZPayProrationBehavior, QZPaySubscriptionStatus } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

export interface QZPaySubscription {
    id: string;
    customerId: string;
    planId: string;
    status: QZPaySubscriptionStatus;
    interval: QZPayBillingInterval;
    intervalCount: number;
    quantity: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart: Date | null;
    trialEnd: Date | null;
    cancelAt: Date | null;
    canceledAt: Date | null;
    cancelAtPeriodEnd: boolean;
    providerSubscriptionIds: Record<string, string>;
    promoCodeId?: string | null;
    metadata: QZPayMetadata;
    livemode: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayCreateSubscriptionInput {
    customerId: string;
    planId: string;
    quantity?: number;
    trialDays?: number;
    metadata?: QZPayMetadata;
    promoCodeId?: string;
}

export interface QZPayUpdateSubscriptionInput {
    planId?: string;
    quantity?: number;
    prorationBehavior?: QZPayProrationBehavior;
    metadata?: QZPayMetadata;
    status?: QZPaySubscriptionStatus;
    canceledAt?: Date;
    cancelAt?: Date;
    /** Current period start date (for renewals) */
    currentPeriodStart?: Date;
    /** Current period end date (for renewals) */
    currentPeriodEnd?: Date;
}

export interface QZPayCancelSubscriptionInput {
    cancelAt?: QZPayCancelAt;
    reason?: string;
}

export interface QZPaySubscriptionItem {
    id: string;
    subscriptionId: string;
    priceId: string;
    quantity: number;
    metadata: QZPayMetadata;
    createdAt: Date;
    updatedAt: Date;
}
