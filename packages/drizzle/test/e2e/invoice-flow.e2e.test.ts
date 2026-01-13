/**
 * Invoice Flow E2E Tests
 *
 * Tests complete invoice flows from creation through finalization,
 * payment, and voiding against a real PostgreSQL database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayInvoicesRepository } from '../../src/repositories/invoices.repository.js';
import { QZPayPaymentsRepository } from '../../src/repositories/payments.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { QZPaySubscriptionsRepository } from '../../src/repositories/subscriptions.repository.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Invoice Flow E2E', () => {
    let invoicesRepo: QZPayInvoicesRepository;
    let paymentsRepo: QZPayPaymentsRepository;
    let customersRepo: QZPayCustomersRepository;
    let subscriptionsRepo: QZPaySubscriptionsRepository;
    let plansRepo: QZPayPlansRepository;

    let testCustomerId: string;
    let testSubscriptionId: string;

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        invoicesRepo = new QZPayInvoicesRepository(db);
        paymentsRepo = new QZPayPaymentsRepository(db);
        customersRepo = new QZPayCustomersRepository(db);
        subscriptionsRepo = new QZPaySubscriptionsRepository(db);
        plansRepo = new QZPayPlansRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();

        // Setup: Create customer
        const customer = await customersRepo.create({
            externalId: 'ext-invoice-flow-customer',
            email: 'invoice-flow@example.com',
            name: 'Invoice Flow Test',
            livemode: true
        });
        testCustomerId = customer.id;

        // Setup: Create plan and subscription
        const plan = await plansRepo.create({
            name: 'Invoice Flow Test Plan',
            active: true,
            livemode: true
        });

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscription = await subscriptionsRepo.create({
            customerId: testCustomerId,
            planId: plan.id,
            status: 'active',
            billingInterval: 'month',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            livemode: true
        });
        testSubscriptionId = subscription.id;
    });

    describe('Full Invoice Lifecycle', () => {
        it('should complete full invoice lifecycle: draft → open → paid', async () => {
            // Step 1: Generate invoice number
            const invoiceNumber = await invoicesRepo.generateInvoiceNumber('INV');
            expect(invoiceNumber).toBe('INV-000001');

            // Step 2: Create draft invoice
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);

            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                subscriptionId: testSubscriptionId,
                number: invoiceNumber,
                status: 'draft',
                currency: 'USD',
                subtotal: 9900,
                tax: 0,
                total: 9900,
                amountRemaining: 9900,
                amountPaid: 0,
                dueDate,
                livemode: true
            });

            expect(invoice.status).toBe('draft');
            expect(invoice.number).toBe('INV-000001');

            // Step 3: Add invoice lines
            await invoicesRepo.createLine({
                invoiceId: invoice.id,
                description: 'Monthly subscription - Pro Plan',
                quantity: 1,
                unitAmount: 7900,
                amount: 7900,
                currency: 'USD',
                livemode: true
            });

            await invoicesRepo.createLine({
                invoiceId: invoice.id,
                description: 'Add-on: Extra storage',
                quantity: 2,
                unitAmount: 1000,
                amount: 2000,
                currency: 'USD',
                livemode: true
            });

            // Verify lines
            const invoiceData = await invoicesRepo.findWithLines(invoice.id);
            if (!invoiceData) {
                throw new Error('Invoice not found');
            }
            const { lines } = invoiceData;
            expect(lines).toHaveLength(2);
            expect(lines.reduce((sum, l) => sum + l.amount, 0)).toBe(9900);

            // Step 4: Finalize invoice (draft → open)
            const openInvoice = await invoicesRepo.finalize(invoice.id);
            expect(openInvoice.status).toBe('open');

            // Step 5: Create payment for invoice
            const payment = await paymentsRepo.create({
                customerId: testCustomerId,
                invoiceId: invoice.id,
                amount: 9900,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                providerPaymentId: 'pi_invoice_payment',
                livemode: true
            });

            // Step 6: Record payment on invoice
            await invoicesRepo.recordPayment({
                invoiceId: invoice.id,
                paymentId: payment.id,
                amountApplied: 9900,
                currency: 'USD',
                livemode: true
            });

            // Step 7: Mark invoice as paid
            const paidInvoice = await invoicesRepo.updateStatus(invoice.id, 'paid', {
                amountPaid: 9900,
                amountRemaining: 0
            });

            expect(paidInvoice.status).toBe('paid');
            expect(paidInvoice.paidAt).not.toBeNull();
            expect(paidInvoice.amountPaid).toBe(9900);
            expect(paidInvoice.amountRemaining).toBe(0);

            // Verify total paid amount
            const totalPaid = await invoicesRepo.getTotalPaidAmount(invoice.id);
            expect(totalPaid).toBe(9900);
        });

        it('should handle invoice voiding', async () => {
            // Create and finalize invoice
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-VOID-001',
                status: 'draft',
                currency: 'USD',
                subtotal: 5000,
                total: 5000,
                amountRemaining: 5000,
                amountPaid: 0,
                livemode: true
            });

            await invoicesRepo.finalize(invoice.id);

            // Void the invoice
            const voidedInvoice = await invoicesRepo.updateStatus(invoice.id, 'void');

            expect(voidedInvoice.status).toBe('void');
            expect(voidedInvoice.voidedAt).not.toBeNull();
        });
    });

    describe('Invoice Number Generation', () => {
        it('should generate sequential invoice numbers', async () => {
            const num1 = await invoicesRepo.generateInvoiceNumber('INV');
            expect(num1).toBe('INV-000001');

            await invoicesRepo.create({
                customerId: testCustomerId,
                number: num1,
                status: 'draft',
                currency: 'USD',
                subtotal: 1000,
                total: 1000,
                amountRemaining: 1000,
                amountPaid: 0,
                livemode: true
            });

            const num2 = await invoicesRepo.generateInvoiceNumber('INV');
            expect(num2).toBe('INV-000002');

            await invoicesRepo.create({
                customerId: testCustomerId,
                number: num2,
                status: 'draft',
                currency: 'USD',
                subtotal: 1000,
                total: 1000,
                amountRemaining: 1000,
                amountPaid: 0,
                livemode: true
            });

            const num3 = await invoicesRepo.generateInvoiceNumber('INV');
            expect(num3).toBe('INV-000003');
        });

        it('should support custom prefixes', async () => {
            const customNum = await invoicesRepo.generateInvoiceNumber('CUSTOM');
            expect(customNum).toBe('CUSTOM-000001');
        });
    });

    describe('Subscription Invoice Flow', () => {
        it('should generate recurring invoices for subscription', async () => {
            // Simulate 3 months of invoicing
            for (let month = 1; month <= 3; month++) {
                const invoiceNumber = await invoicesRepo.generateInvoiceNumber('SUB');

                const invoice = await invoicesRepo.create({
                    customerId: testCustomerId,
                    subscriptionId: testSubscriptionId,
                    number: invoiceNumber,
                    status: 'draft',
                    currency: 'USD',
                    subtotal: 9900,
                    total: 9900,
                    amountRemaining: 9900,
                    amountPaid: 0,
                    periodStart: new Date(2024, month - 1, 1),
                    periodEnd: new Date(2024, month, 0),
                    livemode: true
                });

                // Add line item
                await invoicesRepo.createLine({
                    invoiceId: invoice.id,
                    description: `Monthly subscription - Month ${month}`,
                    quantity: 1,
                    unitAmount: 9900,
                    amount: 9900,
                    currency: 'USD',
                    livemode: true
                });

                // Finalize and pay
                await invoicesRepo.finalize(invoice.id);
                await invoicesRepo.updateStatus(invoice.id, 'paid', {
                    amountPaid: 9900,
                    amountRemaining: 0
                });
            }

            // Verify all subscription invoices
            const subscriptionInvoices = await invoicesRepo.findBySubscriptionId(testSubscriptionId);
            expect(subscriptionInvoices).toHaveLength(3);
            expect(subscriptionInvoices.every((inv) => inv.status === 'paid')).toBe(true);
        });
    });

    describe('Overdue Invoice Handling', () => {
        it('should identify overdue invoices', async () => {
            const pastDueDate = new Date();
            pastDueDate.setDate(pastDueDate.getDate() - 10); // 10 days ago

            // Create overdue invoice
            const overdueInvoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-OVERDUE-001',
                status: 'open', // Already finalized
                currency: 'USD',
                subtotal: 5000,
                total: 5000,
                amountRemaining: 5000,
                amountPaid: 0,
                dueDate: pastDueDate,
                livemode: true
            });

            // Create non-overdue invoice
            const futureDueDate = new Date();
            futureDueDate.setDate(futureDueDate.getDate() + 30);

            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-FUTURE-001',
                status: 'open',
                currency: 'USD',
                subtotal: 3000,
                total: 3000,
                amountRemaining: 3000,
                amountPaid: 0,
                dueDate: futureDueDate,
                livemode: true
            });

            // Find overdue invoices
            const overdueInvoices = await invoicesRepo.findOverdue(true);
            expect(overdueInvoices).toHaveLength(1);
            expect(overdueInvoices[0].id).toBe(overdueInvoice.id);
        });

        it('should find unpaid invoices', async () => {
            // Create draft invoice
            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-DRAFT-001',
                status: 'draft',
                currency: 'USD',
                subtotal: 1000,
                total: 1000,
                amountRemaining: 1000,
                amountPaid: 0,
                livemode: true
            });

            // Create open invoice
            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-OPEN-001',
                status: 'open',
                currency: 'USD',
                subtotal: 2000,
                total: 2000,
                amountRemaining: 2000,
                amountPaid: 0,
                livemode: true
            });

            // Create paid invoice
            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-PAID-001',
                status: 'paid',
                currency: 'USD',
                subtotal: 3000,
                total: 3000,
                amountRemaining: 0,
                amountPaid: 3000,
                livemode: true
            });

            const unpaidInvoices = await invoicesRepo.findUnpaid(true);
            expect(unpaidInvoices).toHaveLength(2);
            expect(unpaidInvoices.every((inv) => inv.status === 'draft' || inv.status === 'open')).toBe(true);
        });
    });

    describe('Partial Payment Flow', () => {
        it('should handle multiple partial payments on invoice', async () => {
            // Create invoice for $100
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'INV-PARTIAL-001',
                status: 'open',
                currency: 'USD',
                subtotal: 10000,
                total: 10000,
                amountRemaining: 10000,
                amountPaid: 0,
                livemode: true
            });

            // First partial payment $40
            const payment1 = await paymentsRepo.create({
                customerId: testCustomerId,
                invoiceId: invoice.id,
                amount: 4000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await invoicesRepo.recordPayment({
                invoiceId: invoice.id,
                paymentId: payment1.id,
                amountApplied: 4000,
                currency: 'USD',
                livemode: true
            });

            await invoicesRepo.update(invoice.id, {
                amountPaid: 4000,
                amountRemaining: 6000
            });

            // Second partial payment $60
            const payment2 = await paymentsRepo.create({
                customerId: testCustomerId,
                invoiceId: invoice.id,
                amount: 6000,
                currency: 'USD',
                status: 'succeeded',
                provider: 'stripe',
                livemode: true
            });

            await invoicesRepo.recordPayment({
                invoiceId: invoice.id,
                paymentId: payment2.id,
                amountApplied: 6000,
                currency: 'USD',
                livemode: true
            });

            await invoicesRepo.updateStatus(invoice.id, 'paid', {
                amountPaid: 10000,
                amountRemaining: 0
            });

            // Verify payments recorded
            const invoicePayments = await invoicesRepo.findPaymentsByInvoiceId(invoice.id);
            expect(invoicePayments).toHaveLength(2);

            const totalPaid = await invoicesRepo.getTotalPaidAmount(invoice.id);
            expect(totalPaid).toBe(10000);

            // Verify final invoice state
            const finalInvoice = await invoicesRepo.findById(invoice.id);
            expect(finalInvoice?.status).toBe('paid');
            expect(finalInvoice?.amountPaid).toBe(10000);
            expect(finalInvoice?.amountRemaining).toBe(0);
        });
    });

    describe('Invoice Search and Filtering', () => {
        beforeEach(async () => {
            // Create invoices with various statuses
            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'SEARCH-001',
                status: 'paid',
                currency: 'USD',
                subtotal: 1000,
                total: 1000,
                amountRemaining: 0,
                amountPaid: 1000,
                livemode: true
            });
            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'SEARCH-002',
                status: 'open',
                currency: 'USD',
                subtotal: 2000,
                total: 2000,
                amountRemaining: 2000,
                amountPaid: 0,
                livemode: true
            });
            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'SEARCH-003',
                status: 'void',
                currency: 'USD',
                subtotal: 3000,
                total: 3000,
                amountRemaining: 3000,
                amountPaid: 0,
                livemode: false
            });
        });

        it('should search by multiple statuses', async () => {
            const result = await invoicesRepo.search({ status: ['paid', 'open'] });
            expect(result.data).toHaveLength(2);
        });

        it('should filter by livemode', async () => {
            const liveResult = await invoicesRepo.search({ livemode: true });
            const testResult = await invoicesRepo.search({ livemode: false });

            expect(liveResult.data).toHaveLength(2);
            expect(testResult.data).toHaveLength(1);
        });

        it('should search by customer and status combined', async () => {
            const result = await invoicesRepo.findByCustomerId(testCustomerId, { status: 'paid' });
            expect(result.data).toHaveLength(1);
            expect(result.data[0].number).toBe('SEARCH-001');
        });

        it('should find invoice by number', async () => {
            const invoice = await invoicesRepo.findByNumber('SEARCH-002');
            expect(invoice).not.toBeNull();
            expect(invoice?.status).toBe('open');
        });
    });

    describe('Provider Invoice Lookup', () => {
        it('should find invoice by Stripe ID', async () => {
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'STRIPE-001',
                status: 'open',
                currency: 'USD',
                subtotal: 1000,
                total: 1000,
                amountRemaining: 1000,
                amountPaid: 0,
                stripeInvoiceId: 'in_stripe_abc123',
                livemode: true
            });

            const found = await invoicesRepo.findByStripeInvoiceId('in_stripe_abc123');
            expect(found).not.toBeNull();
            expect(found?.id).toBe(invoice.id);
        });

        it('should find invoice by MercadoPago ID', async () => {
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'MP-001',
                status: 'open',
                currency: 'ars',
                subtotal: 10000,
                total: 10000,
                amountRemaining: 10000,
                amountPaid: 0,
                mpInvoiceId: 'mp_invoice_xyz789',
                livemode: true
            });

            const found = await invoicesRepo.findByMpInvoiceId('mp_invoice_xyz789');
            expect(found).not.toBeNull();
            expect(found?.id).toBe(invoice.id);
        });

        it('should find by provider using generic method', async () => {
            await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'GENERIC-001',
                status: 'open',
                currency: 'USD',
                subtotal: 1000,
                total: 1000,
                amountRemaining: 1000,
                amountPaid: 0,
                stripeInvoiceId: 'in_generic_test',
                livemode: true
            });

            const found = await invoicesRepo.findByProviderInvoiceId('stripe', 'in_generic_test');
            expect(found).not.toBeNull();
            expect(found?.number).toBe('GENERIC-001');
        });
    });

    describe('Invoice with Tax', () => {
        it('should handle invoice with tax calculation', async () => {
            const invoice = await invoicesRepo.create({
                customerId: testCustomerId,
                number: 'TAX-001',
                status: 'draft',
                currency: 'USD',
                subtotal: 10000, // $100.00
                tax: 800, // $8.00 (8% tax)
                total: 10800, // $108.00
                amountRemaining: 10800,
                amountPaid: 0,
                livemode: true
            });

            // Add pre-tax line item
            await invoicesRepo.createLine({
                invoiceId: invoice.id,
                description: 'Professional Service',
                quantity: 1,
                unitAmount: 10000,
                amount: 10000,
                currency: 'USD',
                livemode: true
            });

            // Add tax line item
            await invoicesRepo.createLine({
                invoiceId: invoice.id,
                description: 'Sales Tax (8%)',
                quantity: 1,
                unitAmount: 800,
                amount: 800,
                currency: 'USD',
                livemode: true
            });

            const invoiceData = await invoicesRepo.findWithLines(invoice.id);
            if (!invoiceData) {
                throw new Error('Invoice not found');
            }
            const { invoice: inv, lines } = invoiceData;
            expect(inv.subtotal).toBe(10000);
            expect(inv.tax).toBe(800);
            expect(inv.total).toBe(10800);
            expect(lines).toHaveLength(2);
        });
    });
});
