/**
 * Admin API Routes
 *
 * Administrative routes for managing billing operations.
 * These routes should be protected with admin-level authentication.
 */
import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { mapErrorToHttpStatus } from '../errors/error-mapper.js';
import { HttpStatus } from '../errors/http-error.js';
import { createQZPayMiddleware } from '../middleware/qzpay.middleware.js';
import type { QZPayApiListResponse, QZPayApiResponse, QZPayHonoEnv } from '../types.js';

/**
 * Admin routes configuration
 */
export interface QZPayAdminRoutesConfig {
    /** QZPay billing instance */
    billing: QZPayBilling;
    /** Route prefix (default: '/admin') */
    prefix?: string;
    /** Auth middleware for admin authentication (required) */
    authMiddleware: MiddlewareHandler;
}

/**
 * Dashboard stats response
 */
interface QZPayDashboardStats {
    customers: {
        total: number;
    };
    subscriptions: {
        total: number;
        byStatus: Record<string, number>;
    };
    payments: {
        total: number;
        totalAmount: number;
    };
    invoices: {
        total: number;
        byStatus: Record<string, number>;
    };
}

/**
 * Create admin API routes
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createAdminRoutes } from '@qazuor/qzpay-hono';
 *
 * const adminRoutes = createAdminRoutes({
 *   billing,
 *   authMiddleware: adminAuthRequired()
 * });
 *
 * app.route('/', adminRoutes);
 * ```
 */
