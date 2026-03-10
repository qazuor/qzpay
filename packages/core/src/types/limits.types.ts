/**
 * Limits types for QZPay (usage-based billing)
 */

import type { QZPayMetadata, QZPaySourceType } from './common.types.js';

export interface QZPayLimit {
    id: string;
    key: string;
    name: string;
    description: string | null;
    defaultValue: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface QZPayCustomerLimit {
    customerId: string;
    limitKey: string;
    maxValue: number;
    currentValue: number;
    resetAt: Date | null;
    source: QZPaySourceType;
    sourceId: string | null;
}

export interface QZPayLimitCheck {
    customerId: string;
    limitKey: string;
    maxValue: number;
    currentValue: number;
    remaining: number;
    isExceeded: boolean;
    resetAt: Date | null;
}

export interface QZPayIncrementLimitInput {
    customerId: string;
    limitKey: string;
    incrementBy?: number;
}

export interface QZPaySetLimitInput {
    customerId: string;
    limitKey: string;
    maxValue: number;
    resetAt?: Date;
    /** Source type for the limit. Defaults to 'manual' in mapper if not provided. */
    source?: QZPaySourceType;
    /**
     * ID of the source entity that set this limit.
     * Must be a valid UUID. The DB column is uuid type and will reject non-UUID values at runtime.
     * Typically the QZPaySubscriptionAddOn.id.
     */
    sourceId?: string;
}

export interface QZPayUsageRecord {
    id: string;
    customerId: string;
    limitKey: string;
    quantity: number;
    action: 'increment' | 'decrement' | 'set';
    timestamp: Date;
    metadata: QZPayMetadata;
}
