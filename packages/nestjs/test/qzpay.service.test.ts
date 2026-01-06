/**
 * QZPay Service Tests
 */
import { describe, expect, it, vi } from 'vitest';
import { QZPayService } from '../src/qzpay.service.js';
import {
    createMockBilling,
    createMockCustomer,
    createMockEntitlement,
    createMockInvoice,
    createMockLimit,
    createMockPayment,
    createMockPlan,
    createMockSubscription
} from './helpers/nestjs-mocks.js';

describe('QZPayService', () => {
    describe('getBilling', () => {
        it('should return the underlying billing instance', () => {
            const mockBilling = createMockBilling();
            const service = new QZPayService(mockBilling);

            expect(service.getBilling()).toBe(mockBilling);
        });
    });

    describe('Customer Operations', () => {
        it('should create a customer', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.create).mockResolvedValue(mockCustomer);

            const service = new QZPayService(mockBilling);
            const result = await service.createCustomer({ email: 'test@example.com' });

            expect(result).toEqual(mockCustomer);
            expect(mockBilling.customers.create).toHaveBeenCalledWith({ email: 'test@example.com' });
        });

        it('should get a customer', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.get).mockResolvedValue(mockCustomer);

            const service = new QZPayService(mockBilling);
            const result = await service.getCustomer('cus_123');

            expect(result).toEqual(mockCustomer);
            expect(mockBilling.customers.get).toHaveBeenCalledWith('cus_123');
        });

        it('should get customer by external ID', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            vi.mocked(mockBilling.customers.getByExternalId).mockResolvedValue(mockCustomer);

            const service = new QZPayService(mockBilling);
            const result = await service.getCustomerByExternalId('ext_123');

            expect(result).toEqual(mockCustomer);
            expect(mockBilling.customers.getByExternalId).toHaveBeenCalledWith('ext_123');
        });

        it('should update a customer', async () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer({ name: 'Updated Name' });
            vi.mocked(mockBilling.customers.update).mockResolvedValue(mockCustomer);

            const service = new QZPayService(mockBilling);
            const result = await service.updateCustomer('cus_123', { name: 'Updated Name' });

            expect(result?.name).toBe('Updated Name');
        });

        it('should delete a customer', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.customers.delete).mockResolvedValue(undefined);

            const service = new QZPayService(mockBilling);
            await service.deleteCustomer('cus_123');

            expect(mockBilling.customers.delete).toHaveBeenCalledWith('cus_123');
        });
    });

    describe('Subscription Operations', () => {
        it('should create a subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            vi.mocked(mockBilling.subscriptions.create).mockResolvedValue(mockSubscription);

            const service = new QZPayService(mockBilling);
            const result = await service.createSubscription({
                customerId: 'cus_123',
                planId: 'plan_123'
            });

            expect(result).toEqual(mockSubscription);
        });

        it('should get a subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(mockSubscription);

            const service = new QZPayService(mockBilling);
            const result = await service.getSubscription('sub_123');

            expect(result).toEqual(mockSubscription);
        });

        it('should get subscriptions by customer ID', async () => {
            const mockBilling = createMockBilling();
            const mockSubscriptions = [createMockSubscription()];
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue(mockSubscriptions);

            const service = new QZPayService(mockBilling);
            const result = await service.getSubscriptionsByCustomerId('cus_123');

            expect(result).toHaveLength(1);
        });

        it('should get active subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscriptions = [
                createMockSubscription({ id: 'sub_1', status: 'canceled' }),
                createMockSubscription({ id: 'sub_2', status: 'active' })
            ];
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue(mockSubscriptions);

            const service = new QZPayService(mockBilling);
            const result = await service.getActiveSubscription('cus_123');

            expect(result?.id).toBe('sub_2');
            expect(result?.status).toBe('active');
        });

        it('should return null when no active subscription', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.subscriptions.getByCustomerId).mockResolvedValue([createMockSubscription({ status: 'canceled' })]);

            const service = new QZPayService(mockBilling);
            const result = await service.getActiveSubscription('cus_123');

            expect(result).toBeNull();
        });

        it('should update a subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription();
            vi.mocked(mockBilling.subscriptions.update).mockResolvedValue(mockSubscription);

            const service = new QZPayService(mockBilling);
            const result = await service.updateSubscription('sub_123', { planId: 'plan_456' });

            expect(result).toEqual(mockSubscription);
        });

        it('should cancel a subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription({ status: 'canceled' });
            vi.mocked(mockBilling.subscriptions.cancel).mockResolvedValue(mockSubscription);

            const service = new QZPayService(mockBilling);
            const result = await service.cancelSubscription('sub_123');

            expect(result.status).toBe('canceled');
        });

        it('should pause a subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription({ status: 'paused' });
            vi.mocked(mockBilling.subscriptions.pause).mockResolvedValue(mockSubscription);

            const service = new QZPayService(mockBilling);
            const result = await service.pauseSubscription('sub_123');

            expect(result.status).toBe('paused');
        });

        it('should resume a subscription', async () => {
            const mockBilling = createMockBilling();
            const mockSubscription = createMockSubscription({ status: 'active' });
            vi.mocked(mockBilling.subscriptions.resume).mockResolvedValue(mockSubscription);

            const service = new QZPayService(mockBilling);
            const result = await service.resumeSubscription('sub_123');

            expect(result.status).toBe('active');
        });
    });

    describe('Payment Operations', () => {
        it('should process a payment', async () => {
            const mockBilling = createMockBilling();
            const mockPayment = createMockPayment();
            vi.mocked(mockBilling.payments.process).mockResolvedValue(mockPayment);

            const service = new QZPayService(mockBilling);
            const result = await service.processPayment({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd'
            });

            expect(result).toEqual(mockPayment);
        });

        it('should get a payment', async () => {
            const mockBilling = createMockBilling();
            const mockPayment = createMockPayment();
            vi.mocked(mockBilling.payments.get).mockResolvedValue(mockPayment);

            const service = new QZPayService(mockBilling);
            const result = await service.getPayment('pay_123');

            expect(result).toEqual(mockPayment);
        });

        it('should get payments by customer ID', async () => {
            const mockBilling = createMockBilling();
            const mockPayments = [createMockPayment()];
            vi.mocked(mockBilling.payments.getByCustomerId).mockResolvedValue(mockPayments);

            const service = new QZPayService(mockBilling);
            const result = await service.getPaymentsByCustomerId('cus_123');

            expect(result).toHaveLength(1);
        });

        it('should refund a payment', async () => {
            const mockBilling = createMockBilling();
            const mockPayment = createMockPayment({ status: 'refunded' });
            vi.mocked(mockBilling.payments.refund).mockResolvedValue(mockPayment);

            const service = new QZPayService(mockBilling);
            const result = await service.refundPayment({ paymentId: 'pay_123' });

            expect(result.status).toBe('refunded');
        });
    });

    describe('Invoice Operations', () => {
        it('should create an invoice', async () => {
            const mockBilling = createMockBilling();
            const mockInvoice = createMockInvoice();
            vi.mocked(mockBilling.invoices.create).mockResolvedValue(mockInvoice);

            const service = new QZPayService(mockBilling);
            const result = await service.createInvoice({ customerId: 'cus_123' });

            expect(result).toEqual(mockInvoice);
        });

        it('should get an invoice', async () => {
            const mockBilling = createMockBilling();
            const mockInvoice = createMockInvoice();
            vi.mocked(mockBilling.invoices.get).mockResolvedValue(mockInvoice);

            const service = new QZPayService(mockBilling);
            const result = await service.getInvoice('inv_123');

            expect(result).toEqual(mockInvoice);
        });

        it('should get invoices by customer ID', async () => {
            const mockBilling = createMockBilling();
            const mockInvoices = [createMockInvoice()];
            vi.mocked(mockBilling.invoices.getByCustomerId).mockResolvedValue(mockInvoices);

            const service = new QZPayService(mockBilling);
            const result = await service.getInvoicesByCustomerId('cus_123');

            expect(result).toHaveLength(1);
        });

        it('should mark invoice as paid', async () => {
            const mockBilling = createMockBilling();
            const mockInvoice = createMockInvoice({ status: 'paid' });
            vi.mocked(mockBilling.invoices.markPaid).mockResolvedValue(mockInvoice);

            const service = new QZPayService(mockBilling);
            const result = await service.markInvoicePaid('inv_123', 'pay_123');

            expect(result.status).toBe('paid');
        });
    });

    describe('Plan Operations', () => {
        it('should get all plans', () => {
            const mockBilling = createMockBilling();
            const mockPlans = [createMockPlan()];
            vi.mocked(mockBilling.getPlans).mockReturnValue(mockPlans);

            const service = new QZPayService(mockBilling);
            const result = service.getPlans();

            expect(result).toEqual(mockPlans);
        });

        it('should get a single plan', () => {
            const mockBilling = createMockBilling();
            const mockPlan = createMockPlan();
            vi.mocked(mockBilling.getPlan).mockReturnValue(mockPlan);

            const service = new QZPayService(mockBilling);
            const result = service.getPlan('plan_123');

            expect(result).toEqual(mockPlan);
        });
    });

    describe('Entitlement Operations', () => {
        it('should check entitlement', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.check).mockResolvedValue(true);

            const service = new QZPayService(mockBilling);
            const result = await service.checkEntitlement('cus_123', 'feature_api');

            expect(result).toBe(true);
        });

        it('should get entitlements', async () => {
            const mockBilling = createMockBilling();
            const mockEntitlements = [createMockEntitlement()];
            vi.mocked(mockBilling.entitlements.getByCustomerId).mockResolvedValue(mockEntitlements);

            const service = new QZPayService(mockBilling);
            const result = await service.getEntitlements('cus_123');

            expect(result).toHaveLength(1);
        });
    });

    describe('Limit Operations', () => {
        it('should check limit', async () => {
            const mockBilling = createMockBilling();
            const mockResult = { allowed: true, current: 50, max: 100 };
            vi.mocked(mockBilling.limits.check).mockResolvedValue(mockResult);

            const service = new QZPayService(mockBilling);
            const result = await service.checkLimit('cus_123', 'api_calls');

            expect(result.allowed).toBe(true);
        });

        it('should get limits', async () => {
            const mockBilling = createMockBilling();
            const mockLimits = [createMockLimit()];
            vi.mocked(mockBilling.limits.getByCustomerId).mockResolvedValue(mockLimits);

            const service = new QZPayService(mockBilling);
            const result = await service.getLimits('cus_123');

            expect(result).toHaveLength(1);
        });

        it('should increment limit', async () => {
            const mockBilling = createMockBilling();
            const mockLimit = createMockLimit({ currentValue: 501 });
            vi.mocked(mockBilling.limits.increment).mockResolvedValue(mockLimit);

            const service = new QZPayService(mockBilling);
            const result = await service.incrementLimit('cus_123', 'api_calls', 1);

            expect(result.currentValue).toBe(501);
        });

        it('should set limit', async () => {
            const mockBilling = createMockBilling();
            const mockLimit = createMockLimit({ maxValue: 2000 });
            vi.mocked(mockBilling.limits.set).mockResolvedValue(mockLimit);

            const service = new QZPayService(mockBilling);
            const result = await service.setLimit('cus_123', 'api_calls', 2000);

            expect(result.maxValue).toBe(2000);
        });
    });

    describe('Utility Methods', () => {
        it('should check if livemode', () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.isLivemode).mockReturnValue(true);

            const service = new QZPayService(mockBilling);
            const result = service.isLivemode();

            expect(result).toBe(true);
        });
    });

    describe('Event Handling', () => {
        it('should subscribe to events', () => {
            const mockBilling = createMockBilling();
            const unsubscribeFn = vi.fn();
            vi.mocked(mockBilling.on).mockReturnValue(unsubscribeFn);

            const service = new QZPayService(mockBilling);
            const handler = vi.fn();
            const unsubscribe = service.on('customer.created', handler);

            expect(mockBilling.on).toHaveBeenCalledWith('customer.created', handler);
            expect(unsubscribe).toBe(unsubscribeFn);
        });

        it('should subscribe to one-time events', () => {
            const mockBilling = createMockBilling();
            const unsubscribeFn = vi.fn();
            vi.mocked(mockBilling.once).mockReturnValue(unsubscribeFn);

            const service = new QZPayService(mockBilling);
            const handler = vi.fn();
            const unsubscribe = service.once('payment.succeeded', handler);

            expect(mockBilling.once).toHaveBeenCalledWith('payment.succeeded', handler);
            expect(unsubscribe).toBe(unsubscribeFn);
        });

        it('should unsubscribe all events on module destroy', () => {
            const mockBilling = createMockBilling();
            const unsubscribeFn1 = vi.fn();
            const unsubscribeFn2 = vi.fn();
            vi.mocked(mockBilling.on).mockReturnValueOnce(unsubscribeFn1).mockReturnValueOnce(unsubscribeFn2);

            const service = new QZPayService(mockBilling);
            service.on('customer.created', vi.fn());
            service.on('payment.succeeded', vi.fn());

            service.onModuleDestroy();

            expect(unsubscribeFn1).toHaveBeenCalled();
            expect(unsubscribeFn2).toHaveBeenCalled();
        });
    });
});
