/**
 * Usage-Based Billing Types
 *
 * Types for metered pricing, usage aggregation, and tiered pricing models.
 */

import type { QZPayCurrency } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

/**
 * Usage meter definition
 *
 * Defines a metric that can be tracked for usage-based billing.
 */
export interface QZPayUsageMeter {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Internal identifier for API usage */
    key: string;

    /** Description of what this meter tracks */
    description: string | null;

    /** Unit of measurement (e.g., 'requests', 'GB', 'messages') */
    unit: string;

    /** How to aggregate usage within a billing period */
    aggregationType: QZPayUsageAggregationType;

    /** Whether this meter is active */
    active: boolean;

    /** Custom metadata */
    metadata: QZPayMetadata;

    /** Timestamps */
    createdAt: Date;
    updatedAt: Date;
}

/**
 * How to aggregate usage within a billing period
 */
export type QZPayUsageAggregationType =
    | 'sum' // Sum of all usage records
    | 'max' // Maximum value recorded
    | 'last' // Last recorded value (for gauge metrics)
    | 'count'; // Number of records

/**
 * Usage event - raw usage data point
 */
export interface QZPayUsageEvent {
    /** Unique identifier */
    id: string;

    /** Customer who used the resource */
    customerId: string;

    /** Subscription (if applicable) */
    subscriptionId: string | null;

    /** Meter this event belongs to */
    meterKey: string;

    /** Quantity/value of usage */
    quantity: number;

    /** When the usage occurred */
    timestamp: Date;

    /** Idempotency key to prevent duplicate events */
    idempotencyKey: string | null;

    /** Custom properties for this event */
    properties: Record<string, unknown>;

    /** Timestamps */
    createdAt: Date;
}

/**
 * Aggregated usage for a billing period
 */
export interface QZPayUsageSummary {
    /** Customer */
    customerId: string;

    /** Subscription (if applicable) */
    subscriptionId: string | null;

    /** Meter key */
    meterKey: string;

    /** Start of the billing period */
    periodStart: Date;

    /** End of the billing period */
    periodEnd: Date;

    /** Aggregated value */
    aggregatedValue: number;

    /** Number of events in this period */
    eventCount: number;

    /** Calculated amount to charge (in cents) */
    amount: number;

    /** Currency */
    currency: QZPayCurrency;

    /** Breakdown by tier (if tiered pricing) */
    tierBreakdown: QZPayTierBreakdownItem[] | null;
}

/**
 * Breakdown of usage by pricing tier
 */
export interface QZPayTierBreakdownItem {
    /** Tier index (0-based) */
    tierIndex: number;

    /** Quantity in this tier */
    quantity: number;

    /** Unit price for this tier */
    unitPrice: number;

    /** Total amount for this tier */
    amount: number;

    /** First unit in this tier */
    fromUnit: number;

    /** Last unit in this tier (null = unlimited) */
    toUnit: number | null;
}

/**
 * Metered price configuration
 *
 * Extends standard pricing with usage-based billing options.
 */
export interface QZPayMeteredPrice {
    /** Price ID */
    priceId: string;

    /** Meter this price is based on */
    meterKey: string;

    /** Currency */
    currency: QZPayCurrency;

    /** Pricing model */
    pricingModel: QZPayPricingModel;

    /** Pricing tiers (for tiered models) */
    tiers: QZPayPricingTier[] | null;

    /** Flat rate per unit (for per_unit model) */
    unitAmount: number | null;

    /** Minimum charge per billing period */
    minimumAmount: number | null;

    /** Maximum charge per billing period */
    maximumAmount: number | null;

    /** Whether to bill in advance or arrears */
    billingMode: 'advance' | 'arrears';

    /** When to reset usage (null = per billing period) */
    resetBehavior: 'billing_period' | 'calendar_month' | 'never' | null;

    /** Custom metadata */
    metadata: QZPayMetadata;

    /** Timestamps */
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Pricing models for metered billing
 */
export type QZPayPricingModel =
    | 'per_unit' // Fixed price per unit
    | 'tiered_graduated' // Different rates for different volume brackets (each tier priced separately)
    | 'tiered_volume' // Single rate based on total volume (all units at one tier price)
    | 'package' // Price per package of units (e.g., $10 per 1000 units)
    | 'flat_fee'; // Flat fee regardless of usage

/**
 * Pricing tier definition
 */
export interface QZPayPricingTier {
    /** First unit in this tier (inclusive) */
    upTo: number | null; // null = unlimited (last tier)

