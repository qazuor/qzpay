/**
 * Event emitter for QZPay billing events
 */
import type { QZPayBillingEvent } from '../constants/index.js';
import type { QZPayEvent, QZPayEventHandler, QZPayEventMap, QZPayTypedEventHandler } from '../types/events.types.js';
import { qzpayGenerateId } from '../utils/hash.utils.js';

/**
 * Listener entry with metadata
 */
interface QZPayEventListener<K extends keyof QZPayEventMap = keyof QZPayEventMap> {
    handler: QZPayTypedEventHandler<K>;
    once: boolean;
}

/**
 * Event emitter options
 */
export interface QZPayEventEmitterOptions {
    /**
     * Whether events are in live mode (production) or test mode
     */
    livemode?: boolean;

    /**
     * Maximum number of listeners per event (0 = unlimited)
     */
    maxListeners?: number;

    /**
     * Custom error handler for async event handlers
     */
    onError?: (error: Error, event: QZPayEvent) => void;
}

/**
 * Type-safe event emitter for billing events
 */
export class QZPayEventEmitter {
    private readonly listeners = new Map<keyof QZPayEventMap, QZPayEventListener[]>();
    private readonly wildcardListeners: QZPayEventListener<keyof QZPayEventMap>[] = [];
    private readonly options: Required<QZPayEventEmitterOptions>;

    constructor(options: QZPayEventEmitterOptions = {}) {
        this.options = {
            livemode: options.livemode ?? false,
            maxListeners: options.maxListeners ?? 0,
            onError:
                options.onError ??
                ((error, event) => {
                    console.error(`[QZPay] Error in event handler for ${event.type}:`, error);
                })
        };
    }

