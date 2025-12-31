/**
 * Limits types for QZPay (usage-based billing)
 */

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
    source: 'subscription' | 'purchase' | 'manual';
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
    source?: 'manual';
}

export interface QZPayUsageRecord {
    id: string;
    customerId: string;
    limitKey: string;
    quantity: number;
    action: 'increment' | 'decrement' | 'set';
    timestamp: Date;
    metadata: Record<string, unknown>;
}
