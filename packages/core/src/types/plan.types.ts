/**
 * Plan and Price types for QZPay
 */
import type { QZPayBillingInterval, QZPayCurrency } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

export interface QZPayPlan {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    prices: QZPayPrice[];
    features: QZPayPlanFeature[];
    entitlements: string[];
    limits: Record<string, number>;
    metadata: QZPayMetadata;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayPrice {
    id: string;
    planId: string;
    nickname: string | null;
    currency: QZPayCurrency;
    unitAmount: number;
    billingInterval: QZPayBillingInterval;
    intervalCount: number;
    trialDays: number | null;
    active: boolean;
    providerPriceIds: Record<string, string>;
    metadata: QZPayMetadata;
    createdAt: Date;
    updatedAt: Date;
}

export interface QZPayPlanFeature {
    name: string;
    description?: string;
    included: boolean;
}

export interface QZPayCreatePlanInput {
    name: string;
    description?: string;
    features?: QZPayPlanFeature[];
    entitlements?: string[];
    limits?: Record<string, number>;
    metadata?: QZPayMetadata;
}

export interface QZPayCreatePriceInput {
    planId: string;
    nickname?: string;
    currency: QZPayCurrency;
    unitAmount: number;
    billingInterval: QZPayBillingInterval;
    intervalCount?: number;
    trialDays?: number;
    metadata?: QZPayMetadata;
}

export interface QZPayProduct {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    prices: QZPayProductPrice[];
    metadata: QZPayMetadata;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayProductPrice {
    id: string;
    productId: string;
    nickname: string | null;
    currency: QZPayCurrency;
    unitAmount: number;
    active: boolean;
    providerPriceIds: Record<string, string>;
    metadata: QZPayMetadata;
    createdAt: Date;
    updatedAt: Date;
}
