/**
 * Invoices Repository Integration Tests
 *
 * Tests the invoices repository against a real PostgreSQL database
 * using Testcontainers for isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../src/repositories/customers.repository.js';
import { QZPayInvoicesRepository } from '../src/repositories/invoices.repository.js';
import { QZPayPaymentsRepository } from '../src/repositories/payments.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from './helpers/db-helpers.js';

describe('QZPayInvoicesRepository', () => {
    let invoicesRepository: QZPayInvoicesRepository;
    let customersRepository: QZPayCustomersRepository;
    let paymentsRepository: QZPayPaymentsRepository;
    let testCustomerId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        invoicesRepository = new QZPayInvoicesRepository(db);
        customersRepository = new QZPayCustomersRepository(db);
        paymentsRepository = new QZPayPaymentsRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
        // Create a test customer for invoice tests
        const customer = await customersRepository.create({
            externalId: 'ext-inv-customer',
            email: 'invoice-test@example.com',
            livemode: true
        });
        testCustomerId = customer.id;
    });

    describe('create', () => {
        it('should create a new invoice', async () => {
            const input = {
                customerId: testCustomerId,
                number: 'INV-000001',
                status: 'draft' as const,
                currency: 'usd',
                subtotal: 10000,
                tax: 1000,
                total: 11000,
                amountPaid: 0,
                amountRemaining: 11000,
                livemode: true
            };

            const invoice = await invoicesRepository.create(input);

            expect(invoice.id).toBeDefined();
            expect(invoice.customerId).toBe(testCustomerId);
            expect(invoice.number).toBe('INV-000001');
            expect(invoice.status).toBe('draft');
            expect(invoice.total).toBe(11000);
            expect(invoice.createdAt).toBeInstanceOf(Date);
        });

        it('should create invoice with provider IDs', async () => {
            const input = {
                customerId: testCustomerId,
                number: 'INV-000002',
                status: 'open' as const,
                currency: 'usd',
                total: 5000,
                stripeInvoiceId: 'in_stripe123',
                mpInvoiceId: 'mp_inv456',
                livemode: true
            };

            const invoice = await invoicesRepository.create(input);

            expect(invoice.stripeInvoiceId).toBe('in_stripe123');
            expect(invoice.mpInvoiceId).toBe('mp_inv456');
        });
    });

    describe('findById', () => {
        it('should find invoice by ID', async () => {
            const created = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-FIND-001',
                status: 'draft' as const,
                currency: 'usd',
                total: 5000,
                livemode: true
            });

            const found = await invoicesRepository.findById(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
            expect(found?.number).toBe('INV-FIND-001');
        });

        it('should return null for non-existent ID', async () => {
            const found = await invoicesRepository.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });
    });

    describe('findByNumber', () => {
        it('should find invoice by number', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-UNIQUE-123',
                status: 'open' as const,
                currency: 'usd',
                total: 7500,
                livemode: true
            });

            const found = await invoicesRepository.findByNumber('INV-UNIQUE-123');

            expect(found).not.toBeNull();
            expect(found?.number).toBe('INV-UNIQUE-123');
        });
    });

    describe('findByStripeInvoiceId', () => {
        it('should find invoice by Stripe invoice ID', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-STRIPE-001',
                status: 'open' as const,
                currency: 'usd',
                total: 3000,
                stripeInvoiceId: 'in_test123456',
                livemode: true
            });

            const found = await invoicesRepository.findByStripeInvoiceId('in_test123456');

            expect(found).not.toBeNull();
            expect(found?.stripeInvoiceId).toBe('in_test123456');
        });
    });

    describe('findByMpInvoiceId', () => {
        it('should find invoice by MercadoPago invoice ID', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-MP-001',
                status: 'open' as const,
                currency: 'ars',
                total: 15000,
                mpInvoiceId: 'mp_inv_789',
                livemode: true
            });

            const found = await invoicesRepository.findByMpInvoiceId('mp_inv_789');

            expect(found).not.toBeNull();
            expect(found?.mpInvoiceId).toBe('mp_inv_789');
        });
    });

    describe('findByProviderInvoiceId', () => {
        it('should find by stripe provider', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-PROV-S1',
                status: 'open' as const,
                currency: 'usd',
                total: 2000,
                stripeInvoiceId: 'in_provider_stripe',
                livemode: true
            });

            const found = await invoicesRepository.findByProviderInvoiceId('stripe', 'in_provider_stripe');
            expect(found).not.toBeNull();
        });

        it('should find by mercadopago provider', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-PROV-MP1',
                status: 'open' as const,
                currency: 'ars',
                total: 5000,
                mpInvoiceId: 'mp_provider_id',
                livemode: true
            });

            const found = await invoicesRepository.findByProviderInvoiceId('mercadopago', 'mp_provider_id');
            expect(found).not.toBeNull();
        });
    });

    describe('findByCustomerId', () => {
        it('should find invoices by customer ID with pagination', async () => {
            for (let i = 1; i <= 5; i++) {
                await invoicesRepository.create({
                    customerId: testCustomerId,
                    number: `INV-CUST-${i.toString().padStart(3, '0')}`,
                    status: 'open' as const,
                    currency: 'usd',
                    total: i * 1000,
                    livemode: true
                });
            }

            const result = await invoicesRepository.findByCustomerId(testCustomerId, { limit: 3, offset: 0 });

            expect(result.data).toHaveLength(3);
            expect(result.total).toBe(5);
        });

        it('should filter by status', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-STATUS-1',
                status: 'draft' as const,
                currency: 'usd',
                total: 1000,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-STATUS-2',
                status: 'paid' as const,
                currency: 'usd',
                total: 2000,
                livemode: true
            });

            const draftResult = await invoicesRepository.findByCustomerId(testCustomerId, { status: 'draft' });
            const paidResult = await invoicesRepository.findByCustomerId(testCustomerId, { status: 'paid' });

            expect(draftResult.data).toHaveLength(1);
            expect(paidResult.data).toHaveLength(1);
        });

        it('should filter by multiple statuses', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-MULTI-1',
                status: 'draft' as const,
                currency: 'usd',
                total: 1000,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-MULTI-2',
                status: 'open' as const,
                currency: 'usd',
                total: 2000,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-MULTI-3',
                status: 'paid' as const,
                currency: 'usd',
                total: 3000,
                livemode: true
            });

            const result = await invoicesRepository.findByCustomerId(testCustomerId, { status: ['draft', 'open'] });

            expect(result.data).toHaveLength(2);
        });
    });

    describe('findUnpaid', () => {
        it('should find unpaid invoices (draft and open)', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-UNPAID-1',
                status: 'draft' as const,
                currency: 'usd',
                total: 1000,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-UNPAID-2',
                status: 'open' as const,
                currency: 'usd',
                total: 2000,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-UNPAID-3',
                status: 'paid' as const,
                currency: 'usd',
                total: 3000,
                livemode: true
            });

            const unpaid = await invoicesRepository.findUnpaid(true);

            expect(unpaid).toHaveLength(2);
        });
    });

    describe('findOverdue', () => {
        it('should find overdue invoices', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-OVERDUE-1',
                status: 'open' as const,
                currency: 'usd',
                total: 1000,
                dueDate: yesterday,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-OVERDUE-2',
                status: 'open' as const,
                currency: 'usd',
                total: 2000,
                dueDate: tomorrow,
                livemode: true
            });

            const overdue = await invoicesRepository.findOverdue(true);

            expect(overdue).toHaveLength(1);
            expect(overdue[0].number).toBe('INV-OVERDUE-1');
        });
    });

    describe('update', () => {
        it('should update invoice fields', async () => {
            const created = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-UPDATE-1',
                status: 'draft' as const,
                currency: 'usd',
                subtotal: 5000,
                total: 5000,
                livemode: true
            });

            const updated = await invoicesRepository.update(created.id, {
                subtotal: 5500,
                total: 6000,
                metadata: { note: 'updated' }
            });

            expect(updated.subtotal).toBe(5500);
            expect(updated.total).toBe(6000);
            expect(updated.metadata).toEqual({ note: 'updated' });
            expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });
    });

    describe('updateStatus', () => {
        it('should update invoice status to paid with paidAt', async () => {
            const created = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-PAID-1',
                status: 'open' as const,
                currency: 'usd',
                total: 5000,
                livemode: true
            });

            const updated = await invoicesRepository.updateStatus(created.id, 'paid');

            expect(updated.status).toBe('paid');
            expect(updated.paidAt).toBeInstanceOf(Date);
        });

        it('should update invoice status to void with voidedAt', async () => {
            const created = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-VOID-1',
                status: 'open' as const,
                currency: 'usd',
                total: 5000,
                livemode: true
            });

            const updated = await invoicesRepository.updateStatus(created.id, 'void');

            expect(updated.status).toBe('void');
            expect(updated.voidedAt).toBeInstanceOf(Date);
        });
    });

    describe('finalize', () => {
        it('should finalize draft invoice to open', async () => {
            const created = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-FINALIZE-1',
                status: 'draft' as const,
                currency: 'usd',
                total: 5000,
                livemode: true
            });

            const finalized = await invoicesRepository.finalize(created.id);

            expect(finalized.status).toBe('open');
        });

        it('should throw when finalizing non-draft invoice', async () => {
            const created = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-FINALIZE-2',
                status: 'open' as const,
                currency: 'usd',
                total: 5000,
                livemode: true
            });

            await expect(invoicesRepository.finalize(created.id)).rejects.toThrow();
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-SEARCH-1',
                status: 'draft' as const,
                currency: 'usd',
                total: 1000,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-SEARCH-2',
                status: 'open' as const,
                currency: 'usd',
                total: 2000,
                livemode: true
            });
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-SEARCH-3',
                status: 'paid' as const,
                currency: 'usd',
                total: 3000,
                livemode: false
            });
        });

        it('should search by livemode', async () => {
            const liveResult = await invoicesRepository.search({ livemode: true });
            const testResult = await invoicesRepository.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should search by customer ID', async () => {
            const result = await invoicesRepository.search({ customerId: testCustomerId });
            expect(result.total).toBe(3);
        });

        it('should paginate results', async () => {
            const page1 = await invoicesRepository.search({ limit: 2, offset: 0 });
            const page2 = await invoicesRepository.search({ limit: 2, offset: 2 });

            expect(page1.data).toHaveLength(2);
            expect(page2.data).toHaveLength(1);
        });
    });

    describe('generateInvoiceNumber', () => {
        it('should generate first invoice number', async () => {
            const number = await invoicesRepository.generateInvoiceNumber('INV');
            expect(number).toBe('INV-000001');
        });

        it('should increment invoice number', async () => {
            await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-000005',
                status: 'draft' as const,
                currency: 'usd',
                total: 1000,
                livemode: true
            });

            const number = await invoicesRepository.generateInvoiceNumber('INV');
            expect(number).toBe('INV-000006');
        });

        it('should use custom prefix', async () => {
            const number = await invoicesRepository.generateInvoiceNumber('CUSTOM');
            expect(number).toBe('CUSTOM-000001');
        });
    });

    describe('softDelete', () => {
        it('should soft delete an invoice', async () => {
            const created = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-DELETE-1',
                status: 'draft' as const,
                currency: 'usd',
                total: 5000,
                livemode: true
            });

            await invoicesRepository.softDelete(created.id);

            const found = await invoicesRepository.findById(created.id);
            expect(found).toBeNull();
        });

        it('should throw when deleting non-existent invoice', async () => {
            await expect(invoicesRepository.softDelete('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
        });
    });

    describe('Invoice Lines', () => {
        let testInvoiceId: string;

        beforeEach(async () => {
            const invoice = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-LINES-001',
                status: 'draft' as const,
                currency: 'usd',
                total: 10000,
                livemode: true
            });
            testInvoiceId = invoice.id;
        });

        it('should create invoice line', async () => {
            const line = await invoicesRepository.createLine({
                invoiceId: testInvoiceId,
                description: 'Pro Plan - Monthly',
                quantity: 1,
                unitAmount: 5000,
                amount: 5000,
                currency: 'usd'
            });

            expect(line.id).toBeDefined();
            expect(line.description).toBe('Pro Plan - Monthly');
            expect(line.amount).toBe(5000);
        });

        it('should create multiple invoice lines', async () => {
            const lines = await invoicesRepository.createLines([
                {
                    invoiceId: testInvoiceId,
                    description: 'Item 1',
                    quantity: 2,
                    unitAmount: 1000,
                    amount: 2000,
                    currency: 'usd'
                },
                {
                    invoiceId: testInvoiceId,
                    description: 'Item 2',
                    quantity: 1,
                    unitAmount: 3000,
                    amount: 3000,
                    currency: 'usd'
                }
            ]);

            expect(lines).toHaveLength(2);
        });

        it('should find lines by invoice ID', async () => {
            await invoicesRepository.createLines([
                {
                    invoiceId: testInvoiceId,
                    description: 'Line 1',
                    quantity: 1,
                    unitAmount: 1000,
                    amount: 1000,
                    currency: 'usd'
                },
                {
                    invoiceId: testInvoiceId,
                    description: 'Line 2',
                    quantity: 1,
                    unitAmount: 2000,
                    amount: 2000,
                    currency: 'usd'
                }
            ]);

            const lines = await invoicesRepository.findLinesByInvoiceId(testInvoiceId);

            expect(lines).toHaveLength(2);
        });

        it('should delete lines by invoice ID', async () => {
            await invoicesRepository.createLines([
                {
                    invoiceId: testInvoiceId,
                    description: 'To Delete',
                    quantity: 1,
                    unitAmount: 1000,
                    amount: 1000,
                    currency: 'usd'
                }
            ]);

            await invoicesRepository.deleteLinesByInvoiceId(testInvoiceId);
            const lines = await invoicesRepository.findLinesByInvoiceId(testInvoiceId);

            expect(lines).toHaveLength(0);
        });
    });

    describe('Invoice Payments', () => {
        let testInvoiceId: string;
        let testPaymentId: string;

        beforeEach(async () => {
            const invoice = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-PAY-001',
                status: 'open' as const,
                currency: 'usd',
                total: 10000,
                amountRemaining: 10000,
                livemode: true
            });
            testInvoiceId = invoice.id;

            const payment = await paymentsRepository.create({
                customerId: testCustomerId,
                amount: 10000,
                currency: 'usd',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });
            testPaymentId = payment.id;
        });

        it('should record invoice payment', async () => {
            const invoicePayment = await invoicesRepository.recordPayment({
                invoiceId: testInvoiceId,
                paymentId: testPaymentId,
                amountApplied: 10000,
                currency: 'usd',
                livemode: true
            });

            expect(invoicePayment.id).toBeDefined();
            expect(invoicePayment.amountApplied).toBe(10000);
        });

        it('should find payments by invoice ID', async () => {
            await invoicesRepository.recordPayment({
                invoiceId: testInvoiceId,
                paymentId: testPaymentId,
                amountApplied: 5000,
                currency: 'usd',
                livemode: true
            });

            const payments = await invoicesRepository.findPaymentsByInvoiceId(testInvoiceId);

            expect(payments).toHaveLength(1);
            expect(payments[0].amountApplied).toBe(5000);
        });

        it('should get total paid amount', async () => {
            await invoicesRepository.recordPayment({
                invoiceId: testInvoiceId,
                paymentId: testPaymentId,
                amountApplied: 5000,
                currency: 'usd',
                livemode: true
            });

            const total = await invoicesRepository.getTotalPaidAmount(testInvoiceId);

            expect(total).toBe(5000);
        });
    });

    describe('findWithLines', () => {
        it('should find invoice with lines', async () => {
            const invoice = await invoicesRepository.create({
                customerId: testCustomerId,
                number: 'INV-WITH-LINES-1',
                status: 'draft' as const,
                currency: 'usd',
                total: 5000,
                livemode: true
            });

            await invoicesRepository.createLines([
                {
                    invoiceId: invoice.id,
                    description: 'Line Item',
                    quantity: 1,
                    unitAmount: 5000,
                    amount: 5000,
                    currency: 'usd'
                }
            ]);

            const result = await invoicesRepository.findWithLines(invoice.id);

            expect(result).not.toBeNull();
            expect(result?.invoice.id).toBe(invoice.id);
            expect(result?.lines).toHaveLength(1);
        });

        it('should return null for non-existent invoice', async () => {
            const result = await invoicesRepository.findWithLines('00000000-0000-0000-0000-000000000000');
            expect(result).toBeNull();
        });
    });
});