export function createAdminRoutes(config: QZPayAdminRoutesConfig): Hono<QZPayHonoEnv> {
    const { billing, prefix = '/admin', authMiddleware } = config;

    const router = new Hono<QZPayHonoEnv>();

    // Apply QZPay middleware
    router.use('*', createQZPayMiddleware({ billing }));

    // Apply auth middleware (required for admin routes)
    router.use('*', authMiddleware);

    // Dashboard stats
    router.get(`${prefix}/dashboard`, async (c) => {
        try {
            // Fetch data for dashboard
            const [customersResult, subscriptionsResult, paymentsResult, invoicesResult] = await Promise.all([
                billing.customers.list({ limit: 1 }),
                billing.subscriptions.list({ limit: 1000 }),
                billing.payments.list({ limit: 1000 }),
                billing.invoices.list({ limit: 1000 })
            ]);

            // Calculate subscription stats by status
            const subscriptionsByStatus: Record<string, number> = {};
            for (const sub of subscriptionsResult.data) {
                subscriptionsByStatus[sub.status] = (subscriptionsByStatus[sub.status] || 0) + 1;
            }

            // Calculate payment total amount
            const totalPaymentAmount = paymentsResult.data.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0);

            // Calculate invoice stats by status
            const invoicesByStatus: Record<string, number> = {};
            for (const inv of invoicesResult.data) {
                invoicesByStatus[inv.status] = (invoicesByStatus[inv.status] || 0) + 1;
            }

            const stats: QZPayDashboardStats = {
                customers: {
                    total: customersResult.total
                },
                subscriptions: {
                    total: subscriptionsResult.total,
                    byStatus: subscriptionsByStatus
                },
                payments: {
                    total: paymentsResult.total,
                    totalAmount: totalPaymentAmount
                },
                invoices: {
                    total: invoicesResult.total,
                    byStatus: invoicesByStatus
                }
            };

            const response: QZPayApiResponse<QZPayDashboardStats> = { success: true, data: stats };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Advanced customer search
    router.get(`${prefix}/customers`, async (c) => {
        try {
            const limit = Number(c.req.query('limit')) || 50;
            const offset = Number(c.req.query('offset')) || 0;
            const email = c.req.query('email');
            const externalId = c.req.query('externalId');

            // If searching by external ID
            if (externalId) {
                const customer = await billing.customers.getByExternalId(externalId);
                const response: QZPayApiResponse<typeof customer> = {
                    success: true,
                    data: customer
                };
                return c.json(response);
            }

            const listOptions: { limit: number; offset: number; filters?: Record<string, unknown> } = {
                limit,
                offset
            };
            if (email) {
                listOptions.filters = { email };
            }
            const result = await billing.customers.list(listOptions);

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
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Get customer with full details
    router.get(`${prefix}/customers/:id/full`, async (c) => {
        try {
            const customerId = c.req.param('id');
            const [customer, subscriptions, payments, invoices, entitlements, limits] = await Promise.all([
                billing.customers.get(customerId),
                billing.subscriptions.getByCustomerId(customerId),
                billing.payments.getByCustomerId(customerId),
                billing.invoices.getByCustomerId(customerId),
                billing.entitlements.getByCustomerId(customerId),
                billing.limits.getByCustomerId(customerId)
            ]);

            if (!customer) {
                const [errorResponse, statusCode] = createErrorResponse('Customer not found', 'NOT_FOUND');
                return c.json(errorResponse, statusCode as ContentfulStatusCode);
            }

            const response: QZPayApiResponse<{
                customer: typeof customer;
                subscriptions: typeof subscriptions;
                payments: typeof payments;
                invoices: typeof invoices;
                entitlements: typeof entitlements;
                limits: typeof limits;
            }> = {
                success: true,
                data: {
                    customer,
                    subscriptions,
                    payments,
                    invoices,
                    entitlements,
                    limits
                }
            };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Advanced subscription search
    router.get(`${prefix}/subscriptions`, async (c) => {
        try {
            const limit = Number(c.req.query('limit')) || 50;
            const offset = Number(c.req.query('offset')) || 0;
            const status = c.req.query('status');
            const planId = c.req.query('planId');

            const result = await billing.subscriptions.list({
                limit,
                offset,
                filters: {
                    ...(status && { status }),
                    ...(planId && { planId })
                }
            });

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
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Force cancel subscription (admin only)
    router.post(`${prefix}/subscriptions/:id/force-cancel`, async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const subscription = await billing.subscriptions.cancel(c.req.param('id'), {
                cancelAtPeriodEnd: false,
                reason: body.reason || 'Admin force cancellation'
            });
            const response: QZPayApiResponse<typeof subscription> = { success: true, data: subscription };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Change subscription plan (admin only)
    router.post(`${prefix}/subscriptions/:id/change-plan`, async (c) => {
        try {
            const body = await c.req.json();
            const result = await billing.subscriptions.changePlan(c.req.param('id'), {
                newPlanId: body.newPlanId,
                newPriceId: body.newPriceId,
                prorationBehavior: body.prorationBehavior || 'create_prorations',
                applyAt: body.applyAt || 'immediately'
            });
            const response: QZPayApiResponse<typeof result> = { success: true, data: result };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Advanced payment search
    router.get(`${prefix}/payments`, async (c) => {
        try {
            const limit = Number(c.req.query('limit')) || 50;
            const offset = Number(c.req.query('offset')) || 0;
            const status = c.req.query('status');
            const minAmount = c.req.query('minAmount');
            const maxAmount = c.req.query('maxAmount');

            const result = await billing.payments.list({
                limit,
                offset,
                filters: {
                    ...(status && { status }),
                    ...(minAmount && { minAmount: Number(minAmount) }),
                    ...(maxAmount && { maxAmount: Number(maxAmount) })
                }
            });

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
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Force refund payment (admin only)
    router.post(`${prefix}/payments/:id/force-refund`, async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const payment = await billing.payments.refund({
                paymentId: c.req.param('id'),
                amount: body.amount,
                reason: body.reason || 'Admin force refund'
            });
            const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Advanced invoice search
    router.get(`${prefix}/invoices`, async (c) => {
        try {
            const limit = Number(c.req.query('limit')) || 50;
            const offset = Number(c.req.query('offset')) || 0;
            const status = c.req.query('status');

            const invoiceListOptions: { limit: number; offset: number; filters?: Record<string, unknown> } = {
                limit,
                offset
            };
            if (status) {
                invoiceListOptions.filters = { status };
            }
            const result = await billing.invoices.list(invoiceListOptions);

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
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Mark invoice as paid (admin only)
    router.post(`${prefix}/invoices/:id/mark-paid`, async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const invoice = await billing.invoices.markPaid(c.req.param('id'), body.paymentId || `manual_${Date.now()}`);
            const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Void invoice (admin only)
    router.post(`${prefix}/invoices/:id/void`, async (c) => {
        try {
            const invoice = await billing.invoices.void(c.req.param('id'));
            const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Grant entitlement (admin only)
    router.post(`${prefix}/customers/:customerId/entitlements`, async (c) => {
        try {
            const body = await c.req.json();
            const entitlement = await billing.entitlements.grant(
                c.req.param('customerId'),
                body.entitlementKey,
                'admin',
                body.sourceId || `admin_grant_${Date.now()}`
            );
            const response: QZPayApiResponse<typeof entitlement> = { success: true, data: entitlement };
            return c.json(response, 201);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Revoke entitlement (admin only)
    router.delete(`${prefix}/customers/:customerId/entitlements/:key`, async (c) => {
        try {
            await billing.entitlements.revoke(c.req.param('customerId'), c.req.param('key'));
            const response: QZPayApiResponse = { success: true };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Set limit (admin only)
    router.post(`${prefix}/customers/:customerId/limits/:key/set`, async (c) => {
        try {
            const body = await c.req.json();
            const limit = await billing.limits.set(c.req.param('customerId'), c.req.param('key'), body.maxValue);
            const response: QZPayApiResponse<typeof limit> = { success: true, data: limit };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Reset limit usage (admin only)
    router.post(`${prefix}/customers/:customerId/limits/:key/reset`, async (c) => {
        try {
            // Get current limit to know the max value
            const currentLimit = await billing.limits.check(c.req.param('customerId'), c.req.param('key'));
            // Record usage with 'set' action to reset to 0
            await billing.limits.recordUsage(c.req.param('customerId'), c.req.param('key'), 0, 'set');
            const response: QZPayApiResponse<{ reset: true; previousValue: number }> = {
                success: true,
                data: { reset: true, previousValue: currentLimit.currentValue }
            };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Promo codes management
    router.get(`${prefix}/promo-codes`, async (c) => {
        try {
            const limit = Number(c.req.query('limit')) || 50;
            const offset = Number(c.req.query('offset')) || 0;
            const active = c.req.query('active');

            const promoListOptions: { limit: number; offset: number; filters?: Record<string, unknown> } = {
                limit,
                offset
            };
            if (active !== undefined) {
                promoListOptions.filters = { active: active === 'true' };
            }
            const result = await billing.promoCodes.list(promoListOptions);

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
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Plans management
    router.get(`${prefix}/plans`, async (c) => {
        try {
            const activeOnly = c.req.query('active') === 'true';

            if (activeOnly) {
                const data = await billing.plans.getActive();
                const response: QZPayApiResponse<typeof data> = { success: true, data };
                return c.json(response);
            }

            const limit = Number(c.req.query('limit')) || 50;
            const offset = Number(c.req.query('offset')) || 0;
            const result = await billing.plans.list({ limit, offset });

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
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

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
