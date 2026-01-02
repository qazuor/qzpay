/**
 * Event store and replay capabilities
 */
import type { QZPayEvent, QZPayEventMap } from '../types/events.types.js';
import type { QZPayEventEmitter } from './event-emitter.js';
import type { QZPayEventFilterCriteria } from './event-filter.js';
import { qzpayCreateEventMatcher, qzpaySortEventsByDate } from './event-filter.js';

/**
 * Event storage options
 */
export interface QZPayEventStoreOptions {
    /** Maximum number of events to store (0 = unlimited) */
    maxEvents?: number;
    /** Maximum age of events in milliseconds (0 = unlimited) */
    maxAge?: number;
    /** Enable automatic cleanup */
    autoCleanup?: boolean;
    /** Cleanup interval in milliseconds */
    cleanupInterval?: number;
}

/**
 * Replay options
 */
export interface QZPayEventReplayOptions {
    /** Filter criteria for events to replay */
    filter?: QZPayEventFilterCriteria;
    /** Replay speed multiplier (1 = real-time, 0 = instant) */
    speed?: number;
    /** Maximum number of events to replay */
    limit?: number;
    /** Start from this event ID */
    startAfter?: string;
    /** Callback before each event */
    onBeforeReplay?: (event: QZPayEvent) => void | Promise<void>;
    /** Callback after each event */
    onAfterReplay?: (event: QZPayEvent, success: boolean, error?: Error) => void | Promise<void>;
    /** Stop on error */
    stopOnError?: boolean;
}

/**
 * Replay result
 */
export interface QZPayEventReplayResult {
    total: number;
    replayed: number;
    succeeded: number;
    failed: number;
    skipped: number;
    errors: Array<{ eventId: string; error: Error }>;
    duration: number;
}

/**
 * In-memory event store for development/testing
 */
export class QZPayInMemoryEventStore {
    private events: QZPayEvent[] = [];
    private readonly options: Required<QZPayEventStoreOptions>;
    private cleanupTimer: ReturnType<typeof setInterval> | undefined;

    constructor(options: QZPayEventStoreOptions = {}) {
        this.options = {
            maxEvents: options.maxEvents ?? 10000,
            maxAge: options.maxAge ?? 24 * 60 * 60 * 1000, // 24 hours
            autoCleanup: options.autoCleanup ?? true,
            cleanupInterval: options.cleanupInterval ?? 60000 // 1 minute
        };

        if (this.options.autoCleanup) {
            this.startCleanup();
        }
    }

    /**
     * Store an event
     */
    store<T>(event: QZPayEvent<T>): void {
        this.events.push(event as QZPayEvent);
        this.enforceMaxEvents();
    }

    /**
     * Get all events
     */
    getAll(): QZPayEvent[] {
        return [...this.events];
    }

    /**
     * Get event by ID
     */
    getById(eventId: string): QZPayEvent | undefined {
        return this.events.find((e) => e.id === eventId);
    }

    /**
     * Query events with filter criteria
     */
    query(criteria: QZPayEventFilterCriteria): QZPayEvent[] {
        const matcher = qzpayCreateEventMatcher(criteria);
        return this.events.filter(matcher);
    }

    /**
     * Get events for a specific entity
     */
    getByEntity(entityType: string, entityId: string): QZPayEvent[] {
        return this.events.filter((event) => {
            // Check event type prefix
            if (!event.type.startsWith(`${entityType}.`)) {
                return false;
            }
            // Check entity ID in data
            const data = event.data as Record<string, unknown>;
            // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
            return data['id'] === entityId;
        });
    }

    /**
     * Get events for a customer
     */
    getByCustomer(customerId: string): QZPayEvent[] {
        return this.events.filter((event) => {
            const data = event.data as Record<string, unknown>;
            // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
            return data['customerId'] === customerId || (event.type.startsWith('customer.') && data['id'] === customerId);
        });
    }

    /**
     * Get events in date range
     */
    getByDateRange(start: Date, end: Date): QZPayEvent[] {
        return this.events.filter((event) => {
            return event.createdAt >= start && event.createdAt <= end;
        });
    }

    /**
     * Get count of stored events
     */
    count(): number {
        return this.events.length;
    }

    /**
     * Clear all events
     */
    clear(): void {
        this.events = [];
    }

    /**
     * Remove old events based on maxAge
     */
    cleanup(): number {
        const now = Date.now();
        const initialCount = this.events.length;

        this.events = this.events.filter((event) => {
            const age = now - event.createdAt.getTime();
            return age <= this.options.maxAge;
        });

        return initialCount - this.events.length;
    }

    /**
     * Stop automatic cleanup
     */
    stopCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }

    /**
     * Destroy the store
     */
    destroy(): void {
        this.stopCleanup();
        this.clear();
    }

    private enforceMaxEvents(): void {
        if (this.options.maxEvents > 0 && this.events.length > this.options.maxEvents) {
            // Remove oldest events
            const excess = this.events.length - this.options.maxEvents;
            this.events.splice(0, excess);
        }
    }

    private startCleanup(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.options.cleanupInterval);
    }
}

/**
 * Event replayer for re-processing stored events
 */
export class QZPayEventReplayer {
    constructor(
        private readonly emitter: QZPayEventEmitter,
        private readonly store: QZPayInMemoryEventStore
    ) {}

