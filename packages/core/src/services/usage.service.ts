/**
 * Usage-Based Billing Service for QZPay
 *
 * Provides utilities for recording usage events, querying usage data,
 * calculating charges, and running usage billing jobs.
 */
import type { QZPayCurrency } from '../constants/index.js';
import {
    qzpayCalculateTieredAmount,
    qzpayCreateUsageSummary,
    qzpayGetBillingPeriod,
    qzpayValidateUsageEvent
} from '../helpers/usage.helper.js';
import type {
    QZPayCreateMeteredPriceInput,
    QZPayCreateUsageMeterInput,
    QZPayMeteredPrice,
    QZPayPricingTier,
    QZPayQueryUsageOptions,
    QZPayRecordUsageInput,
    QZPayUsageBillingJobConfig,
    QZPayUsageBillingJobResult,
    QZPayUsageChargeResult,
    QZPayUsageEvent,
    QZPayUsageLineItem,
    QZPayUsageMeter,
    QZPayUsageQueryResult,
    QZPayUsageSummary
} from '../types/usage.types.js';
import { qzpayGenerateId } from '../utils/hash.utils.js';

// ==================== Types ====================

/**
 * Usage service configuration
 */
export interface QZPayUsageServiceConfig {
    /** Default currency for usage charges */
    defaultCurrency?: QZPayCurrency;

    /** Default aggregation type for new meters */
    defaultAggregationType?: 'sum' | 'max' | 'last' | 'count';

    /** Whether to deduplicate events by idempotency key */
    enableIdempotency?: boolean;

    /** How long to keep idempotency keys (in hours) */
    idempotencyTTLHours?: number;

    /** Grace period before processing usage (in hours) */
    gracePeriodHours?: number;
}

/**
 * Usage storage interface (to be implemented by storage adapters)
 */
export interface QZPayUsageStorage {
    // Meter operations
    createMeter(meter: QZPayUsageMeter): Promise<QZPayUsageMeter>;
    getMeter(key: string): Promise<QZPayUsageMeter | null>;
    listMeters(): Promise<QZPayUsageMeter[]>;
    updateMeter(key: string, update: Partial<QZPayUsageMeter>): Promise<QZPayUsageMeter>;

    // Metered price operations
    createMeteredPrice(price: QZPayMeteredPrice): Promise<QZPayMeteredPrice>;
    getMeteredPrice(priceId: string): Promise<QZPayMeteredPrice | null>;
    getMeteredPriceByMeter(meterKey: string): Promise<QZPayMeteredPrice | null>;

    // Event operations
    recordEvent(event: QZPayUsageEvent): Promise<QZPayUsageEvent>;
    getEvents(customerId: string, meterKey: string, startDate: Date, endDate: Date): Promise<QZPayUsageEvent[]>;
    checkIdempotencyKey(key: string): Promise<boolean>;
    saveIdempotencyKey(key: string, ttlHours: number): Promise<void>;

    // Summary operations
    saveSummary(summary: QZPayUsageSummary): Promise<void>;
    getSummary(customerId: string, meterKey: string, periodStart: Date, periodEnd: Date): Promise<QZPayUsageSummary | null>;
}

// ==================== Service Functions ====================

/**
 * Create a new usage meter
 */
