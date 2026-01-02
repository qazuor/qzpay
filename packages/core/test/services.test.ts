/**
 * Tests for service helpers
 */
import { describe, expect, it } from 'vitest';
import { QZPAY_CURRENCY, QZPAY_INVOICE_STATUS, QZPAY_PAYMENT_STATUS, QZPAY_SUBSCRIPTION_STATUS } from '../src/constants/index.js';
// Invoice service helpers
import {
    QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG,
    // Payment service helpers
    qzpayCalculateGraceEndDate,
    qzpayCalculateInvoiceProration,
    qzpayCalculateInvoiceTotals,
    qzpayCalculateLineItemAmount,
    qzpayCalculateNextRetryDate,
    // Payment method service helpers
    qzpayCheckPaymentMethodExpiration,
    qzpayCreateExpirationConfig,
    qzpayCreateInvoiceLines,
    qzpayCreateInvoiceNumberConfig,
    qzpayCreatePaymentRetryConfig,
    qzpayCreateProrationLineItems,
    qzpayFilterActivePaymentMethods,
    qzpayFormatInvoiceAmount,
    qzpayGenerateInvoiceNumber,
    qzpayGetCardBrandIcon,
    qzpayGetCardExpirationDate,
    qzpayGetCardExpirationDisplay,
    qzpayGetDaysUntilCardExpiration,
    qzpayGetDaysUntilDue,
    qzpayGetExpiringPaymentMethods,
    qzpayGetGraceDaysRemaining,
    qzpayGetInvoicePeriodDays,
    qzpayGetInvoicePeriodDescription,
    qzpayGetPaymentMethodDisplayLabel,
    qzpayGetPaymentMethodTypeDisplay,
    qzpayGetRetryState,
    qzpayHasAccessDuringGrace,
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
    qzpayIsCardExpired,
    qzpayIsGracePeriodExpired,
    qzpayPaymentFailed,
    qzpayPaymentIsPending,
    qzpayPaymentIsRefundable,
    qzpayPaymentMethodCanBeDeleted,
    qzpayPaymentMethodIsActive,
    qzpayPaymentMethodIsDefault,
    qzpayPaymentMethodIsExpired,
    qzpayPaymentMethodIsValid,
    qzpayPaymentSucceeded,
    qzpayPaymentWasRefunded,
    qzpayShouldSendExpirationWarning,
    qzpaySortPaymentMethods,
    qzpayValidateBillingDetails,
    qzpayValidateInvoiceLines,
    qzpayValidateLineItem,
    qzpayValidatePaymentAmount
} from '../src/services/index.js';
import type {
    QZPayCardDetails,
    QZPayCreateInvoiceLineInput,
    QZPayInvoice,
    QZPayInvoiceLine,
    QZPayPayment,
    QZPayPaymentMethod,
    QZPaySubscription
} from '../src/types/index.js';

// ==================== Test Data Helpers ====================

function createPayment(overrides: Partial<QZPayPayment> = {}): QZPayPayment {
    return {
        id: 'pay_1',
        customerId: 'cust_1',
        subscriptionId: 'sub_1',
        invoiceId: 'inv_1',
        amount: 1000,
        currency: QZPAY_CURRENCY.USD,
        status: QZPAY_PAYMENT_STATUS.SUCCEEDED,
        providerPaymentIds: {},
        metadata: {},
        livemode: false,
        createdAt: new Date(),
        ...overrides
    };
}

function createInvoice(overrides: Partial<QZPayInvoice> = {}): QZPayInvoice {
    return {
        id: 'inv_1',
        customerId: 'cust_1',
        subscriptionId: 'sub_1',
        invoiceNumber: 'INV-2024-000001',
        status: QZPAY_INVOICE_STATUS.DRAFT,
        currency: QZPAY_CURRENCY.USD,
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
        amountPaid: 0,
        amountDue: 1000,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        paidAt: null,
        voidedAt: null,
        finalizedAt: null,
        hostedInvoiceUrl: null,
        invoicePdf: null,
        lines: [
            {
                id: 'line_1',
                invoiceId: 'inv_1',
                description: 'Test line item',
                quantity: 1,
                unitAmount: 1000,
                amount: 1000,
                priceId: null,
                periodStart: null,
                periodEnd: null,
                metadata: {}
            }
        ],
        providerInvoiceIds: {},
        metadata: {},
        livemode: false,
        createdAt: new Date(),
        ...overrides
    };
}

