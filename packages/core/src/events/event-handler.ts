/**
 * Event handler utilities for QZPay
 */
import type { QZPayBillingEvent } from '../constants/index.js';
import type { QZPayEvent, QZPayEventMap, QZPayTypedEventHandler } from '../types/events.types.js';

/**
 * Middleware function type
 */
export type QZPayEventMiddleware<T = unknown> = (event: QZPayEvent<T>, next: () => Promise<void>) => Promise<void> | void;

/**
 * Create a handler with middleware chain
 */
export function qzpayWithMiddleware<K extends keyof QZPayEventMap>(
    middlewares: QZPayEventMiddleware<QZPayEventMap[K]>[],
    handler: QZPayTypedEventHandler<K>
): QZPayTypedEventHandler<K> {
    return async (event) => {
        let index = 0;

        const next = async (): Promise<void> => {
            if (index < middlewares.length) {
                const middleware = middlewares[index];
                index++;
                if (middleware) {
                    await middleware(event, next);
                }
            } else {
                await handler(event);
            }
        };

        await next();
    };
}

/**
 * Logging middleware for event handlers
 */
export function qzpayLoggingMiddleware<T = unknown>(
    logger: (message: string, data?: Record<string, unknown>) => void = console.log
): QZPayEventMiddleware<T> {
    return async (event, next) => {
        const start = Date.now();
        logger(`[QZPay] Event received: ${event.type}`, {
            eventId: event.id,
            livemode: event.livemode
        });

        try {
            await next();
            logger(`[QZPay] Event handled: ${event.type}`, {
                eventId: event.id,
                duration: Date.now() - start
            });
        } catch (error) {
            logger(`[QZPay] Event handler error: ${event.type}`, {
                eventId: event.id,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - start
            });
            throw error;
        }
    };
}

/**
 * Calculate retry delay based on backoff strategy
 */
function calculateRetryDelay(attempt: number, baseDelay: number, backoff: 'linear' | 'exponential'): number {
    return backoff === 'exponential' ? baseDelay * 2 ** attempt : baseDelay * (attempt + 1);
}

/**
 * Retry middleware for event handlers
 */
export function qzpayRetryMiddleware<T = unknown>(options?: {
    maxRetries?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
}): QZPayEventMiddleware<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const baseDelay = options?.delay ?? 1000;
    const backoff = options?.backoff ?? 'exponential';

    return async (_event, next) => {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await next();
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries) {
                    const delay = calculateRetryDelay(attempt, baseDelay, backoff);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    };
}

/**
 * Timeout middleware for event handlers
 */
