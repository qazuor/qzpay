/**
 * Event filtering utilities
 */
import type { QZPayBillingEvent } from '../constants/index.js';
import type { QZPayEvent } from '../types/events.types.js';
import { qzpayMatchesEventPattern } from './event-handler.js';
import type { QZPayDetailedEvent, QZPayRelatedEntity } from './event-payload.js';

/**
 * Filter criteria for querying events
 */
export interface QZPayEventFilterCriteria {
    /** Event types to include (supports wildcards) */
    types?: string[];
    /** Event types to exclude (supports wildcards) */
    excludeTypes?: string[];
    /** Filter by entity type */
    entityTypes?: QZPayRelatedEntity['type'][];
    /** Filter by specific entity IDs */
    entityIds?: string[];
    /** Filter by customer ID */
    customerId?: string;
    /** Filter by subscription ID */
    subscriptionId?: string;
    /** Filter events created after this date */
    createdAfter?: Date;
    /** Filter events created before this date */
    createdBefore?: Date;
    /** Filter by livemode */
    livemode?: boolean;
    /** Filter by tags (any match) */
    tags?: string[];
    /** Filter by actor type */
    actorTypes?: ('system' | 'user' | 'api' | 'webhook' | 'scheduler')[];
    /** Filter by correlation ID */
    correlationId?: string;
    /** Filter by source */
    source?: string;
    /** Custom predicate function */
    predicate?: (event: QZPayEvent) => boolean;
}

/**
 * Event filter builder for fluent API
 */
export class QZPayEventFilter {
    private criteria: QZPayEventFilterCriteria = {};

    /**
     * Filter by event types (supports wildcards like "subscription.*")
     */
    types(...types: string[]): this {
        this.criteria.types = types;
        return this;
    }

    /**
     * Exclude event types (supports wildcards)
     */
    excludeTypes(...types: string[]): this {
        this.criteria.excludeTypes = types;
        return this;
    }

    /**
     * Filter by entity types
     */
    entityTypes(...types: QZPayRelatedEntity['type'][]): this {
        this.criteria.entityTypes = types;
        return this;
    }

    /**
     * Filter by entity IDs
     */
    entityIds(...ids: string[]): this {
        this.criteria.entityIds = ids;
        return this;
    }

    /**
     * Filter by customer ID
     */
    forCustomer(customerId: string): this {
        this.criteria.customerId = customerId;
        return this;
    }

    /**
     * Filter by subscription ID
     */
    forSubscription(subscriptionId: string): this {
        this.criteria.subscriptionId = subscriptionId;
        return this;
    }

    /**
     * Filter by date range
     */
    dateRange(start?: Date, end?: Date): this {
        if (start) this.criteria.createdAfter = start;
        if (end) this.criteria.createdBefore = end;
        return this;
    }

    /**
     * Filter events created after a date
     */
    after(date: Date): this {
        this.criteria.createdAfter = date;
        return this;
    }

    /**
     * Filter events created before a date
     */
    before(date: Date): this {
        this.criteria.createdBefore = date;
        return this;
    }

    /**
     * Filter by last N hours
     */
    lastHours(hours: number): this {
        this.criteria.createdAfter = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this;
    }

    /**
     * Filter by last N days
     */
    lastDays(days: number): this {
        this.criteria.createdAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return this;
    }

    /**
     * Filter live mode events only
     */
    liveModeOnly(): this {
        this.criteria.livemode = true;
        return this;
    }

    /**
     * Filter test mode events only
     */
    testModeOnly(): this {
        this.criteria.livemode = false;
        return this;
    }

    /**
     * Filter by tags
     */
    withTags(...tags: string[]): this {
        this.criteria.tags = tags;
        return this;
    }

    /**
     * Filter by actor types
     */
    byActors(...types: ('system' | 'user' | 'api' | 'webhook' | 'scheduler')[]): this {
        this.criteria.actorTypes = types;
        return this;
    }

    /**
     * Filter by correlation ID
     */
    withCorrelation(correlationId: string): this {
        this.criteria.correlationId = correlationId;
        return this;
    }

    /**
     * Filter by source
     */
    fromSource(source: string): this {
        this.criteria.source = source;
        return this;
    }

    /**
     * Add custom predicate
     */
    where(predicate: (event: QZPayEvent) => boolean): this {
        this.criteria.predicate = predicate;
        return this;
    }

    /**
     * Get the filter criteria
     */
    getCriteria(): QZPayEventFilterCriteria {
        return { ...this.criteria };
    }

    /**
     * Create a matcher function from the criteria
     */
    toMatcher(): (event: QZPayEvent) => boolean {
        return qzpayCreateEventMatcher(this.criteria);
    }

    /**
     * Filter an array of events
     */
    apply<T extends QZPayEvent>(events: T[]): T[] {
        const matcher = this.toMatcher();
        return events.filter(matcher);
    }

    /**
     * Reset the filter
     */
    reset(): this {
        this.criteria = {};
        return this;
    }
}

/**
 * Create a new event filter builder
 */
export function qzpayCreateEventFilter(): QZPayEventFilter {
    return new QZPayEventFilter();
}

/**
 * Create a matcher function from filter criteria
 */