function createPaymentMethod(overrides: Partial<QZPayPaymentMethod> = {}): QZPayPaymentMethod {
    return {
        id: 'pm_1',
        customerId: 'cust_1',
        type: 'card',
        status: 'active',
        isDefault: false,
        card: {
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: new Date().getFullYear() + 2,
            funding: 'credit',
            country: 'US'
        },
        bankAccount: null,
        billingDetails: null,
        providerPaymentMethodIds: {},
        metadata: {},
        livemode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function createSubscription(overrides: Partial<QZPaySubscription> = {}): QZPaySubscription {
    const now = new Date();
    return {
        id: 'sub_1',
        customerId: 'cust_1',
        planId: 'plan_1',
        status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE,
        interval: 'month',
        intervalCount: 1,
        quantity: 1,
        currentPeriodStart: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        trialStart: null,
        trialEnd: null,
        cancelAt: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        providerSubscriptionIds: {},
        metadata: {},
        livemode: false,
        createdAt: now,
        ...overrides
    };
}

// ==================== Payment Service Tests ====================

describe('Payment Service', () => {
    describe('qzpayCreatePaymentRetryConfig', () => {
        it('should create retry config with defaults', () => {
            const config = qzpayCreatePaymentRetryConfig();
            expect(config.retryIntervals).toEqual([1, 3, 5, 7]);
            expect(config.maxAttempts).toBe(4);
            expect(config.gracePeriodDays).toBe(7);
        });

        it('should merge custom config with defaults', () => {
            const config = qzpayCreatePaymentRetryConfig({ maxAttempts: 6, gracePeriodDays: 14 });
            expect(config.maxAttempts).toBe(6);
            expect(config.gracePeriodDays).toBe(14);
            expect(config.retryIntervals).toEqual([1, 3, 5, 7]);
        });
    });

    describe('qzpayCalculateGraceEndDate', () => {
        it('should calculate grace period end date', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const graceEnd = qzpayCalculateGraceEndDate(firstFailure, 7);
            expect(graceEnd.toISOString()).toBe('2024-01-08T00:00:00.000Z');
        });
    });

    describe('qzpayCalculateNextRetryDate', () => {
        it('should return next retry date based on attempt', () => {
            const firstFailure = new Date('2024-01-01T12:00:00Z');
            const config = qzpayCreatePaymentRetryConfig();
            // Attempt 0: should add first interval (1 day)
            const nextRetry = qzpayCalculateNextRetryDate(firstFailure, 0, config);
            expect(nextRetry).not.toBeNull();
            // Verify the date is 1 day after first failure
            const dayDiff = Math.round((nextRetry?.getTime() - firstFailure.getTime()) / (1000 * 60 * 60 * 24));
            expect(dayDiff).toBe(1);
        });

        it('should return null when max attempts reached', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const config = qzpayCreatePaymentRetryConfig({ maxAttempts: 4 });
            const nextRetry = qzpayCalculateNextRetryDate(firstFailure, 4, config);
            expect(nextRetry).toBeNull();
        });
    });

    describe('qzpayIsGracePeriodExpired', () => {
        it('should return true when grace period has expired', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-10T00:00:00Z');
            expect(qzpayIsGracePeriodExpired(firstFailure, 7, now)).toBe(true);
        });

        it('should return false when grace period is still active', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-05T00:00:00Z');
            expect(qzpayIsGracePeriodExpired(firstFailure, 7, now)).toBe(false);
        });
    });

    describe('qzpayGetGraceDaysRemaining', () => {
        it('should return remaining days in grace period', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-05T00:00:00Z');
            expect(qzpayGetGraceDaysRemaining(firstFailure, 7, now)).toBe(3);
        });

        it('should return 0 when grace period has expired', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const now = new Date('2024-01-15T00:00:00Z');
            expect(qzpayGetGraceDaysRemaining(firstFailure, 7, now)).toBe(0);
        });
    });

    describe('qzpayGetRetryState', () => {
        it('should return null when no failed payments', () => {
            const payments = [createPayment({ status: QZPAY_PAYMENT_STATUS.SUCCEEDED })];
            const config = qzpayCreatePaymentRetryConfig();
            expect(qzpayGetRetryState(payments, config)).toBeNull();
        });

        it('should return retry state for failed payments', () => {
            const firstFailure = new Date('2024-01-01T00:00:00Z');
            const payments = [createPayment({ status: QZPAY_PAYMENT_STATUS.FAILED, createdAt: firstFailure })];
            const config = qzpayCreatePaymentRetryConfig();
            const now = new Date('2024-01-02T00:00:00Z');

            const state = qzpayGetRetryState(payments, config, now);

            expect(state).not.toBeNull();
            expect(state?.attemptNumber).toBe(1);
            expect(state?.firstFailureAt).toEqual(firstFailure);
            expect(state?.maxRetriesReached).toBe(false);
        });

        it('should indicate when max attempts exceeded', () => {
            const payments = [
                createPayment({ id: 'pay_1', status: QZPAY_PAYMENT_STATUS.FAILED, createdAt: new Date('2024-01-01') }),
                createPayment({ id: 'pay_2', status: QZPAY_PAYMENT_STATUS.FAILED, createdAt: new Date('2024-01-02') }),
                createPayment({ id: 'pay_3', status: QZPAY_PAYMENT_STATUS.FAILED, createdAt: new Date('2024-01-03') }),
                createPayment({ id: 'pay_4', status: QZPAY_PAYMENT_STATUS.FAILED, createdAt: new Date('2024-01-04') })
            ];
            const config = qzpayCreatePaymentRetryConfig({ maxAttempts: 4 });

            const state = qzpayGetRetryState(payments, config, new Date('2024-01-05T00:00:00Z'));

            expect(state?.maxRetriesReached).toBe(true);
            expect(state?.attemptNumber).toBe(4);
        });
    });

    describe('qzpayHasAccessDuringGrace', () => {
        it('should return true for active subscription', () => {
            const subscription = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.ACTIVE });
            expect(qzpayHasAccessDuringGrace(subscription, null)).toBe(true);
        });

        it('should return true for past_due subscription in grace period', () => {
            const subscription = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE });
            const retryState = {
                attemptNumber: 1,
                firstFailureAt: new Date('2024-01-01'),
                lastFailureAt: new Date('2024-01-01'),
                nextRetryAt: new Date('2024-01-02'),
                graceExpired: false,
                graceDaysRemaining: 5,
                maxRetriesReached: false
            };
            expect(qzpayHasAccessDuringGrace(subscription, retryState)).toBe(true);
        });

        it('should return false for past_due subscription after grace period', () => {
            const subscription = createSubscription({ status: QZPAY_SUBSCRIPTION_STATUS.PAST_DUE });
            const retryState = {
                attemptNumber: 4,
                firstFailureAt: new Date('2024-01-01'),
                lastFailureAt: new Date('2024-01-08'),
                nextRetryAt: null,
                graceExpired: true,
                graceDaysRemaining: 0,
                maxRetriesReached: true
            };
            expect(qzpayHasAccessDuringGrace(subscription, retryState)).toBe(false);
        });
    });

    describe('Payment status helpers', () => {
        it('qzpayPaymentSucceeded should detect succeeded payments', () => {
            expect(qzpayPaymentSucceeded(createPayment({ status: QZPAY_PAYMENT_STATUS.SUCCEEDED }))).toBe(true);
            expect(qzpayPaymentSucceeded(createPayment({ status: QZPAY_PAYMENT_STATUS.FAILED }))).toBe(false);
        });

        it('qzpayPaymentFailed should detect failed payments', () => {
            expect(qzpayPaymentFailed(createPayment({ status: QZPAY_PAYMENT_STATUS.FAILED }))).toBe(true);
            expect(qzpayPaymentFailed(createPayment({ status: QZPAY_PAYMENT_STATUS.SUCCEEDED }))).toBe(false);
        });

        it('qzpayPaymentIsPending should detect pending payments', () => {
            expect(qzpayPaymentIsPending(createPayment({ status: QZPAY_PAYMENT_STATUS.PENDING }))).toBe(true);
            expect(qzpayPaymentIsPending(createPayment({ status: QZPAY_PAYMENT_STATUS.SUCCEEDED }))).toBe(false);
        });

        it('qzpayPaymentWasRefunded should detect refunded payments', () => {
            expect(qzpayPaymentWasRefunded(createPayment({ status: QZPAY_PAYMENT_STATUS.REFUNDED }))).toBe(true);
            expect(qzpayPaymentWasRefunded(createPayment({ status: QZPAY_PAYMENT_STATUS.SUCCEEDED }))).toBe(false);
        });

        it('qzpayPaymentIsRefundable should check if payment can be refunded', () => {
            expect(qzpayPaymentIsRefundable(createPayment({ status: QZPAY_PAYMENT_STATUS.SUCCEEDED }))).toBe(true);
            expect(qzpayPaymentIsRefundable(createPayment({ status: QZPAY_PAYMENT_STATUS.FAILED }))).toBe(false);
        });
    });

    describe('qzpayValidatePaymentAmount', () => {
        it('should validate positive integer amounts', () => {
            expect(qzpayValidatePaymentAmount(1000).valid).toBe(true);
            expect(qzpayValidatePaymentAmount(1).valid).toBe(true);
        });

        it('should reject zero or negative amounts', () => {
            expect(qzpayValidatePaymentAmount(0).valid).toBe(false);
            expect(qzpayValidatePaymentAmount(-100).valid).toBe(false);
        });

        it('should reject non-integer amounts', () => {
            expect(qzpayValidatePaymentAmount(10.5).valid).toBe(false);
        });
    });
});

