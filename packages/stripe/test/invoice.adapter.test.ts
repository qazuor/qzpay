/**
 * Stripe Invoice Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeInvoiceAdapter } from '../src/adapters/invoice.adapter.js';
import { createMockStripeClient, createMockStripeInvoice } from './helpers/stripe-mocks.js';

describe('QZPayStripeInvoiceAdapter', () => {
    let adapter: QZPayStripeInvoiceAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripeInvoiceAdapter(mockStripe);
        vi.clearAllMocks();
    });

    describe('list', () => {
        it('should list invoices for a customer', async () => {
            const mockInvoice1 = createMockStripeInvoice({ id: 'in_1' });
            const mockInvoice2 = createMockStripeInvoice({ id: 'in_2' });
            vi.mocked(mockStripe.invoices.list).mockResolvedValue({
                data: [mockInvoice1, mockInvoice2],
                has_more: false,
                object: 'list',
                url: '/v1/invoices'
            });

            const result = await adapter.list('cus_123');

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('in_1');
            expect(result[1].id).toBe('in_2');
            expect(mockStripe.invoices.list).toHaveBeenCalledWith({
                customer: 'cus_123'
            });
        });

        it('should list invoices with limit option', async () => {
            vi.mocked(mockStripe.invoices.list).mockResolvedValue({
                data: [],
                has_more: false,
                object: 'list',
                url: '/v1/invoices'
            });

            await adapter.list('cus_123', { limit: 10 });

            expect(mockStripe.invoices.list).toHaveBeenCalledWith({
                customer: 'cus_123',
                limit: 10
            });
        });

        it('should list invoices with pagination options', async () => {
            vi.mocked(mockStripe.invoices.list).mockResolvedValue({
                data: [],
                has_more: false,
                object: 'list',
                url: '/v1/invoices'
            });

            await adapter.list('cus_123', {
                limit: 10,
                startingAfter: 'in_start',
                endingBefore: 'in_end'
            });

            expect(mockStripe.invoices.list).toHaveBeenCalledWith({
                customer: 'cus_123',
                limit: 10,
                starting_after: 'in_start',
                ending_before: 'in_end'
            });
        });

        it('should map invoice data correctly', async () => {
            const now = Math.floor(Date.now() / 1000);
            const mockInvoice = createMockStripeInvoice({
                id: 'in_123',
                customer: 'cus_123',
                subscription: 'sub_123',
                status: 'open',
                currency: 'usd',
                subtotal: 1000,
                tax: 100,
                total: 1100,
                total_discount_amounts: [{ amount: 50, discount: 'disc_123' }],
                amount_paid: 0,
                amount_due: 1100,
                due_date: now + 86400,
                period_start: now,
                period_end: now + 2592000,
                metadata: { order_id: '12345' }
            });

            vi.mocked(mockStripe.invoices.list).mockResolvedValue({
                data: [mockInvoice],
                has_more: false,
                object: 'list',
                url: '/v1/invoices'
            });

            const result = await adapter.list('cus_123');

            expect(result[0]).toMatchObject({
                id: 'in_123',
                customerId: 'cus_123',
                subscriptionId: 'sub_123',
                status: 'open',
                currency: 'USD',
                subtotal: 1000,
                tax: 100,
                discount: 50,
                total: 1100,
                amountPaid: 0,
                amountDue: 1100,
                metadata: { order_id: '12345' }
            });

            expect(result[0].dueDate).toBeInstanceOf(Date);
            expect(result[0].periodStart).toBeInstanceOf(Date);
            expect(result[0].periodEnd).toBeInstanceOf(Date);
        });
    });

    describe('retrieve', () => {
        it('should retrieve a single invoice', async () => {
            const mockInvoice = createMockStripeInvoice({
                id: 'in_123',
                customer: 'cus_123',
                status: 'paid'
            });
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.id).toBe('in_123');
            expect(result.customerId).toBe('cus_123');
            expect(result.status).toBe('paid');
            expect(mockStripe.invoices.retrieve).toHaveBeenCalledWith('in_123');
        });

        it('should map all invoice statuses correctly', async () => {
            const statuses: Array<{ stripe: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'; expected: string }> = [
                { stripe: 'draft', expected: 'draft' },
                { stripe: 'open', expected: 'open' },
                { stripe: 'paid', expected: 'paid' },
                { stripe: 'void', expected: 'void' },
                { stripe: 'uncollectible', expected: 'uncollectible' }
            ];

            for (const { stripe, expected } of statuses) {
                const mockInvoice = createMockStripeInvoice({ status: stripe });
                vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

                const result = await adapter.retrieve('in_test');
                expect(result.status).toBe(expected);
            }
        });

        it('should handle invoice with expanded customer', async () => {
            const mockInvoice = createMockStripeInvoice({
                customer: {
                    id: 'cus_123',
                    object: 'customer',
                    email: 'test@example.com'
                    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
                } as any
            });
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.customerId).toBe('cus_123');
        });

        it('should handle invoice with expanded subscription', async () => {
            const mockInvoice = createMockStripeInvoice({
                subscription: {
                    id: 'sub_123',
                    object: 'subscription'
                    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
                } as any
            });
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.subscriptionId).toBe('sub_123');
        });

        it('should handle null values correctly', async () => {
            const mockInvoice = createMockStripeInvoice({
                subscription: null,
                due_date: null,
                hosted_invoice_url: null,
                invoice_pdf: null,
                status_transitions: {
                    paid_at: null,
                    finalized_at: null,
                    marked_uncollectible_at: null,
                    voided_at: null
                }
            });
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.subscriptionId).toBeNull();
            expect(result.dueDate).toBeNull();
            expect(result.paidAt).toBeNull();
            expect(result.hostedInvoiceUrl).toBeNull();
            expect(result.invoicePdf).toBeNull();
        });
    });

    describe('markPaid', () => {
        it('should mark an invoice as paid', async () => {
            const mockInvoice = createMockStripeInvoice({
                id: 'in_123',
                status: 'paid',
                amount_paid: 1000
            });
            vi.mocked(mockStripe.invoices.pay).mockResolvedValue(mockInvoice);

            const result = await adapter.markPaid('in_123');

            expect(result.id).toBe('in_123');
            expect(result.status).toBe('paid');
            expect(result.amountPaid).toBe(1000);
            expect(mockStripe.invoices.pay).toHaveBeenCalledWith('in_123', {
                paid_out_of_band: true
            });
        });
    });

    describe('finalize', () => {
        it('should finalize a draft invoice', async () => {
            const mockInvoice = createMockStripeInvoice({
                id: 'in_123',
                status: 'open'
            });
            vi.mocked(mockStripe.invoices.finalizeInvoice).mockResolvedValue(mockInvoice);

            const result = await adapter.finalize('in_123');

            expect(result.id).toBe('in_123');
            expect(result.status).toBe('open');
            expect(mockStripe.invoices.finalizeInvoice).toHaveBeenCalledWith('in_123');
        });
    });

    describe('void', () => {
        it('should void an invoice', async () => {
            const now = Math.floor(Date.now() / 1000);
            const mockInvoice = createMockStripeInvoice({
                id: 'in_123',
                status: 'void',
                status_transitions: {
                    voided_at: now,
                    paid_at: null,
                    finalized_at: null,
                    marked_uncollectible_at: null
                }
            });
            vi.mocked(mockStripe.invoices.voidInvoice).mockResolvedValue(mockInvoice);

            const result = await adapter.void('in_123');

            expect(result.id).toBe('in_123');
            expect(result.status).toBe('void');
            expect(mockStripe.invoices.voidInvoice).toHaveBeenCalledWith('in_123');
        });
    });

    describe('send', () => {
        it('should send an invoice to customer', async () => {
            const mockInvoice = createMockStripeInvoice({
                id: 'in_123',
                status: 'open'
            });
            vi.mocked(mockStripe.invoices.sendInvoice).mockResolvedValue(mockInvoice);

            const result = await adapter.send('in_123');

            expect(result.id).toBe('in_123');
            expect(result.status).toBe('open');
            expect(mockStripe.invoices.sendInvoice).toHaveBeenCalledWith('in_123');
        });
    });

    describe('edge cases', () => {
        it('should handle missing optional fields', async () => {
            const mockInvoice = createMockStripeInvoice({
                subtotal: undefined,
                tax: undefined,
                total_discount_amounts: undefined,
                total: undefined,
                amount_paid: undefined,
                amount_due: undefined
                // biome-ignore lint/suspicious/noExplicitAny: Testing undefined edge cases
            } as any);
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.subtotal).toBe(0);
            expect(result.tax).toBe(0);
            expect(result.discount).toBe(0);
            expect(result.total).toBe(0);
            expect(result.amountPaid).toBe(0);
            expect(result.amountDue).toBe(0);
        });

        it('should calculate total discount from multiple discounts', async () => {
            const mockInvoice = createMockStripeInvoice({
                total_discount_amounts: [
                    { amount: 100, discount: 'disc_1' },
                    { amount: 50, discount: 'disc_2' },
                    { amount: 25, discount: 'disc_3' }
                ]
            });
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.discount).toBe(175);
        });

        it('should handle empty metadata', async () => {
            const mockInvoice = createMockStripeInvoice({
                // biome-ignore lint/suspicious/noExplicitAny: Testing undefined metadata
                metadata: undefined as any
            });
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.metadata).toEqual({});
        });

        it('should convert currency to uppercase', async () => {
            const mockInvoice = createMockStripeInvoice({
                currency: 'eur'
            });
            vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue(mockInvoice);

            const result = await adapter.retrieve('in_123');

            expect(result.currency).toBe('EUR');
        });
    });
});