export function qzpayCreateEventMatcher(criteria: QZPayEventFilterCriteria): (event: QZPayEvent) => boolean {
    return (event: QZPayEvent): boolean => {
        // Type filter
        if (criteria.types && criteria.types.length > 0) {
            const matches = criteria.types.some((pattern) => qzpayMatchesEventPattern(event.type, pattern));
            if (!matches) return false;
        }

        // Exclude types filter
        if (criteria.excludeTypes && criteria.excludeTypes.length > 0) {
            const excluded = criteria.excludeTypes.some((pattern) => qzpayMatchesEventPattern(event.type, pattern));
            if (excluded) return false;
        }

        // Date range filter
        if (criteria.createdAfter && event.createdAt < criteria.createdAfter) {
            return false;
        }
        if (criteria.createdBefore && event.createdAt > criteria.createdBefore) {
            return false;
        }

        // Livemode filter
        if (criteria.livemode !== undefined && event.livemode !== criteria.livemode) {
            return false;
        }

        // Data-based filters
        const data = event.data as Record<string, unknown>;

        // Customer ID filter
        if (criteria.customerId && data['customerId'] !== criteria.customerId) {
            // Also check if the event is a customer event with matching id
            if (data['id'] !== criteria.customerId || !event.type.startsWith('customer.')) {
                return false;
            }
        }

        // Subscription ID filter
        if (criteria.subscriptionId && data['subscriptionId'] !== criteria.subscriptionId) {
            // Also check if the event is a subscription event with matching id
            if (data['id'] !== criteria.subscriptionId || !event.type.startsWith('subscription.')) {
                return false;
            }
        }

        // Entity type filter
        if (criteria.entityTypes && criteria.entityTypes.length > 0) {
            const eventEntityType = event.type.split('.')[0] as QZPayRelatedEntity['type'];
            if (!criteria.entityTypes.includes(eventEntityType)) {
                return false;
            }
        }

        // Entity ID filter
        if (criteria.entityIds && criteria.entityIds.length > 0) {
            const entityId = data['id'] as string | undefined;
            if (!entityId || !criteria.entityIds.includes(entityId)) {
                return false;
            }
        }

        // Check detailed event metadata
        const detailedEvent = event as QZPayDetailedEvent;
        if (detailedEvent.metadata) {
            // Tags filter (any match)
            if (criteria.tags && criteria.tags.length > 0) {
                const eventTags = detailedEvent.metadata.tags ?? [];
                const hasTag = criteria.tags.some((tag) => eventTags.includes(tag));
                if (!hasTag) return false;
            }

            // Actor type filter
            if (criteria.actorTypes && criteria.actorTypes.length > 0) {
                const actorType = detailedEvent.metadata.actor?.type;
                if (!actorType || !criteria.actorTypes.includes(actorType)) {
                    return false;
                }
            }

            // Correlation ID filter
            if (criteria.correlationId && detailedEvent.metadata.correlationId !== criteria.correlationId) {
                return false;
            }

            // Source filter
            if (criteria.source && detailedEvent.metadata.source !== criteria.source) {
                return false;
            }
        }

        // Custom predicate
        if (criteria.predicate && !criteria.predicate(event)) {
            return false;
        }

        return true;
    };
}

/**
 * Subscription event filter shortcut
 */
export function qzpaySubscriptionEvents(): QZPayEventFilter {
    return qzpayCreateEventFilter().types('subscription.*');
}

/**
 * Payment event filter shortcut
 */
export function qzpayPaymentEvents(): QZPayEventFilter {
    return qzpayCreateEventFilter().types('payment.*');
}

/**
 * Invoice event filter shortcut
 */
export function qzpayInvoiceEvents(): QZPayEventFilter {
    return qzpayCreateEventFilter().types('invoice.*');
}

/**
 * Customer event filter shortcut
 */
export function qzpayCustomerEvents(): QZPayEventFilter {
    return qzpayCreateEventFilter().types('customer.*');
}

/**
 * Failure event filter shortcut
 */
export function qzpayFailureEvents(): QZPayEventFilter {
    return qzpayCreateEventFilter().types('payment.failed', 'invoice.payment_failed');
}

/**
 * Filter events by event pattern
 */
export function qzpayFilterEventsByPattern<T extends QZPayEvent>(events: T[], pattern: string): T[] {
    return events.filter((event) => qzpayMatchesEventPattern(event.type, pattern));
}

/**
 * Group events by type
 */
export function qzpayGroupEventsByType<T extends QZPayEvent>(events: T[]): Map<QZPayBillingEvent, T[]> {
    const groups = new Map<QZPayBillingEvent, T[]>();

    for (const event of events) {
        const existing = groups.get(event.type) ?? [];
        existing.push(event);
        groups.set(event.type, existing);
    }

    return groups;
}

/**
 * Group events by entity ID
 */
export function qzpayGroupEventsByEntity<T extends QZPayEvent>(events: T[]): Map<string, T[]> {
    const groups = new Map<string, T[]>();

    for (const event of events) {
        const data = event.data as Record<string, unknown>;
        const entityId = data['id'] as string | undefined;
        if (!entityId) continue;

        const existing = groups.get(entityId) ?? [];
        existing.push(event);
        groups.set(entityId, existing);
    }

    return groups;
}

/**
 * Sort events by creation date
 */
export function qzpaySortEventsByDate<T extends QZPayEvent>(events: T[], order: 'asc' | 'desc' = 'asc'): T[] {
    return [...events].sort((a, b) => {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        return order === 'asc' ? diff : -diff;
    });
}
