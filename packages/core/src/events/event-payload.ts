/**
 * Enhanced event payloads with detailed context
 */
import type { QZPayBillingEvent } from '../constants/index.js';
import type { QZPayEvent, QZPayEventMap } from '../types/events.types.js';
import { qzpayGenerateId } from '../utils/hash.utils.js';

/**
 * Actor information for audit trail
 */
export interface QZPayEventActor {
    type: 'system' | 'user' | 'api' | 'webhook' | 'scheduler';
    id?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
}

/**
 * Change record for tracking field modifications
 */
export interface QZPayEventChange {
    field: string;
    previousValue: unknown;
    newValue: unknown;
}

/**
 * Related entity reference
 */
export interface QZPayRelatedEntity {
    type: 'customer' | 'subscription' | 'payment' | 'invoice' | 'plan' | 'promo_code';
    id: string;
}

/**
 * Enhanced event with detailed context
 */
export interface QZPayDetailedEvent<T = unknown> extends QZPayEvent<T> {
    /** Detailed metadata */
    metadata: QZPayEventMetadata;
    /** Related entities */
    relatedEntities: QZPayRelatedEntity[];
    /** Field changes (for update events) */
    changes?: QZPayEventChange[] | undefined;
    /** Previous state (for update/delete events) */
    previousState?: Partial<T> | undefined;
}

/**
 * Event metadata with additional context
 */
export interface QZPayEventMetadata {
    /** Actor who triggered the event */
    actor?: QZPayEventActor | undefined;
    /** Request ID for tracing */
    requestId?: string | undefined;
    /** Correlation ID for related events */
    correlationId?: string | undefined;
    /** Parent event ID (for event chains) */
    parentEventId?: string | undefined;
    /** Source of the event */
    source?: string | undefined;
    /** Event version for schema compatibility */
    version: string;
    /** Processing timestamp */
    processedAt?: Date | undefined;
    /** Custom tags for filtering */
    tags?: string[] | undefined;
    /** Idempotency key */
    idempotencyKey?: string | undefined;
}

/**
 * Options for creating detailed events
 */
export interface QZPayDetailedEventOptions<T> {
    actor?: QZPayEventActor;
    requestId?: string;
    correlationId?: string;
    parentEventId?: string;
    source?: string;
    tags?: string[];
    idempotencyKey?: string;
    previousState?: Partial<T>;
    changes?: QZPayEventChange[];
    relatedEntities?: QZPayRelatedEntity[];
}

/**
 * Create a detailed event with enhanced context
 */
export function qzpayCreateDetailedEvent<K extends keyof QZPayEventMap>(
    eventType: K,
    data: QZPayEventMap[K],
    livemode: boolean,
    options: QZPayDetailedEventOptions<QZPayEventMap[K]> = {}
): QZPayDetailedEvent<QZPayEventMap[K]> {
    return {
        id: qzpayGenerateId('evt'),
        type: eventType as QZPayBillingEvent,
        data,
        livemode,
        createdAt: new Date(),
        metadata: {
            actor: options.actor,
            requestId: options.requestId,
            correlationId: options.correlationId ?? qzpayGenerateId('cor'),
            parentEventId: options.parentEventId,
            source: options.source ?? 'qzpay',
            version: '1.0',
            tags: options.tags,
            idempotencyKey: options.idempotencyKey
        },
        relatedEntities: options.relatedEntities ?? extractRelatedEntities(eventType, data),
        changes: options.changes,
        previousState: options.previousState
    };
}

/**
 * Extract related entities from event data
 */
