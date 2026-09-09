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
    /**
     * Product/business line this plan belongs to. QZPay has no opinion on the
     * value set — the consuming application defines and interprets its own —
     * and persists it verbatim (the drizzle adapter's column caps it at 32
     * characters). See `QZPayCreateSubscriptionInput.productDomain`, which
     * carries the same contract for the subscription side.
     *
     * **Required, and deliberately so**, for the reason the subscription field
     * states: an optional field is satisfied by omission, and an omitted domain
     * still has to become *some* value at the storage layer — one product line
     * silently answering for every other.
     *
     * Until this field existed, a caller could not state a plan's domain even
     * when it wanted to. `mapCorePlanCreateToDrizzle` builds the insert
     * field-by-field off this interface, so a `productDomain` handed to
     * `plans.create()` was dropped on the floor and the column default answered
     * instead — silently, and for every plan of every secondary product line.
     * That is the same defect the subscription side fixed one release earlier;
     * this is the half that was missed.
     */
    productDomain: string;
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