export function qzpayTimeoutMiddleware<T = unknown>(timeoutMs = 30000): QZPayEventMiddleware<T> {
    return async (event, next) => {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Event handler timeout after ${timeoutMs}ms for ${event.type}`));
            }, timeoutMs);
        });

        await Promise.race([next(), timeoutPromise]);
    };
}

/**
 * Filter middleware - only processes events matching condition
 */
export function qzpayFilterMiddleware<T = unknown>(predicate: (event: QZPayEvent<T>) => boolean): QZPayEventMiddleware<T> {
    return async (event, next) => {
        if (predicate(event)) {
            await next();
        }
    };
}

/**
 * Debounce handler - groups rapid events
 */
export function qzpayDebounceHandler<K extends keyof QZPayEventMap>(
    handler: QZPayTypedEventHandler<K>,
    waitMs = 500,
    options?: { leading?: boolean; trailing?: boolean }
): QZPayTypedEventHandler<K> {
    const leading = options?.leading ?? false;
    const trailing = options?.trailing ?? true;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastEvent: QZPayEvent<QZPayEventMap[K]> | undefined;
    let called = false;

    return async (event) => {
        lastEvent = event;

        if (leading && !called) {
            called = true;
            await handler(event);
        }

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(async () => {
            if (trailing && lastEvent) {
                await handler(lastEvent);
            }
            called = false;
        }, waitMs);
    };
}

/**
 * Batch handler - collects events and processes them together
 */
export function qzpayBatchHandler<K extends keyof QZPayEventMap>(
    handler: (events: QZPayEvent<QZPayEventMap[K]>[]) => Promise<void> | void,
    options?: { maxSize?: number; maxWaitMs?: number }
): QZPayTypedEventHandler<K> {
    const maxSize = options?.maxSize ?? 10;
    const maxWaitMs = options?.maxWaitMs ?? 1000;

    let batch: QZPayEvent<QZPayEventMap[K]>[] = [];
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const flush = async (): Promise<void> => {
        if (batch.length === 0) return;

        const events = [...batch];
        batch = [];

        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
        }

        await handler(events);
    };

    return async (event) => {
        batch.push(event);

        if (batch.length >= maxSize) {
            await flush();
            return;
        }

        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                flush().catch(console.error);
            }, maxWaitMs);
        }
    };
}

/**
 * Create a typed event handler map
 */
export function qzpayCreateHandlerMap(): QZPayHandlerMap {
    return new QZPayHandlerMap();
}

/**
 * Handler map for organizing event handlers
 */
export class QZPayHandlerMap {
    private readonly handlers = new Map<keyof QZPayEventMap, QZPayTypedEventHandler<keyof QZPayEventMap>[]>();

    /**
     * Register a handler for an event type
     */
    handle<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): this {
        let handlers = this.handlers.get(eventType);
        if (!handlers) {
            handlers = [];
            this.handlers.set(eventType, handlers);
        }
        handlers.push(handler as QZPayTypedEventHandler<keyof QZPayEventMap>);
        return this;
    }

    /**
     * Get handlers for an event type
     */
    getHandlers<K extends keyof QZPayEventMap>(eventType: K): QZPayTypedEventHandler<K>[] {
        return (this.handlers.get(eventType) ?? []) as QZPayTypedEventHandler<K>[];
    }

    /**
     * Get all registered event types
     */
    getEventTypes(): (keyof QZPayEventMap)[] {
        return Array.from(this.handlers.keys());
    }

    /**
     * Check if a handler exists for an event type
     */
    has(eventType: keyof QZPayEventMap): boolean {
        return this.handlers.has(eventType);
    }

    /**
     * Remove handlers for an event type
     */
    remove(eventType: keyof QZPayEventMap): void {
        this.handlers.delete(eventType);
    }

    /**
     * Clear all handlers
     */
    clear(): void {
        this.handlers.clear();
    }
}

/**
 * Check if an event matches a pattern
 */
export function qzpayMatchesEventPattern(eventType: QZPayBillingEvent, pattern: string): boolean {
    // Exact match
    if (pattern === eventType) return true;

    // Wildcard patterns
    if (pattern === '*') return true;

    // Prefix pattern (e.g., "subscription.*")
    if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        return eventType.startsWith(`${prefix}.`);
    }

    // Suffix pattern (e.g., "*.created")
    if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(2);
        return eventType.endsWith(`.${suffix}`);
    }

    return false;
}

/**
 * Create a handler that only runs in livemode
 */
export function qzpayLivemodeOnly<K extends keyof QZPayEventMap>(handler: QZPayTypedEventHandler<K>): QZPayTypedEventHandler<K> {
    return async (event) => {
        if (event.livemode) {
            await handler(event);
        }
    };
}

/**
 * Create a handler that only runs in test mode
 */
export function qzpayTestmodeOnly<K extends keyof QZPayEventMap>(handler: QZPayTypedEventHandler<K>): QZPayTypedEventHandler<K> {
    return async (event) => {
        if (!event.livemode) {
            await handler(event);
        }
    };
}

/**
 * Compose multiple handlers into one
 */
export function qzpayComposeHandlers<K extends keyof QZPayEventMap>(...handlers: QZPayTypedEventHandler<K>[]): QZPayTypedEventHandler<K> {
    return async (event) => {
        for (const handler of handlers) {
            await handler(event);
        }
    };
}

/**
 * Run handlers in parallel
 */
export function qzpayParallelHandlers<K extends keyof QZPayEventMap>(...handlers: QZPayTypedEventHandler<K>[]): QZPayTypedEventHandler<K> {
    return async (event) => {
        await Promise.all(handlers.map((handler) => handler(event)));
    };
}
