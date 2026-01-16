/**
 * Billing Routes Error Mapping Tests
 *
 * Tests to verify correct HTTP status codes are returned for different error scenarios
 */
import { describe, expect, it, vi } from 'vitest';
import { createBillingRoutes } from '../../src/routes/billing.routes.js';
import { createMockBilling, createMockCustomer } from '../helpers/hono-mocks.js';

describe('Billing Routes Error Mapping', () => {
    describe('Error Status Codes', () => {
        it('should return 404 for customer not found', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Customer not found');
        });

        it('should return 409 for customer already exists', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.create).mockRejectedValue(new Error('Customer already exists'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'existing@example.com', name: 'Test' })
            });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('CONFLICT');
        });

        it('should return 422 for invalid customer data', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.create).mockRejectedValue(new Error('Invalid email format'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'invalid-email', name: 'Test' })
            });
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 500 for generic database errors', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.list).mockRejectedValue(new Error('Database connection failed'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });

        it('should return 404 for subscription not found', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions/sub_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return 404 for payment not found', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.payments.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/payments/pay_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return 404 for invoice not found', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.invoices.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/invoices/inv_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return 404 for plan not found', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.plans.get).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/plans/plan_notfound');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return 404 for promo code not found', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.promoCodes.getByCode).mockResolvedValue(null);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/promo-codes/NOTFOUND');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return 422 for validation errors in subscription creation', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.create).mockRejectedValue(new Error('Required field missing'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: 'cus_123' }) // Missing planId
            });
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return 409 for duplicate subscription', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.create).mockRejectedValue(new Error('Subscription already exists for this customer'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: 'cus_123', planId: 'plan_123' })
            });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.error.code).toBe('CONFLICT');
        });
    });

    describe('Success Status Codes', () => {
        it('should return 201 for customer creation', async () => {
            const mockBilling = createMockBilling();
            const customer = createMockCustomer({ id: 'cus_new' });
            vi.mocked(mockBilling.customers.create).mockResolvedValue(customer);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'new@example.com', name: 'New Customer' })
            });

            expect(response.status).toBe(201);
        });

        it('should return 200 for customer update', async () => {
            const mockBilling = createMockBilling();
            const customer = createMockCustomer({ id: 'cus_123' });
            vi.mocked(mockBilling.customers.update).mockResolvedValue(customer);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Name' })
            });

            expect(response.status).toBe(200);
        });

        it('should return 200 for customer deletion', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.delete).mockResolvedValue(undefined);

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123', {
                method: 'DELETE'
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Error Message Patterns', () => {
        it('should handle "does not exist" pattern', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.get).mockRejectedValue(new Error('Record does not exist'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle "validation failed" pattern', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.create).mockRejectedValue(new Error('Validation failed for email'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'invalid', name: 'Test' })
            });
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should be case-insensitive for error patterns', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.get).mockRejectedValue(new Error('CUSTOMER NOT FOUND'));

            const routes = createBillingRoutes({ billing: mockBilling });
            const response = await routes.request('/billing/customers/cus_123');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });
    });
});
