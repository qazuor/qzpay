/**
 * QZPay Middleware Tests
 */
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createQZPayMiddleware, getQZPay } from '../../src/middleware/qzpay.middleware.js';
import type { QZPayHonoEnv } from '../../src/types.js';
import { createMockBilling, createMockCustomer } from '../helpers/hono-mocks.js';

describe('QZPay Middleware', () => {
    describe('createQZPayMiddleware', () => {
        it('should attach billing instance to context', async () => {
            const mockBilling = createMockBilling();
            const app = new Hono<QZPayHonoEnv>();

            app.use('*', createQZPayMiddleware({ billing: mockBilling }));
            app.get('/test', (c) => {
                const qzpay = c.get('qzpay');
                return c.json({ hasQzpay: !!qzpay });
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.hasQzpay).toBe(true);
        });

        it('should make billing available to subsequent handlers', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(mockCustomer);

            const app = new Hono<QZPayHonoEnv>();

            app.use('*', createQZPayMiddleware({ billing: mockBilling }));
            app.get('/customer/:id', async (c) => {
                const qzpay = c.get('qzpay');
                const customer = await qzpay.customers.get(c.req.param('id'));
                return c.json(customer);
            });

            const response = await app.request('/customer/cus_123');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.id).toBe('cus_123');
            expect(mockBilling.customers.get).toHaveBeenCalledWith('cus_123');
        });

        it('should work with multiple routes', async () => {
            const mockBilling = createMockBilling();
            const app = new Hono<QZPayHonoEnv>();

            app.use('*', createQZPayMiddleware({ billing: mockBilling }));

            app.get('/route1', (c) => {
                const qzpay = c.get('qzpay');
                return c.json({ route: 1, hasQzpay: !!qzpay });
            });

            app.get('/route2', (c) => {
                const qzpay = c.get('qzpay');
                return c.json({ route: 2, hasQzpay: !!qzpay });
            });

            const response1 = await app.request('/route1');
            const data1 = await response1.json();

            const response2 = await app.request('/route2');
            const data2 = await response2.json();

            expect(data1.hasQzpay).toBe(true);
            expect(data2.hasQzpay).toBe(true);
        });

        it('should work with nested routes', async () => {
            const mockBilling = createMockBilling();
            const app = new Hono<QZPayHonoEnv>();

            app.use('*', createQZPayMiddleware({ billing: mockBilling }));
            app.get('/api/v1/customers/:id', (c) => {
                const qzpay = c.get('qzpay');
                return c.json({ path: c.req.path, hasQzpay: !!qzpay });
            });

            const response = await app.request('/api/v1/customers/cus_123');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.hasQzpay).toBe(true);
            expect(data.path).toBe('/api/v1/customers/cus_123');
        });

        it('should allow calling next middleware', async () => {
            const mockBilling = createMockBilling();
            const app = new Hono<QZPayHonoEnv>();
            const middlewareCalled: string[] = [];

            app.use('*', createQZPayMiddleware({ billing: mockBilling }));
            app.use('*', async (_c, next) => {
                middlewareCalled.push('custom');
                await next();
            });
            app.get('/test', (c) => {
                middlewareCalled.push('handler');
                return c.json({ called: middlewareCalled });
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(data.called).toContain('custom');
            expect(data.called).toContain('handler');
        });
    });

    describe('getQZPay', () => {
        it('should return billing from context', async () => {
            const mockBilling = createMockBilling();
            const app = new Hono<QZPayHonoEnv>();

            app.use('*', createQZPayMiddleware({ billing: mockBilling }));
            app.get('/test', (c) => {
                const qzpay = getQZPay(c);
                return c.json({ hasQzpay: !!qzpay, hasCustomers: !!qzpay.customers });
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(data.hasQzpay).toBe(true);
            expect(data.hasCustomers).toBe(true);
        });

        it('should provide type-safe access to billing methods', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer({ name: 'Type Safe Customer' });
            vi.mocked(mockBilling.customers.get).mockResolvedValue(mockCustomer);

            const app = new Hono<QZPayHonoEnv>();

            app.use('*', createQZPayMiddleware({ billing: mockBilling }));
            app.get('/customer/:id', async (c) => {
                const qzpay = getQZPay(c);
                const customer = await qzpay.customers.get(c.req.param('id'));
                return c.json({ name: customer.name });
            });

            const response = await app.request('/customer/cus_123');
            const data = await response.json();

            expect(data.name).toBe('Type Safe Customer');
        });
    });
});
