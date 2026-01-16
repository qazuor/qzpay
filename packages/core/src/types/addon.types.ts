/**
 * Add-on Types
 *
 * Types for add-on products that can be purchased alongside subscriptions.
 */

import type { QZPayBillingInterval } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

/**
 * Add-on definition
 */
export interface QZPayAddOn {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Description */
    description: string | null;

    /** Whether the add-on is currently available for purchase */
    active: boolean;

    /** Price in cents */
    unitAmount: number;

    /** Currency code (e.g., 'USD') */
    currency: string;

    /** Billing interval for recurring add-ons */
    billingInterval: QZPayBillingInterval | 'one_time';

    /** Number of intervals between billings (e.g., 1 for monthly, 3 for quarterly) */
    billingIntervalCount: number;

    /** Plan IDs this add-on is compatible with (empty = compatible with all) */
    compatiblePlanIds: string[];

    /** Whether this add-on can be purchased multiple times */
    allowMultiple: boolean;

    /** Maximum quantity allowed per subscription (null = unlimited) */
    maxQuantity: number | null;

    /** Features/entitlements granted by this add-on */
    entitlements: string[];

    /** Limits granted/modified by this add-on */
    limits: Array<{
        key: string;
        value: number;
        action: 'set' | 'increment';
    }>;

    /** Custom metadata */
    metadata: QZPayMetadata;

    /** Timestamps */
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Subscription add-on (an add-on attached to a subscription)
 */
export interface QZPaySubscriptionAddOn {
    /** Unique identifier */
    id: string;

    /** Subscription this add-on is attached to */
    subscriptionId: string;

    /** Add-on definition ID */
    addOnId: string;

    /** Quantity purchased */
    quantity: number;

    /** Price at time of purchase (in cents) */
    unitAmount: number;

    /** Currency */
    currency: string;

    /** Status */
    status: 'active' | 'canceled' | 'pending';

    /** When the add-on was added */
    addedAt: Date;

    /** When the add-on was canceled (if applicable) */
    canceledAt: Date | null;

    /** When the add-on expires (for one-time add-ons with expiration) */
    expiresAt: Date | null;

    /** Custom metadata */
    metadata: QZPayMetadata;

    /** Timestamps */
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Input for creating an add-on
 */
export interface QZPayCreateAddOnInput {
    id?: string;
    name: string;
    description?: string;
    unitAmount: number;
    currency: string;
    billingInterval: QZPayBillingInterval | 'one_time';
    billingIntervalCount?: number;
    compatiblePlanIds?: string[];
    allowMultiple?: boolean;
    maxQuantity?: number;
    entitlements?: string[];
    limits?: Array<{
        key: string;
        value: number;
        action: 'set' | 'increment';
    }>;
    metadata?: QZPayMetadata;
}

/**
 * Input for updating an add-on
 */
export interface QZPayUpdateAddOnInput {
    name?: string;
    description?: string;
    unitAmount?: number;
    active?: boolean;
    compatiblePlanIds?: string[];
    allowMultiple?: boolean;
    maxQuantity?: number;
    entitlements?: string[];
    limits?: Array<{
        key: string;
        value: number;
        action: 'set' | 'increment';
    }>;
    metadata?: QZPayMetadata;
}

/**
 * Input for adding an add-on to a subscription
 */
export interface QZPayAddSubscriptionAddOnInput {
    subscriptionId: string;
    addOnId: string;
    quantity?: number;
    metadata?: QZPayMetadata;
}

/**
 * Result of adding an add-on to a subscription
 */
export interface QZPayAddSubscriptionAddOnResult {
    subscriptionAddOn: QZPaySubscriptionAddOn;
    /** Proration amount if applicable (negative = credit, positive = charge) */
    prorationAmount: number | null;
}
