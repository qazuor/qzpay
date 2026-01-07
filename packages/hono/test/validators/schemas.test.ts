/**
 * Zod Schema Validation Tests
 */
import { describe, expect, it } from 'vitest';
import {
    CancelSubscriptionSchema,
    CreateCustomerSchema,
    CreateInvoiceSchema,
    CustomerQuerySchema,
    IdParamSchema,
    InvoiceQuerySchema,
    PaginationSchema,
    PaymentQuerySchema,
    ProcessPaymentSchema,
    RefundPaymentSchema,
    SubscriptionQuerySchema,
    UpdateCustomerSchema
} from '../../src/validators/schemas.js';

describe('Zod Validation Schemas', () => {
    describe('CustomerBaseSchema', () => {
        it('should validate valid customer data', () => {
            const result = CreateCustomerSchema.safeParse({
                email: 'test@example.com',
                name: 'John Doe'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('test@example.com');
                expect(result.data.name).toBe('John Doe');
            }
        });

        it('should accept optional fields', () => {
            const result = CreateCustomerSchema.safeParse({
                email: 'test@example.com',
                name: 'John Doe',
                externalId: 'ext-123',
                phone: '+1234567890',
                metadata: { plan: 'pro' }
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.externalId).toBe('ext-123');
                expect(result.data.metadata).toEqual({ plan: 'pro' });
            }
        });

        it('should reject invalid email', () => {
            const result = CreateCustomerSchema.safeParse({
                email: 'not-an-email',
                name: 'John Doe'
            });

            expect(result.success).toBe(false);
        });

        it('should reject empty name', () => {
            const result = CreateCustomerSchema.safeParse({
                email: 'test@example.com',
                name: ''
            });

            expect(result.success).toBe(false);
        });

        it('should reject name too long', () => {
            const result = CreateCustomerSchema.safeParse({
                email: 'test@example.com',
                name: 'a'.repeat(101)
            });

            expect(result.success).toBe(false);
        });
    });

    describe('UpdateCustomerSchema', () => {
        it('should accept partial updates', () => {
            const result = UpdateCustomerSchema.safeParse({
                name: 'New Name'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('New Name');
                expect(result.data.email).toBeUndefined();
            }
        });

        it('should accept empty object', () => {
            const result = UpdateCustomerSchema.safeParse({});

            expect(result.success).toBe(true);
        });
    });

    describe('ProcessPaymentSchema', () => {
        it('should validate valid payment data', () => {
            const result = ProcessPaymentSchema.safeParse({
                customerId: 'cust-123',
                amount: 1000,
                currency: 'usd'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amount).toBe(1000);
                expect(result.data.currency).toBe('USD');
            }
        });

        it('should transform currency to uppercase', () => {
            const result = ProcessPaymentSchema.safeParse({
                customerId: 'cust-123',
                amount: 1000,
                currency: 'eur'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.currency).toBe('EUR');
            }
        });

        it('should reject non-positive amount', () => {
            const result = ProcessPaymentSchema.safeParse({
                customerId: 'cust-123',
                amount: 0,
                currency: 'usd'
            });

            expect(result.success).toBe(false);
        });

        it('should reject negative amount', () => {
            const result = ProcessPaymentSchema.safeParse({
                customerId: 'cust-123',
                amount: -100,
                currency: 'usd'
            });

            expect(result.success).toBe(false);
        });

        it('should reject invalid currency length', () => {
            const result = ProcessPaymentSchema.safeParse({
                customerId: 'cust-123',
                amount: 1000,
                currency: 'us'
            });

            expect(result.success).toBe(false);
        });
    });

    describe('RefundPaymentSchema', () => {
        it('should accept optional amount', () => {
            const result = RefundPaymentSchema.safeParse({});

            expect(result.success).toBe(true);
        });

        it('should accept amount and reason', () => {
            const result = RefundPaymentSchema.safeParse({
                amount: 500,
                reason: 'Customer requested'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amount).toBe(500);
                expect(result.data.reason).toBe('Customer requested');
            }
        });

        it('should reject non-positive amount', () => {
            const result = RefundPaymentSchema.safeParse({
                amount: 0
            });

            expect(result.success).toBe(false);
        });
    });

    describe('CancelSubscriptionSchema', () => {
        it('should use default cancelAtPeriodEnd', () => {
            const result = CancelSubscriptionSchema.safeParse({});

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.cancelAtPeriodEnd).toBe(true);
            }
        });

        it('should accept false for immediate cancel', () => {
            const result = CancelSubscriptionSchema.safeParse({
                cancelAtPeriodEnd: false
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.cancelAtPeriodEnd).toBe(false);
            }
        });

        it('should accept reason', () => {
            const result = CancelSubscriptionSchema.safeParse({
                reason: 'Too expensive'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.reason).toBe('Too expensive');
            }
        });
    });

    describe('CreateInvoiceSchema', () => {
        it('should validate valid invoice data', () => {
            const result = CreateInvoiceSchema.safeParse({
                customerId: 'cust-123'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.customerId).toBe('cust-123');
            }
        });

        it('should accept optional fields', () => {
            const dueDate = new Date('2024-12-31');
            const result = CreateInvoiceSchema.safeParse({
                customerId: 'cust-123',
                subscriptionId: 'sub-456',
                dueDate: dueDate.toISOString(),
                metadata: { type: 'manual' }
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.subscriptionId).toBe('sub-456');
                expect(result.data.dueDate).toBeInstanceOf(Date);
            }
        });
    });

    describe('PaginationSchema', () => {
        it('should use defaults', () => {
            const result = PaginationSchema.safeParse({});

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(20);
                expect(result.data.offset).toBe(0);
            }
        });

        it('should coerce string to number', () => {
            const result = PaginationSchema.safeParse({
                limit: '50',
                offset: '10'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(50);
                expect(result.data.offset).toBe(10);
            }
        });

        it('should reject limit over 100', () => {
            const result = PaginationSchema.safeParse({
                limit: 150
            });

            expect(result.success).toBe(false);
        });

        it('should reject negative offset', () => {
            const result = PaginationSchema.safeParse({
                offset: -1
            });

            expect(result.success).toBe(false);
        });
    });

    describe('CustomerQuerySchema', () => {
        it('should extend pagination with filters', () => {
            const result = CustomerQuerySchema.safeParse({
                limit: 10,
                email: 'test@example.com',
                externalId: 'ext-123'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(10);
                expect(result.data.email).toBe('test@example.com');
                expect(result.data.externalId).toBe('ext-123');
            }
        });
    });

    describe('SubscriptionQuerySchema', () => {
        it('should accept status filter', () => {
            const result = SubscriptionQuerySchema.safeParse({
                status: 'active'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('active');
            }
        });

        it('should reject invalid status', () => {
            const result = SubscriptionQuerySchema.safeParse({
                status: 'invalid-status'
            });

            expect(result.success).toBe(false);
        });
    });

    describe('PaymentQuerySchema', () => {
        it('should accept date filters', () => {
            const from = new Date('2024-01-01');
            const to = new Date('2024-12-31');

            const result = PaymentQuerySchema.safeParse({
                from: from.toISOString(),
                to: to.toISOString()
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.from).toBeInstanceOf(Date);
                expect(result.data.to).toBeInstanceOf(Date);
            }
        });

        it('should accept status filter', () => {
            const result = PaymentQuerySchema.safeParse({
                status: 'succeeded'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('succeeded');
            }
        });
    });

    describe('InvoiceQuerySchema', () => {
        it('should accept invoice status filter', () => {
            const result = InvoiceQuerySchema.safeParse({
                status: 'paid'
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('paid');
            }
        });
    });

    describe('IdParamSchema', () => {
        it('should validate non-empty id', () => {
            const result = IdParamSchema.safeParse({
                id: 'item-123'
            });

            expect(result.success).toBe(true);
        });

        it('should reject empty id', () => {
            const result = IdParamSchema.safeParse({
                id: ''
            });

            expect(result.success).toBe(false);
        });
    });
});
