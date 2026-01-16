/**
 * Payments Repository Tests
 *
 * Tests for QZPayPaymentsRepository operations.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayPaymentsRepository } from '../src/repositories/payments.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayPaymentsRepository', () => {
    let paymentsRepo: QZPayPaymentsRepository;
    let customersRepo: QZPayCustomersRepository;
    let customerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        paymentsRepo = new QZPayPaymentsRepository(db);
        customersRepo = new QZPayCustomersRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Create a customer for payments
        const customer = await customersRepo.create({
            externalId: `pay-test-${Date.now()}`,
            email: 'payment-test@example.com',
            name: 'Payment Test User',
            livemode: true
        });
        customerId = customer.id;
    });

    describe('create', () => {
        it('should create a new payment', async () => {
            const payment = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });

            expect(payment.id).toBeDefined();
            expect(payment.customerId).toBe(customerId);
            expect(payment.amount).toBe(9999);
            expect(payment.currency).toBe('USD');
            expect(payment.status).toBe('pending');
            expect(payment.provider).toBe('stripe');
        });

        it('should create payment with provider payment ids', async () => {
            const payment = await paymentsRepo.create({
                customerId,
                amount: 5000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentIds: { stripe: 'pi_test_123456' },
                livemode: true
            });

            const providerIds = payment.providerPaymentIds as Record<string, string>;
            expect(providerIds.stripe).toBe('pi_test_123456');
        });

        it('should create payment with metadata', async () => {
            const payment = await paymentsRepo.create({
                customerId,
                amount: 7500,
                currency: 'eur',
                status: 'pending',
                provider: 'stripe',
                metadata: { orderId: 'order-123', source: 'checkout' },
                livemode: true
            });

            expect(payment.metadata).toEqual({ orderId: 'order-123', source: 'checkout' });
        });
    });

    describe('findById', () => {
        it('should find payment by id', async () => {
            const created = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });

            const found = await paymentsRepo.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.amount).toBe(9999);
        });

        it('should return null for non-existent payment', async () => {
            // Use a valid UUID format that doesn't exist
            const found = await paymentsRepo.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findByCustomerId', () => {
        it('should find all payments for a customer', async () => {
            // Create multiple payments
            await paymentsRepo.create({
                customerId,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId,
                amount: 2000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId,
                amount: 3000,
                currency: 'USD',
                status: 'failed',
                provider: 'stripe',
                livemode: true
            });

            const result = await paymentsRepo.findByCustomerId(customerId);

            expect(result.data.length).toBe(3);
            expect(result.data.every((p) => p.customerId === customerId)).toBe(true);
        });
    });

    describe('findByProviderPaymentId', () => {
        it('should find payment by provider payment id', async () => {
            await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentIds: { stripe: 'pi_unique_123' },
                livemode: true
            });

            const found = await paymentsRepo.findByProviderPaymentId('pi_unique_123');

            expect(found).not.toBeNull();
            const providerIds = found?.providerPaymentIds as Record<string, string>;
            expect(providerIds?.stripe).toBe('pi_unique_123');
        });

        it('should return null for non-existent provider payment id', async () => {
            const found = await paymentsRepo.findByProviderPaymentId('pi_non_existent');
            expect(found).toBeNull();
        });
    });

    describe('update', () => {
        it('should update payment status', async () => {
            const created = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });

            const updated = await paymentsRepo.update(created.id, {
                status: 'succeeded'
            });

            expect(updated.status).toBe('succeeded');
            expect(updated.id).toBe(created.id);
        });

        it('should update payment metadata', async () => {
            const created = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                metadata: {},
                livemode: true
            });

            const updated = await paymentsRepo.update(created.id, {
                metadata: { refundRequested: true }
            });

            expect(updated.metadata).toEqual({ refundRequested: true });
        });

        it('should update provider payment ids', async () => {
            const created = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'pending',
                provider: 'stripe',
                livemode: true
            });

            const updated = await paymentsRepo.update(created.id, {
                providerPaymentIds: { stripe: 'pi_updated_123' }
            });

            const providerIds = updated.providerPaymentIds as Record<string, string>;
            expect(providerIds.stripe).toBe('pi_updated_123');
        });
    });

    describe('search', () => {
        it('should search payments with status filter', async () => {
            await paymentsRepo.create({
                customerId,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId,
                amount: 2000,
                currency: 'USD',
                status: 'failed',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId,
                amount: 3000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            const succeededResult = await paymentsRepo.search({
                status: 'succeeded',
                livemode: true
            });

            expect(succeededResult.data.length).toBe(2);
            expect(succeededResult.data.every((p) => p.status === 'succeeded')).toBe(true);
        });

        it('should search payments with provider filter', async () => {
            await paymentsRepo.create({
                customerId,
                amount: 1000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.create({
                customerId,
                amount: 2000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'mercadopago',
                livemode: true
            });

            const stripeResult = await paymentsRepo.search({
                provider: 'stripe',
                livemode: true
            });

            expect(stripeResult.data.length).toBe(1);
            expect(stripeResult.data[0].provider).toBe('stripe');
        });

        it('should paginate results', async () => {
            // Create 5 payments
            for (let i = 0; i < 5; i++) {
                await paymentsRepo.create({
                    customerId,
                    amount: (i + 1) * 1000,
                    currency: 'USD',
                    status: 'succeeded',
                    provider: 'stripe',
                    livemode: true
                });
            }

            const result = await paymentsRepo.search({
                limit: 2,
                offset: 0,
                livemode: true
            });

            expect(result.data.length).toBe(2);
            expect(result.total).toBe(5);
        });
    });

    describe('createRefund', () => {
        it('should create a refund for a payment', async () => {
            const payment = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            const refund = await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 5000,
                currency: 'USD',
                reason: 'Customer requested refund',
                status: 'pending'
            });

            expect(refund.id).toBeDefined();
            expect(refund.paymentId).toBe(payment.id);
            expect(refund.amount).toBe(5000);
            expect(refund.reason).toBe('Customer requested refund');
        });

        it('should create full refund', async () => {
            const payment = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            const refund = await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 9999,
                currency: 'USD',
                reason: 'Order canceled',
                status: 'succeeded'
            });

            expect(refund.amount).toBe(9999);
            expect(refund.status).toBe('succeeded');
        });
    });

    describe('findRefundsByPaymentId', () => {
        it('should find all refunds for a payment', async () => {
            const payment = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 2000,
                currency: 'USD',
                reason: 'Partial refund 1',
                status: 'succeeded'
            });

            await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 3000,
                currency: 'USD',
                reason: 'Partial refund 2',
                status: 'succeeded'
            });

            const refunds = await paymentsRepo.findRefundsByPaymentId(payment.id);

            expect(refunds.length).toBe(2);
            expect(refunds.every((r) => r.paymentId === payment.id)).toBe(true);
        });
    });

    describe('calculateTotalRefunded', () => {
        it('should calculate total refunded amount', async () => {
            const payment = await paymentsRepo.create({
                customerId,
                amount: 9999,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 2000,
                currency: 'USD',
                reason: 'Partial refund 1',
                status: 'succeeded'
            });

            await paymentsRepo.createRefund({
                paymentId: payment.id,
                amount: 3000,
                currency: 'USD',
                reason: 'Partial refund 2',
                status: 'succeeded'
            });

            const refunds = await paymentsRepo.findRefundsByPaymentId(payment.id);
            const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);

            expect(totalRefunded).toBe(5000);
        });
    });
});
