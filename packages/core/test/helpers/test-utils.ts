/**
 * Test utilities for QZPay
 */
import { vi } from 'vitest';
import type { QZPayBilling } from '../../src/billing.js';
import type { QZPayEvent, QZPayEventMap, QZPayTypedEventHandler } from '../../src/types/events.types.js';

/**
 * Create a mock event for testing
 */
export function createMockEvent<K extends keyof QZPayEventMap>(
    type: K,
    data: QZPayEventMap[K],
    options?: {
        livemode?: boolean;
        id?: string;
    }
): QZPayEvent<QZPayEventMap[K]> {
    return {
        id: options?.id ?? `evt_test_${Date.now()}`,
        type,
        data,
        livemode: options?.livemode ?? false,
        createdAt: new Date()
    };
}

/**
 * Wait for a specific number of milliseconds
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a spy handler for events
 */
export function createSpyHandler<K extends keyof QZPayEventMap>(): {
    handler: QZPayTypedEventHandler<K>;
    calls: QZPayEvent<QZPayEventMap[K]>[];
    lastCall: () => QZPayEvent<QZPayEventMap[K]> | undefined;
    reset: () => void;
} {
    const calls: QZPayEvent<QZPayEventMap[K]>[] = [];

    const handler: QZPayTypedEventHandler<K> = (event) => {
        calls.push(event);
    };

    return {
        handler,
        calls,
        lastCall: () => calls[calls.length - 1],
        reset: () => {
            calls.length = 0;
        }
    };
}

/**
 * Collect events from billing instance
 */
export function collectEvents<K extends keyof QZPayEventMap>(
    billing: QZPayBilling,
    eventType: K
): {
    events: QZPayEvent<QZPayEventMap[K]>[];
    unsubscribe: () => void;
} {
    const events: QZPayEvent<QZPayEventMap[K]>[] = [];

    const unsubscribe = billing.on(eventType, (event) => {
        events.push(event);
    });

    return { events, unsubscribe };
}

/**
 * Wait for an event to be emitted
 */
export async function waitForEvent<K extends keyof QZPayEventMap>(
    billing: QZPayBilling,
    eventType: K,
    timeoutMs = 1000
): Promise<QZPayEvent<QZPayEventMap[K]>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            unsubscribe();
            reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeoutMs);

        const unsubscribe = billing.once(eventType, (event) => {
            clearTimeout(timer);
            resolve(event);
        });
    });
}

/**
 * Create a mock function that tracks calls
 */
export function createMockFn<T extends (...args: Parameters<T>) => ReturnType<T>>(): {
    fn: T;
    calls: Parameters<T>[];
    reset: () => void;
} {
    const calls: Parameters<T>[] = [];

    const fn = vi.fn((...args: Parameters<T>) => {
        calls.push(args);
        return undefined as ReturnType<T>;
    }) as unknown as T;

    return {
        fn,
        calls,
        reset: () => {
            calls.length = 0;
            vi.mocked(fn).mockClear();
        }
    };
}

/**
 * Assert that an event was emitted with specific data
 */
export function assertEventEmitted<K extends keyof QZPayEventMap>(
    events: QZPayEvent<QZPayEventMap[K]>[],
    expectedType: K,
    expectedData?: Partial<QZPayEventMap[K]>
): void {
    const event = events.find((e) => e.type === expectedType);
    if (!event) {
        throw new Error(`Event ${expectedType} was not emitted`);
    }
    if (expectedData) {
        for (const [key, value] of Object.entries(expectedData)) {
            const eventData = event.data as Record<string, unknown>;
            if (eventData[key] !== value) {
                throw new Error(`Event ${expectedType} data.${key} expected ${value} but got ${eventData[key]}`);
            }
        }
    }
}

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix = 'test'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a deferred promise for async testing
 */
export function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}