    /**
     * Subscribe to a specific event type
     */
    on<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): () => void {
        return this.addListener(eventType, handler, false);
    }

    /**
     * Subscribe to all events (wildcard)
     */
    onAny(handler: QZPayEventHandler): () => void {
        const listener: QZPayEventListener<keyof QZPayEventMap> = {
            handler: handler as QZPayTypedEventHandler<keyof QZPayEventMap>,
            once: false
        };
        this.wildcardListeners.push(listener);

        return () => this.offAny(handler);
    }

    /**
     * Subscribe to a specific event type (fires only once)
     */
    once<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): () => void {
        return this.addListener(eventType, handler, true);
    }

    /**
     * Unsubscribe from a specific event type
     */
    off<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>): void {
        const eventListeners = this.listeners.get(eventType);
        if (!eventListeners) return;

        const index = eventListeners.findIndex((l) => l.handler === handler);
        if (index !== -1) {
            eventListeners.splice(index, 1);
        }

        if (eventListeners.length === 0) {
            this.listeners.delete(eventType);
        }
    }

    /**
     * Unsubscribe from wildcard events
     */
    offAny(handler: QZPayEventHandler): void {
        const index = this.wildcardListeners.findIndex((l) => l.handler === handler);
        if (index !== -1) {
            this.wildcardListeners.splice(index, 1);
        }
    }

    /**
     * Emit an event to all subscribed handlers
     */
    async emit<K extends keyof QZPayEventMap>(eventType: K, data: QZPayEventMap[K]): Promise<QZPayEvent<QZPayEventMap[K]>> {
        const event = this.createEvent(eventType, data);
        const eventListeners = this.listeners.get(eventType) ?? [];

        const listenersToRemove = await this.executeListenersAsync(eventListeners, event);
        await this.executeWildcardListenersAsync(event);
        this.removeOnceListeners(eventListeners, listenersToRemove);

        return event;
    }

    /**
     * Emit an event synchronously (fire and forget)
     */
    emitSync<K extends keyof QZPayEventMap>(eventType: K, data: QZPayEventMap[K]): QZPayEvent<QZPayEventMap[K]> {
        const event = this.createEvent(eventType, data);
        const eventListeners = this.listeners.get(eventType) ?? [];

        const listenersToRemove = this.executeListenersSync(eventListeners, event);
        this.executeWildcardListenersSync(event);
        this.removeOnceListeners(eventListeners, listenersToRemove);

        return event;
    }

    /**
     * Get listener count for an event type
     */
    listenerCount(eventType?: keyof QZPayEventMap): number {
        if (eventType) {
            return (this.listeners.get(eventType)?.length ?? 0) + this.wildcardListeners.length;
        }

        let count = this.wildcardListeners.length;
        for (const listeners of this.listeners.values()) {
            count += listeners.length;
        }
        return count;
    }

    /**
     * Get all registered event types
     */
    eventNames(): (keyof QZPayEventMap)[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * Remove all listeners
     */
    removeAllListeners(eventType?: keyof QZPayEventMap): void {
        if (eventType) {
            this.listeners.delete(eventType);
        } else {
            this.listeners.clear();
            this.wildcardListeners.length = 0;
        }
    }

    /**
     * Wait for a specific event to be emitted
     */
    waitFor<K extends keyof QZPayEventMap>(eventType: K, options?: { timeout?: number }): Promise<QZPayEvent<QZPayEventMap[K]>> {
        const timeout = options?.timeout ?? 30000;

        return new Promise((resolve, reject) => {
            let timeoutId: ReturnType<typeof setTimeout> | undefined;

            const unsubscribe = this.once(eventType, (event) => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(event);
            });

            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    unsubscribe();
                    reject(new Error(`Timeout waiting for event: ${eventType}`));
                }, timeout);
            }
        });
    }

    private createEvent<K extends keyof QZPayEventMap>(eventType: K, data: QZPayEventMap[K]): QZPayEvent<QZPayEventMap[K]> {
        return {
            id: qzpayGenerateId('evt'),
            type: eventType as QZPayBillingEvent,
            data,
            livemode: this.options.livemode,
            createdAt: new Date()
        };
    }

    private async executeListenersAsync<K extends keyof QZPayEventMap>(
        listeners: QZPayEventListener[],
        event: QZPayEvent<QZPayEventMap[K]>
    ): Promise<QZPayEventListener[]> {
        const listenersToRemove: QZPayEventListener[] = [];

        for (const listener of listeners) {
            await this.safeExecuteAsync(listener.handler, event);
            if (listener.once) {
                listenersToRemove.push(listener);
            }
        }

        return listenersToRemove;
    }

    private async executeWildcardListenersAsync<K extends keyof QZPayEventMap>(event: QZPayEvent<QZPayEventMap[K]>): Promise<void> {
        for (const listener of this.wildcardListeners) {
            await this.safeExecuteAsync(listener.handler, event);
        }
    }

    private executeListenersSync<K extends keyof QZPayEventMap>(
        listeners: QZPayEventListener[],
        event: QZPayEvent<QZPayEventMap[K]>
    ): QZPayEventListener[] {
        const listenersToRemove: QZPayEventListener[] = [];

        for (const listener of listeners) {
            this.safeExecuteSync(listener.handler, event);
            if (listener.once) {
                listenersToRemove.push(listener);
            }
        }

        return listenersToRemove;
    }

    private executeWildcardListenersSync<K extends keyof QZPayEventMap>(event: QZPayEvent<QZPayEventMap[K]>): void {
        for (const listener of this.wildcardListeners) {
            this.safeExecuteSync(listener.handler, event);
        }
    }

    private async safeExecuteAsync<K extends keyof QZPayEventMap>(
        handler: QZPayTypedEventHandler<keyof QZPayEventMap>,
        event: QZPayEvent<QZPayEventMap[K]>
    ): Promise<void> {
        try {
            await handler(event as QZPayEvent<QZPayEventMap[keyof QZPayEventMap]>);
        } catch (error) {
            this.handleError(error, event);
        }
    }

    private safeExecuteSync<K extends keyof QZPayEventMap>(
        handler: QZPayTypedEventHandler<keyof QZPayEventMap>,
        event: QZPayEvent<QZPayEventMap[K]>
    ): void {
        try {
            const result = handler(event as QZPayEvent<QZPayEventMap[keyof QZPayEventMap]>);
            if (result instanceof Promise) {
                result.catch((error) => this.handleError(error, event));
            }
        } catch (error) {
            this.handleError(error, event);
        }
    }

    private handleError<K extends keyof QZPayEventMap>(error: unknown, event: QZPayEvent<QZPayEventMap[K]>): void {
        this.options.onError(error instanceof Error ? error : new Error(String(error)), event);
    }

    private removeOnceListeners(eventListeners: QZPayEventListener[], listenersToRemove: QZPayEventListener[]): void {
        for (const listener of listenersToRemove) {
            const index = eventListeners.indexOf(listener);
            if (index !== -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    private addListener<K extends keyof QZPayEventMap>(eventType: K, handler: QZPayTypedEventHandler<K>, once: boolean): () => void {
        let eventListeners = this.listeners.get(eventType);

        if (!eventListeners) {
            eventListeners = [];
            this.listeners.set(eventType, eventListeners);
        }

        if (this.options.maxListeners > 0 && eventListeners.length >= this.options.maxListeners) {
            console.warn(`[QZPay] MaxListenersExceededWarning: ${eventType} has ${eventListeners.length} listeners`);
        }

        const listener: QZPayEventListener = {
            handler: handler as QZPayTypedEventHandler<keyof QZPayEventMap>,
            once
        };
        eventListeners.push(listener);

        return () => this.off(eventType, handler);
    }
}

/**
 * Create a new event emitter instance
 */
export function qzpayCreateEventEmitter(options?: QZPayEventEmitterOptions): QZPayEventEmitter {
    return new QZPayEventEmitter(options);
}
