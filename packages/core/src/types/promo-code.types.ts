/**
 * Promo code types for QZPay
 */
import type { QZPayCurrency, QZPayDiscountCondition, QZPayDiscountStackingMode, QZPayDiscountType } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

export interface QZPayPromoCode {
    id: string;
    code: string;
    discountType: QZPayDiscountType;
    discountValue: number;
    currency: QZPayCurrency | null;
    stackingMode: QZPayDiscountStackingMode;
    conditions: QZPayPromoCodeCondition[];
    maxRedemptions: number | null;
    currentRedemptions: number;
    maxRedemptionsPerCustomer: number | null;
    validFrom: Date | null;
    validUntil: Date | null;
    applicablePlanIds: string[];
    applicableProductIds: string[];
    active: boolean;
    metadata: QZPayMetadata;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface QZPayPromoCodeCondition {
    type: QZPayDiscountCondition;
    value: unknown;
}

export interface QZPayCreatePromoCodeInput {
    code: string;
    discountType: QZPayDiscountType;
    discountValue: number;
    currency?: QZPayCurrency;
    stackingMode?: QZPayDiscountStackingMode;
    conditions?: QZPayPromoCodeCondition[];
    maxRedemptions?: number;
    maxRedemptionsPerCustomer?: number;
    validFrom?: Date;
    validUntil?: Date;
    applicablePlanIds?: string[];
    applicableProductIds?: string[];
    metadata?: QZPayMetadata;
}

export interface QZPayAppliedDiscount {
    promoCodeId: string;
    code: string;
    discountType: QZPayDiscountType;
    discountValue: number;
    discountAmount: number;
}