    /**
     * Replay events to the emitter
     */
    async replay(options: QZPayEventReplayOptions = {}): Promise<QZPayEventReplayResult> {
        const startTime = Date.now();
        const result: QZPayEventReplayResult = {
            total: 0,
            replayed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            duration: 0
        };

        // Get events to replay
        let events = options.filter ? this.store.query(options.filter) : this.store.getAll();

        // Sort by creation date
        events = qzpaySortEventsByDate(events, 'asc');

        // Apply startAfter
        if (options.startAfter) {
            const startIndex = events.findIndex((e) => e.id === options.startAfter);
            if (startIndex !== -1) {
                events = events.slice(startIndex + 1);
            }
        }

        // Apply limit
        if (options.limit && options.limit > 0) {
            events = events.slice(0, options.limit);
        }

        result.total = events.length;

        // Replay events
        let previousTime = events[0]?.createdAt.getTime() ?? Date.now();

        for (const event of events) {
            // Calculate delay for real-time replay
            if (options.speed && options.speed > 0) {
                const timeDiff = event.createdAt.getTime() - previousTime;
                const delay = timeDiff / options.speed;
                if (delay > 0) {
                    await this.sleep(delay);
                }
                previousTime = event.createdAt.getTime();
            }

            // Before callback
            if (options.onBeforeReplay) {
                await options.onBeforeReplay(event);
            }

            // Replay the event
            let success = false;
            let error: Error | undefined;

            try {
                await this.emitter.emit(event.type as keyof QZPayEventMap, event.data as QZPayEventMap[keyof QZPayEventMap]);
                success = true;
                result.succeeded++;
            } catch (e) {
                error = e instanceof Error ? e : new Error(String(e));
                result.errors.push({ eventId: event.id, error });
                result.failed++;

                if (options.stopOnError) {
                    result.skipped = result.total - result.replayed - 1;
                    break;
                }
            }

            result.replayed++;

            // After callback
            if (options.onAfterReplay) {
                await options.onAfterReplay(event, success, error);
            }
        }

        result.duration = Date.now() - startTime;
        return result;
    }

    /**
     * Replay a single event by ID
     */
    async replayById(eventId: string): Promise<boolean> {
        const event = this.store.getById(eventId);
        if (!event) {
            return false;
        }

        await this.emitter.emit(event.type as keyof QZPayEventMap, event.data as QZPayEventMap[keyof QZPayEventMap]);
        return true;
    }

    /**
     * Replay events for a specific entity
     */
    async replayForEntity(entityType: string, entityId: string): Promise<QZPayEventReplayResult> {
        const events = this.store.getByEntity(entityType, entityId);
        return this.replay({
            filter: {
                predicate: (e) => events.some((stored) => stored.id === e.id)
            }
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Create an event store that automatically stores events from an emitter
 */
export function qzpayCreateAutoStore(emitter: QZPayEventEmitter, options?: QZPayEventStoreOptions): QZPayInMemoryEventStore {
    const store = new QZPayInMemoryEventStore(options);

    // Subscribe to all events
    emitter.onAny((event) => {
        store.store(event);
    });

    return store;
}

/**
 * Create a replayer for an emitter with a store
 */
export function qzpayCreateReplayer(emitter: QZPayEventEmitter, store: QZPayInMemoryEventStore): QZPayEventReplayer {
    return new QZPayEventReplayer(emitter, store);
}

/**
 * Event snapshot for debugging
 */
export interface QZPayEventSnapshot {
    timestamp: Date;
    eventCount: number;
    eventsByType: Record<string, number>;
    oldestEvent?: { id: string; type: string; createdAt: Date } | undefined;
    newestEvent?: { id: string; type: string; createdAt: Date } | undefined;
}

/**
 * Get a snapshot of the event store
 */
export function qzpayGetEventSnapshot(store: QZPayInMemoryEventStore): QZPayEventSnapshot {
    const events = store.getAll();
    const sorted = qzpaySortEventsByDate(events, 'asc');

    const eventsByType: Record<string, number> = {};
    for (const event of events) {
        eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
    }

    const oldest = sorted[0];
    const newest = sorted[sorted.length - 1];

    return {
        timestamp: new Date(),
        eventCount: events.length,
        eventsByType,
        oldestEvent: oldest ? { id: oldest.id, type: oldest.type, createdAt: oldest.createdAt } : undefined,
        newestEvent: newest ? { id: newest.id, type: newest.type, createdAt: newest.createdAt } : undefined
    };
}

/**
 * Export events to JSON format
 */
export function qzpayExportEvents(store: QZPayInMemoryEventStore): string {
    const events = store.getAll();
    return JSON.stringify(
        events,
        (_key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        },
        2
    );
}

/**
 * Import events from JSON format
 */
export function qzpayImportEvents(store: QZPayInMemoryEventStore, json: string): number {
    const events = JSON.parse(json) as Array<{ createdAt: string; [key: string]: unknown }>;

    let imported = 0;
    for (const eventData of events) {
        const event: QZPayEvent = {
            ...eventData,
            createdAt: new Date(eventData.createdAt)
        } as QZPayEvent;
        store.store(event);
        imported++;
    }

    return imported;
}
