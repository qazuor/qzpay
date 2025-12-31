/**
 * Drizzle ORM relations for QZPay billing tables
 *
 * Defines relationships between all billing entities.
 */
import { relations } from 'drizzle-orm';
import { billingCustomers } from './customers.schema.js';
import { billingInvoiceLines, billingInvoicePayments, billingInvoices } from './invoices.schema.js';
import { billingPaymentMethods } from './payment-methods.schema.js';
import { billingPayments, billingRefunds } from './payments.schema.js';
import { billingPromoCodeUsage, billingPromoCodes } from './promo-codes.schema.js';
import { billingSubscriptions } from './subscriptions.schema.js';
import { billingUsageRecords } from './usage-records.schema.js';
import { billingVendorPayouts, billingVendors } from './vendors.schema.js';

/**
 * Customer relations
 */
export const billingCustomersRelations = relations(billingCustomers, ({ many }) => ({
    subscriptions: many(billingSubscriptions),
    payments: many(billingPayments),
    invoices: many(billingInvoices),
    paymentMethods: many(billingPaymentMethods),
    promoCodeUsage: many(billingPromoCodeUsage)
}));

/**
 * Subscription relations
 */
export const billingSubscriptionsRelations = relations(billingSubscriptions, ({ one, many }) => ({
    customer: one(billingCustomers, {
        fields: [billingSubscriptions.customerId],
        references: [billingCustomers.id]
    }),
    promoCode: one(billingPromoCodes, {
        fields: [billingSubscriptions.promoCodeId],
        references: [billingPromoCodes.id]
    }),
    payments: many(billingPayments),
    invoices: many(billingInvoices),
    usageRecords: many(billingUsageRecords)
}));

/**
 * Payment relations
 */
export const billingPaymentsRelations = relations(billingPayments, ({ one, many }) => ({
    customer: one(billingCustomers, {
        fields: [billingPayments.customerId],
        references: [billingCustomers.id]
    }),
    subscription: one(billingSubscriptions, {
        fields: [billingPayments.subscriptionId],
        references: [billingSubscriptions.id]
    }),
    refunds: many(billingRefunds)
}));

/**
 * Refund relations
 */
export const billingRefundsRelations = relations(billingRefunds, ({ one }) => ({
    payment: one(billingPayments, {
        fields: [billingRefunds.paymentId],
        references: [billingPayments.id]
    })
}));

/**
 * Invoice relations
 */
export const billingInvoicesRelations = relations(billingInvoices, ({ one, many }) => ({
    customer: one(billingCustomers, {
        fields: [billingInvoices.customerId],
        references: [billingCustomers.id]
    }),
    subscription: one(billingSubscriptions, {
        fields: [billingInvoices.subscriptionId],
        references: [billingSubscriptions.id]
    }),
    lines: many(billingInvoiceLines),
    payments: many(billingInvoicePayments)
}));

/**
 * Invoice line relations
 */
export const billingInvoiceLinesRelations = relations(billingInvoiceLines, ({ one }) => ({
    invoice: one(billingInvoices, {
        fields: [billingInvoiceLines.invoiceId],
        references: [billingInvoices.id]
    })
}));

/**
 * Invoice payment relations
 */
export const billingInvoicePaymentsRelations = relations(billingInvoicePayments, ({ one }) => ({
    invoice: one(billingInvoices, {
        fields: [billingInvoicePayments.invoiceId],
        references: [billingInvoices.id]
    })
}));

/**
 * Payment method relations
 */
export const billingPaymentMethodsRelations = relations(billingPaymentMethods, ({ one }) => ({
    customer: one(billingCustomers, {
        fields: [billingPaymentMethods.customerId],
        references: [billingCustomers.id]
    })
}));

/**
 * Promo code relations
 */
export const billingPromoCodesRelations = relations(billingPromoCodes, ({ many }) => ({
    subscriptions: many(billingSubscriptions),
    usage: many(billingPromoCodeUsage)
}));

/**
 * Promo code usage relations
 */
export const billingPromoCodeUsageRelations = relations(billingPromoCodeUsage, ({ one }) => ({
    promoCode: one(billingPromoCodes, {
        fields: [billingPromoCodeUsage.promoCodeId],
        references: [billingPromoCodes.id]
    })
}));

/**
 * Vendor relations
 */
export const billingVendorsRelations = relations(billingVendors, ({ many }) => ({
    payouts: many(billingVendorPayouts)
}));

/**
 * Vendor payout relations
 */
export const billingVendorPayoutsRelations = relations(billingVendorPayouts, ({ one }) => ({
    vendor: one(billingVendors, {
        fields: [billingVendorPayouts.vendorId],
        references: [billingVendors.id]
    })
}));

/**
 * Usage record relations
 */
export const billingUsageRecordsRelations = relations(billingUsageRecords, ({ one }) => ({
    subscription: one(billingSubscriptions, {
        fields: [billingUsageRecords.subscriptionId],
        references: [billingSubscriptions.id]
    })
}));