// ==================== Invoice Service Tests ====================

describe('Invoice Service', () => {
    describe('qzpayCreateInvoiceNumberConfig', () => {
        it('should create config with defaults', () => {
            const config = qzpayCreateInvoiceNumberConfig();
            expect(config.prefix).toBe('INV');
            expect(config.includeYear).toBe(true);
            expect(config.sequenceDigits).toBe(6);
        });

        it('should merge custom config', () => {
            const config = qzpayCreateInvoiceNumberConfig({ prefix: 'BILL', sequenceDigits: 4 });
            expect(config.prefix).toBe('BILL');
            expect(config.sequenceDigits).toBe(4);
            expect(config.includeYear).toBe(true);
        });
    });

    describe('qzpayGenerateInvoiceNumber', () => {
        it('should generate invoice number with year', () => {
            const config = QZPAY_DEFAULT_INVOICE_NUMBER_CONFIG;
            const number = qzpayGenerateInvoiceNumber(1, config, undefined, 2024);
            expect(number).toBe('INV-2024-000001');
        });

        it('should generate invoice number without year', () => {
            const config = qzpayCreateInvoiceNumberConfig({ includeYear: false });
            const number = qzpayGenerateInvoiceNumber(42, config);
            expect(number).toBe('INV-000042');
        });

        it('should include tenant prefix when configured', () => {
            const config = qzpayCreateInvoiceNumberConfig({ includeTenantPrefix: true });
            const number = qzpayGenerateInvoiceNumber(1, config, 'acme', 2024);
            expect(number).toBe('ACME-INV-2024-000001');
        });
    });

    describe('qzpayCalculateLineItemAmount', () => {
        it('should calculate line item amount', () => {
            const input: QZPayCreateInvoiceLineInput = {
                description: 'Test item',
                quantity: 2,
                unitAmount: 500
            };
            const result = qzpayCalculateLineItemAmount(input);
            expect(result.amount).toBe(1000);
            expect(result.quantity).toBe(2);
            expect(result.unitAmount).toBe(500);
        });
    });

    describe('qzpayCalculateInvoiceTotals', () => {
        it('should calculate totals without tax or discount', () => {
            const lines: QZPayInvoiceLine[] = [
                {
                    id: 'l1',
                    invoiceId: 'inv_1',
                    description: 'Item 1',
                    quantity: 1,
                    unitAmount: 1000,
                    amount: 1000,
                    priceId: null,
                    periodStart: null,
                    periodEnd: null,
                    metadata: {}
                },
                {
                    id: 'l2',
                    invoiceId: 'inv_1',
                    description: 'Item 2',
                    quantity: 2,
                    unitAmount: 500,
                    amount: 1000,
                    priceId: null,
                    periodStart: null,
                    periodEnd: null,
                    metadata: {}
                }
            ];
            const result = qzpayCalculateInvoiceTotals(lines);
            expect(result.subtotal).toBe(2000);
            expect(result.tax).toBe(0);
            expect(result.discount).toBe(0);
            expect(result.total).toBe(2000);
            expect(result.amountDue).toBe(2000);
        });

        it('should calculate with tax', () => {
            const lines: QZPayInvoiceLine[] = [
                {
                    id: 'l1',
                    invoiceId: 'inv_1',
                    description: 'Item',
                    quantity: 1,
                    unitAmount: 1000,
                    amount: 1000,
                    priceId: null,
                    periodStart: null,
                    periodEnd: null,
                    metadata: {}
                }
            ];
            const result = qzpayCalculateInvoiceTotals(lines, 10); // 10% tax
            expect(result.subtotal).toBe(1000);
            expect(result.tax).toBe(100);
            expect(result.total).toBe(1100);
        });

        it('should calculate with discount and tax', () => {
            const lines: QZPayInvoiceLine[] = [
                {
                    id: 'l1',
                    invoiceId: 'inv_1',
                    description: 'Item',
                    quantity: 1,
                    unitAmount: 1000,
                    amount: 1000,
                    priceId: null,
                    periodStart: null,
                    periodEnd: null,
                    metadata: {}
                }
            ];
            const result = qzpayCalculateInvoiceTotals(lines, 10, 200); // 10% tax, $2 discount
            expect(result.subtotal).toBe(1000);
            expect(result.discount).toBe(200);
            // Tax applied after discount: (1000 - 200) * 0.10 = 80
            expect(result.tax).toBe(80);
            expect(result.total).toBe(880); // 800 + 80
        });

        it('should calculate amount due with partial payment', () => {
            const lines: QZPayInvoiceLine[] = [
                {
                    id: 'l1',
                    invoiceId: 'inv_1',
                    description: 'Item',
                    quantity: 1,
                    unitAmount: 1000,
                    amount: 1000,
                    priceId: null,
                    periodStart: null,
                    periodEnd: null,
                    metadata: {}
                }
            ];
            const result = qzpayCalculateInvoiceTotals(lines, 0, 0, 400);
            expect(result.total).toBe(1000);
            expect(result.amountDue).toBe(600);
        });
    });

    describe('Invoice status helpers', () => {
        it('qzpayInvoiceIsDraft should detect draft invoices', () => {
            expect(qzpayInvoiceIsDraft(createInvoice({ status: QZPAY_INVOICE_STATUS.DRAFT }))).toBe(true);
            expect(qzpayInvoiceIsDraft(createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN }))).toBe(false);
        });

        it('qzpayInvoiceIsOpen should detect open invoices', () => {
            expect(qzpayInvoiceIsOpen(createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN }))).toBe(true);
            expect(qzpayInvoiceIsOpen(createInvoice({ status: QZPAY_INVOICE_STATUS.DRAFT }))).toBe(false);
        });

        it('qzpayInvoiceIsPaid should detect paid invoices', () => {
            expect(qzpayInvoiceIsPaid(createInvoice({ status: QZPAY_INVOICE_STATUS.PAID }))).toBe(true);
            expect(qzpayInvoiceIsPaid(createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN }))).toBe(false);
        });

        it('qzpayInvoiceIsVoid should detect voided invoices', () => {
            expect(qzpayInvoiceIsVoid(createInvoice({ status: QZPAY_INVOICE_STATUS.VOID }))).toBe(true);
            expect(qzpayInvoiceIsVoid(createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN }))).toBe(false);
        });

        it('qzpayInvoiceIsUncollectible should detect uncollectible invoices', () => {
            expect(qzpayInvoiceIsUncollectible(createInvoice({ status: QZPAY_INVOICE_STATUS.UNCOLLECTIBLE }))).toBe(true);
            expect(qzpayInvoiceIsUncollectible(createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN }))).toBe(false);
        });
    });

    describe('qzpayInvoiceCanBeFinalized', () => {
        it('should allow finalizing draft invoice with lines and positive total', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.DRAFT, total: 1000 });
            const result = qzpayInvoiceCanBeFinalized(invoice);
            expect(result.canFinalize).toBe(true);
        });

        it('should not allow finalizing non-draft invoice', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN });
            const result = qzpayInvoiceCanBeFinalized(invoice);
            expect(result.canFinalize).toBe(false);
            expect(result.error).toContain('draft');
        });

        it('should not allow finalizing invoice without lines', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.DRAFT, lines: [] });
            const result = qzpayInvoiceCanBeFinalized(invoice);
            expect(result.canFinalize).toBe(false);
            expect(result.error).toContain('line item');
        });

        it('should not allow finalizing invoice with zero total', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.DRAFT, total: 0 });
            const result = qzpayInvoiceCanBeFinalized(invoice);
            expect(result.canFinalize).toBe(false);
            expect(result.error).toContain('greater than zero');
        });
    });

    describe('qzpayInvoiceCanBeVoided', () => {
        it('should allow voiding open invoice', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN });
            const result = qzpayInvoiceCanBeVoided(invoice);
            expect(result.canVoid).toBe(true);
        });

        it('should not allow voiding paid invoice', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.PAID });
            const result = qzpayInvoiceCanBeVoided(invoice);
            expect(result.canVoid).toBe(false);
            expect(result.error).toContain('refund');
        });

        it('should not allow voiding already voided invoice', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.VOID });
            const result = qzpayInvoiceCanBeVoided(invoice);
            expect(result.canVoid).toBe(false);
            expect(result.error).toContain('already voided');
        });
    });

    describe('qzpayInvoiceCanBeModified', () => {
        it('should allow modifying draft invoice', () => {
            expect(qzpayInvoiceCanBeModified(createInvoice({ status: QZPAY_INVOICE_STATUS.DRAFT }))).toBe(true);
        });

        it('should not allow modifying non-draft invoice', () => {
            expect(qzpayInvoiceCanBeModified(createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN }))).toBe(false);
            expect(qzpayInvoiceCanBeModified(createInvoice({ status: QZPAY_INVOICE_STATUS.PAID }))).toBe(false);
        });
    });

    describe('qzpayInvoiceIsPastDue', () => {
        it('should detect past due open invoice', () => {
            const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN, dueDate: pastDueDate });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(true);
        });

        it('should not flag invoice without due date', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN, dueDate: null });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(false);
        });

        it('should not flag invoice not yet due', () => {
            const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN, dueDate: futureDate });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(false);
        });

        it('should not flag non-open invoice', () => {
            const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.PAID, dueDate: pastDueDate });
            expect(qzpayInvoiceIsPastDue(invoice)).toBe(false);
        });
    });

    describe('qzpayGetDaysUntilDue', () => {
        it('should calculate days until due', () => {
            const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const invoice = createInvoice({ dueDate: sevenDaysFromNow });
            const days = qzpayGetDaysUntilDue(invoice);
            expect(days).toBe(7);
        });

        it('should return null for invoice without due date', () => {
            const invoice = createInvoice({ dueDate: null });
            expect(qzpayGetDaysUntilDue(invoice)).toBeNull();
        });
    });

    describe('qzpayInvoiceHasOutstandingBalance', () => {
        it('should detect outstanding balance on open invoice', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN, amountDue: 500 });
            expect(qzpayInvoiceHasOutstandingBalance(invoice)).toBe(true);
        });

        it('should not flag fully paid invoice', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.OPEN, amountDue: 0 });
            expect(qzpayInvoiceHasOutstandingBalance(invoice)).toBe(false);
        });

        it('should not flag non-open invoice with balance', () => {
            const invoice = createInvoice({ status: QZPAY_INVOICE_STATUS.DRAFT, amountDue: 500 });
            expect(qzpayInvoiceHasOutstandingBalance(invoice)).toBe(false);
        });
    });

    describe('qzpayGetInvoicePeriodDescription', () => {
        it('should format period description', () => {
            const invoice = createInvoice({
                periodStart: new Date('2024-01-01'),
                periodEnd: new Date('2024-01-31')
            });
            const description = qzpayGetInvoicePeriodDescription(invoice);
            expect(description).toContain('Jan');
            expect(description).toContain('2024');
        });

        it('should return null when no period', () => {
            const invoice = createInvoice({ periodStart: null, periodEnd: null });
            expect(qzpayGetInvoicePeriodDescription(invoice)).toBeNull();
        });
    });

    describe('qzpayGetInvoicePeriodDays', () => {
        it('should calculate period days', () => {
            const invoice = createInvoice({
                periodStart: new Date('2024-01-01'),
                periodEnd: new Date('2024-01-31')
            });
            expect(qzpayGetInvoicePeriodDays(invoice)).toBe(30);
        });

        it('should return null when no period', () => {
            const invoice = createInvoice({ periodStart: null, periodEnd: null });
            expect(qzpayGetInvoicePeriodDays(invoice)).toBeNull();
        });
    });

    describe('qzpayFormatInvoiceAmount', () => {
        it('should format amount in USD', () => {
            const formatted = qzpayFormatInvoiceAmount(1000, QZPAY_CURRENCY.USD);
            expect(formatted).toBe('$10.00');
        });

        it('should format amount in EUR', () => {
            const formatted = qzpayFormatInvoiceAmount(2500, QZPAY_CURRENCY.EUR);
            expect(formatted).toContain('25');
        });
    });

    describe('qzpayValidateLineItem', () => {
        it('should validate correct line item', () => {
            const input: QZPayCreateInvoiceLineInput = {
                description: 'Test item',
                quantity: 1,
                unitAmount: 1000
            };
            const result = qzpayValidateLineItem(input);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject empty description', () => {
            const input: QZPayCreateInvoiceLineInput = {
                description: '',
                quantity: 1,
                unitAmount: 1000
            };
            const result = qzpayValidateLineItem(input);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Line item description is required');
        });

        it('should reject non-positive quantity', () => {
            const input: QZPayCreateInvoiceLineInput = {
                description: 'Test',
                quantity: 0,
                unitAmount: 1000
            };
            const result = qzpayValidateLineItem(input);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Quantity'))).toBe(true);
        });

        it('should reject non-integer unit amount', () => {
            const input: QZPayCreateInvoiceLineInput = {
                description: 'Test',
                quantity: 1,
                unitAmount: 10.5
            };
            const result = qzpayValidateLineItem(input);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('integer'))).toBe(true);
        });
    });

    describe('qzpayValidateInvoiceLines', () => {
        it('should validate correct line items', () => {
            const lines: QZPayCreateInvoiceLineInput[] = [
                { description: 'Item 1', quantity: 1, unitAmount: 1000 },
                { description: 'Item 2', quantity: 2, unitAmount: 500 }
            ];
            const result = qzpayValidateInvoiceLines(lines);
            expect(result.valid).toBe(true);
        });

        it('should reject empty lines array', () => {
            const result = qzpayValidateInvoiceLines([]);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('At least one line item is required');
        });

        it('should report errors with line numbers', () => {
            const lines: QZPayCreateInvoiceLineInput[] = [
                { description: 'Item 1', quantity: 1, unitAmount: 1000 },
                { description: '', quantity: 0, unitAmount: 500 }
            ];
            const result = qzpayValidateInvoiceLines(lines);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Line 2'))).toBe(true);
        });
    });

    describe('qzpayCalculateInvoiceProration', () => {
        it('should calculate proration for upgrade', () => {
            const result = qzpayCalculateInvoiceProration(1000, 2000, 15, 30);
            expect(result.unusedCredit).toBe(500); // 50% of current plan
            expect(result.newPlanProrated).toBe(1000); // 50% of new plan
            expect(result.netAmount).toBe(500); // Difference
        });

        it('should calculate proration for downgrade', () => {
            const result = qzpayCalculateInvoiceProration(2000, 1000, 15, 30);
            expect(result.unusedCredit).toBe(1000);
            expect(result.newPlanProrated).toBe(500);
            expect(result.netAmount).toBe(-500); // Credit to customer
        });
    });

    describe('qzpayCreateProrationLineItems', () => {
        it('should create proration line items for upgrade', () => {
            const proration = { unusedCredit: 500, newPlanProrated: 1000 };
            const lines = qzpayCreateProrationLineItems(
                'inv_1',
                'Basic Plan',
                'Pro Plan',
                proration,
                new Date('2024-01-15'),
                new Date('2024-01-31')
            );

            expect(lines).toHaveLength(2);
            expect(lines[0]?.amount).toBe(-500); // Credit
            expect(lines[1]?.amount).toBe(1000); // Charge
            expect(lines[0]?.description).toContain('Basic Plan');
            expect(lines[1]?.description).toContain('Pro Plan');
        });
    });

    describe('qzpayCreateInvoiceLines', () => {
        it('should create invoice lines from input', () => {
            const inputs: QZPayCreateInvoiceLineInput[] = [
                { description: 'Item 1', quantity: 2, unitAmount: 500 },
                { description: 'Item 2', quantity: 1, unitAmount: 1000 }
            ];
            const lines = qzpayCreateInvoiceLines('inv_1', inputs);

            expect(lines).toHaveLength(2);
            expect(lines[0]?.amount).toBe(1000);
            expect(lines[1]?.amount).toBe(1000);
            expect(lines[0]?.invoiceId).toBe('inv_1');
        });
    });
});

