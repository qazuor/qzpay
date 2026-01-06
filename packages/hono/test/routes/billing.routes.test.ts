/**
 * Billing Routes Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { createBillingRoutes } from '../../src/routes/billing.routes.js';
import {
    createMockBilling,
    createMockCustomer,
    createMockEntitlement,
    createMockInvoice,
    createMockLimit,
    createMockListResponse,
    createMockPayment,
    createMockPlan,
    createMockPromoCode,
    createMockSubscription
} from '../helpers/hono-mocks.js';

describe('Billing Routes', () => {
    describe('Customer Routes', () => {
        it('should list customers with pagination', async () => {
            const mockBilling = createMockBilling();
            const customers = [createMockCustomer({ id: 'cus_1' }), createMockCustomer({ id: 'cus_2' })];
            vi.mocked(mockBilling.customers.list).mockResolvedValue(createMockListResponse(customers));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers?limit=10&offset=5');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.pagination.limit).toBe(10);
            expect(data.pagination.offset).toBe(5);
            expect(mockBilling.customers.list).toHaveBeenCalledWith({ limit: 10, offset: 5 });
        });

        it('should get a single customer', async () => {
            const mockBilling = createMockBilling();
            const customer = createMockCustomer({ id: 'cus_123' });
            vi.mocked(mockBilling.customers.get).mockResolvedValue(customer);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.id).toBe('cus_123');
        });

        it('should return 404 for non-existent customer', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should create a customer', async () => {
            const mockBilling = createMockBilling();
            const customer = createMockCustomer({ id: 'cus_new' });
            vi.mocked(mockBilling.customers.create).mockResolvedValue(customer);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'new@example.com' })
            });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.id).toBe('cus_new');
        });

        it('should update a customer', async () => {
            const mockBilling = createMockBilling();
            const customer = createMockCustomer({ id: 'cus_123', name: 'Updated Name' });
            vi.mocked(mockBilling.customers.update).mockResolvedValue(customer);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Name' })
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.name).toBe('Updated Name');
        });

        it('should delete a customer', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.delete).mockResolvedValue(undefined);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123', {
                method: 'DELETE'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should handle errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.list).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.message).toBe('Database error');
        });

        it('should return 404 when updating non-existent customer', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.update).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_notfound', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test' })
            });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should use default pagination values', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.list).mockResolvedValue(createMockListResponse([]));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.pagination.limit).toBe(20);
            expect(data.pagination.offset).toBe(0);
        });

        it('should handle non-Error exceptions', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.get).mockRejectedValue('string error');

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('string error');
        });

        it('should handle create errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.create).mockRejectedValue(new Error('Validation error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'test@example.com' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Validation error');
        });

        it('should handle update errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.update).mockRejectedValue(new Error('Update failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Update failed');
        });

        it('should handle delete errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.delete).mockRejectedValue(new Error('Delete failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123', {
                method: 'DELETE'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Delete failed');
        });
    });

    describe('Subscription Routes', () => {
        it('should list subscriptions', async () => {
            const mockBilling = createMockBilling();
            const subscriptions = [createMockSubscription({ id: 'sub_1' })];
            vi.mocked(mockBilling.subscriptions.list).mockResolvedValue(createMockListResponse(subscriptions));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);
        });

        it('should get subscriptions by customerId', async () => {
            const mockBilling = createMockBilling();
            const subscriptions = [createMockSubscription({ customerId: 'cus_123' })];
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue(subscriptions);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions?customerId=cus_123');
            const _data = await response.json();

            expect(response.status).toBe(200);
            expect(mockBilling.subscriptions.getByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should get a single subscription', async () => {
            const mockBilling = createMockBilling();
            const subscription = createMockSubscription({ id: 'sub_123' });
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(subscription);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.id).toBe('sub_123');
        });

        it('should create a subscription', async () => {
            const mockBilling = createMockBilling();
            const subscription = createMockSubscription();
            vi.mocked(mockBilling.subscriptions.create).mockResolvedValue(subscription);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: 'cus_123', planId: 'plan_123' })
            });

            expect(response.status).toBe(201);
        });

        it('should update a subscription', async () => {
            const mockBilling = createMockBilling();
            const subscription = createMockSubscription();
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(subscription);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: 'plan_456' })
            });

            expect(response.status).toBe(200);
        });

        it('should cancel a subscription', async () => {
            const mockBilling = createMockBilling();
            const subscription = createMockSubscription({ status: 'canceled' });
            vi.mocked(mockBilling.subscriptions.cancel).mockResolvedValue(subscription);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123/cancel', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.status).toBe('canceled');
        });

        it('should pause a subscription', async () => {
            const mockBilling = createMockBilling();
            const subscription = createMockSubscription({ status: 'paused' });
            vi.mocked(mockBilling.subscriptions.pause).mockResolvedValue(subscription);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123/pause', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.status).toBe('paused');
        });

        it('should resume a subscription', async () => {
            const mockBilling = createMockBilling();
            const subscription = createMockSubscription({ status: 'active' });
            vi.mocked(mockBilling.subscriptions.resume).mockResolvedValue(subscription);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123/resume', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.status).toBe('active');
        });

        it('should return 404 for non-existent subscription', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle subscription list errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.list).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Database error');
        });

        it('should handle cancel errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.cancel).mockRejectedValue(new Error('Cancel failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123/cancel', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Cancel failed');
        });

        it('should handle pause errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.pause).mockRejectedValue(new Error('Pause failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123/pause', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Pause failed');
        });

        it('should handle resume errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.resume).mockRejectedValue(new Error('Resume failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123/resume', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Resume failed');
        });
    });

    describe('Payment Routes', () => {
        it('should list payments', async () => {
            const mockBilling = createMockBilling();
            const payments = [createMockPayment()];
            vi.mocked(mockBilling.payments.list).mockResolvedValue(createMockListResponse(payments));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should get payments by customerId', async () => {
            const mockBilling = createMockBilling();
            const payments = [createMockPayment({ customerId: 'cus_123' })];
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(payments);

            const routes = createBillingRoutes({ billing: mockBilling });
            await routes.request('/billing/payments?customerId=cus_123');

            expect(mockBilling.payments.getByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should get a single payment', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment({ id: 'pay_123' });
            vi.mocked(mockBilling.payments.get).mockResolvedValue(payment);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments/pay_123');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.id).toBe('pay_123');
        });

        it('should process a payment', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment();
            vi.mocked(mockBilling.payments.process).mockResolvedValue(payment);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 1000, customerId: 'cus_123' })
            });

            expect(response.status).toBe(201);
        });

        it('should refund a payment', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment({ status: 'refunded' });
            vi.mocked(mockBilling.payments.refund).mockResolvedValue(payment);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments/pay_123/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 500 })
            });
            const _data = await response.json();

            expect(response.status).toBe(200);
            expect(mockBilling.payments.refund).toHaveBeenCalledWith({ paymentId: 'pay_123', amount: 500 });
        });

        it('should return 404 for non-existent payment', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments/pay_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle refund without body', async () => {
            const mockBilling = createMockBilling();
            const payment = createMockPayment({ status: 'refunded' });
            vi.mocked(mockBilling.payments.refund).mockResolvedValue(payment);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments/pay_123/refund', {
                method: 'POST'
            });

            expect(response.status).toBe(200);
            expect(mockBilling.payments.refund).toHaveBeenCalledWith({ paymentId: 'pay_123' });
        });

        it('should handle payment list errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.list).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Database error');
        });

        it('should handle process errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.process).mockRejectedValue(new Error('Payment failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 1000 })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Payment failed');
        });

        it('should handle refund errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.refund).mockRejectedValue(new Error('Refund failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments/pay_123/refund', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Refund failed');
        });
    });

    describe('Invoice Routes', () => {
        it('should list invoices', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createMockInvoice()];
            vi.mocked(mockBilling.invoices.list).mockResolvedValue(createMockListResponse(invoices));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should get invoices by customerId', async () => {
            const mockBilling = createMockBilling();
            const invoices = [createMockInvoice()];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(invoices);

            const routes = createBillingRoutes({ billing: mockBilling });
            await routes.request('/billing/invoices?customerId=cus_123');

            expect(mockBilling.invoices.getByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should get a single invoice', async () => {
            const mockBilling = createMockBilling();
            const invoice = createMockInvoice({ id: 'inv_123' });
            vi.mocked(mockBilling.invoices.get).mockResolvedValue(invoice);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices/inv_123');
            const data = await response.json();

            expect(data.data.id).toBe('inv_123');
        });

        it('should create an invoice', async () => {
            const mockBilling = createMockBilling();
            const invoice = createMockInvoice();
            vi.mocked(mockBilling.invoices.create).mockResolvedValue(invoice);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: 'cus_123' })
            });

            expect(response.status).toBe(201);
        });

        it('should void an invoice', async () => {
            const mockBilling = createMockBilling();
            const invoice = createMockInvoice({ status: 'voided' });
            vi.mocked(mockBilling.invoices.void).mockResolvedValue(invoice);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices/inv_123/void', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.status).toBe('voided');
        });

        it('should return 404 for non-existent invoice', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices/inv_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle invoice list errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.list).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Database error');
        });

        it('should handle void errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.void).mockRejectedValue(new Error('Void failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices/inv_123/void', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Void failed');
        });
    });

    describe('Plan Routes', () => {
        it('should list plans', async () => {
            const mockBilling = createMockBilling();
            const plans = [createMockPlan()];
            vi.mocked(mockBilling.plans.list).mockResolvedValue(createMockListResponse(plans));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should get active plans', async () => {
            const mockBilling = createMockBilling();
            const plans = [createMockPlan({ active: true })];
            vi.mocked(mockBilling.plans.getActive).mockResolvedValue(plans);

            const routes = createBillingRoutes({ billing: mockBilling });
            await routes.request('/billing/plans?active=true');

            expect(mockBilling.plans.getActive).toHaveBeenCalled();
        });

        it('should get a single plan', async () => {
            const mockBilling = createMockBilling();
            const plan = createMockPlan({ id: 'plan_123' });
            vi.mocked(mockBilling.plans.get).mockResolvedValue(plan);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans/plan_123');
            const data = await response.json();

            expect(data.data.id).toBe('plan_123');
        });

        it('should get plan prices', async () => {
            const mockBilling = createMockBilling();
            const prices = [{ id: 'price_1', amount: 1999 }];
            vi.mocked(mockBilling.plans.getPrices).mockResolvedValue(prices);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans/plan_123/prices');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(1);
        });

        it('should return 404 for non-existent plan', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans/plan_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle plan list errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.list).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Database error');
        });

        it('should handle get prices errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.getPrices).mockRejectedValue(new Error('Prices not found'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans/plan_123/prices');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Prices not found');
        });
    });

    describe('Promo Code Routes', () => {
        it('should list promo codes', async () => {
            const mockBilling = createMockBilling();
            const promoCodes = [createMockPromoCode()];
            vi.mocked(mockBilling.promoCodes.list).mockResolvedValue(createMockListResponse(promoCodes));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should get a promo code by code', async () => {
            const mockBilling = createMockBilling();
            const promoCode = createMockPromoCode({ code: 'DISCOUNT20' });
            vi.mocked(mockBilling.promoCodes.getByCode).mockResolvedValue(promoCode);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes/DISCOUNT20');
            const data = await response.json();

            expect(data.data.code).toBe('DISCOUNT20');
        });

        it('should validate a promo code', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.promoCodes.validate).mockResolvedValue({ valid: true, discount: 20 });

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'DISCOUNT20', customerId: 'cus_123', planId: 'plan_123' })
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.valid).toBe(true);
        });

        it('should return 404 for non-existent promo code', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.promoCodes.getByCode).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes/NOTFOUND');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle promo code list errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.promoCodes.list).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Database error');
        });

        it('should handle validate errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.promoCodes.validate).mockRejectedValue(new Error('Invalid code'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'INVALID', customerId: 'cus_123' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Invalid code');
        });
    });

    describe('Entitlement Routes', () => {
        it('should get customer entitlements', async () => {
            const mockBilling = createMockBilling();
            const entitlements = [createMockEntitlement()];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(entitlements);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should check a specific entitlement', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.check).mockResolvedValue(true);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements/feature_api');
            const data = await response.json();

            expect(data.data.hasEntitlement).toBe(true);
        });

        it('should grant an entitlement', async () => {
            const mockBilling = createMockBilling();
            const entitlement = createMockEntitlement();
            vi.mocked(mockBilling.entitlements.grant).mockResolvedValue(entitlement);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entitlementKey: 'feature_api', source: 'plan', sourceId: 'plan_123' })
            });

            expect(response.status).toBe(201);
        });

        it('should revoke an entitlement', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.revoke).mockResolvedValue(undefined);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements/feature_api', {
                method: 'DELETE'
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should handle entitlement list errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Database error');
        });

        it('should handle check errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.check).mockRejectedValue(new Error('Check failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements/feature_api');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Check failed');
        });

        it('should handle grant errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.grant).mockRejectedValue(new Error('Grant failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entitlementKey: 'feature_api', source: 'plan', sourceId: 'plan_123' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Grant failed');
        });

        it('should handle revoke errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.revoke).mockRejectedValue(new Error('Revoke failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/entitlements/feature_api', {
                method: 'DELETE'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Revoke failed');
        });
    });

    describe('Limit Routes', () => {
        it('should get customer limits', async () => {
            const mockBilling = createMockBilling();
            const limits = [createMockLimit()];
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(limits);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits');
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should check a specific limit', async () => {
            const mockBilling = createMockBilling();
            const result = { allowed: true, current: 50, max: 100 };
            vi.mocked(mockBilling.limits.check).mockResolvedValue(result);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits/api_calls');
            const data = await response.json();

            expect(data.data.allowed).toBe(true);
        });

        it('should increment a limit', async () => {
            const mockBilling = createMockBilling();
            const limit = createMockLimit({ currentValue: 51 });
            vi.mocked(mockBilling.limits.increment).mockResolvedValue(limit);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits/api_calls/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 1 })
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.currentValue).toBe(51);
        });

        it('should record usage', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.recordUsage).mockResolvedValue(undefined);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits/api_calls/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: 10, action: 'api_request' })
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should handle limit list errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.getByCustomerId).mockRejectedValue(new Error('Database error'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Database error');
        });

        it('should handle limit check errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.check).mockRejectedValue(new Error('Check failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits/api_calls');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Check failed');
        });

        it('should handle increment without body', async () => {
            const mockBilling = createMockBilling();
            const limit = createMockLimit({ currentValue: 1 });
            vi.mocked(mockBilling.limits.increment).mockResolvedValue(limit);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits/api_calls/increment', {
                method: 'POST'
            });

            expect(response.status).toBe(200);
            expect(mockBilling.limits.increment).toHaveBeenCalledWith('cus_123', 'api_calls', undefined);
        });

        it('should handle increment errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.increment).mockRejectedValue(new Error('Increment failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits/api_calls/increment', {
                method: 'POST'
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Increment failed');
        });

        it('should handle record usage errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.recordUsage).mockRejectedValue(new Error('Usage recording failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123/limits/api_calls/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: 10, action: 'api_request' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Usage recording failed');
        });
    });

    describe('Route Configuration', () => {
        it('should use custom prefix', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.list).mockResolvedValue(createMockListResponse([]));

            const routes = createBillingRoutes({ billing: mockBilling, prefix: '/api/v1' });
            const response = await routes.request('/api/v1/customers');

            expect(response.status).toBe(200);
        });

        it('should disable customer routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, customers: false });
            const response = await routes.request('/billing/customers');

            expect(response.status).toBe(404);
        });

        it('should disable subscription routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, subscriptions: false });
            const response = await routes.request('/billing/subscriptions');

            expect(response.status).toBe(404);
        });

        it('should disable payment routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, payments: false });
            const response = await routes.request('/billing/payments');

            expect(response.status).toBe(404);
        });

        it('should disable invoice routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, invoices: false });
            const response = await routes.request('/billing/invoices');

            expect(response.status).toBe(404);
        });

        it('should disable plan routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, plans: false });
            const response = await routes.request('/billing/plans');

            expect(response.status).toBe(404);
        });

        it('should disable promo code routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, promoCodes: false });
            const response = await routes.request('/billing/promo-codes');

            expect(response.status).toBe(404);
        });

        it('should disable entitlement routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, entitlements: false });
            const response = await routes.request('/billing/customers/cus_123/entitlements');

            expect(response.status).toBe(404);
        });

        it('should disable limit routes when configured', async () => {
            const mockBilling = createMockBilling();

            const routes = createBillingRoutes({ billing: mockBilling, limits: false });
            const response = await routes.request('/billing/customers/cus_123/limits');

            expect(response.status).toBe(404);
        });

        it('should apply auth middleware when provided', async () => {
            const mockBilling = createMockBilling();
            let authCalled = false;

            const authMiddleware = async (_c: unknown, next: () => Promise<void>) => {
                authCalled = true;
                await next();
            };

            vi.mocked(mockBilling.customers.list).mockResolvedValue(createMockListResponse([]));

            const routes = createBillingRoutes({
                billing: mockBilling,
                authMiddleware: authMiddleware as never
            });
            await routes.request('/billing/customers');

            expect(authCalled).toBe(true);
        });
    });

    describe('Additional Error Scenarios', () => {
        it('should handle subscription update errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.update).mockRejectedValue(new Error('Update failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: 'plan_new' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Update failed');
        });

        it('should handle subscription create errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.create).mockRejectedValue(new Error('Create failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: 'cus_123', planId: 'plan_123' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Create failed');
        });

        it('should handle subscription get errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.get).mockRejectedValue(new Error('Get failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get failed');
        });

        it('should handle subscription getByCustomerId errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockRejectedValue(new Error('Get by customer failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions?customerId=cus_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get by customer failed');
        });

        it('should handle payment get errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.get).mockRejectedValue(new Error('Get failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments/pay_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get failed');
        });

        it('should handle payment getByCustomerId errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.getByCustomerId).mockRejectedValue(new Error('Get by customer failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments?customerId=cus_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get by customer failed');
        });

        it('should handle invoice get errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.get).mockRejectedValue(new Error('Get failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices/inv_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get failed');
        });

        it('should handle invoice getByCustomerId errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.getByCustomerId).mockRejectedValue(new Error('Get by customer failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices?customerId=cus_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get by customer failed');
        });

        it('should handle invoice create errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.create).mockRejectedValue(new Error('Create failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: 'cus_123' })
            });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Create failed');
        });

        it('should handle plan get errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.get).mockRejectedValue(new Error('Get failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans/plan_123');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get failed');
        });

        it('should handle plan getActive errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.getActive).mockRejectedValue(new Error('Get active failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans?active=true');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get active failed');
        });

        it('should handle promo code get errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.promoCodes.getByCode).mockRejectedValue(new Error('Get failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes/INVALID');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error.message).toBe('Get failed');
        });
    });
});
