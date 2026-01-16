/**
 * Billing API Routes
 *
 * REST API routes for billing operations
 */
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { mapErrorToHttpStatus } from '../errors/error-mapper.js';
import { HttpStatus } from '../errors/http-error.js';
import { createQZPayMiddleware } from '../middleware/qzpay.middleware.js';
import { GrantEntitlementSchema, IncrementLimitSchema, RecordUsageSchema, ValidatePromoCodeSchema } from '../schemas/index.js';
import type { QZPayApiListResponse, QZPayApiResponse, QZPayBillingRoutesConfig, QZPayHonoEnv } from '../types.js';
import {
    CancelSubscriptionSchema,
    CreateCustomerSchema,
    CreateInvoiceSchema,
    CreateSubscriptionSchema,
    CustomerQuerySchema,
    IdParamSchema,
    InvoiceQuerySchema,
    PaginationSchema,
    PaymentQuerySchema,
    ProcessPaymentSchema,
    RefundPaymentSchema,
    SubscriptionQuerySchema,
    UpdateCustomerSchema,
    UpdateSubscriptionSchema
} from '../validators/schemas.js';
import { zValidator } from '../validators/zod-validator.js';

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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.get(`${prefix}/customers/:id`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const customer = await billing.customers.get(id);
                if (!customer) {
                    const [errorResponse, statusCode] = createErrorResponse('Customer not found', 'NOT_FOUND');
                    return c.json(errorResponse, statusCode);
                }
                const response: QZPayApiResponse<typeof customer> = { success: true, data: customer };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/customers`, zValidator('json', CreateCustomerSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const customer = await billing.customers.create(stripUndefined(body));
                const response: QZPayApiResponse<typeof customer> = { success: true, data: customer };
                return c.json(response, 201);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.patch(`${prefix}/customers/:id`, zValidator('param', IdParamSchema), zValidator('json', UpdateCustomerSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const body = c.req.valid('json');
                const customer = await billing.customers.update(id, stripUndefined(body));
                if (!customer) {
                    const [errorResponse, statusCode] = createErrorResponse('Customer not found', 'NOT_FOUND');
                    return c.json(errorResponse, statusCode);
                }
                const response: QZPayApiResponse<typeof customer> = { success: true, data: customer };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.delete(`${prefix}/customers/:id`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                await billing.customers.delete(id);
                const response: QZPayApiResponse = { success: true };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.get(`${prefix}/subscriptions/:id`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const subscription = await billing.subscriptions.get(id);
                if (!subscription) {
                    const [errorResponse, statusCode] = createErrorResponse('Subscription not found', 'NOT_FOUND');
                    return c.json(errorResponse, statusCode);
                }
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/subscriptions`, zValidator('json', CreateSubscriptionSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const subscription = await billing.subscriptions.create(stripUndefined(body));
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response, 201);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.patch(
            `${prefix}/subscriptions/:id`,
            zValidator('param', IdParamSchema),
            zValidator('json', UpdateSubscriptionSchema),
            async (c) => {
                try {
                    const { id } = c.req.valid('param');
                    const body = c.req.valid('json');
                    const subscription = await billing.subscriptions.update(id, stripUndefined(body));
                    const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                    return c.json(response);
                } catch (error) {
                    const [errorResponse, statusCode] = createErrorResponse(error);
                    return c.json(errorResponse, statusCode);
                }
            }
        );

        router.post(
            `${prefix}/subscriptions/:id/cancel`,
            zValidator('param', IdParamSchema),
            zValidator('json', CancelSubscriptionSchema),
            async (c) => {
                try {
                    const { id } = c.req.valid('param');
                    const body = c.req.valid('json');
                    const subscription = await billing.subscriptions.cancel(id, stripUndefined(body));
                    const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                    return c.json(response);
                } catch (error) {
                    const [errorResponse, statusCode] = createErrorResponse(error);
                    return c.json(errorResponse, statusCode);
                }
            }
        );

        router.post(`${prefix}/subscriptions/:id/pause`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const subscription = await billing.subscriptions.pause(id);
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/subscriptions/:id/resume`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const subscription = await billing.subscriptions.resume(id);
                const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.get(`${prefix}/payments/:id`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const payment = await billing.payments.get(id);
                if (!payment) {
                    const [errorResponse, statusCode] = createErrorResponse('Payment not found', 'NOT_FOUND');
                    return c.json(errorResponse, statusCode);
                }
                const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/payments`, zValidator('json', ProcessPaymentSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const payment = await billing.payments.process(stripUndefined(body));
                const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
                return c.json(response, 201);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(
            `${prefix}/payments/:id/refund`,
            zValidator('param', IdParamSchema),
            zValidator('json', RefundPaymentSchema),
            async (c) => {
                try {
                    const { id } = c.req.valid('param');
                    const body = c.req.valid('json');
                    const payment = await billing.payments.refund(stripUndefined({ paymentId: id, ...body }));
                    const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
                    return c.json(response);
                } catch (error) {
                    const [errorResponse, statusCode] = createErrorResponse(error);
                    return c.json(errorResponse, statusCode);
                }
            }
        );
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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.get(`${prefix}/invoices/:id`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const invoice = await billing.invoices.get(id);
                if (!invoice) {
                    const [errorResponse, statusCode] = createErrorResponse('Invoice not found', 'NOT_FOUND');
                    return c.json(errorResponse, statusCode);
                }
                const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/invoices`, zValidator('json', CreateInvoiceSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const invoice = await billing.invoices.create(stripUndefined(body));
                const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
                return c.json(response, 201);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/invoices/:id/void`, zValidator('param', IdParamSchema), async (c) => {
            try {
                const { id } = c.req.valid('param');
                const invoice = await billing.invoices.void(id);
                const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
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
                    const [errorResponse, statusCode] = createErrorResponse(error);
                    return c.json(errorResponse, statusCode);
                }
            }
        );

        router.get(`${prefix}/plans/:id`, async (c) => {
            try {
                const plan = await billing.plans.get(c.req.param('id'));
                if (!plan) {
                    const [errorResponse, statusCode] = createErrorResponse('Plan not found', 'NOT_FOUND');
                    return c.json(errorResponse, statusCode);
                }
                const response: QZPayApiResponse<typeof plan> = { success: true, data: plan };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.get(`${prefix}/plans/:id/prices`, async (c) => {
            try {
                const prices = await billing.plans.getPrices(c.req.param('id'));
                const response: QZPayApiResponse<typeof prices> = { success: true, data: prices };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.get(`${prefix}/promo-codes/:code`, async (c) => {
            try {
                const promoCode = await billing.promoCodes.getByCode(c.req.param('code'));
                if (!promoCode) {
                    const [errorResponse, statusCode] = createErrorResponse('Promo code not found', 'NOT_FOUND');
                    return c.json(errorResponse, statusCode);
                }
                const response: QZPayApiResponse<typeof promoCode> = { success: true, data: promoCode };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/promo-codes/validate`, zValidator('json', ValidatePromoCodeSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const result = await billing.promoCodes.validate(body.code, body.customerId, body.planId);
                const response: QZPayApiResponse<typeof result> = { success: true, data: result };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/customers/:customerId/entitlements`, zValidator('json', GrantEntitlementSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const entitlement = await billing.entitlements.grant(
                    c.req.param('customerId'),
                    body.entitlementKey,
                    body.source,
                    body.sourceId
                );
                const response: QZPayApiResponse<typeof entitlement> = { success: true, data: entitlement };
                return c.json(response, 201);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.delete(`${prefix}/customers/:customerId/entitlements/:key`, async (c) => {
            try {
                await billing.entitlements.revoke(c.req.param('customerId'), c.req.param('key'));
                const response: QZPayApiResponse = { success: true };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
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
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.get(`${prefix}/customers/:customerId/limits/:key`, async (c) => {
            try {
                const result = await billing.limits.check(c.req.param('customerId'), c.req.param('key'));
                const response: QZPayApiResponse<typeof result> = { success: true, data: result };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/customers/:customerId/limits/:key/increment`, zValidator('json', IncrementLimitSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                const limit = await billing.limits.increment(c.req.param('customerId'), c.req.param('key'), body.amount);
                const response: QZPayApiResponse<typeof limit> = { success: true, data: limit };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });

        router.post(`${prefix}/customers/:customerId/limits/:key/usage`, zValidator('json', RecordUsageSchema), async (c) => {
            try {
                const body = c.req.valid('json');
                await billing.limits.recordUsage(c.req.param('customerId'), c.req.param('key'), body.quantity, body.action);
                const response: QZPayApiResponse = { success: true };
                return c.json(response);
            } catch (error) {
                const [errorResponse, statusCode] = createErrorResponse(error);
                return c.json(errorResponse, statusCode);
            }
        });
    }

    return router;
}

/**
 * Create an error response with proper HTTP status code
 *
 * Maps errors to appropriate HTTP status codes based on error message patterns
 *
 * @param error - Error to convert to response
 * @param code - Optional explicit error code (overrides automatic mapping)
 * @returns Tuple of [response, statusCode]
 */
function createErrorResponse(error: unknown, code?: string): [QZPayApiResponse, ContentfulStatusCode] {
    // If explicit code provided (legacy behavior for explicit 404s), use it
    if (code) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = code === 'NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
        return [
            {
                success: false,
                error: {
                    code,
                    message
                }
            },
            statusCode as ContentfulStatusCode
        ];
    }

    // Otherwise, use automatic error mapping
    const { status, code: errorCode, message } = mapErrorToHttpStatus(error);
    return [
        {
            success: false,
            error: {
                code: errorCode,
                message
            }
        },
        status as ContentfulStatusCode
    ];
}

/**
 * Strip undefined values from object for exactOptionalPropertyTypes compatibility
 * Zod produces `| undefined` for optional properties, but QZPay types use `?` without `| undefined`
 * Uses double-cast to force TypeScript to accept the transformation
 */
function stripUndefined<T extends Record<string, unknown>, R = T>(obj: T): R {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as unknown as R;
}
