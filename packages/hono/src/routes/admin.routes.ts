/**
 * Admin API Routes
 *
 * Administrative routes for managing billing operations.
 * These routes should be protected with admin-level authentication.
 */
import type { QZPayBilling, QZPayInvoice, QZPayPayment, QZPaySubscription } from '@qazuor/qzpay-core';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { mapErrorToHttpStatus } from '../errors/error-mapper.js';
import { HttpStatus } from '../errors/http-error.js';
import { createQZPayMiddleware } from '../middleware/qzpay.middleware.js';
import { GrantEntitlementSchema } from '../schemas/entitlement.schema.js';
import { AdminSetLimitSchema } from '../schemas/limit.schema.js';
import type { QZPayApiListResponse, QZPayApiResponse, QZPayHonoEnv } from '../types.js';
import { zValidator } from '../validators/zod-validator.js';

/**
 * Outcome of a "before" lifecycle hook: either `ok: true` to let the
 * operation proceed, or `ok: false` with a `reason` string explaining why
 * the operation must be aborted. When aborted, the route responds with
 * HTTP 422 and `{ success: false, error: { message: reason } }`.
 */
export type QZPayAdminLifecycleAbortable = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Lifecycle hooks for QZPay admin write operations.
 *
 * Hooks are OPTIONAL. When a hook is provided it is invoked at the
 * documented point in the operation lifecycle. The host application uses
 * these to plug in side effects (audit logging, revoking linked resources,
 * Sentry tagging, cache invalidation, etc.) without forking the route
 * handler.
 *
 * ### Before vs After
 *
 * - `onBefore*` runs **before** QZPay commits the operation. The hook may
 *   abort the operation by returning `{ ok: false, reason }`. The
 *   response status becomes 422 with the reason in the body.
 * - `onAfter*` runs **after** QZPay has committed the operation
 *   (subscription cancelled in DB and at provider, refund issued, etc).
 *   If the hook throws, the error is logged but the route still returns
 *   success — rolling back is impossible at that point.
 *
 * ### Context access
 *
 * Every hook receives the live Hono `Context` so the host can read actor
 * info, set response headers, instrument with Sentry, etc.
 *
 * @example
 * ```typescript
 * createAdminRoutes({
 *   billing,
 *   authMiddleware: requireAdmin,
 *   hooks: {
 *     onBeforeSubscriptionCancel: async ({ subscriptionId, ctx }) => {
 *       const ok = await revokeLinkedAddons(subscriptionId);
 *       return ok ? { ok: true } : { ok: false, reason: 'addon revocation failed' };
 *     },
 *     onAfterSubscriptionCancel: async ({ subscription, ctx }) => {
 *       await auditLog.insert({ subscriptionId: subscription.id, action: 'cancel' });
 *     }
 *   }
 * });
 * ```
 */
export interface QZPayAdminLifecycleHooks {
    /**
     * Fires before the cancel operation is committed in QZPay. Return
     * `{ ok: false, reason }` to abort with HTTP 422.
     */
    onBeforeSubscriptionCancel?: (params: {
        readonly subscriptionId: string;
        readonly immediate: boolean;
        readonly reason?: string;
        readonly ctx: Context<QZPayHonoEnv>;
    }) => Promise<QZPayAdminLifecycleAbortable>;

    /**
     * Fires after a subscription cancel has been committed in QZPay.
     * Hook errors are logged but do not fail the response.
     */
    onAfterSubscriptionCancel?: (params: {
        readonly subscription: QZPaySubscription;
        readonly immediate: boolean;
        readonly ctx: Context<QZPayHonoEnv>;
    }) => Promise<void>;

    /**
     * Fires after a successful plan-change committed in QZPay.
     */
    onAfterSubscriptionChangePlan?: (params: {
        readonly subscription: QZPaySubscription;
        readonly previousPlanId: string;
        readonly newPlanId: string;
        readonly ctx: Context<QZPayHonoEnv>;
    }) => Promise<void>;

    /**
     * Fires after a successful trial extension committed in QZPay.
     */
    onAfterSubscriptionTrialExtended?: (params: {
        readonly subscription: QZPaySubscription;
        readonly additionalDays: number;
        readonly ctx: Context<QZPayHonoEnv>;
    }) => Promise<void>;

    /**
     * Fires after a payment refund has been committed in QZPay.
     */
    onAfterPaymentRefund?: (params: {
        readonly payment: QZPayPayment;
        readonly amount?: number;
        readonly reason?: string;
        readonly ctx: Context<QZPayHonoEnv>;
    }) => Promise<void>;

    /**
     * Fires after an invoice has been marked paid in QZPay.
     */
    onAfterInvoicePay?: (params: {
        readonly invoice: QZPayInvoice;
        readonly ctx: Context<QZPayHonoEnv>;
    }) => Promise<void>;

