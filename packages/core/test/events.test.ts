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
