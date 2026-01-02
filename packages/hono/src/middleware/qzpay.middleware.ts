/**
 * QZPay Context Middleware
 *
 * Attaches QZPay billing instance to Hono context
 */
import type { MiddlewareHandler } from 'hono';
import type { QZPayHonoEnv, QZPayMiddlewareConfig } from '../types.js';

/**
 * Create QZPay middleware that attaches billing instance to context
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createQZPayMiddleware } from '@qazuor/qzpay-hono';
 * import { createQZPayBilling } from '@qazuor/qzpay-core';
 *
 * const billing = createQZPayBilling({ storage });
 * const app = new Hono();
 *
 * app.use('*', createQZPayMiddleware({ billing }));
 *
 * app.get('/customer/:id', async (c) => {
 *   const qzpay = c.get('qzpay');
 *   const customer = await qzpay.customers.get(c.req.param('id'));
 *   return c.json(customer);
 * });
 * ```
 */
export function createQZPayMiddleware(config: QZPayMiddlewareConfig): MiddlewareHandler<QZPayHonoEnv> {
    return async (c, next) => {
        c.set('qzpay', config.billing);
        await next();
    };
}

/**
 * Get QZPay billing instance from context
 * Utility function for type-safe access
 *
 * @example
 * ```typescript
 * app.get('/customer/:id', async (c) => {
 *   const qzpay = getQZPay(c);
 *   const customer = await qzpay.customers.get(c.req.param('id'));
 *   return c.json(customer);
 * });
 * ```
 */
export function getQZPay<E extends QZPayHonoEnv>(c: { get: (key: 'qzpay') => E['Variables']['qzpay'] }) {
    return c.get('qzpay');
}