function extractRelatedEntities<K extends keyof QZPayEventMap>(eventType: K, data: QZPayEventMap[K]): QZPayRelatedEntity[] {
    const entities: QZPayRelatedEntity[] = [];
    const dataObj = data as unknown as Record<string, unknown>;

    // Extract entity ID based on event type
    const entityType = eventType.split('.')[0] as QZPayRelatedEntity['type'];
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
    const id = dataObj['id'];
    if (id && typeof id === 'string') {
        entities.push({ type: entityType, id });
    }

    // Extract related customer
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
    const customerId = dataObj['customerId'];
    if (customerId && typeof customerId === 'string') {
        entities.push({ type: 'customer', id: customerId });
    }

    // Extract related subscription
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
    const subscriptionId = dataObj['subscriptionId'];
    if (subscriptionId && typeof subscriptionId === 'string') {
        entities.push({ type: 'subscription', id: subscriptionId });
    }

    // Extract related invoice
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
    const invoiceId = dataObj['invoiceId'];
    if (invoiceId && typeof invoiceId === 'string') {
        entities.push({ type: 'invoice', id: invoiceId });
    }

    // Extract related plan
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
    const planId = dataObj['planId'];
    if (planId && typeof planId === 'string') {
        entities.push({ type: 'plan', id: planId });
    }

    return entities;
}

/**
 * Check if two values are equal
 */
function areValuesEqual(prev: unknown, curr: unknown): boolean {
    if (prev === curr) return true;

    // Handle Date comparison
    if (prev instanceof Date && curr instanceof Date) {
        return prev.getTime() === curr.getTime();
    }

    // Handle object comparison (shallow)
    if (typeof prev === 'object' && typeof curr === 'object' && prev !== null && curr !== null) {
        return JSON.stringify(prev) === JSON.stringify(curr);
    }

    return false;
}

/**
 * Calculate changes between two states
 */
export function qzpayCalculateChanges<T extends Record<string, unknown>>(
    previousState: T,
    newState: T,
    fieldsToTrack?: string[]
): QZPayEventChange[] {
    const changes: QZPayEventChange[] = [];
    const fields = fieldsToTrack ?? Object.keys(newState);

    for (const field of fields) {
        const prev = previousState[field];
        const curr = newState[field];

        // Skip unchanged values
        if (areValuesEqual(prev, curr)) continue;

        changes.push({
            field,
            previousValue: prev,
            newValue: curr
        });
    }

    return changes;
}

/**
 * Event summary for logging/debugging
 */
export interface QZPayEventSummary {
    id: string;
    type: string;
    entityId?: string | undefined;
    entityType?: string | undefined;
    actorType?: string | undefined;
    changedFields?: string[] | undefined;
    livemode: boolean;
    createdAt: Date;
}

/**
 * Create a summary from a detailed event
 */
export function qzpayCreateEventSummary<T>(event: QZPayDetailedEvent<T>): QZPayEventSummary {
    const dataObj = event.data as unknown as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
    const id = dataObj['id'];

    return {
        id: event.id,
        type: event.type,
        entityId: typeof id === 'string' ? id : undefined,
        entityType: event.type.split('.')[0],
        actorType: event.metadata.actor?.type,
        changedFields: event.changes?.map((c) => c.field),
        livemode: event.livemode,
        createdAt: event.createdAt
    };
}

/**
 * Format event for human-readable logging
 */
export function qzpayFormatEventLog<T>(event: QZPayDetailedEvent<T>): string {
    const summary = qzpayCreateEventSummary(event);
    const parts = [
        `[${summary.type}]`,
        summary.entityId ? `entity=${summary.entityId}` : '',
        summary.actorType ? `actor=${summary.actorType}` : '',
        summary.changedFields?.length ? `changes=[${summary.changedFields.join(',')}]` : '',
        event.livemode ? '[LIVE]' : '[TEST]'
    ].filter(Boolean);

    return parts.join(' ');
}

/**
 * Serialize event to JSON with proper date handling
 */
export function qzpaySerializeEvent<T>(event: QZPayDetailedEvent<T>): string {
    return JSON.stringify(event, (_key, value) => {
        if (value instanceof Date) {
            return { __type: 'Date', value: value.toISOString() };
        }
        return value;
    });
}

/**
 * Deserialize event from JSON
 */
export function qzpayDeserializeEvent<T>(json: string): QZPayDetailedEvent<T> {
    return JSON.parse(json, (_key, value) => {
        if (value && typeof value === 'object' && value.__type === 'Date') {
            return new Date(value.value);
        }
        return value;
    }) as QZPayDetailedEvent<T>;
}