    /** Unit amount for this tier (in cents) */
    unitAmount: number;

    /** Flat amount for this tier (optional, for package pricing) */
    flatAmount: number | null;
}

/**
 * Input for recording a usage event
 */
export interface QZPayRecordUsageInput {
    /** Customer ID */
    customerId: string;

    /** Subscription ID (optional) */
    subscriptionId?: string;

    /** Meter key */
    meterKey: string;

    /** Quantity/value */
    quantity: number;

    /** When the usage occurred (defaults to now) */
    timestamp?: Date;

    /** Idempotency key */
    idempotencyKey?: string;

    /** Custom properties */
    properties?: Record<string, unknown>;
}

/**
 * Input for creating a usage meter
 */
export interface QZPayCreateUsageMeterInput {
    name: string;
    key: string;
    description?: string;
    unit: string;
    aggregationType: QZPayUsageAggregationType;
    metadata?: QZPayMetadata;
}

/**
 * Input for creating a metered price
 */
export interface QZPayCreateMeteredPriceInput {
    priceId: string;
    meterKey: string;
    currency: QZPayCurrency;
    pricingModel: QZPayPricingModel;
    tiers?: QZPayPricingTier[];
    unitAmount?: number;
    minimumAmount?: number;
    maximumAmount?: number;
    billingMode?: 'advance' | 'arrears';
    resetBehavior?: 'billing_period' | 'calendar_month' | 'never';
    metadata?: QZPayMetadata;
}

/**
 * Options for querying usage
 */
export interface QZPayQueryUsageOptions {
    /** Customer ID */
    customerId: string;

    /** Subscription ID (optional) */
    subscriptionId?: string;

    /** Meter key (optional, all meters if not specified) */
    meterKey?: string;

    /** Start of period */
    startDate: Date;

    /** End of period */
    endDate: Date;

    /** Whether to include event-level details */
    includeEvents?: boolean;
}

/**
 * Usage query result
 */
export interface QZPayUsageQueryResult {
    /** Customer */
    customerId: string;

    /** Query period */
    periodStart: Date;
    periodEnd: Date;

    /** Summaries by meter */
    summaries: QZPayUsageSummary[];

    /** Raw events (if requested) */
    events: QZPayUsageEvent[] | null;
}

/**
 * Result of calculating usage charges
 */
export interface QZPayUsageChargeResult {
    /** Customer */
    customerId: string;

    /** Subscription (if applicable) */
    subscriptionId: string | null;

    /** Billing period */
    periodStart: Date;
    periodEnd: Date;

    /** Line items for each meter */
    lineItems: QZPayUsageLineItem[];

    /** Total amount */
    totalAmount: number;

    /** Currency */
    currency: QZPayCurrency;
}

/**
 * Line item for usage charges
 */
export interface QZPayUsageLineItem {
    /** Meter key */
    meterKey: string;

    /** Description */
    description: string;

    /** Total quantity */
    quantity: number;

    /** Unit label */
    unit: string;

    /** Amount for this line */
    amount: number;

    /** Tier breakdown (if applicable) */
    tierBreakdown: QZPayTierBreakdownItem[] | null;
}

/**
 * Usage billing job configuration
 */
export interface QZPayUsageBillingJobConfig {
    /** Job name */
    name: string;

    /** Cron expression for scheduling */
    schedule: string;

    /** Subscriptions to process (null = all active metered subscriptions) */
    subscriptionIds: string[] | null;

    /** Whether to create invoices automatically */
    autoInvoice: boolean;

    /** Whether to charge payment method automatically */
    autoCharge: boolean;

    /** Grace period in hours before processing */
    gracePeriodHours: number;
}

/**
 * Usage billing job result
 */
export interface QZPayUsageBillingJobResult {
    /** Job execution ID */
    jobId: string;

    /** When the job ran */
    executedAt: Date;

    /** Number of subscriptions processed */
    processedCount: number;

    /** Number of invoices created */
    invoicesCreated: number;

    /** Number of successful charges */
    chargesSucceeded: number;

    /** Number of failed charges */
    chargesFailed: number;

    /** Errors encountered */
    errors: Array<{
        subscriptionId: string;
        customerId: string;
        error: string;
    }>;
}
