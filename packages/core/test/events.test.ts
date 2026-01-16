import { describe, expect, it, vi } from 'vitest';
import {
    QZPayEventEmitter,
    QZPayHandlerMap,
    qzpayComposeHandlers,
    qzpayCreateEventEmitter,
    qzpayCreateHandlerMap,
    qzpayFilterMiddleware,
    qzpayLivemodeOnly,
    qzpayLoggingMiddleware,
    qzpayMatchesEventPattern,
    qzpayParallelHandlers,
    qzpayRetryMiddleware,
    qzpayTestmodeOnly,
    qzpayTimeoutMiddleware,
    qzpayWithMiddleware
} from '../src/events/index.js';
import type { QZPayCustomer } from '../src/types/customer.types.js';
import type { QZPayEvent } from '../src/types/events.types.js';

const mockCustomer: QZPayCustomer = {
    id: 'cus_123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date()
};

describe('QZPayEventEmitter', () => {
    describe('constructor', () => {
        it('should create emitter with default options', () => {
            const emitter = new QZPayEventEmitter();
            expect(emitter).toBeInstanceOf(QZPayEventEmitter);
        });

        it('should create emitter with custom options', () => {
            const onError = vi.fn();
            const emitter = new QZPayEventEmitter({
                livemode: true,
                maxListeners: 10,
                onError
            });
            expect(emitter).toBeInstanceOf(QZPayEventEmitter);
        });

        it('should create emitter with logger', () => {
            const logger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };
            const emitter = new QZPayEventEmitter({
                logger
            });
            expect(emitter).toBeInstanceOf(QZPayEventEmitter);
        });
    });

    describe('on/off', () => {
        it('should subscribe to events', async () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            emitter.on('customer.created', handler);
            await emitter.emit('customer.created', mockCustomer);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'customer.created',
                    data: mockCustomer
                })
            );
        });

        it('should unsubscribe from events', async () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            emitter.on('customer.created', handler);
            emitter.off('customer.created', handler);
            await emitter.emit('customer.created', mockCustomer);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should return unsubscribe function', async () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            const unsubscribe = emitter.on('customer.created', handler);
            unsubscribe();
            await emitter.emit('customer.created', mockCustomer);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('once', () => {
        it('should fire handler only once', async () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            emitter.once('customer.created', handler);
            await emitter.emit('customer.created', mockCustomer);
            await emitter.emit('customer.created', mockCustomer);

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('onAny/offAny', () => {
        it('should subscribe to all events', async () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            emitter.onAny(handler);
            await emitter.emit('customer.created', mockCustomer);
            await emitter.emit('customer.updated', mockCustomer);

            expect(handler).toHaveBeenCalledTimes(2);
        });

        it('should unsubscribe from all events', async () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            emitter.onAny(handler);
            emitter.offAny(handler);
            await emitter.emit('customer.created', mockCustomer);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('emit', () => {
        it('should return event object', async () => {
            const emitter = new QZPayEventEmitter();
            const event = await emitter.emit('customer.created', mockCustomer);

            expect(event).toMatchObject({
                type: 'customer.created',
                data: mockCustomer,
                livemode: false
            });
            expect(event.id).toMatch(/^evt_/);
            expect(event.createdAt).toBeInstanceOf(Date);
        });

        it('should set livemode from options', async () => {
            const emitter = new QZPayEventEmitter({ livemode: true });
            const event = await emitter.emit('customer.created', mockCustomer);

            expect(event.livemode).toBe(true);
        });

        it('should handle async handlers', async () => {
            const emitter = new QZPayEventEmitter();
            const results: number[] = [];

            emitter.on('customer.created', async () => {
                await new Promise((r) => setTimeout(r, 10));
                results.push(1);
            });

            emitter.on('customer.created', async () => {
                results.push(2);
            });

            await emitter.emit('customer.created', mockCustomer);

            expect(results).toEqual([1, 2]);
        });

        it('should catch and report handler errors', async () => {
            const onError = vi.fn();
            const emitter = new QZPayEventEmitter({ onError });

            emitter.on('customer.created', () => {
                throw new Error('Handler error');
            });

            await emitter.emit('customer.created', mockCustomer);

            expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ type: 'customer.created' }));
        });

        it('should use logger.error when handler throws error', async () => {
            const logger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };
            const emitter = new QZPayEventEmitter({ logger });

            emitter.on('customer.created', () => {
                throw new Error('Handler error');
            });

            await emitter.emit('customer.created', mockCustomer);

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error in event handler for customer.created'),
                expect.objectContaining({
                    error: expect.any(Error),
                    event: expect.objectContaining({ type: 'customer.created' })
                })
            );
        });

        it('should fallback to console.error when no logger provided', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const emitter = new QZPayEventEmitter();

            emitter.on('customer.created', () => {
                throw new Error('Handler error');
            });

            await emitter.emit('customer.created', mockCustomer);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[QZPay] Error in event handler for customer.created'),
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('emitSync', () => {
        it('should emit synchronously', () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            emitter.on('customer.created', handler);
            const event = emitter.emitSync('customer.created', mockCustomer);

            expect(event.type).toBe('customer.created');
            expect(handler).toHaveBeenCalled();
        });
    });

    describe('listenerCount', () => {
        it('should count listeners for specific event', () => {
            const emitter = new QZPayEventEmitter();

            emitter.on('customer.created', vi.fn());
            emitter.on('customer.created', vi.fn());
            emitter.on('customer.updated', vi.fn());

            expect(emitter.listenerCount('customer.created')).toBe(2);
        });

        it('should count all listeners', () => {
            const emitter = new QZPayEventEmitter();

            emitter.on('customer.created', vi.fn());
            emitter.on('customer.updated', vi.fn());
            emitter.onAny(vi.fn());

            expect(emitter.listenerCount()).toBe(3);
        });
    });

    describe('eventNames', () => {
        it('should return registered event types', () => {
            const emitter = new QZPayEventEmitter();

            emitter.on('customer.created', vi.fn());
            emitter.on('customer.updated', vi.fn());

            expect(emitter.eventNames()).toContain('customer.created');
            expect(emitter.eventNames()).toContain('customer.updated');
        });
    });

    describe('removeAllListeners', () => {
        it('should remove all listeners for specific event', async () => {
            const emitter = new QZPayEventEmitter();
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on('customer.created', handler1);
            emitter.on('customer.updated', handler2);
            emitter.removeAllListeners('customer.created');

            await emitter.emit('customer.created', mockCustomer);
            await emitter.emit('customer.updated', mockCustomer);

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('should remove all listeners', async () => {
            const emitter = new QZPayEventEmitter();
            const handler = vi.fn();

            emitter.on('customer.created', handler);
            emitter.onAny(handler);
            emitter.removeAllListeners();

            await emitter.emit('customer.created', mockCustomer);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('waitFor', () => {
        it('should wait for event', async () => {
            const emitter = new QZPayEventEmitter();

            setTimeout(() => {
                emitter.emit('customer.created', mockCustomer);
            }, 10);

            const event = await emitter.waitFor('customer.created');

            expect(event.type).toBe('customer.created');
        });

        it('should timeout if event not received', async () => {
            const emitter = new QZPayEventEmitter();

            await expect(emitter.waitFor('customer.created', { timeout: 50 })).rejects.toThrow('Timeout');
        });
    });

    describe('maxListeners', () => {
        it('should use logger.warn when maxListeners is exceeded', () => {
            const logger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };
            const emitter = new QZPayEventEmitter({ maxListeners: 2, logger });

            emitter.on('customer.created', vi.fn());
            emitter.on('customer.created', vi.fn());
            emitter.on('customer.created', vi.fn());

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('MaxListenersExceededWarning'),
                expect.objectContaining({
                    eventType: 'customer.created',
                    listenerCount: 2
                })
            );
        });

        it('should fallback to console.warn when no logger provided', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const emitter = new QZPayEventEmitter({ maxListeners: 2 });

            emitter.on('customer.created', vi.fn());
            emitter.on('customer.created', vi.fn());
            emitter.on('customer.created', vi.fn());

            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[QZPay] MaxListenersExceededWarning'));

            consoleWarnSpy.mockRestore();
        });
    });
});

describe('qzpayCreateEventEmitter', () => {
    it('should create event emitter', () => {
        const emitter = qzpayCreateEventEmitter();
        expect(emitter).toBeInstanceOf(QZPayEventEmitter);
    });
});

describe('Event Handler Utilities', () => {
    describe('qzpayWithMiddleware', () => {
        it('should execute middleware chain', async () => {
            const order: string[] = [];

            const middleware1 = vi.fn(async (_, next) => {
                order.push('m1-before');
                await next();
                order.push('m1-after');
            });

            const middleware2 = vi.fn(async (_, next) => {
                order.push('m2-before');
                await next();
                order.push('m2-after');
            });

            const handler = vi.fn(async () => {
                order.push('handler');
            });

            const wrapped = qzpayWithMiddleware([middleware1, middleware2], handler);

            const event: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            await wrapped(event);

            expect(order).toEqual(['m1-before', 'm2-before', 'handler', 'm2-after', 'm1-after']);
        });
    });

    describe('qzpayLoggingMiddleware', () => {
        it('should log events', async () => {
            const logger = vi.fn();
            const middleware = qzpayLoggingMiddleware(logger);

            const event: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            await middleware(event, async () => {});

            expect(logger).toHaveBeenCalledTimes(2);
        });
    });

    describe('qzpayRetryMiddleware', () => {
        it('should retry on failure', async () => {
            const middleware = qzpayRetryMiddleware({ maxRetries: 2, delay: 10 });
            let attempts = 0;

            const event: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            await middleware(event, async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('Temporary failure');
                }
            });

            expect(attempts).toBe(2);
        });
    });

    describe('qzpayTimeoutMiddleware', () => {
        it('should timeout slow handlers', async () => {
            const middleware = qzpayTimeoutMiddleware(50);

            const event: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            await expect(
                middleware(event, async () => {
                    await new Promise((r) => setTimeout(r, 200));
                })
            ).rejects.toThrow('timeout');
        });
    });

    describe('qzpayFilterMiddleware', () => {
        it('should filter events', async () => {
            const handler = vi.fn();
            const middleware = qzpayFilterMiddleware<QZPayCustomer>((event) => event.livemode);

            const testEvent: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            const liveEvent: QZPayEvent<QZPayCustomer> = {
                id: 'evt_456',
                type: 'customer.created',
                data: mockCustomer,
                livemode: true,
                createdAt: new Date()
            };

            await middleware(testEvent, handler);
            expect(handler).not.toHaveBeenCalled();

            await middleware(liveEvent, handler);
            expect(handler).toHaveBeenCalled();
        });
    });

    describe('qzpayLivemodeOnly/qzpayTestmodeOnly', () => {
        it('should only run in livemode', async () => {
            const handler = vi.fn();
            const wrapped = qzpayLivemodeOnly(handler);

            const testEvent: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            const liveEvent: QZPayEvent<QZPayCustomer> = {
                id: 'evt_456',
                type: 'customer.created',
                data: mockCustomer,
                livemode: true,
                createdAt: new Date()
            };

            await wrapped(testEvent);
            expect(handler).not.toHaveBeenCalled();

            await wrapped(liveEvent);
            expect(handler).toHaveBeenCalled();
        });

        it('should only run in testmode', async () => {
            const handler = vi.fn();
            const wrapped = qzpayTestmodeOnly(handler);

            const testEvent: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            await wrapped(testEvent);
            expect(handler).toHaveBeenCalled();
        });
    });

    describe('qzpayComposeHandlers', () => {
        it('should compose handlers sequentially', async () => {
            const order: number[] = [];

            const handler1 = vi.fn(async () => {
                order.push(1);
            });
            const handler2 = vi.fn(async () => {
                order.push(2);
            });

            const composed = qzpayComposeHandlers(handler1, handler2);

            const event: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            await composed(event);

            expect(order).toEqual([1, 2]);
        });
    });

    describe('qzpayParallelHandlers', () => {
        it('should run handlers in parallel', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            const parallel = qzpayParallelHandlers(handler1, handler2);

            const event: QZPayEvent<QZPayCustomer> = {
                id: 'evt_123',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            await parallel(event);

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });
    });

    describe('qzpayMatchesEventPattern', () => {
        it('should match exact event type', () => {
            expect(qzpayMatchesEventPattern('customer.created', 'customer.created')).toBe(true);
            expect(qzpayMatchesEventPattern('customer.created', 'customer.updated')).toBe(false);
        });

        it('should match wildcard pattern', () => {
            expect(qzpayMatchesEventPattern('customer.created', '*')).toBe(true);
        });

        it('should match prefix pattern', () => {
            expect(qzpayMatchesEventPattern('customer.created', 'customer.*')).toBe(true);
            expect(qzpayMatchesEventPattern('payment.succeeded', 'customer.*')).toBe(false);
        });

        it('should match suffix pattern', () => {
            expect(qzpayMatchesEventPattern('customer.created', '*.created')).toBe(true);
            expect(qzpayMatchesEventPattern('customer.updated', '*.created')).toBe(false);
        });
    });
});

describe('QZPayHandlerMap', () => {
    it('should register and retrieve handlers', () => {
        const map = new QZPayHandlerMap();
        const handler = vi.fn();

        map.handle('customer.created', handler);

        expect(map.getHandlers('customer.created')).toContain(handler);
    });

    it('should check if handler exists', () => {
        const map = new QZPayHandlerMap();

        expect(map.has('customer.created')).toBe(false);

        map.handle('customer.created', vi.fn());

        expect(map.has('customer.created')).toBe(true);
    });

    it('should get all event types', () => {
        const map = new QZPayHandlerMap();

        map.handle('customer.created', vi.fn());
        map.handle('customer.updated', vi.fn());

        expect(map.getEventTypes()).toHaveLength(2);
    });

    it('should remove handlers', () => {
        const map = new QZPayHandlerMap();

        map.handle('customer.created', vi.fn());
        map.remove('customer.created');

        expect(map.has('customer.created')).toBe(false);
    });

    it('should clear all handlers', () => {
        const map = new QZPayHandlerMap();

        map.handle('customer.created', vi.fn());
        map.handle('customer.updated', vi.fn());
        map.clear();

        expect(map.getEventTypes()).toHaveLength(0);
    });
});

describe('qzpayCreateHandlerMap', () => {
    it('should create handler map', () => {
        const map = qzpayCreateHandlerMap();
        expect(map).toBeInstanceOf(QZPayHandlerMap);
    });
});

// ============================================================================
// Event Payload Tests (3A.5.1)
// ============================================================================

import {
    qzpayCalculateChanges,
    qzpayCreateDetailedEvent,
    qzpayCreateEventSummary,
    qzpayDeserializeEvent,
    qzpayFormatEventLog,
    qzpaySerializeEvent
} from '../src/events/event-payload.js';

describe('Event Payload (3A.5.1)', () => {
    describe('qzpayCreateDetailedEvent', () => {
        it('should create detailed event with default options', () => {
            const event = qzpayCreateDetailedEvent('customer.created', mockCustomer, false);

            expect(event.id).toMatch(/^evt_/);
            expect(event.type).toBe('customer.created');
            expect(event.data).toEqual(mockCustomer);
            expect(event.livemode).toBe(false);
            expect(event.metadata).toBeDefined();
            expect(event.metadata.version).toBe('1.0');
            expect(event.metadata.source).toBe('qzpay');
            expect(event.metadata.correlationId).toMatch(/^cor_/);
            expect(event.relatedEntities).toBeDefined();
        });

        it('should create detailed event with actor', () => {
            const event = qzpayCreateDetailedEvent('customer.created', mockCustomer, true, {
                actor: {
                    type: 'user',
                    id: 'usr_123',
                    email: 'admin@example.com'
                }
            });

            expect(event.metadata.actor?.type).toBe('user');
            expect(event.metadata.actor?.id).toBe('usr_123');
            expect(event.livemode).toBe(true);
        });

        it('should create detailed event with custom options', () => {
            const event = qzpayCreateDetailedEvent('customer.updated', mockCustomer, false, {
                requestId: 'req_123',
                correlationId: 'cor_custom',
                source: 'custom-source',
                tags: ['important', 'billing'],
                idempotencyKey: 'idem_123'
            });

            expect(event.metadata.requestId).toBe('req_123');
            expect(event.metadata.correlationId).toBe('cor_custom');
            expect(event.metadata.source).toBe('custom-source');
            expect(event.metadata.tags).toEqual(['important', 'billing']);
            expect(event.metadata.idempotencyKey).toBe('idem_123');
        });

        it('should extract related entities from event data', () => {
            const dataWithRelations = {
                ...mockCustomer,
                subscriptionId: 'sub_123'
            };
            const event = qzpayCreateDetailedEvent('customer.updated', dataWithRelations as unknown as QZPayCustomer, false);

            expect(event.relatedEntities).toContainEqual({ type: 'customer', id: mockCustomer.id });
        });

        it('should include changes when provided', () => {
            const changes = [{ field: 'name', previousValue: 'Old Name', newValue: 'New Name' }];
            const event = qzpayCreateDetailedEvent('customer.updated', mockCustomer, false, {
                changes
            });

            expect(event.changes).toEqual(changes);
        });

        it('should include previous state when provided', () => {
            const previousState = { name: 'Old Name' };
            const event = qzpayCreateDetailedEvent('customer.updated', mockCustomer, false, {
                previousState
            });

            expect(event.previousState).toEqual(previousState);
        });
    });

    describe('qzpayCalculateChanges', () => {
        it('should detect changed fields', () => {
            const previous = { name: 'Old Name', email: 'old@example.com', count: 1 };
            const current = { name: 'New Name', email: 'old@example.com', count: 2 };

            const changes = qzpayCalculateChanges(previous, current);

            expect(changes).toHaveLength(2);
            expect(changes).toContainEqual({
                field: 'name',
                previousValue: 'Old Name',
                newValue: 'New Name'
            });
            expect(changes).toContainEqual({
                field: 'count',
                previousValue: 1,
                newValue: 2
            });
        });

        it('should not report unchanged fields', () => {
            const previous = { name: 'Same', email: 'same@example.com' };
            const current = { name: 'Same', email: 'same@example.com' };

            const changes = qzpayCalculateChanges(previous, current);

            expect(changes).toHaveLength(0);
        });

        it('should compare dates correctly', () => {
            const date = new Date('2024-01-01');
            const previous = { date };
            const current = { date: new Date('2024-01-01') };

            const changes = qzpayCalculateChanges(previous, current);

            expect(changes).toHaveLength(0);
        });

        it('should detect date changes', () => {
            const previous = { date: new Date('2024-01-01') };
            const current = { date: new Date('2024-01-02') };

            const changes = qzpayCalculateChanges(previous, current);

            expect(changes).toHaveLength(1);
        });

        it('should track only specified fields', () => {
            const previous = { name: 'Old', email: 'old@example.com' };
            const current = { name: 'New', email: 'new@example.com' };

            const changes = qzpayCalculateChanges(previous, current, ['name']);

            expect(changes).toHaveLength(1);
            expect(changes[0].field).toBe('name');
        });

        it('should compare objects shallowly', () => {
            const previous = { metadata: { key: 'old' } };
            const current = { metadata: { key: 'new' } };

            const changes = qzpayCalculateChanges(previous, current);

            expect(changes).toHaveLength(1);
        });
    });

    describe('qzpayCreateEventSummary', () => {
        it('should create summary from detailed event', () => {
            const event = qzpayCreateDetailedEvent('customer.created', mockCustomer, true, {
                actor: { type: 'user' }
            });

            const summary = qzpayCreateEventSummary(event);

            expect(summary.id).toBe(event.id);
            expect(summary.type).toBe('customer.created');
            expect(summary.entityId).toBe(mockCustomer.id);
            expect(summary.entityType).toBe('customer');
            expect(summary.actorType).toBe('user');
            expect(summary.livemode).toBe(true);
        });

        it('should include changed fields in summary', () => {
            const event = qzpayCreateDetailedEvent('customer.updated', mockCustomer, false, {
                changes: [
                    { field: 'name', previousValue: 'Old', newValue: 'New' },
                    { field: 'email', previousValue: 'old@example.com', newValue: 'new@example.com' }
                ]
            });

            const summary = qzpayCreateEventSummary(event);

            expect(summary.changedFields).toEqual(['name', 'email']);
        });
    });

    describe('qzpayFormatEventLog', () => {
        it('should format event for logging', () => {
            const event = qzpayCreateDetailedEvent('customer.created', mockCustomer, true, {
                actor: { type: 'api' }
            });

            const log = qzpayFormatEventLog(event);

            expect(log).toContain('[customer.created]');
            expect(log).toContain('entity=cus_123');
            expect(log).toContain('actor=api');
            expect(log).toContain('[LIVE]');
        });

        it('should show test mode label', () => {
            const event = qzpayCreateDetailedEvent('customer.created', mockCustomer, false);
            const log = qzpayFormatEventLog(event);

            expect(log).toContain('[TEST]');
        });
    });

    describe('qzpaySerializeEvent/qzpayDeserializeEvent', () => {
        it('should serialize and deserialize events preserving structure', () => {
            const event = qzpayCreateDetailedEvent('customer.created', mockCustomer, false);

            const serialized = qzpaySerializeEvent(event);
            const deserialized = qzpayDeserializeEvent<QZPayCustomer>(serialized);

            expect(deserialized.id).toBe(event.id);
            expect(deserialized.type).toBe(event.type);
            expect(deserialized.livemode).toBe(event.livemode);
            expect(deserialized.metadata).toBeDefined();
            expect(deserialized.relatedEntities).toBeDefined();
        });

        it('should serialize to valid JSON string', () => {
            const event = qzpayCreateDetailedEvent('customer.created', mockCustomer, false);

            const serialized = qzpaySerializeEvent(event);

            // Should be valid JSON
            expect(() => JSON.parse(serialized)).not.toThrow();
            const parsed = JSON.parse(serialized);
            expect(parsed.id).toBe(event.id);
            expect(parsed.type).toBe(event.type);
        });

        it('should handle nested data correctly', () => {
            const dataWithNested = {
                id: 'test_1',
                settings: { notifications: true, theme: 'dark' }
            };
            const event = qzpayCreateDetailedEvent('customer.created', dataWithNested as unknown as QZPayCustomer, false);

            const serialized = qzpaySerializeEvent(event);
            const deserialized = qzpayDeserializeEvent<typeof dataWithNested>(serialized);

            expect((deserialized.data as typeof dataWithNested).settings).toEqual({ notifications: true, theme: 'dark' });
        });
    });
});

// ============================================================================
// Event Filter Tests (3A.5.2)
// ============================================================================

import {
    QZPayEventFilter,
    qzpayCreateEventFilter,
    qzpayCreateEventMatcher,
    qzpayCustomerEvents,
    qzpayFailureEvents,
    qzpayFilterEventsByPattern,
    qzpayGroupEventsByEntity,
    qzpayGroupEventsByType,
    qzpayInvoiceEvents,
    qzpayPaymentEvents,
    qzpaySortEventsByDate,
    qzpaySubscriptionEvents
} from '../src/events/event-filter.js';

describe('Event Filter (3A.5.2)', () => {
    const mockEvents: QZPayEvent[] = [
        {
            id: 'evt_1',
            type: 'customer.created',
            data: { id: 'cus_1', customerId: 'cus_1' },
            livemode: false,
            createdAt: new Date('2024-01-01')
        },
        {
            id: 'evt_2',
            type: 'customer.updated',
            data: { id: 'cus_1', customerId: 'cus_1' },
            livemode: true,
            createdAt: new Date('2024-01-02')
        },
        {
            id: 'evt_3',
            type: 'subscription.created',
            data: { id: 'sub_1', customerId: 'cus_1' },
            livemode: false,
            createdAt: new Date('2024-01-03')
        },
        {
            id: 'evt_4',
            type: 'payment.succeeded',
            data: { id: 'pay_1', customerId: 'cus_2' },
            livemode: true,
            createdAt: new Date('2024-01-04')
        }
    ] as QZPayEvent[];

    describe('QZPayEventFilter', () => {
        it('should create filter with types', () => {
            const filter = new QZPayEventFilter().types('customer.created', 'customer.updated');
            const criteria = filter.getCriteria();

            expect(criteria.types).toEqual(['customer.created', 'customer.updated']);
        });

        it('should filter by wildcard types', () => {
            const filter = new QZPayEventFilter().types('customer.*');
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(2);
            expect(result.every((e) => e.type.startsWith('customer.'))).toBe(true);
        });

        it('should exclude types', () => {
            const filter = new QZPayEventFilter().excludeTypes('customer.*');
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(2);
            expect(result.some((e) => e.type.startsWith('customer.'))).toBe(false);
        });

        it('should filter by customer ID', () => {
            const filter = new QZPayEventFilter().forCustomer('cus_1');
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(3);
        });

        it('should filter by date range', () => {
            const filter = new QZPayEventFilter().dateRange(new Date('2024-01-02'), new Date('2024-01-03'));
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(2);
        });

        it('should filter by after date', () => {
            // after() includes events on or after the date (>= comparison)
            const filter = new QZPayEventFilter().after(new Date('2024-01-03'));
            const result = filter.apply(mockEvents);

            // Should include evt_3 (2024-01-03) and evt_4 (2024-01-04)
            expect(result).toHaveLength(2);
        });

        it('should filter by before date', () => {
            // before() includes events on or before the date (<= comparison)
            const filter = new QZPayEventFilter().before(new Date('2024-01-02'));
            const result = filter.apply(mockEvents);

            // Should include evt_1 (2024-01-01) and evt_2 (2024-01-02)
            expect(result).toHaveLength(2);
        });

        it('should filter live mode only', () => {
            const filter = new QZPayEventFilter().liveModeOnly();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(2);
            expect(result.every((e) => e.livemode)).toBe(true);
        });

        it('should filter test mode only', () => {
            const filter = new QZPayEventFilter().testModeOnly();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(2);
            expect(result.every((e) => !e.livemode)).toBe(true);
        });

        it('should filter by entity types', () => {
            const filter = new QZPayEventFilter().entityTypes('customer', 'subscription');
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(3);
        });

        it('should filter by entity IDs', () => {
            const filter = new QZPayEventFilter().entityIds('cus_1', 'sub_1');
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(3);
        });

        it('should use custom predicate', () => {
            const filter = new QZPayEventFilter().where((e) => e.id === 'evt_1');
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('evt_1');
        });

        it('should chain multiple filters', () => {
            const filter = new QZPayEventFilter().types('customer.*').liveModeOnly();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('evt_2');
        });

        it('should reset filter', () => {
            const filter = new QZPayEventFilter().types('customer.*').reset();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(4);
        });

        it('should create matcher function', () => {
            const filter = new QZPayEventFilter().types('payment.*');
            const matcher = filter.toMatcher();

            expect(matcher(mockEvents[3])).toBe(true);
            expect(matcher(mockEvents[0])).toBe(false);
        });
    });

    describe('qzpayCreateEventFilter', () => {
        it('should create new filter instance', () => {
            const filter = qzpayCreateEventFilter();
            expect(filter).toBeInstanceOf(QZPayEventFilter);
        });
    });

    describe('qzpayCreateEventMatcher', () => {
        it('should create matcher from criteria', () => {
            const matcher = qzpayCreateEventMatcher({ types: ['customer.*'] });

            expect(matcher(mockEvents[0])).toBe(true);
            expect(matcher(mockEvents[3])).toBe(false);
        });
    });

    describe('Filter shortcuts', () => {
        it('qzpaySubscriptionEvents should filter subscription events', () => {
            const filter = qzpaySubscriptionEvents();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('subscription.created');
        });

        it('qzpayPaymentEvents should filter payment events', () => {
            const filter = qzpayPaymentEvents();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('payment.succeeded');
        });

        it('qzpayCustomerEvents should filter customer events', () => {
            const filter = qzpayCustomerEvents();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(2);
        });

        it('qzpayInvoiceEvents should filter invoice events', () => {
            const filter = qzpayInvoiceEvents();
            const result = filter.apply(mockEvents);

            expect(result).toHaveLength(0);
        });

        it('qzpayFailureEvents should filter failure events', () => {
            const failureEvents: QZPayEvent[] = [
                ...mockEvents,
                {
                    id: 'evt_5',
                    type: 'payment.failed',
                    data: { id: 'pay_2' },
                    livemode: false,
                    createdAt: new Date()
                }
            ] as QZPayEvent[];

            const filter = qzpayFailureEvents();
            const result = filter.apply(failureEvents);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('payment.failed');
        });
    });

    describe('qzpayFilterEventsByPattern', () => {
        it('should filter events by pattern', () => {
            const result = qzpayFilterEventsByPattern(mockEvents, 'customer.*');

            expect(result).toHaveLength(2);
        });
    });

    describe('qzpayGroupEventsByType', () => {
        it('should group events by type', () => {
            const groups = qzpayGroupEventsByType(mockEvents);

            expect(groups.get('customer.created')).toHaveLength(1);
            expect(groups.get('customer.updated')).toHaveLength(1);
            expect(groups.get('subscription.created')).toHaveLength(1);
            expect(groups.get('payment.succeeded')).toHaveLength(1);
        });
    });

    describe('qzpayGroupEventsByEntity', () => {
        it('should group events by entity ID', () => {
            const groups = qzpayGroupEventsByEntity(mockEvents);

            expect(groups.get('cus_1')).toHaveLength(2);
            expect(groups.get('sub_1')).toHaveLength(1);
            expect(groups.get('pay_1')).toHaveLength(1);
        });
    });

    describe('qzpaySortEventsByDate', () => {
        it('should sort events ascending', () => {
            const shuffled = [...mockEvents].reverse();
            const sorted = qzpaySortEventsByDate(shuffled, 'asc');

            expect(sorted[0].id).toBe('evt_1');
            expect(sorted[3].id).toBe('evt_4');
        });

        it('should sort events descending', () => {
            const sorted = qzpaySortEventsByDate(mockEvents, 'desc');

            expect(sorted[0].id).toBe('evt_4');
            expect(sorted[3].id).toBe('evt_1');
        });
    });
});

// ============================================================================
// Event Store Tests (3A.5.3)
// ============================================================================

import {
    QZPayEventReplayer,
    QZPayInMemoryEventStore,
    qzpayCreateAutoStore,
    qzpayCreateReplayer,
    qzpayExportEvents,
    qzpayGetEventSnapshot,
    qzpayImportEvents
} from '../src/events/event-store.js';

describe('Event Store (3A.5.3)', () => {
    describe('QZPayInMemoryEventStore', () => {
        it('should store and retrieve events', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const event: QZPayEvent = {
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            };

            store.store(event);

            expect(store.count()).toBe(1);
            expect(store.getById('evt_1')).toEqual(event);
            store.destroy();
        });

        it('should get all events', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });
            store.store({
                id: 'evt_2',
                type: 'customer.updated',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });

            expect(store.getAll()).toHaveLength(2);
            store.destroy();
        });

        it('should query events with criteria', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });
            store.store({
                id: 'evt_2',
                type: 'payment.succeeded',
                data: { id: 'pay_1' },
                livemode: true,
                createdAt: new Date()
            });

            const result = store.query({ types: ['customer.*'] });

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('evt_1');
            store.destroy();
        });

        it('should get events by entity', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: { id: 'cus_1' },
                livemode: false,
                createdAt: new Date()
            });
            store.store({
                id: 'evt_2',
                type: 'customer.updated',
                data: { id: 'cus_1' },
                livemode: false,
                createdAt: new Date()
            });

            const result = store.getByEntity('customer', 'cus_1');

            expect(result).toHaveLength(2);
            store.destroy();
        });

        it('should get events by customer', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });

            store.store({
                id: 'evt_1',
                type: 'subscription.created',
                data: { id: 'sub_1', customerId: 'cus_1' },
                livemode: false,
                createdAt: new Date()
            });
            store.store({
                id: 'evt_2',
                type: 'customer.created',
                data: { id: 'cus_1' },
                livemode: false,
                createdAt: new Date()
            });

            const result = store.getByCustomer('cus_1');

            expect(result).toHaveLength(2);
            store.destroy();
        });

        it('should get events by date range', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date('2024-01-01')
            });
            store.store({
                id: 'evt_2',
                type: 'customer.updated',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date('2024-01-05')
            });

            const result = store.getByDateRange(new Date('2024-01-01'), new Date('2024-01-03'));

            expect(result).toHaveLength(1);
            store.destroy();
        });

        it('should enforce max events limit', () => {
            const store = new QZPayInMemoryEventStore({
                maxEvents: 2,
                autoCleanup: false
            });

            store.store({ id: 'evt_1', type: 'customer.created', data: {}, livemode: false, createdAt: new Date() });
            store.store({ id: 'evt_2', type: 'customer.created', data: {}, livemode: false, createdAt: new Date() });
            store.store({ id: 'evt_3', type: 'customer.created', data: {}, livemode: false, createdAt: new Date() });

            expect(store.count()).toBe(2);
            expect(store.getById('evt_1')).toBeUndefined();
            expect(store.getById('evt_3')).toBeDefined();
            store.destroy();
        });

        it('should cleanup old events', () => {
            const store = new QZPayInMemoryEventStore({
                maxAge: 1000,
                autoCleanup: false
            });

            store.store({
                id: 'evt_old',
                type: 'customer.created',
                data: {},
                livemode: false,
                createdAt: new Date(Date.now() - 2000)
            });
            store.store({
                id: 'evt_new',
                type: 'customer.created',
                data: {},
                livemode: false,
                createdAt: new Date()
            });

            const removed = store.cleanup();

            expect(removed).toBe(1);
            expect(store.count()).toBe(1);
            expect(store.getById('evt_old')).toBeUndefined();
            store.destroy();
        });

        it('should clear all events', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });

            store.store({ id: 'evt_1', type: 'customer.created', data: {}, livemode: false, createdAt: new Date() });
            store.store({ id: 'evt_2', type: 'customer.created', data: {}, livemode: false, createdAt: new Date() });
            store.clear();

            expect(store.count()).toBe(0);
            store.destroy();
        });
    });

    describe('QZPayEventReplayer', () => {
        it('should replay events', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);
            const handler = vi.fn();

            emitter.on('customer.created', handler);

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });

            const result = await replayer.replay();

            expect(result.total).toBe(1);
            expect(result.replayed).toBe(1);
            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(0);
            expect(handler).toHaveBeenCalledTimes(1);
            store.destroy();
        });

        it('should replay single event by ID', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);
            const handler = vi.fn();

            emitter.on('customer.created', handler);

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });

            const result = await replayer.replayById('evt_1');

            expect(result).toBe(true);
            expect(handler).toHaveBeenCalled();
            store.destroy();
        });

        it('should return false for non-existent event', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);

            const result = await replayer.replayById('non_existent');

            expect(result).toBe(false);
            store.destroy();
        });

        it('should replay with filter', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);
            const handler = vi.fn();

            emitter.on('customer.created', handler);

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });
            store.store({
                id: 'evt_2',
                type: 'payment.succeeded',
                data: { id: 'pay_1' },
                livemode: false,
                createdAt: new Date()
            });

            const result = await replayer.replay({
                filter: { types: ['customer.*'] }
            });

            expect(result.total).toBe(1);
            expect(handler).toHaveBeenCalledTimes(1);
            store.destroy();
        });

        it('should handle replay and count successes', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);
            const handler = vi.fn();

            emitter.on('customer.created', handler);

            store.store({
                id: 'evt_1',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });
            store.store({
                id: 'evt_2',
                type: 'customer.created',
                data: mockCustomer,
                livemode: false,
                createdAt: new Date()
            });

            const result = await replayer.replay();

            expect(result.succeeded).toBe(2);
            expect(result.failed).toBe(0);
            expect(handler).toHaveBeenCalledTimes(2);
            store.destroy();
        });

        it('should replay all events when stopOnError is true but no errors occur', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);
            const handler = vi.fn();

            emitter.on('customer.created', handler);

            store.store({ id: 'evt_1', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date() });
            store.store({ id: 'evt_2', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date() });

            const result = await replayer.replay({ stopOnError: true });

            expect(result.replayed).toBe(2);
            expect(result.succeeded).toBe(2);
            expect(result.skipped).toBe(0);
            store.destroy();
        });

        it('should replay with limit', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);

            store.store({ id: 'evt_1', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-01') });
            store.store({ id: 'evt_2', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-02') });
            store.store({ id: 'evt_3', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-03') });

            const result = await replayer.replay({ limit: 2 });

            expect(result.total).toBe(2);
            store.destroy();
        });

        it('should replay starting after specific event', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);

            store.store({ id: 'evt_1', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-01') });
            store.store({ id: 'evt_2', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-02') });
            store.store({ id: 'evt_3', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-03') });

            const result = await replayer.replay({ startAfter: 'evt_1' });

            expect(result.total).toBe(2);
            store.destroy();
        });

        it('should call before/after replay callbacks', async () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = new QZPayEventReplayer(emitter, store);
            const beforeCb = vi.fn();
            const afterCb = vi.fn();

            store.store({ id: 'evt_1', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date() });

            await replayer.replay({
                onBeforeReplay: beforeCb,
                onAfterReplay: afterCb
            });

            expect(beforeCb).toHaveBeenCalled();
            expect(afterCb).toHaveBeenCalledWith(expect.anything(), true, undefined);
            store.destroy();
        });
    });

    describe('qzpayCreateAutoStore', () => {
        it('should automatically store emitted events', async () => {
            const emitter = new QZPayEventEmitter();
            const store = qzpayCreateAutoStore(emitter, { autoCleanup: false });

            await emitter.emit('customer.created', mockCustomer);
            await emitter.emit('customer.updated', mockCustomer);

            expect(store.count()).toBe(2);
            store.destroy();
        });
    });

    describe('qzpayCreateReplayer', () => {
        it('should create replayer instance', () => {
            const emitter = new QZPayEventEmitter();
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });
            const replayer = qzpayCreateReplayer(emitter, store);

            expect(replayer).toBeInstanceOf(QZPayEventReplayer);
            store.destroy();
        });
    });

    describe('qzpayGetEventSnapshot', () => {
        it('should get snapshot of event store', () => {
            const store = new QZPayInMemoryEventStore({ autoCleanup: false });

            store.store({ id: 'evt_1', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-01') });
            store.store({ id: 'evt_2', type: 'customer.updated', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-02') });
            store.store({ id: 'evt_3', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-03') });

            const snapshot = qzpayGetEventSnapshot(store);

            expect(snapshot.eventCount).toBe(3);
            expect(snapshot.eventsByType['customer.created']).toBe(2);
            expect(snapshot.eventsByType['customer.updated']).toBe(1);
            expect(snapshot.oldestEvent?.id).toBe('evt_1');
            expect(snapshot.newestEvent?.id).toBe('evt_3');
            store.destroy();
        });
    });

    describe('qzpayExportEvents/qzpayImportEvents', () => {
        it('should export and import events', () => {
            const store1 = new QZPayInMemoryEventStore({ autoCleanup: false });
            const store2 = new QZPayInMemoryEventStore({ autoCleanup: false });

            store1.store({ id: 'evt_1', type: 'customer.created', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-01') });
            store1.store({ id: 'evt_2', type: 'customer.updated', data: mockCustomer, livemode: false, createdAt: new Date('2024-01-02') });

            const json = qzpayExportEvents(store1);
            const imported = qzpayImportEvents(store2, json);

            expect(imported).toBe(2);
            expect(store2.count()).toBe(2);
            expect(store2.getById('evt_1')).toBeDefined();
            expect(store2.getById('evt_2')).toBeDefined();
            store1.destroy();
            store2.destroy();
        });
    });
});
