/**
 * Limit type mappers
 *
 * Maps between Drizzle schema types and Core domain types.
 */
import type { QZPayCustomerLimit, QZPayLimit, QZPayMetadata, QZPaySetLimitInput, QZPayUsageRecord } from '@qazuor/qzpay-core';
import type {
    QZPayBillingCustomerLimit,
    QZPayBillingCustomerLimitInsert,
    QZPayBillingLimit,
    QZPayBillingLimitInsert,
    QZPayBillingUsageRecord,
    QZPayBillingUsageRecordInsert
} from '../schema/index.js';

/**
 * Map Drizzle limit definition to Core limit
 */
export function mapDrizzleLimitToCore(drizzle: QZPayBillingLimit): QZPayLimit {
    return {
        id: drizzle.id,
        key: drizzle.key,
        name: drizzle.name,
        description: drizzle.description ?? null,
        defaultValue: drizzle.defaultValue,
        createdAt: drizzle.createdAt,
        updatedAt: drizzle.updatedAt
    };
}

/**
 * Map Core limit to Drizzle insert
 */
export function mapCoreLimitToDrizzle(limit: QZPayLimit): QZPayBillingLimitInsert {
    return {
        id: limit.id,
        key: limit.key,
        name: limit.name,
        description: limit.description ?? null,
        defaultValue: limit.defaultValue
    };
}

/**
 * Map Drizzle customer limit to Core customer limit
 */
export function mapDrizzleCustomerLimitToCore(drizzle: QZPayBillingCustomerLimit): QZPayCustomerLimit {
    return {
        customerId: drizzle.customerId,
        limitKey: drizzle.limitKey,
        maxValue: drizzle.maxValue,
        currentValue: drizzle.currentValue,
        resetAt: drizzle.resetAt ?? null,
        source: drizzle.source as QZPayCustomerLimit['source'],
        sourceId: drizzle.sourceId ?? null
    };
}

/**
 * Map Core set limit input to Drizzle insert
 */
export function mapCoreSetLimitToDrizzle(input: QZPaySetLimitInput, livemode: boolean): QZPayBillingCustomerLimitInsert {
    return {
        customerId: input.customerId,
        limitKey: input.limitKey,
        maxValue: input.maxValue,
        currentValue: 0,
        resetAt: input.resetAt ?? null,
        source: input.source ?? 'manual',
        sourceId: null,
        livemode
    };
}

/**
 * Map Core set limit with source to Drizzle insert
 */
export function mapCoreSetLimitWithSourceToDrizzle(
    customerId: string,
    limitKey: string,
    maxValue: number,
    source: QZPayCustomerLimit['source'],
    sourceId: string | null,
    resetAt: Date | null,
    livemode: boolean
): QZPayBillingCustomerLimitInsert {
    return {
        customerId,
        limitKey,
        maxValue,
        currentValue: 0,
        resetAt,
        source,
        sourceId,
        livemode
    };
}

/**
 * Map Drizzle usage record to Core usage record
 */
export function mapDrizzleUsageRecordToCore(drizzle: QZPayBillingUsageRecord): QZPayUsageRecord {
    return {
        id: drizzle.id,
        customerId: drizzle.subscriptionId, // Note: mapping subscriptionId to customerId for compatibility
        limitKey: drizzle.metricName,
        quantity: drizzle.quantity,
        action: drizzle.action as QZPayUsageRecord['action'],
        timestamp: drizzle.timestamp,
        metadata: (drizzle.metadata as QZPayMetadata) ?? {}
    };
}

/**
 * Map Core usage record to Drizzle insert
 */
export function mapCoreUsageRecordToDrizzle(record: QZPayUsageRecord, subscriptionId: string): QZPayBillingUsageRecordInsert {
    return {
        id: record.id,
        subscriptionId,
        metricName: record.limitKey,
        quantity: record.quantity,
        action: record.action,
        timestamp: record.timestamp,
        metadata: record.metadata ?? {}
    };
}