export function qzpayCreateUsageMeter(input: QZPayCreateUsageMeterInput): QZPayUsageMeter {
    const now = new Date();
    return {
        id: qzpayGenerateId(),
        name: input.name,
        key: input.key,
        description: input.description ?? null,
        unit: input.unit,
        aggregationType: input.aggregationType,
        active: true,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Create a new metered price
 */
export function qzpayCreateMeteredPrice(input: QZPayCreateMeteredPriceInput): QZPayMeteredPrice {
    const now = new Date();
    return {
        priceId: input.priceId,
        meterKey: input.meterKey,
        currency: input.currency,
        pricingModel: input.pricingModel,
        tiers: input.tiers ?? null,
        unitAmount: input.unitAmount ?? null,
        minimumAmount: input.minimumAmount ?? null,
        maximumAmount: input.maximumAmount ?? null,
        billingMode: input.billingMode ?? 'arrears',
        resetBehavior: input.resetBehavior ?? null,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Record a usage event
 */
export function qzpayRecordUsageEvent(input: QZPayRecordUsageInput): { event: QZPayUsageEvent; errors: string[] } {
    const validation = qzpayValidateUsageEvent({
        customerId: input.customerId,
        meterKey: input.meterKey,
        quantity: input.quantity
    });

    if (!validation.valid) {
        return {
            event: null as unknown as QZPayUsageEvent,
            errors: validation.errors
        };
    }

    const event: QZPayUsageEvent = {
        id: qzpayGenerateId(),
        customerId: input.customerId,
        subscriptionId: input.subscriptionId ?? null,
        meterKey: input.meterKey,
        quantity: input.quantity,
        timestamp: input.timestamp ?? new Date(),
        idempotencyKey: input.idempotencyKey ?? null,
        properties: input.properties ?? {},
        createdAt: new Date()
    };

    return { event, errors: [] };
}

/**
 * Query usage for a customer
 */
export function qzpayQueryUsage(
    events: QZPayUsageEvent[],
    meters: QZPayUsageMeter[],
    prices: QZPayMeteredPrice[],
    options: QZPayQueryUsageOptions
): QZPayUsageQueryResult {
    // Group events by meter
    const eventsByMeter = new Map<string, QZPayUsageEvent[]>();

    for (const event of events) {
        if (options.meterKey && event.meterKey !== options.meterKey) {
            continue;
        }
        if (event.timestamp < options.startDate || event.timestamp > options.endDate) {
            continue;
        }
        if (options.subscriptionId && event.subscriptionId !== options.subscriptionId) {
            continue;
        }

        const existing = eventsByMeter.get(event.meterKey) ?? [];
        existing.push(event);
        eventsByMeter.set(event.meterKey, existing);
    }

    // Create summaries
    const summaries: QZPayUsageSummary[] = [];

    for (const [meterKey, meterEvents] of eventsByMeter) {
        const meter = meters.find((m) => m.key === meterKey);
        const price = prices.find((p) => p.meterKey === meterKey);

        if (!meter || !price) {
            continue;
        }

        const summary = qzpayCreateUsageSummary(
            options.customerId,
            options.subscriptionId ?? null,
            meterKey,
            meterEvents,
            meter,
            price,
            options.startDate,
            options.endDate
        );
        summaries.push(summary);
    }

    return {
        customerId: options.customerId,
        periodStart: options.startDate,
        periodEnd: options.endDate,
        summaries,
        events: options.includeEvents ? events : null
    };
}

/**
 * Calculate charges for usage
 */
export function qzpayCalculateUsageCharges(
    summaries: QZPayUsageSummary[],
    meters: QZPayUsageMeter[],
    currency: QZPayCurrency
): QZPayUsageChargeResult {
    const lineItems: QZPayUsageLineItem[] = [];
    let totalAmount = 0;

    for (const summary of summaries) {
        const meter = meters.find((m) => m.key === summary.meterKey);
        if (!meter) continue;

        lineItems.push({
            meterKey: summary.meterKey,
            description: `${meter.name} usage`,
            quantity: summary.aggregatedValue,
            unit: meter.unit,
            amount: summary.amount,
            tierBreakdown: summary.tierBreakdown
        });

        totalAmount += summary.amount;
    }

    const customerId = summaries[0]?.customerId ?? '';
    const subscriptionId = summaries[0]?.subscriptionId ?? null;
    const periodStart = summaries[0]?.periodStart ?? new Date();
    const periodEnd = summaries[0]?.periodEnd ?? new Date();

    return {
        customerId,
        subscriptionId,
        periodStart,
        periodEnd,
        lineItems,
        totalAmount,
        currency
    };
}

/**
 * Create default pricing tiers (for common pricing patterns)
 */
export function qzpayCreateGraduatedTiers(tiers: Array<{ upTo: number | null; pricePerUnit: number }>): QZPayPricingTier[] {
    return tiers.map((tier) => ({
        upTo: tier.upTo,
        unitAmount: tier.pricePerUnit,
        flatAmount: null
    }));
}

/**
 * Create volume-based pricing tiers
 */
export function qzpayCreateVolumeTiers(tiers: Array<{ upTo: number | null; pricePerUnit: number }>): QZPayPricingTier[] {
    return tiers.map((tier) => ({
        upTo: tier.upTo,
        unitAmount: tier.pricePerUnit,
        flatAmount: null
    }));
}

/**
 * Create package pricing (e.g., $10 per 1000 units)
 */
export function qzpayCreatePackagePricing(packageSize: number, packagePrice: number): QZPayPricingTier[] {
    return [
        {
            upTo: packageSize,
            unitAmount: 0,
            flatAmount: packagePrice
        }
    ];
}

/**
 * Estimate usage charges for a projected quantity
 */
export function qzpayEstimateUsageCharge(
    projectedQuantity: number,
    price: QZPayMeteredPrice
): { amount: number; breakdown: Array<{ tier: number; quantity: number; amount: number }> } {
    const { amount, breakdown } = qzpayCalculateTieredAmount(projectedQuantity, price);

    return {
        amount,
        breakdown: breakdown.map((item) => ({
            tier: item.tierIndex,
            quantity: item.quantity,
            amount: item.amount
        }))
    };
}

/**
 * Create a usage billing job configuration
 */
export function qzpayCreateUsageBillingJobConfig(
    name: string,
    options: Partial<QZPayUsageBillingJobConfig> = {}
): QZPayUsageBillingJobConfig {
    return {
        name,
        schedule: options.schedule ?? '0 0 * * *', // Daily at midnight
        subscriptionIds: options.subscriptionIds ?? null,
        autoInvoice: options.autoInvoice ?? true,
        autoCharge: options.autoCharge ?? false,
        gracePeriodHours: options.gracePeriodHours ?? 24
    };
}

/**
 * Process usage billing for subscriptions (job handler)
 */
export async function qzpayProcessUsageBilling(
    subscriptions: Array<{
        id: string;
        customerId: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
    }>,
    getUsageEvents: (customerId: string, startDate: Date, endDate: Date) => Promise<QZPayUsageEvent[]>,
    meters: QZPayUsageMeter[],
    prices: QZPayMeteredPrice[],
    createInvoice: (customerId: string, charges: QZPayUsageChargeResult) => Promise<{ id: string }>,
    config: QZPayUsageBillingJobConfig
): Promise<QZPayUsageBillingJobResult> {
    const jobId = qzpayGenerateId();
    const executedAt = new Date();
    const errors: QZPayUsageBillingJobResult['errors'] = [];
    let invoicesCreated = 0;
    let chargesSucceeded = 0;
    let chargesFailed = 0;

    for (const subscription of subscriptions) {
        try {
            // Get usage events for this billing period
            const events = await getUsageEvents(subscription.customerId, subscription.currentPeriodStart, subscription.currentPeriodEnd);

            if (events.length === 0) {
                continue; // No usage, skip
            }

            // Calculate charges
            const queryResult = qzpayQueryUsage(events, meters, prices, {
                customerId: subscription.customerId,
                subscriptionId: subscription.id,
                startDate: subscription.currentPeriodStart,
                endDate: subscription.currentPeriodEnd
            });

            if (queryResult.summaries.length === 0) {
                continue; // No charges
            }

            const charges = qzpayCalculateUsageCharges(queryResult.summaries, meters, queryResult.summaries[0]?.currency ?? 'USD');

            if (charges.totalAmount === 0) {
                continue; // No charges
            }

            // Create invoice if configured
            if (config.autoInvoice) {
                await createInvoice(subscription.customerId, charges);
                invoicesCreated++;
            }

            chargesSucceeded++;
        } catch (error) {
            chargesFailed++;
            errors.push({
                subscriptionId: subscription.id,
                customerId: subscription.customerId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    return {
        jobId,
        executedAt,
        processedCount: subscriptions.length,
        invoicesCreated,
        chargesSucceeded,
        chargesFailed,
        errors
    };
}

/**
 * Get usage billing period for a subscription
 */
export function qzpayGetUsageBillingPeriod(
    subscriptionStart: Date,
    billingInterval: 'day' | 'week' | 'month' | 'year',
    intervalCount: number
): { periodStart: Date; periodEnd: Date } {
    return qzpayGetBillingPeriod(subscriptionStart, billingInterval, intervalCount);
}

/**
 * Validate basic price fields
 */
function validateBasicPriceFields(price: QZPayMeteredPrice, errors: string[]): void {
    if (!price.priceId) {
        errors.push('Price ID is required');
    }

    if (!price.meterKey) {
        errors.push('Meter key is required');
    }

    if (!price.currency) {
        errors.push('Currency is required');
    }

    if (!price.pricingModel) {
        errors.push('Pricing model is required');
    }
}

/**
 * Validate pricing model requirements
 */
function validatePricingModel(price: QZPayMeteredPrice, errors: string[]): void {
    if (price.pricingModel === 'per_unit' && price.unitAmount === null) {
        errors.push('Unit amount is required for per_unit pricing');
    }

    if (
        (price.pricingModel === 'tiered_graduated' || price.pricingModel === 'tiered_volume') &&
        (!price.tiers || price.tiers.length === 0)
    ) {
        errors.push('Tiers are required for tiered pricing');
    }
}

/**
 * Validate price tiers
 */
function validatePriceTiers(tiers: QZPayPricingTier[], errors: string[]): void {
    let previousUpTo = 0;
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!tier) continue;

        if (tier.upTo !== null && tier.upTo <= previousUpTo) {
            errors.push(`Tier ${i + 1}: upTo must be greater than previous tier`);
        }

        if (tier.unitAmount < 0) {
            errors.push(`Tier ${i + 1}: unitAmount cannot be negative`);
        }

        if (tier.upTo !== null) {
            previousUpTo = tier.upTo;
        }
    }

    // Last tier should be unlimited
    const lastTier = tiers[tiers.length - 1];
    if (lastTier && lastTier.upTo !== null) {
        errors.push('Last tier should have upTo set to null (unlimited)');
    }
}

/**
 * Validate amount limits
 */
function validateAmountLimits(price: QZPayMeteredPrice, errors: string[]): void {
    if (price.minimumAmount !== null && price.minimumAmount < 0) {
        errors.push('Minimum amount cannot be negative');
    }

    if (price.maximumAmount !== null && price.maximumAmount < 0) {
        errors.push('Maximum amount cannot be negative');
    }

    if (price.minimumAmount !== null && price.maximumAmount !== null && price.minimumAmount > price.maximumAmount) {
        errors.push('Minimum amount cannot exceed maximum amount');
    }
}

/**
 * Validate a metered price configuration
 */
export function qzpayValidateMeteredPrice(price: QZPayMeteredPrice): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    validateBasicPriceFields(price, errors);
    validatePricingModel(price, errors);

    if (price.tiers) {
        validatePriceTiers(price.tiers, errors);
    }

    validateAmountLimits(price, errors);

    return { valid: errors.length === 0, errors };
}
