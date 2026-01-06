/**
 * Tests for invoice service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayCreateInvoiceLineInput, QZPayInvoice, QZPayInvoiceLine } from '../../src/index.js';
import {
    QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG,
    qzpayCalculateInvoiceProration,
    qzpayCalculateInvoiceTotals,
    qzpayCalculateLineItemAmount,
    qzpayCreateInvoiceLines,
    qzpayCreateInvoiceNumberConfig,
    qzpayCreateProrationLineItems,
    qzpayFormatInvoiceAmount,
    qzpayGenerateInvoiceNumber,
    qzpayGetDaysUntilDue,
    qzpayGetInvoicePeriodDays,
    qzpayGetInvoicePeriodDescription,
    qzpayInvoiceCanBeFinalized,
    qzpayInvoiceCanBeModified,
    qzpayInvoiceCanBeVoided,
    qzpayInvoiceHasOutstandingBalance,
    qzpayInvoiceIsDraft,
    qzpayInvoiceIsOpen,
    qzpayInvoiceIsPaid,
    qzpayInvoiceIsPastDue,
    qzpayInvoiceIsUncollectible,
    qzpayInvoiceIsVoid,
    qzpayValidateInvoiceLines,
    qzpayValidateLineItem
} from '../../src/index.js';

// ==================== Test Fixtures ====================

function createInvoice(overrides: Partial<QZPayInvoice> = {}): QZPayInvoice {
    const now = new Date();
    return {
        id: 'inv_test123',
        number: 'INV-2024-000001',
        status: 'draft',
        customerId: 'cus_123',
        currency: 'USD',
        subtotal: 10000,
        tax: 0,
        discount: 0,
        total: 10000,
        amountDue: 10000,
        amountPaid: 0,
        dueDate: null,
        lines: [],
        periodStart: null,
        periodEnd: null,
        description: null,
        metadata: {},
        createdAt: now,
        finalizedAt: null,
        paidAt: null,
        voidedAt: null,
        updatedAt: now,
        deletedAt: null,
        ...overrides
    };
}

function createLineInput(overrides: Partial<QZPayCreateInvoiceLineInput> = {}): QZPayCreateInvoiceLineInput {
    return {
        description: 'Test item',
        quantity: 1,
        unitAmount: 1000,
        ...overrides
    };
}

function createInvoiceLine(overrides: Partial<QZPayInvoiceLine> = {}): QZPayInvoiceLine {
    return {
        id: 'line_123',
        invoiceId: 'inv_123',
        description: 'Test item',
        quantity: 1,
        unitAmount: 1000,
        amount: 1000,
        priceId: null,
        periodStart: null,
        periodEnd: null,
        metadata: {},
        ...overrides
    };
}

// ==================== Invoice Number Tests ====================

describe('Invoice Number Generation', () => {
    describe('qzpayGenerateInvoiceNumber', () => {
        it('should generate invoice number with default config', () => {
            const number = qzpayGenerateInvoiceNumber(1, QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG);
            const currentYear = new Date().getFullYear();

            expect(number).toBe(`INV-${currentYear}-000001`);
        });

        it('should pad sequence number correctly', () => {
            const number = qzpayGenerateInvoiceNumber(42, QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG);
            expect(number).toContain('000042');
        });

        it('should handle large sequence numbers', () => {
            const number = qzpayGenerateInvoiceNumber(999999, QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG);
            expect(number).toContain('999999');
        });

        it('should use custom prefix', () => {
            const config = qzpayCreateInvoiceNumberConfig({ prefix: 'BILL' });
            const number = qzpayGenerateInvoiceNumber(1, config);

            expect(number).toContain('BILL-');
        });

        it('should exclude year when configured', () => {
            const config = qzpayCreateInvoiceNumberConfig({ includeYear: false });
            const number = qzpayGenerateInvoiceNumber(1, config);

            expect(number).toBe('INV-000001');
        });

        it('should include tenant prefix when configured', () => {
            const config = qzpayCreateInvoiceNumberConfig({ includeTenantPrefix: true });
            const number = qzpayGenerateInvoiceNumber(1, config, 'acme');

            expect(number).toContain('ACME-');
        });

        it('should use custom separator', () => {
            const config = qzpayCreateInvoiceNumberConfig({ separator: '/' });
            const number = qzpayGenerateInvoiceNumber(1, config);
            const currentYear = new Date().getFullYear();

            expect(number).toBe(`INV/${currentYear}/000001`);
        });

        it('should use custom sequence digits', () => {
            const config = qzpayCreateInvoiceNumberConfig({ sequenceDigits: 3 });
            const number = qzpayGenerateInvoiceNumber(1, config);

            expect(number).toContain('001');
        });
    });
});

// ==================== Line Item Calculation Tests ====================

describe('Line Item Calculations', () => {
    describe('qzpayCalculateLineItemAmount', () => {
        it('should calculate amount correctly', () => {
            const lineInput = createLineInput({ quantity: 2, unitAmount: 500 });
            const result = qzpayCalculateLineItemAmount(lineInput);

            expect(result.quantity).toBe(2);
            expect(result.unitAmount).toBe(500);
            expect(result.amount).toBe(1000);
        });

        it('should handle fractional quantities', () => {
            const lineInput = createLineInput({ quantity: 2.5, unitAmount: 400 });
            const result = qzpayCalculateLineItemAmount(lineInput);

            expect(result.amount).toBe(1000);
        });
    });

    describe('qzpayCreateInvoiceLines', () => {
        it('should create invoice lines from inputs', () => {
            const inputs = [
                createLineInput({ description: 'Item 1', quantity: 1, unitAmount: 1000 }),
                createLineInput({ description: 'Item 2', quantity: 2, unitAmount: 500 })
            ];

            const lines = qzpayCreateInvoiceLines('inv_123', inputs);

            expect(lines).toHaveLength(2);
            expect(lines[0]?.description).toBe('Item 1');
            expect(lines[0]?.amount).toBe(1000);
            expect(lines[1]?.description).toBe('Item 2');
            expect(lines[1]?.amount).toBe(1000);
        });

        it('should generate unique line IDs', () => {
            const inputs = [createLineInput(), createLineInput()];
            const lines = qzpayCreateInvoiceLines('inv_123', inputs);

            expect(lines[0]?.id).not.toBe(lines[1]?.id);
        });
    });
});

// ==================== Invoice Totals Tests ====================

describe('Invoice Totals', () => {
    describe('qzpayCalculateInvoiceTotals', () => {
        it('should calculate totals correctly', () => {
            const lines = [createInvoiceLine({ amount: 1000 }), createInvoiceLine({ amount: 500 })];

            const totals = qzpayCalculateInvoiceTotals(lines);

            expect(totals.subtotal).toBe(1500);
            expect(totals.tax).toBe(0);
            expect(totals.discount).toBe(0);
            expect(totals.total).toBe(1500);
            expect(totals.amountDue).toBe(1500);
        });

        it('should apply tax rate', () => {
            const lines = [createInvoiceLine({ amount: 1000 })];
            const totals = qzpayCalculateInvoiceTotals(lines, 10); // 10% tax

            expect(totals.subtotal).toBe(1000);
            expect(totals.tax).toBe(100);
            expect(totals.total).toBe(1100);
        });

        it('should apply discount', () => {
            const lines = [createInvoiceLine({ amount: 1000 })];
            const totals = qzpayCalculateInvoiceTotals(lines, 0, 200);

            expect(totals.subtotal).toBe(1000);
            expect(totals.discount).toBe(200);
            expect(totals.total).toBe(800);
        });

        it('should account for amount paid', () => {
            const lines = [createInvoiceLine({ amount: 1000 })];
            const totals = qzpayCalculateInvoiceTotals(lines, 0, 0, 300);

            expect(totals.total).toBe(1000);
            expect(totals.amountDue).toBe(700);
        });

        it('should not have negative amount due', () => {
            const lines = [createInvoiceLine({ amount: 1000 })];
            const totals = qzpayCalculateInvoiceTotals(lines, 0, 0, 1500);

            expect(totals.amountDue).toBe(0);
        });

        it('should handle discount larger than subtotal', () => {
            const lines = [createInvoiceLine({ amount: 1000 })];
            const totals = qzpayCalculateInvoiceTotals(lines, 0, 2000);

            expect(totals.discount).toBe(2000);
            expect(totals.total).toBe(0);
        });
    });
});

// ==================== Status Helpers Tests ====================

describe('Invoice Status Helpers', () => {
    describe('qzpayInvoiceIsDraft', () => {
        it('should return true for draft invoice', () => {
            const invoice = createInvoice({ status: 'draft' });
            expect(qzpayInvoiceIsDraft(invoice)).toBe(true);
        });

        it('should return false for non-draft invoice', () => {
            const invoice = createInvoice({ status: 'open' });
            expect(qzpayInvoiceIsDraft(invoice)).toBe(false);
        });
    });

    describe('qzpayInvoiceIsOpen', () => {
        it('should return true for open invoice', () => {
            const invoice = createInvoice({ status: 'open' });
            expect(qzpayInvoiceIsOpen(invoice)).toBe(true);
        });
    });

    describe('qzpayInvoiceIsPaid', () => {
        it('should return true for paid invoice', () => {
            const invoice = createInvoice({ status: 'paid' });
            expect(qzpayInvoiceIsPaid(invoice)).toBe(true);
        });
    });

    describe('qzpayInvoiceIsVoid', () => {
        it('should return true for void invoice', () => {
            const invoice = createInvoice({ status: 'void' });
            expect(qzpayInvoiceIsVoid(invoice)).toBe(true);
        });
    });

    describe('qzpayInvoiceIsUncollectible', () => {
        it('should return true for uncollectible invoice', () => {
            const invoice = createInvoice({ status: 'uncollectible' });
            expect(qzpayInvoiceIsUncollectible(invoice)).toBe(true);
        });
    });
});

// ==================== Validation Tests ====================

describe('Invoice Validation', () => {
    describe('qzpayInvoiceCanBeFinalized', () => {
        it('should allow finalizing valid draft invoice', () => {
            const invoice = createInvoice({
                status: 'draft',
                lines: [createInvoiceLine()],
                total: 1000
            });

            const result = qzpayInvoiceCanBeFinalized(invoice);

            expect(result.canFinalize).toBe(true);
        });

        it('should reject non-draft invoice', () => {
            const invoice = createInvoice({ status: 'open' });
            const result = qzpayInvoiceCanBeFinalized(invoice);

            expect(result.canFinalize).toBe(false);
            expect(result.error).toBe('Only draft invoices can be finalized');
        });

        it('should reject invoice without line items', () => {
            const invoice = createInvoice({ status: 'draft', lines: [] });
            const result = qzpayInvoiceCanBeFinalized(invoice);

            expect(result.canFinalize).toBe(false);
            expect(result.error).toBe('Invoice must have at least one line item');
        });

        it('should reject invoice with zero total', () => {
            const invoice = createInvoice({
                status: 'draft',
                lines: [createInvoiceLine()],
                total: 0
            });
            const result = qzpayInvoiceCanBeFinalized(invoice);

            expect(result.canFinalize).toBe(false);
            expect(result.error).toBe('Invoice total must be greater than zero');
        });
    });

    describe('qzpayInvoiceCanBeVoided', () => {
        it('should allow voiding draft invoice', () => {
            const invoice = createInvoice({ status: 'draft' });
            const result = qzpayInvoiceCanBeVoided(invoice);

            expect(result.canVoid).toBe(true);
        });

        it('should allow voiding open invoice', () => {
            const invoice = createInvoice({ status: 'open' });
            const result = qzpayInvoiceCanBeVoided(invoice);

            expect(result.canVoid).toBe(true);
        });

        it('should reject voiding paid invoice', () => {
            const invoice = createInvoice({ status: 'paid' });
            const result = qzpayInvoiceCanBeVoided(invoice);

            expect(result.canVoid).toBe(false);
            expect(result.error).toBe('Paid invoices cannot be voided. Use refund instead.');
        });

        it('should reject voiding already voided invoice', () => {
            const invoice = createInvoice({ status: 'void' });
            const result = qzpayInvoiceCanBeVoided(invoice);

            expect(result.canVoid).toBe(false);
            expect(result.error).toBe('Invoice is already voided');
        });
    });

    describe('qzpayInvoiceCanBeModified', () => {
        it('should allow modifying draft invoice', () => {
            const invoice = createInvoice({ status: 'draft' });
            expect(qzpayInvoiceCanBeModified(invoice)).toBe(true);
        });

        it('should reject modifying finalized invoice', () => {
            const invoice = createInvoice({ status: 'open' });
            expect(qzpayInvoiceCanBeModified(invoice)).toBe(false);
        });
    });

    describe('qzpayValidateLineItem', () => {
        it('should validate correct line item', () => {
            const lineItem = createLineInput();
            const result = qzpayValidateLineItem(lineItem);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject empty description', () => {
            const lineItem = createLineInput({ description: '' });
            const result = qzpayValidateLineItem(lineItem);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Line item description is required');
        });

        it('should reject invalid quantity', () => {
            const lineItem = createLineInput({ quantity: 0 });
            const result = qzpayValidateLineItem(lineItem);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Quantity must be a positive number');
        });

        it('should reject negative unit amount', () => {
            const lineItem = createLineInput({ unitAmount: -100 });
            const result = qzpayValidateLineItem(lineItem);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Unit amount must be a non-negative number');
        });

        it('should reject non-integer unit amount', () => {
            const lineItem = createLineInput({ unitAmount: 10.5 });
            const result = qzpayValidateLineItem(lineItem);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Unit amount must be an integer (in cents)');
        });
    });

    describe('qzpayValidateInvoiceLines', () => {
        it('should validate correct line items', () => {
            const lines = [createLineInput(), createLineInput()];
            const result = qzpayValidateInvoiceLines(lines);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject empty lines array', () => {
            const result = qzpayValidateInvoiceLines([]);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least one line item is required');
        });

        it('should collect errors from all invalid lines', () => {
            const lines = [createLineInput({ description: '' }), createLineInput({ quantity: -1 })];
            const result = qzpayValidateInvoiceLines(lines);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
        });
    });
});

// ==================== Due Date Tests ====================

describe('Invoice Due Date Helpers', () => {
    describe('qzpayInvoiceIsPastDue', () => {
        it('should return false for invoice without due date', () => {
            const invoice = createInvoice({ status: 'open', dueDate: null });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(false);
        });

        it('should return true for overdue invoice', () => {
            const pastDate = new Date(Date.now() - 86400000);
            const invoice = createInvoice({ status: 'open', dueDate: pastDate });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(true);
        });

        it('should return false for invoice due in future', () => {
            const futureDate = new Date(Date.now() + 86400000);
            const invoice = createInvoice({ status: 'open', dueDate: futureDate });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(false);
        });

        it('should return false for paid invoice', () => {
            const pastDate = new Date(Date.now() - 86400000);
            const invoice = createInvoice({ status: 'paid', dueDate: pastDate });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(false);
        });
    });

    describe('qzpayGetDaysUntilDue', () => {
        it('should return null for invoice without due date', () => {
            const invoice = createInvoice({ dueDate: null });
            expect(qzpayGetDaysUntilDue(invoice)).toBeNull();
        });

        it('should return positive days for future due date', () => {
            const futureDate = new Date(Date.now() + 5 * 86400000);
            const invoice = createInvoice({ dueDate: futureDate });
            const days = qzpayGetDaysUntilDue(invoice);

            expect(days).toBeGreaterThanOrEqual(4);
            expect(days).toBeLessThanOrEqual(6);
        });

        it('should return negative days for past due date', () => {
            const pastDate = new Date(Date.now() - 5 * 86400000);
            const invoice = createInvoice({ dueDate: pastDate });
            const days = qzpayGetDaysUntilDue(invoice);

            expect(days).toBeLessThan(0);
        });
    });

    describe('qzpayInvoiceHasOutstandingBalance', () => {
        it('should return true for open invoice with amount due', () => {
            const invoice = createInvoice({ status: 'open', amountDue: 1000 });
            expect(qzpayInvoiceHasOutstandingBalance(invoice)).toBe(true);
        });

        it('should return false for paid invoice', () => {
            const invoice = createInvoice({ status: 'paid', amountDue: 0 });
            expect(qzpayInvoiceHasOutstandingBalance(invoice)).toBe(false);
        });

        it('should return false for open invoice with zero amount due', () => {
            const invoice = createInvoice({ status: 'open', amountDue: 0 });
            expect(qzpayInvoiceHasOutstandingBalance(invoice)).toBe(false);
        });
    });
});

// ==================== Period Helpers Tests ====================

describe('Invoice Period Helpers', () => {
    describe('qzpayGetInvoicePeriodDescription', () => {
        it('should return null for invoice without period', () => {
            const invoice = createInvoice();
            expect(qzpayGetInvoicePeriodDescription(invoice)).toBeNull();
        });

        it('should format period correctly', () => {
            const start = new Date('2024-01-01');
            const end = new Date('2024-01-31');
            const invoice = createInvoice({ periodStart: start, periodEnd: end });
            const description = qzpayGetInvoicePeriodDescription(invoice);

            expect(description).toBeTruthy();
            expect(description).toContain('Jan');
            expect(description).toContain('2024');
        });
    });

    describe('qzpayGetInvoicePeriodDays', () => {
        it('should return null for invoice without period', () => {
            const invoice = createInvoice();
            expect(qzpayGetInvoicePeriodDays(invoice)).toBeNull();
        });

        it('should calculate days correctly', () => {
            const start = new Date('2024-01-01');
            const end = new Date('2024-01-31');
            const invoice = createInvoice({ periodStart: start, periodEnd: end });
            const days = qzpayGetInvoicePeriodDays(invoice);

            expect(days).toBe(30);
        });
    });
});

// ==================== Formatting Tests ====================

describe('Invoice Formatting', () => {
    describe('qzpayFormatInvoiceAmount', () => {
        it('should format USD amount correctly', () => {
            const formatted = qzpayFormatInvoiceAmount(1000, 'USD');
            expect(formatted).toContain('10');
            expect(formatted).toContain('$');
        });

        it('should format EUR amount correctly', () => {
            const formatted = qzpayFormatInvoiceAmount(1000, 'EUR');
            expect(formatted).toContain('10');
            expect(formatted).toContain('€');
        });

        it('should handle zero amount', () => {
            const formatted = qzpayFormatInvoiceAmount(0, 'USD');
            expect(formatted).toContain('0');
        });
    });
});

// ==================== Proration Tests ====================

describe('Invoice Proration', () => {
    describe('qzpayCalculateInvoiceProration', () => {
        it('should calculate upgrade proration correctly', () => {
            const result = qzpayCalculateInvoiceProration(1000, 2000, 15, 30);

            expect(result.unusedCredit).toBe(500); // 50% of 1000
            expect(result.newPlanProrated).toBe(1000); // 50% of 2000
            expect(result.netAmount).toBe(500); // 1000 - 500
        });

        it('should calculate downgrade proration correctly', () => {
            const result = qzpayCalculateInvoiceProration(2000, 1000, 15, 30);

            expect(result.unusedCredit).toBe(1000); // 50% of 2000
            expect(result.newPlanProrated).toBe(500); // 50% of 1000
            expect(result.netAmount).toBe(-500); // Negative means credit
        });

        it('should handle full period remaining', () => {
            const result = qzpayCalculateInvoiceProration(1000, 2000, 30, 30);

            expect(result.unusedCredit).toBe(1000);
            expect(result.newPlanProrated).toBe(2000);
            expect(result.netAmount).toBe(1000);
        });

        it('should handle no time remaining', () => {
            const result = qzpayCalculateInvoiceProration(1000, 2000, 0, 30);

            expect(result.unusedCredit).toBe(0);
            expect(result.newPlanProrated).toBe(0);
            expect(result.netAmount).toBe(0);
        });
    });

    describe('qzpayCreateProrationLineItems', () => {
        it('should create credit and charge line items', () => {
            const proration = { unusedCredit: 500, newPlanProrated: 1000 };
            const start = new Date('2024-01-15');
            const end = new Date('2024-01-31');

            const lines = qzpayCreateProrationLineItems('inv_123', 'Basic Plan', 'Pro Plan', proration, start, end);

            expect(lines).toHaveLength(2);

            const creditLine = lines[0];
            expect(creditLine?.description).toContain('Basic Plan');
            expect(creditLine?.amount).toBe(-500);
            expect(creditLine?.metadata.type).toBe('credit');

            const chargeLine = lines[1];
            expect(chargeLine?.description).toContain('Pro Plan');
            expect(chargeLine?.amount).toBe(1000);
            expect(chargeLine?.metadata.type).toBe('charge');
        });

        it('should skip credit line if zero', () => {
            const proration = { unusedCredit: 0, newPlanProrated: 1000 };
            const start = new Date();
            const end = new Date();

            const lines = qzpayCreateProrationLineItems('inv_123', 'Basic Plan', 'Pro Plan', proration, start, end);

            expect(lines).toHaveLength(1);
            expect(lines[0]?.metadata.type).toBe('charge');
        });

        it('should skip charge line if zero', () => {
            const proration = { unusedCredit: 500, newPlanProrated: 0 };
            const start = new Date();
            const end = new Date();

            const lines = qzpayCreateProrationLineItems('inv_123', 'Basic Plan', 'Pro Plan', proration, start, end);

            expect(lines).toHaveLength(1);
            expect(lines[0]?.metadata.type).toBe('credit');
        });
    });
});