// ==================== Payment Method Service Tests ====================

describe('Payment Method Service', () => {
    describe('qzpayCreateExpirationConfig', () => {
        it('should create config with defaults', () => {
            const config = qzpayCreateExpirationConfig();
            expect(config.warningDays).toEqual([30, 7, 1]);
            expect(config.autoUpdateFromProvider).toBe(true);
        });

        it('should merge custom config', () => {
            const config = qzpayCreateExpirationConfig({ warningDays: [14, 3], autoUpdateFromProvider: false });
            expect(config.warningDays).toEqual([14, 3]);
            expect(config.autoUpdateFromProvider).toBe(false);
        });
    });

    describe('qzpayGetCardExpirationDate', () => {
        it('should return end of expiration month', () => {
            const card: QZPayCardDetails = {
                brand: 'visa',
                last4: '4242',
                expMonth: 12,
                expYear: 2025,
                funding: 'credit',
                country: 'US'
            };
            const expDate = qzpayGetCardExpirationDate(card);
            expect(expDate.getFullYear()).toBe(2025);
            expect(expDate.getMonth()).toBe(11); // December (0-indexed)
            expect(expDate.getDate()).toBe(31);
        });
    });

    describe('qzpayIsCardExpired', () => {
        it('should detect expired card', () => {
            const card: QZPayCardDetails = {
                brand: 'visa',
                last4: '4242',
                expMonth: 1,
                expYear: 2020,
                funding: 'credit',
                country: 'US'
            };
            expect(qzpayIsCardExpired(card)).toBe(true);
        });

        it('should detect non-expired card', () => {
            const card: QZPayCardDetails = {
                brand: 'visa',
                last4: '4242',
                expMonth: 12,
                expYear: new Date().getFullYear() + 5,
                funding: 'credit',
                country: 'US'
            };
            expect(qzpayIsCardExpired(card)).toBe(false);
        });
    });

    describe('qzpayGetDaysUntilCardExpiration', () => {
        it('should calculate days until expiration', () => {
            const now = new Date('2024-01-15T00:00:00Z');
            const card: QZPayCardDetails = {
                brand: 'visa',
                last4: '4242',
                expMonth: 1,
                expYear: 2024,
                funding: 'credit',
                country: 'US'
            };
            const days = qzpayGetDaysUntilCardExpiration(card, now);
            // From Jan 15 to Jan 31 (end of month) - 16-17 days depending on how ceiling works
            expect(days).toBeGreaterThanOrEqual(16);
            expect(days).toBeLessThanOrEqual(18);
        });
    });

    describe('qzpayCheckPaymentMethodExpiration', () => {
        it('should check card expiration status', () => {
            const pm = createPaymentMethod({
                card: {
                    brand: 'visa',
                    last4: '4242',
                    expMonth: 12,
                    expYear: new Date().getFullYear() + 1,
                    funding: 'credit',
                    country: 'US'
                }
            });
            const result = qzpayCheckPaymentMethodExpiration(pm);
            expect(result.isExpired).toBe(false);
            expect(result.expirationDate).not.toBeNull();
        });

        it('should return no expiration for non-card types', () => {
            const pm = createPaymentMethod({ type: 'bank_account', card: null });
            const result = qzpayCheckPaymentMethodExpiration(pm);
            expect(result.isExpired).toBe(false);
            expect(result.expirationDate).toBeNull();
            expect(result.daysUntilExpiration).toBeNull();
        });

        it('should detect expiring soon', () => {
            const now = new Date('2024-01-15');
            const pm = createPaymentMethod({
                card: {
                    brand: 'visa',
                    last4: '4242',
                    expMonth: 1,
                    expYear: 2024,
                    funding: 'credit',
                    country: 'US'
                }
            });
            const result = qzpayCheckPaymentMethodExpiration(pm, [30], now);
            expect(result.isExpiringSoon).toBe(true);
        });
    });

    describe('qzpayShouldSendExpirationWarning', () => {
        it('should indicate when to send warning', () => {
            expect(qzpayShouldSendExpirationWarning(30, [30, 7, 1])).toBe(true);
            expect(qzpayShouldSendExpirationWarning(7, [30, 7, 1])).toBe(true);
            expect(qzpayShouldSendExpirationWarning(15, [30, 7, 1])).toBe(false);
        });

        it('should not repeat already sent warnings', () => {
            expect(qzpayShouldSendExpirationWarning(30, [30, 7, 1], [30])).toBe(false);
        });
    });

    describe('Payment method status helpers', () => {
        it('qzpayPaymentMethodIsActive should detect active methods', () => {
            expect(qzpayPaymentMethodIsActive(createPaymentMethod({ status: 'active' }))).toBe(true);
            expect(qzpayPaymentMethodIsActive(createPaymentMethod({ status: 'expired' }))).toBe(false);
        });

        it('qzpayPaymentMethodIsDefault should detect default method', () => {
            expect(qzpayPaymentMethodIsDefault(createPaymentMethod({ isDefault: true }))).toBe(true);
            expect(qzpayPaymentMethodIsDefault(createPaymentMethod({ isDefault: false }))).toBe(false);
        });

        it('qzpayPaymentMethodIsExpired should detect expired status', () => {
            expect(qzpayPaymentMethodIsExpired(createPaymentMethod({ status: 'expired' }))).toBe(true);
            expect(qzpayPaymentMethodIsExpired(createPaymentMethod({ status: 'active' }))).toBe(false);
        });

        it('qzpayPaymentMethodIsValid should check if valid for charges', () => {
            expect(qzpayPaymentMethodIsValid(createPaymentMethod({ status: 'active' }))).toBe(true);
            expect(qzpayPaymentMethodIsValid(createPaymentMethod({ status: 'invalid' }))).toBe(false);
        });
    });

    describe('qzpayPaymentMethodCanBeDeleted', () => {
        it('should allow deleting non-default method', () => {
            const pm = createPaymentMethod({ isDefault: false });
            const result = qzpayPaymentMethodCanBeDeleted(pm, [], false);
            expect(result.canDelete).toBe(true);
        });

        it('should not allow deleting only payment method with active subscriptions', () => {
            const pm = createPaymentMethod({ isDefault: true });
            const result = qzpayPaymentMethodCanBeDeleted(pm, [], true);
            expect(result.canDelete).toBe(false);
            expect(result.error).toContain('active subscriptions');
        });

        it('should not allow deleting default with other methods present', () => {
            const pm = createPaymentMethod({ isDefault: true });
            const otherPm = createPaymentMethod({ id: 'pm_2', isDefault: false });
            const result = qzpayPaymentMethodCanBeDeleted(pm, [otherPm], false);
            expect(result.canDelete).toBe(false);
            expect(result.error).toContain('another payment method as default');
        });
    });

    describe('qzpayGetPaymentMethodTypeDisplay', () => {
        it('should return display names for types', () => {
            expect(qzpayGetPaymentMethodTypeDisplay('card')).toBe('Credit/Debit Card');
            expect(qzpayGetPaymentMethodTypeDisplay('bank_account')).toBe('Bank Account');
            expect(qzpayGetPaymentMethodTypeDisplay('sepa_debit')).toBe('SEPA Direct Debit');
        });
    });

    describe('qzpayGetPaymentMethodDisplayLabel', () => {
        it('should format card label', () => {
            const pm = createPaymentMethod({
                type: 'card',
                card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025, funding: 'credit', country: 'US' }
            });
            const label = qzpayGetPaymentMethodDisplayLabel(pm);
            expect(label).toBe('Visa •••• 4242');
        });

        it('should format bank account label', () => {
            const pm = createPaymentMethod({
                type: 'bank_account',
                card: null,
                bankAccount: { bankName: 'Chase', last4: '6789', accountType: 'checking', country: 'US' }
            });
            const label = qzpayGetPaymentMethodDisplayLabel(pm);
            expect(label).toBe('Chase •••• 6789');
        });
    });

    describe('qzpayGetCardExpirationDisplay', () => {
        it('should format expiration date', () => {
            const card: QZPayCardDetails = {
                brand: 'visa',
                last4: '4242',
                expMonth: 3,
                expYear: 2025,
                funding: 'credit',
                country: 'US'
            };
            expect(qzpayGetCardExpirationDisplay(card)).toBe('03/25');
        });
    });

    describe('qzpayGetCardBrandIcon', () => {
        it('should return brand icon names', () => {
            const card: QZPayCardDetails = { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025, funding: 'credit', country: 'US' };
            expect(qzpayGetCardBrandIcon(card)).toBe('visa');
            card.brand = 'mastercard';
            expect(qzpayGetCardBrandIcon(card)).toBe('mastercard');
            card.brand = 'unknown';
            expect(qzpayGetCardBrandIcon(card)).toBe('credit-card');
        });
    });

    describe('qzpayValidateBillingDetails', () => {
        it('should validate correct email', () => {
            const result = qzpayValidateBillingDetails({ email: 'test@example.com', name: 'Test' });
            expect(result.valid).toBe(true);
        });

        it('should reject invalid email', () => {
            const result = qzpayValidateBillingDetails({ email: 'invalid-email', name: 'Test' });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid email format');
        });

        it('should allow null/undefined fields', () => {
            const result = qzpayValidateBillingDetails({ email: null, name: null });
            expect(result.valid).toBe(true);
        });
    });

    describe('qzpaySortPaymentMethods', () => {
        it('should sort with default first', () => {
            const pms = [
                createPaymentMethod({ id: 'pm_1', isDefault: false, createdAt: new Date('2024-01-01') }),
                createPaymentMethod({ id: 'pm_2', isDefault: true, createdAt: new Date('2024-01-02') }),
                createPaymentMethod({ id: 'pm_3', isDefault: false, createdAt: new Date('2024-01-03') })
            ];
            const sorted = qzpaySortPaymentMethods(pms);
            expect(sorted[0]?.id).toBe('pm_2'); // Default first
            expect(sorted[1]?.id).toBe('pm_3'); // Then newest
            expect(sorted[2]?.id).toBe('pm_1'); // Then oldest
        });
    });

    describe('qzpayFilterActivePaymentMethods', () => {
        it('should filter active methods only', () => {
            const pms = [
                createPaymentMethod({ id: 'pm_1', status: 'active' }),
                createPaymentMethod({ id: 'pm_2', status: 'expired' }),
                createPaymentMethod({ id: 'pm_3', status: 'active' })
            ];
            const active = qzpayFilterActivePaymentMethods(pms);
            expect(active).toHaveLength(2);
            expect(active.map((p) => p.id)).toEqual(['pm_1', 'pm_3']);
        });
    });

    describe('qzpayGetExpiringPaymentMethods', () => {
        it('should find methods expiring within days', () => {
            const now = new Date('2024-01-15');
            const pms = [
                createPaymentMethod({
                    id: 'pm_1',
                    card: { brand: 'visa', last4: '4242', expMonth: 1, expYear: 2024, funding: 'credit', country: 'US' }
                }),
                createPaymentMethod({
                    id: 'pm_2',
                    card: { brand: 'visa', last4: '4343', expMonth: 12, expYear: 2025, funding: 'credit', country: 'US' }
                })
            ];
            const expiring = qzpayGetExpiringPaymentMethods(pms, 30, now);
            expect(expiring).toHaveLength(1);
            expect(expiring[0]?.id).toBe('pm_1');
        });
    });
});
