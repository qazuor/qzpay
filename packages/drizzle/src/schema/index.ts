/**
 * QZPay Drizzle Schema
 *
 * Database schema definitions for QZPay billing using Drizzle ORM.
 * All tables use the 'billing_' prefix for namespace isolation.
 */

// Add-on schema
export {
    billingAddonInsertSchema,
    billingAddonSelectSchema,
    billingAddons,
    billingSubscriptionAddonInsertSchema,
    billingSubscriptionAddonSelectSchema,
    billingSubscriptionAddons,
    type QZPayBillingAddon,
    type QZPayBillingAddonInsert,
    type QZPayBillingAddonInsertInput,
    type QZPayBillingSubscriptionAddon,
    type QZPayBillingSubscriptionAddonInsert,
    type QZPayBillingSubscriptionAddonInsertInput
} from './addons.schema.js';
// Audit logs schema
export {
    billingAuditLogInsertSchema,
    billingAuditLogSelectSchema,
    billingAuditLogs,
    type QZPayBillingAuditLog,
    type QZPayBillingAuditLogInsert
} from './audit-logs.schema.js';
// Customer schema
export {
    billingCustomerInsertSchema,
    billingCustomerSelectSchema,
    billingCustomers,
    type QZPayBillingCustomer,
    type QZPayBillingCustomerInsert,
    type QZPayBillingCustomerInsertInput
} from './customers.schema.js';
// Entitlement schema
export {
    billingCustomerEntitlementInsertSchema,
    billingCustomerEntitlementSelectSchema,
    billingCustomerEntitlements,
    billingEntitlementInsertSchema,
    billingEntitlementSelectSchema,
    billingEntitlements,
    type QZPayBillingCustomerEntitlement,
    type QZPayBillingCustomerEntitlementInsert,
    type QZPayBillingCustomerEntitlementInsertInput,
    type QZPayBillingEntitlement,
    type QZPayBillingEntitlementInsert,
    type QZPayBillingEntitlementInsertInput
} from './entitlements.schema.js';
// Idempotency keys schema
export {
    billingIdempotencyKeyInsertSchema,
    billingIdempotencyKeySelectSchema,
    billingIdempotencyKeys,
    type QZPayBillingIdempotencyKey,
    type QZPayBillingIdempotencyKeyInsert
} from './idempotency.schema.js';
// Invoice schema
export {
    billingInvoiceInsertSchema,
    billingInvoiceLines,
    billingInvoicePayments,
    billingInvoiceSelectSchema,
    billingInvoices,
    type QZPayBillingInvoice,
    type QZPayBillingInvoiceInsert,
    type QZPayBillingInvoiceInsertInput,
    type QZPayBillingInvoiceLine,
    type QZPayBillingInvoiceLineInsert,
    type QZPayBillingInvoicePayment,
    type QZPayBillingInvoicePaymentInsert
} from './invoices.schema.js';
// Limit schema
export {
    billingCustomerLimitInsertSchema,
    billingCustomerLimitSelectSchema,
    billingCustomerLimits,
    billingLimitInsertSchema,
    billingLimitSelectSchema,
    billingLimits,
    type QZPayBillingCustomerLimit,
    type QZPayBillingCustomerLimitInsert,
    type QZPayBillingCustomerLimitInsertInput,
    type QZPayBillingLimit,
    type QZPayBillingLimitInsert,
    type QZPayBillingLimitInsertInput
} from './limits.schema.js';
// Payment method schema
export {
    billingPaymentMethodInsertSchema,
    billingPaymentMethodSelectSchema,
    billingPaymentMethods,
    type QZPayBillingPaymentMethod,
    type QZPayBillingPaymentMethodInsert,
    type QZPayBillingPaymentMethodInsertInput
} from './payment-methods.schema.js';
// Payment schema
export {
    billingPaymentInsertSchema,
    billingPaymentSelectSchema,
    billingPayments,
    billingRefunds,
    type QZPayBillingPayment,
    type QZPayBillingPaymentInsert,
    type QZPayBillingPaymentInsertInput,
    type QZPayBillingRefund,
    type QZPayBillingRefundInsert
} from './payments.schema.js';
// Plan schema
export {
    billingPlanInsertSchema,
    billingPlanSelectSchema,
    billingPlans,
    type QZPayBillingPlan,
    type QZPayBillingPlanInsert,
    type QZPayBillingPlanInsertInput
} from './plans.schema.js';
// Price schema
export {
    billingPriceInsertSchema,
    billingPriceSelectSchema,
    billingPrices,
    type QZPayBillingPrice,
    type QZPayBillingPriceInsert,
    type QZPayBillingPriceInsertInput
} from './prices.schema.js';
// Promo code schema
export {
    billingPromoCodeInsertSchema,
    billingPromoCodeSelectSchema,
    billingPromoCodes,
    billingPromoCodeUsage,
    type QZPayBillingPromoCode,
    type QZPayBillingPromoCodeInsert,
    type QZPayBillingPromoCodeInsertInput,
    type QZPayBillingPromoCodeUsage,
    type QZPayBillingPromoCodeUsageInsert
} from './promo-codes.schema.js';
// Relations
export {
    billingAddonsRelations,
    billingCustomerEntitlementsRelations,
    billingCustomerLimitsRelations,
    billingCustomersRelations,
    billingEntitlementsRelations,
    billingInvoiceLinesRelations,
    billingInvoicePaymentsRelations,
    billingInvoicesRelations,
    billingLimitsRelations,
    billingPaymentMethodsRelations,
    billingPaymentsRelations,
    billingPlansRelations,
    billingPricesRelations,
    billingPromoCodesRelations,
    billingPromoCodeUsageRelations,
    billingRefundsRelations,
    billingSubscriptionAddonsRelations,
    billingSubscriptionsRelations,
    billingUsageRecordsRelations,
    billingVendorPayoutsRelations,
    billingVendorsRelations
} from './relations.js';
// Subscription schema
export {
    billingSubscriptionInsertSchema,
    billingSubscriptionSelectSchema,
    billingSubscriptions,
    type QZPayBillingSubscription,
    type QZPayBillingSubscriptionInsert,
    type QZPayBillingSubscriptionInsertInput
} from './subscriptions.schema.js';
// Usage records schema
export {
    billingUsageRecordInsertSchema,
    billingUsageRecordSelectSchema,
    billingUsageRecords,
    type QZPayBillingUsageRecord,
    type QZPayBillingUsageRecordInsert
} from './usage-records.schema.js';
// Vendor schema
export {
    billingVendorInsertSchema,
    billingVendorPayouts,
    billingVendorSelectSchema,
    billingVendors,
    type QZPayBillingVendor,
    type QZPayBillingVendorInsert,
    type QZPayBillingVendorInsertInput,
    type QZPayBillingVendorPayout,
    type QZPayBillingVendorPayoutInsert
} from './vendors.schema.js';
// Webhook events schema
export {
    billingWebhookDeadLetter,
    billingWebhookEventInsertSchema,
    billingWebhookEventSelectSchema,
    billingWebhookEvents,
    type QZPayBillingWebhookDeadLetter,
    type QZPayBillingWebhookDeadLetterInsert,
    type QZPayBillingWebhookEvent,
    type QZPayBillingWebhookEventInsert
} from './webhook-events.schema.js';

/**
 * Schema version for tracking migrations
 */
export const QZPAY_DRIZZLE_SCHEMA_VERSION = '0.0.1';
