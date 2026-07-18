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
    /**
     * Absolute `http(s)` URL the provider redirects the payer back to after the
     * plan-authorization flow.
     *
     * Provider-specific: MercadoPago **requires** a `back_url` when creating a
     * `preapproval_plan` (`POST /preapproval_plan`) and rejects the request with
     * "Back url is required" when it is absent. The MercadoPago adapter reads this
     * field first, falling back to the adapter-level `defaultPlanBackUrl` config;
     * if neither resolves to a valid absolute URL it throws early instead of
     * surfacing MercadoPago's opaque 400. Providers that do not need a redirect
     * URL for price creation (e.g. Stripe) ignore it, which is why the field is
     * optional on this cross-provider input.
     */
    backUrl?: string;
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
