import { zValidator } from '@hono/zod-validator';
/**
 * Billing API Routes
 *
 * REST API routes for billing operations
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { createQZPayMiddleware } from '../middleware/qzpay.middleware.js';
import type { QZPayApiListResponse, QZPayApiResponse, QZPayBillingRoutesConfig, QZPayHonoEnv } from '../types.js';
import {
    CancelSubscriptionSchema,
    CreateCustomerSchema,
    CreateInvoiceSchema,
    CustomerQuerySchema,
    InvoiceQuerySchema,
    PaginationSchema,
    PaymentQuerySchema,
    ProcessPaymentSchema,
    RefundPaymentSchema,
    SubscriptionQuerySchema,
    UpdateCustomerSchema
} from '../validators/schemas.js';

/**
 * Create billing API routes
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createBillingRoutes } from '@qazuor/qzpay-hono';
 *
 * const billingRoutes = createBillingRoutes({
 *   billing,
 *   prefix: '/api/billing',
 *   authMiddleware: authRequired()
 * });
 *
 * app.route('/', billingRoutes);
 * ```
 */
export function createBillingRoutes(config: QZPayBillingRoutesConfig): Hono<QZPayHonoEnv> {
    const {
        billing,
        prefix = '/billing',
        customers = true,
        subscriptions = true,
        payments = true,
        invoices = true,
        plans = true,
        promoCodes = true,
        entitlements = true,
        limits = true,
        authMiddleware
    } = config;

    const router = new Hono<QZPayHonoEnv>();

    // Apply QZPay middleware
    router.use('*', createQZPayMiddleware({ billing }));

    // Apply auth middleware if provided
    if (authMiddleware) {
        router.use('*', authMiddleware);
    }

    // Customer routes
    if (customers) {
        router.get(`${prefix}/customers`, zValidator('query', CustomerQuerySchema), async (c) => {
            try {
                const query = c.req.valid('query');
                const result = await billing.customers.list({ limit: query.limit, offset: query.offset });

                const response: QZPayApiListResponse<(typeof result.data)[0]> = {
                    success: true,
                    data: result.data,
                    pagination: {
                        limit: query.limit,
                        offset: query.offset,
                        hasMore: result.hasMore,
                        total: result.total
                    }
                };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/customers/:id`, async (c) => {
            try {
                const customer = await billing.customers.get(c.req.param('id'));
                if (!customer) {
                    return c.json(createErrorResponse('Customer not found', 'NOT_FOUND'), 404);
                }
                const response: QZPayApiResponse<typeof customer> = { success: true, data: customer };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/customers`, zValidator('json', CreateCustomerSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const customer = await billing.customers.create(stripUndefined(body));
                const response: QZPayApiResponse<typeof customer> = { success: true, data: customer };
                return c.json(response, 201);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.patch(`${prefix}/customers/:id`, zValidator('json', UpdateCustomerSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const customer = await billing.customers.update(c.req.param('id'), stripUndefined(body));
                if (!customer) {
                    return c.json(createErrorResponse('Customer not found', 'NOT_FOUND'), 404);
                }
                const response: QZPayApiResponse<typeof customer> = { success: true, data: customer };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.delete(`${prefix}/customers/:id`, async (c) => {
            try {
                await billing.customers.delete(c.req.param('id'));
                const response: QZPayApiResponse = { success: true };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    // Subscription routes
    if (subscriptions) {
        router.get(`${prefix}/subscriptions`, zValidator('query', SubscriptionQuerySchema), async (c) => {
            try {
                const query = c.req.valid('query');

                if (query.customerId) {
                    const data = await billing.subscriptions.getByCustomerId(query.customerId);
                    const response: QZPayApiResponse<typeof data> = { success: true, data };
                    return c.json(response);
                }

                const result = await billing.subscriptions.list({ limit: query.limit, offset: query.offset });
                const response: QZPayApiListResponse<(typeof result.data)[0]> = {
                    success: true,
                    data: result.data,
                    pagination: {
                        limit: query.limit,
                        offset: query.offset,
                        hasMore: result.hasMore,
                        total: result.total
                    }
                };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/subscriptions/:id`, async (c) => {
            try {
                const subscription = await billing.subscriptions.get(c.req.param('id'));
                if (!subscription) {
                    return c.json(createErrorResponse('Subscription not found', 'NOT_FOUND'), 404);
                }
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/subscriptions`, async (c) => {
            try {
                const body = await c.req.json();
                const subscription = await billing.subscriptions.create(body);
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response, 201);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.patch(`${prefix}/subscriptions/:id`, async (c) => {
            try {
                const body = await c.req.json();
                const subscription = await billing.subscriptions.update(c.req.param('id'), body);
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/subscriptions/:id/cancel`, zValidator('json', CancelSubscriptionSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const subscription = await billing.subscriptions.cancel(c.req.param('id'), stripUndefined(body));
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/subscriptions/:id/pause`, async (c) => {
            try {
                const subscription = await billing.subscriptions.pause(c.req.param('id'));
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/subscriptions/:id/resume`, async (c) => {
            try {
                const subscription = await billing.subscriptions.resume(c.req.param('id'));
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    // Payment routes
    if (payments) {
        router.get(`${prefix}/payments`, zValidator('query', PaymentQuerySchema), async (c) => {
            try {
                const query = c.req.valid('query');

                if (query.customerId) {
                    const data = await billing.payments.getByCustomerId(query.customerId);
                    const response: QZPayApiResponse<typeof data> = { success: true, data };
                    return c.json(response);
                }

                const result = await billing.payments.list({ limit: query.limit, offset: query.offset });
                const response: QZPayApiListResponse<(typeof result.data)[0]> = {
                    success: true,
                    data: result.data,
                    pagination: {
                        limit: query.limit,
                        offset: query.offset,
                        hasMore: result.hasMore,
                        total: result.total
                    }
                };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/payments/:id`, async (c) => {
            try {
                const payment = await billing.payments.get(c.req.param('id'));
                if (!payment) {
                    return c.json(createErrorResponse('Payment not found', 'NOT_FOUND'), 404);
                }
                const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/payments`, zValidator('json', ProcessPaymentSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const payment = await billing.payments.process(stripUndefined(body));
                const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
                return c.json(response, 201);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/payments/:id/refund`, zValidator('json', RefundPaymentSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const payment = await billing.payments.refund(stripUndefined({ paymentId: c.req.param('id'), ...body }));
                const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    // Invoice routes
    if (invoices) {
        router.get(`${prefix}/invoices`, zValidator('query', InvoiceQuerySchema), async (c) => {
            try {
                const query = c.req.valid('query');

                if (query.customerId) {
                    const data = await billing.invoices.getByCustomerId(query.customerId);
                    const response: QZPayApiResponse<typeof data> = { success: true, data };
                    return c.json(response);
                }

                const result = await billing.invoices.list({ limit: query.limit, offset: query.offset });
                const response: QZPayApiListResponse<(typeof result.data)[0]> = {
                    success: true,
                    data: result.data,
                    pagination: {
                        limit: query.limit,
                        offset: query.offset,
                        hasMore: result.hasMore,
                        total: result.total
                    }
                };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/invoices/:id`, async (c) => {
            try {
                const invoice = await billing.invoices.get(c.req.param('id'));
                if (!invoice) {
                    return c.json(createErrorResponse('Invoice not found', 'NOT_FOUND'), 404);
                }
                const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/invoices`, zValidator('json', CreateInvoiceSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const invoice = await billing.invoices.create(stripUndefined(body));
                const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
                return c.json(response, 201);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/invoices/:id/void`, async (c) => {
            try {
                const invoice = await billing.invoices.void(c.req.param('id'));
                const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    // Plan routes
    if (plans) {
        router.get(
            `${prefix}/plans`,
            zValidator('query', PaginationSchema.extend({ active: z.enum(['true', 'false']).optional() })),
            async (c) => {
                try {
                    const query = c.req.valid('query');
                    if (query.active === 'true') {
                        const data = await billing.plans.getActive();
                        const response: QZPayApiResponse<typeof data> = { success: true, data };
                        return c.json(response);
                    }

                    const result = await billing.plans.list({ limit: query.limit, offset: query.offset });
                    const response: QZPayApiListResponse<(typeof result.data)[0]> = {
                        success: true,
                        data: result.data,
                        pagination: {
                            limit: query.limit,
                            offset: query.offset,
                            hasMore: result.hasMore,
                            total: result.total
                        }
                    };
                    return c.json(response);
                } catch (error) {
                    return c.json(createErrorResponse(error), 500);
                }
            }
        );

        router.get(`${prefix}/plans/:id`, async (c) => {
            try {
                const plan = await billing.plans.get(c.req.param('id'));
                if (!plan) {
                    return c.json(createErrorResponse('Plan not found', 'NOT_FOUND'), 404);
                }
                const response: QZPayApiResponse<typeof plan> = { success: true, data: plan };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/plans/:id/prices`, async (c) => {
            try {
                const prices = await billing.plans.getPrices(c.req.param('id'));
                const response: QZPayApiResponse<typeof prices> = { success: true, data: prices };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    // Promo code routes
    if (promoCodes) {
        router.get(`${prefix}/promo-codes`, async (c) => {
            try {
                const limit = Number(c.req.query('limit')) || 20;
                const offset = Number(c.req.query('offset')) || 0;
                const result = await billing.promoCodes.list({ limit, offset });
                const response: QZPayApiListResponse<(typeof result.data)[0]> = {
                    success: true,
                    data: result.data,
                    pagination: {
                        limit,
                        offset,
                        hasMore: result.hasMore,
                        total: result.total
                    }
                };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/promo-codes/:code`, async (c) => {
            try {
                const promoCode = await billing.promoCodes.getByCode(c.req.param('code'));
                if (!promoCode) {
                    return c.json(createErrorResponse('Promo code not found', 'NOT_FOUND'), 404);
                }
                const response: QZPayApiResponse<typeof promoCode> = { success: true, data: promoCode };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/promo-codes/validate`, async (c) => {
            try {
                const body = await c.req.json();
                const result = await billing.promoCodes.validate(body.code, body.customerId, body.planId);
                const response: QZPayApiResponse<typeof result> = { success: true, data: result };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    // Entitlement routes
    if (entitlements) {
        router.get(`${prefix}/customers/:customerId/entitlements`, async (c) => {
            try {
                const data = await billing.entitlements.getByCustomerId(c.req.param('customerId'));
                const response: QZPayApiResponse<typeof data> = { success: true, data };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/customers/:customerId/entitlements/:key`, async (c) => {
            try {
                const hasEntitlement = await billing.entitlements.check(c.req.param('customerId'), c.req.param('key'));
                const response: QZPayApiResponse<{ hasEntitlement: boolean }> = {
                    success: true,
                    data: { hasEntitlement }
                };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/customers/:customerId/entitlements`, async (c) => {
            try {
                const body = await c.req.json();
                const entitlement = await billing.entitlements.grant(
                    c.req.param('customerId'),
                    body.entitlementKey,
                    body.source,
                    body.sourceId
                );
                const response: QZPayApiResponse<typeof entitlement> = { success: true, data: entitlement };
                return c.json(response, 201);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.delete(`${prefix}/customers/:customerId/entitlements/:key`, async (c) => {
            try {
                await billing.entitlements.revoke(c.req.param('customerId'), c.req.param('key'));
                const response: QZPayApiResponse = { success: true };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    // Limit routes
    if (limits) {
        router.get(`${prefix}/customers/:customerId/limits`, async (c) => {
            try {
                const data = await billing.limits.getByCustomerId(c.req.param('customerId'));
                const response: QZPayApiResponse<typeof data> = { success: true, data };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.get(`${prefix}/customers/:customerId/limits/:key`, async (c) => {
            try {
                const result = await billing.limits.check(c.req.param('customerId'), c.req.param('key'));
                const response: QZPayApiResponse<typeof result> = { success: true, data: result };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/customers/:customerId/limits/:key/increment`, async (c) => {
            try {
                const body = await c.req.json().catch(() => ({}));
                const limit = await billing.limits.increment(c.req.param('customerId'), c.req.param('key'), body.amount);
                const response: QZPayApiResponse<typeof limit> = { success: true, data: limit };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });

        router.post(`${prefix}/customers/:customerId/limits/:key/usage`, async (c) => {
            try {
                const body = await c.req.json();
                await billing.limits.recordUsage(c.req.param('customerId'), c.req.param('key'), body.quantity, body.action);
                const response: QZPayApiResponse = { success: true };
                return c.json(response);
            } catch (error) {
                return c.json(createErrorResponse(error), 500);
            }
        });
    }

    return router;
}

/**
 * Create an error response
 */
function createErrorResponse(error: unknown, code?: string): QZPayApiResponse {
    const message = error instanceof Error ? error.message : String(error);
    return {
        success: false,
        error: {
            code: code ?? 'INTERNAL_ERROR',
            message
        }
    };
}

/**
 * Strip undefined values from object for exactOptionalPropertyTypes compatibility
 * Zod produces `| undefined` for optional properties, but QZPay types use `?` without `| undefined`
 * Uses double-cast to force TypeScript to accept the transformation
 */
function stripUndefined<T extends Record<string, unknown>, R = T>(obj: T): R {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as unknown as R;
}
