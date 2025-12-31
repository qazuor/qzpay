/**
 * QZPay Drizzle Schema
 *
 * Database schema definitions for QZPay billing using Drizzle ORM.
 * All tables use the 'billing_' prefix for namespace isolation.
 */

// Customer schema
export {
    billingCustomerInsertSchema,
    billingCustomers,
    billingCustomerSelectSchema,
    type QZPayBillingCustomer,
    type QZPayBillingCustomerInsert,
    type QZPayBillingCustomerInsertInput
} from './customers.schema.js';

// Subscription schema
export {
    billingSubscriptionInsertSchema,
    billingSubscriptions,
    billingSubscriptionSelectSchema,
    type QZPayBillingSubscription,
    type QZPayBillingSubscriptionInsert,
    type QZPayBillingSubscriptionInsertInput
} from './subscriptions.schema.js';

// Payment schema
export {
    billingPaymentInsertSchema,
    billingPayments,
    billingPaymentSelectSchema,
    billingRefunds,
    type QZPayBillingPayment,
    type QZPayBillingPaymentInsert,
    type QZPayBillingPaymentInsertInput,
    type QZPayBillingRefund,
    type QZPayBillingRefundInsert
} from './payments.schema.js';

// Invoice schema
export {
    billingInvoiceInsertSchema,
    billingInvoiceLines,
    billingInvoicePayments,
    billingInvoices,
    billingInvoiceSelectSchema,
    type QZPayBillingInvoice,
    type QZPayBillingInvoiceInsert,
    type QZPayBillingInvoiceInsertInput,
    type QZPayBillingInvoiceLine,
    type QZPayBillingInvoiceLineInsert,
    type QZPayBillingInvoicePayment,
    type QZPayBillingInvoicePaymentInsert
} from './invoices.schema.js';

// Payment method schema
export {
    billingPaymentMethodInsertSchema,
    billingPaymentMethods,
    billingPaymentMethodSelectSchema,
    type QZPayBillingPaymentMethod,
    type QZPayBillingPaymentMethodInsert,
    type QZPayBillingPaymentMethodInsertInput
} from './payment-methods.schema.js';

// Promo code schema
export {
    billingPromoCodeInsertSchema,
    billingPromoCodes,
    billingPromoCodeSelectSchema,
    billingPromoCodeUsage,
    type QZPayBillingPromoCode,
    type QZPayBillingPromoCodeInsert,
    type QZPayBillingPromoCodeInsertInput,
    type QZPayBillingPromoCodeUsage,
    type QZPayBillingPromoCodeUsageInsert
} from './promo-codes.schema.js';

// Vendor schema
export {
    billingVendorInsertSchema,
    billingVendorPayouts,
    billingVendors,
    billingVendorSelectSchema,
    type QZPayBillingVendor,
    type QZPayBillingVendorInsert,
    type QZPayBillingVendorInsertInput,
    type QZPayBillingVendorPayout,
    type QZPayBillingVendorPayoutInsert
} from './vendors.schema.js';

// Usage records schema
export {
    billingUsageRecordInsertSchema,
    billingUsageRecords,
    billingUsageRecordSelectSchema,
    type QZPayBillingUsageRecord,
    type QZPayBillingUsageRecordInsert
} from './usage-records.schema.js';

// Webhook events schema
export {
    billingWebhookDeadLetter,
    billingWebhookEventInsertSchema,
    billingWebhookEvents,
    billingWebhookEventSelectSchema,
    type QZPayBillingWebhookDeadLetter,
    type QZPayBillingWebhookDeadLetterInsert,
    type QZPayBillingWebhookEvent,
    type QZPayBillingWebhookEventInsert
} from './webhook-events.schema.js';

// Audit logs schema
export {
    billingAuditLogInsertSchema,
    billingAuditLogs,
    billingAuditLogSelectSchema,
    type QZPayBillingAuditLog,
    type QZPayBillingAuditLogInsert
} from './audit-logs.schema.js';

// Idempotency keys schema
export {
    billingIdempotencyKeyInsertSchema,
    billingIdempotencyKeys,
    billingIdempotencyKeySelectSchema,
    type QZPayBillingIdempotencyKey,
    type QZPayBillingIdempotencyKeyInsert
} from './idempotency.schema.js';

// Relations
export {
    billingCustomersRelations,
    billingInvoiceLinesRelations,
    billingInvoicePaymentsRelations,
    billingInvoicesRelations,
    billingPaymentMethodsRelations,
    billingPaymentsRelations,
    billingPromoCodeUsageRelations,
    billingPromoCodesRelations,
    billingRefundsRelations,
    billingSubscriptionsRelations,
    billingUsageRecordsRelations,
    billingVendorPayoutsRelations,
    billingVendorsRelations
} from './relations.js';

/**
 * Schema version for tracking migrations
 */
export const QZPAY_DRIZZLE_SCHEMA_VERSION = '0.0.1';
