import type { QZPayBilling } from '@qazuor/qzpay-core';
import { Hono } from 'hono';
/**
 * Admin Routes Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { createAdminRoutes } from '../../src/routes/admin.routes.js';

// Mock auth middleware
const mockAuthMiddleware = vi.fn(async (_c, next) => {
    await next();
});

// Create mock billing instance
function createMockBilling(): QZPayBilling {
    return {
        customers: {
            list: vi.fn().mockResolvedValue({
                data: [{ id: 'cus_1', email: 'test@test.com' }],
                total: 1,
                limit: 20,
                offset: 0,
                hasMore: false
            }),
            get: vi.fn().mockResolvedValue({ id: 'cus_1', email: 'test@test.com' }),
            getByExternalId: vi.fn().mockResolvedValue({ id: 'cus_1', email: 'test@test.com', externalId: 'ext_1' }),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            syncUser: vi.fn()
        },
        subscriptions: {
            list: vi.fn().mockResolvedValue({
                data: [
                    { id: 'sub_1', status: 'active', planId: 'plan_1' },
                    { id: 'sub_2', status: 'canceled', planId: 'plan_2' }
                ],
                total: 2,
                limit: 20,
                offset: 0,
                hasMore: false
            }),
            get: vi.fn().mockResolvedValue({ id: 'sub_1', status: 'active' }),
            getByCustomerId: vi.fn().mockResolvedValue([{ id: 'sub_1', status: 'active' }]),
            create: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn().mockResolvedValue({ id: 'sub_1', status: 'canceled' }),
            pause: vi.fn(),
            resume: vi.fn(),
            changePlan: vi.fn().mockResolvedValue({
                subscription: { id: 'sub_1', planId: 'new_plan' },
                proration: { creditAmount: 0, chargeAmount: 500, effectiveDate: new Date() }
            })
        },
        payments: {
            list: vi.fn().mockResolvedValue({
                data: [
                    { id: 'pay_1', amount: 1000, status: 'succeeded' },
                    { id: 'pay_2', amount: 2000, status: 'succeeded' }
                ],
                total: 2,
                limit: 20,
                offset: 0,
                hasMore: false
            }),
            get: vi.fn().mockResolvedValue({ id: 'pay_1', amount: 1000, status: 'succeeded' }),
            getByCustomerId: vi.fn().mockResolvedValue([{ id: 'pay_1', amount: 1000 }]),
            process: vi.fn(),
            refund: vi.fn().mockResolvedValue({ id: 'pay_1', status: 'refunded' })
        },
        invoices: {
            list: vi.fn().mockResolvedValue({
                data: [
                    { id: 'inv_1', status: 'paid' },
                    { id: 'inv_2', status: 'open' }
                ],
                total: 2,
                limit: 20,
                offset: 0,
                hasMore: false
            }),
            get: vi.fn().mockResolvedValue({ id: 'inv_1', status: 'open' }),
            getByCustomerId: vi.fn().mockResolvedValue([{ id: 'inv_1' }]),
            create: vi.fn(),
            markPaid: vi.fn().mockResolvedValue({ id: 'inv_1', status: 'paid' }),
            void: vi.fn().mockResolvedValue({ id: 'inv_1', status: 'void' })
        },
        plans: {
            list: vi.fn().mockResolvedValue({
                data: [{ id: 'plan_1', name: 'Pro' }],
                total: 1,
                limit: 20,
                offset: 0,
                hasMore: false
            }),
            get: vi.fn(),
            getActive: vi.fn().mockResolvedValue([{ id: 'plan_1', name: 'Pro', active: true }]),
            getPrices: vi.fn()
        },
        promoCodes: {
            list: vi.fn().mockResolvedValue({
                data: [{ id: 'promo_1', code: 'SAVE20' }],
                total: 1,
                limit: 20,
                offset: 0,
                hasMore: false
            }),
            validate: vi.fn(),
            apply: vi.fn(),
            getByCode: vi.fn()
        },
        entitlements: {
            check: vi.fn().mockResolvedValue(true),
            getByCustomerId: vi.fn().mockResolvedValue([{ id: 'ent_1', entitlementKey: 'feature_a' }]),
            grant: vi.fn().mockResolvedValue({ id: 'ent_2', entitlementKey: 'feature_b' }),
            revoke: vi.fn().mockResolvedValue(undefined)
        },
        limits: {
            check: vi.fn().mockResolvedValue({ allowed: true, currentValue: 50, maxValue: 100, remaining: 50 }),
            getByCustomerId: vi.fn().mockResolvedValue([{ id: 'lim_1', limitKey: 'api_calls' }]),
            increment: vi.fn(),
            set: vi.fn().mockResolvedValue({ id: 'lim_1', limitKey: 'api_calls', currentValue: 0, maxValue: 200 }),
            recordUsage: vi.fn().mockResolvedValue(undefined)
        },
        metrics: {},
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        getPlans: vi.fn().mockReturnValue([]),
        getPlan: vi.fn(),
        isLivemode: vi.fn().mockReturnValue(false),
        getStorage: vi.fn(),
        getPaymentAdapter: vi.fn()
    } as unknown as QZPayBilling;
}

describe('Admin Routes', () => {
    describe('GET /admin/dashboard', () => {
        it('should return dashboard stats', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/dashboard');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toHaveProperty('customers');
            expect(body.data).toHaveProperty('subscriptions');
            expect(body.data).toHaveProperty('payments');
            expect(body.data).toHaveProperty('invoices');
            expect(body.data.payments.totalAmount).toBe(3000);
        });
    });

    describe('GET /admin/customers', () => {
        it('should list customers with pagination', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers?limit=50&offset=0');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.pagination).toBeDefined();
        });

        it('should search by external ID', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers?externalId=ext_1');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.customers.getByExternalId).toHaveBeenCalledWith('ext_1');
        });
    });

    describe('GET /admin/customers/:id/full', () => {
        it('should return full customer details', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/full');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toHaveProperty('customer');
            expect(body.data).toHaveProperty('subscriptions');
            expect(body.data).toHaveProperty('payments');
            expect(body.data).toHaveProperty('invoices');
            expect(body.data).toHaveProperty('entitlements');
            expect(body.data).toHaveProperty('limits');
        });

        it('should return 404 for non-existent customer', async () => {
            const billing = createMockBilling();
            (billing.customers.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/nonexistent/full');
            expect(res.status).toBe(404);
        });
    });

    describe('POST /admin/subscriptions/:id/force-cancel', () => {
        it('should force cancel subscription', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/subscriptions/sub_1/force-cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'Test cancellation' })
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.subscriptions.cancel).toHaveBeenCalledWith('sub_1', {
                cancelAtPeriodEnd: false,
                reason: 'Test cancellation'
            });
        });
    });

    describe('POST /admin/subscriptions/:id/change-plan', () => {
        it('should change subscription plan', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/subscriptions/sub_1/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPlanId: 'plan_pro' })
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.subscriptions.changePlan).toHaveBeenCalled();
        });
    });

    describe('POST /admin/payments/:id/force-refund', () => {
        it('should force refund payment', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/payments/pay_1/force-refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'Customer request' })
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.payments.refund).toHaveBeenCalled();
        });
    });

    describe('POST /admin/invoices/:id/mark-paid', () => {
        it('should mark invoice as paid', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices/inv_1/mark-paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: 'pay_manual' })
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.invoices.markPaid).toHaveBeenCalledWith('inv_1', 'pay_manual');
        });
    });

    describe('POST /admin/invoices/:id/void', () => {
        it('should void invoice', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices/inv_1/void', {
                method: 'POST'
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.invoices.void).toHaveBeenCalledWith('inv_1');
        });
    });

    describe('POST /admin/customers/:customerId/entitlements', () => {
        it('should grant entitlement', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/entitlements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entitlementKey: 'premium_feature' })
            });

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.entitlements.grant).toHaveBeenCalled();
        });
    });

    describe('DELETE /admin/customers/:customerId/entitlements/:key', () => {
        it('should revoke entitlement', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/entitlements/premium_feature', {
                method: 'DELETE'
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.entitlements.revoke).toHaveBeenCalledWith('cus_1', 'premium_feature');
        });
    });

    describe('POST /admin/customers/:customerId/limits/:key/set', () => {
        it('should set limit', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/limits/api_calls/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxValue: 500 })
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.limits.set).toHaveBeenCalledWith('cus_1', 'api_calls', 500);
        });
    });

    describe('POST /admin/customers/:customerId/limits/:key/reset', () => {
        it('should reset limit usage', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/limits/api_calls/reset', {
                method: 'POST'
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.reset).toBe(true);
            expect(body.data.previousValue).toBe(50);
        });
    });

    describe('GET /admin/subscriptions', () => {
        it('should list subscriptions with filters', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/subscriptions?status=active&planId=plan_1');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.subscriptions.list).toHaveBeenCalledWith({
                limit: 50,
                offset: 0,
                filters: {
                    status: 'active',
                    planId: 'plan_1'
                }
            });
        });

        it('should handle errors', async () => {
            const billing = createMockBilling();
            (billing.subscriptions.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/subscriptions');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /admin/payments', () => {
        it('should list payments with filters', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/payments?status=succeeded&minAmount=1000&maxAmount=5000');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.payments.list).toHaveBeenCalledWith({
                limit: 50,
                offset: 0,
                filters: {
                    status: 'succeeded',
                    minAmount: 1000,
                    maxAmount: 5000
                }
            });
        });

        it('should handle errors', async () => {
            const billing = createMockBilling();
            (billing.payments.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/payments');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /admin/invoices', () => {
        it('should list invoices with status filter', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices?status=open');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.invoices.list).toHaveBeenCalledWith({
                limit: 50,
                offset: 0,
                filters: { status: 'open' }
            });
        });

        it('should list invoices without filters', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should handle errors', async () => {
            const billing = createMockBilling();
            (billing.invoices.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /admin/customers - search by email', () => {
        it('should search customers by email', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers?email=test@test.com');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(billing.customers.list).toHaveBeenCalledWith({
                limit: 50,
                offset: 0,
                filters: { email: 'test@test.com' }
            });
        });

        it('should handle errors when searching by external ID', async () => {
            const billing = createMockBilling();
            (billing.customers.getByExternalId as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('External ID error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers?externalId=ext_123');
            expect(res.status).toBe(500);
        });

        it('should handle errors when searching by email', async () => {
            const billing = createMockBilling();
            (billing.customers.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('List error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers?email=test@example.com');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /admin/promo-codes', () => {
        it('should list all promo codes', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/promo-codes');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should filter by active status true', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/promo-codes?active=true');
            expect(res.status).toBe(200);

            expect(billing.promoCodes.list).toHaveBeenCalledWith({
                limit: 50,
                offset: 0,
                filters: { active: true }
            });
        });

        it('should filter by active status false', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/promo-codes?active=false');
            expect(res.status).toBe(200);

            expect(billing.promoCodes.list).toHaveBeenCalledWith({
                limit: 50,
                offset: 0,
                filters: { active: false }
            });
        });

        it('should handle errors', async () => {
            const billing = createMockBilling();
            (billing.promoCodes.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/promo-codes');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /admin/plans', () => {
        it('should list all plans', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/plans');
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
        });

        it('should handle errors', async () => {
            const billing = createMockBilling();
            (billing.plans.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/plans');
            expect(res.status).toBe(500);
        });

        it('should get active plans only', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/plans?active=true');
            expect(res.status).toBe(200);

            expect(billing.plans.getActive).toHaveBeenCalled();
        });

        it('should handle errors when getting active plans', async () => {
            const billing = createMockBilling();
            (billing.plans.getActive as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/plans?active=true');
            expect(res.status).toBe(500);
        });
    });

    describe('Error handling on admin endpoints', () => {
        it('should handle force-cancel errors', async () => {
            const billing = createMockBilling();
            (billing.subscriptions.cancel as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Cancel error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/subscriptions/sub_1/force-cancel', {
                method: 'POST'
            });
            expect(res.status).toBe(500);
        });

        it('should handle force-cancel without body', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/subscriptions/sub_1/force-cancel', {
                method: 'POST'
            });

            expect(res.status).toBe(200);
            expect(billing.subscriptions.cancel).toHaveBeenCalledWith('sub_1', {
                cancelAtPeriodEnd: false,
                reason: 'Admin force cancellation'
            });
        });

        it('should handle change-plan errors', async () => {
            const billing = createMockBilling();
            (billing.subscriptions.changePlan as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Change plan error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/subscriptions/sub_1/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPlanId: 'plan_new' })
            });
            expect(res.status).toBe(500);
        });

        it('should handle force-refund errors', async () => {
            const billing = createMockBilling();
            (billing.payments.refund as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Refund error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/payments/pay_1/force-refund', {
                method: 'POST'
            });
            expect(res.status).toBe(500);
        });

        it('should handle force-refund without body', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/payments/pay_1/force-refund', {
                method: 'POST'
            });

            expect(res.status).toBe(200);
            expect(billing.payments.refund).toHaveBeenCalledWith({
                paymentId: 'pay_1',
                amount: undefined,
                reason: 'Admin force refund'
            });
        });

        it('should handle mark-paid errors', async () => {
            const billing = createMockBilling();
            (billing.invoices.markPaid as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Mark paid error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices/inv_1/mark-paid', {
                method: 'POST'
            });
            expect(res.status).toBe(500);
        });

        it('should handle mark-paid without body', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices/inv_1/mark-paid', {
                method: 'POST'
            });

            expect(res.status).toBe(200);
            // Should generate a default paymentId
            expect(billing.invoices.markPaid).toHaveBeenCalled();
        });

        it('should handle void invoice errors', async () => {
            const billing = createMockBilling();
            (billing.invoices.void as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Void error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/invoices/inv_1/void', {
                method: 'POST'
            });
            expect(res.status).toBe(500);
        });

        it('should handle grant entitlement errors', async () => {
            const billing = createMockBilling();
            (billing.entitlements.grant as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Grant error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/entitlements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entitlementKey: 'feature_x' })
            });
            expect(res.status).toBe(500);
        });

        it('should handle revoke entitlement errors', async () => {
            const billing = createMockBilling();
            (billing.entitlements.revoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Revoke error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/entitlements/feature_x', {
                method: 'DELETE'
            });
            expect(res.status).toBe(500);
        });

        it('should handle set limit errors', async () => {
            const billing = createMockBilling();
            (billing.limits.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Set limit error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/limits/api_calls/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxValue: 1000 })
            });
            expect(res.status).toBe(500);
        });

        it('should handle reset limit errors', async () => {
            const billing = createMockBilling();
            (billing.limits.check as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Check error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/limits/api_calls/reset', {
                method: 'POST'
            });
            expect(res.status).toBe(500);
        });

        it('should handle dashboard errors', async () => {
            const billing = createMockBilling();
            (billing.customers.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Dashboard error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/dashboard');
            expect(res.status).toBe(500);
        });

        it('should handle get customer full details errors', async () => {
            const billing = createMockBilling();
            (billing.customers.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Get customer error'));

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/admin/customers/cus_1/full');
            expect(res.status).toBe(500);
        });
    });

    describe('Custom prefix', () => {
        it('should use custom prefix', async () => {
            const billing = createMockBilling();
            const adminRoutes = createAdminRoutes({
                billing,
                prefix: '/api/admin',
                authMiddleware: mockAuthMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            const res = await app.request('/api/admin/dashboard');
            expect(res.status).toBe(200);
        });
    });

    describe('Auth middleware', () => {
        it('should apply auth middleware to all routes', async () => {
            const billing = createMockBilling();
            const authMiddleware = vi.fn(async (_c, next) => {
                await next();
            });

            const adminRoutes = createAdminRoutes({
                billing,
                authMiddleware
            });

            const app = new Hono();
            app.route('/', adminRoutes);

            await app.request('/admin/dashboard');

            expect(authMiddleware).toHaveBeenCalled();
        });
    });
});