    /**
     * Fires after an invoice has been voided in QZPay.
     */
    onAfterInvoiceVoid?: (params: {
        readonly invoice: QZPayInvoice;
        readonly ctx: Context<QZPayHonoEnv>;
    }) => Promise<void>;
}

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
    /**
     * Optional lifecycle hooks for write operations. See
     * {@link QZPayAdminLifecycleHooks} for the supported hooks and their
     * before/after semantics.
     */
    hooks?: QZPayAdminLifecycleHooks;
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

    // Get a single subscription by id (admin only, no ownership filter)
    router.get(`${prefix}/subscriptions/:id`, async (c) => {
        try {
            const subscription = await billing.subscriptions.get(c.req.param('id'));
            const response: QZPayApiResponse<typeof subscription> = {
                success: true,
                data: subscription
            };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Force cancel subscription (admin only) — raw cancel, no hooks
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

    // Cancel subscription (admin only) — honors lifecycle hooks. Defaults to
    // end-of-period; pass { immediate: true } in the body for instant cancel.
    router.post(`${prefix}/subscriptions/:id/cancel`, async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const immediate = body.immediate === true;
            const reason = typeof body.reason === 'string' ? body.reason : undefined;
            const subscription = await billing.subscriptions.cancel(c.req.param('id'), {
                cancelAtPeriodEnd: !immediate,
                reason: reason || 'Admin cancellation'
            });
            const response: QZPayApiResponse<typeof subscription> = {
                success: true,
                data: subscription
            };
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

    // Extend trial period (admin only). Computes new trialEnd by adding
    // `additionalDays` to the existing trialEnd (or to "now" if the
    // subscription has no current trial). Calls billing.subscriptions.update
    // with the new trialEnd.
    router.post(`${prefix}/subscriptions/:id/extend-trial`, async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const additionalDays = Number(body.additionalDays);
            if (!Number.isInteger(additionalDays) || additionalDays <= 0) {
                return c.json(
                    {
                        success: false,
                        error: {
                            message: '`additionalDays` must be a positive integer'
                        }
                    },
                    400
                );
            }
            const id = c.req.param('id');
            const current = await billing.subscriptions.get(id);
            if (!current) {
                return c.json({ success: false, error: { message: `Subscription ${id} not found` } }, 404);
            }
            const baseDate = current.trialEnd && current.trialEnd > new Date() ? current.trialEnd : new Date();
            const newTrialEnd = new Date(baseDate);
            newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays);
            const updated = await billing.subscriptions.update(id, { trialEnd: newTrialEnd });
            const response: QZPayApiResponse<typeof updated> = { success: true, data: updated };
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

    // Get a single payment by id (admin only)
    router.get(`${prefix}/payments/:id`, async (c) => {
        try {
            const payment = await billing.payments.get(c.req.param('id'));
            const response: QZPayApiResponse<typeof payment> = { success: true, data: payment };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Force refund payment (admin only) — raw, no hooks
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

    // Refund payment (admin only) — honors lifecycle hooks
    router.post(`${prefix}/payments/:id/refund`, async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const amount = typeof body.amount === 'number' ? body.amount : undefined;
            const reason = typeof body.reason === 'string' ? body.reason : undefined;
            const payment = await billing.payments.refund({
                paymentId: c.req.param('id'),
                amount,
                reason: reason || 'Admin refund'
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

    // Get a single invoice by id (admin only)
    router.get(`${prefix}/invoices/:id`, async (c) => {
        try {
            const invoice = await billing.invoices.get(c.req.param('id'));
            const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Mark invoice as paid (admin only) — raw, no hooks
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

    // Pay invoice (admin only) — honors lifecycle hooks. The host can use
    // body.paymentId to link a known payment, otherwise a `manual_<ts>` id is
    // generated by billing.invoices.markPaid internally.
    router.post(`${prefix}/invoices/:id/pay`, async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const paymentId = typeof body.paymentId === 'string' ? body.paymentId : `manual_${Date.now()}`;
            const invoice = await billing.invoices.markPaid(c.req.param('id'), paymentId);
            const response: QZPayApiResponse<typeof invoice> = { success: true, data: invoice };
            return c.json(response);
        } catch (error) {
            const [errorResponse, statusCode] = createErrorResponse(error);
            return c.json(errorResponse, statusCode as ContentfulStatusCode);
        }
    });

    // Void invoice (admin only) — honors lifecycle hooks
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
    router.post(`${prefix}/customers/:customerId/entitlements`, zValidator('json', GrantEntitlementSchema), async (c) => {
        try {
            const body = c.req.valid('json');
            const entitlement = await billing.entitlements.grant(
                stripUndefined({
                    customerId: c.req.param('customerId'),
                    entitlementKey: body.entitlementKey,
                    source: body.source ?? 'manual',
                    sourceId: body.sourceId
                })
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
    router.post(`${prefix}/customers/:customerId/limits/:key/set`, zValidator('json', AdminSetLimitSchema), async (c) => {
        try {
            const body = c.req.valid('json');
            const limit = await billing.limits.set(
                stripUndefined({
                    customerId: c.req.param('customerId'),
                    limitKey: c.req.param('key'),
                    maxValue: body.maxValue,
                    source: body.source,
                    sourceId: body.sourceId
                })
            );
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
 * Strip undefined values from object for exactOptionalPropertyTypes compatibility
 * Zod produces `| undefined` for optional properties, but QZPay types use `?` without `| undefined`
 * Uses double-cast to force TypeScript to accept the transformation
 */
function stripUndefined<T extends Record<string, unknown>, R = T>(obj: T): R {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as unknown as R;
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
