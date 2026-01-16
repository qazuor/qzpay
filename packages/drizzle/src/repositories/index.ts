/**
 * QZPay Drizzle Repositories
 *
 * Database repositories for all billing entities.
 *
 * Note: All repositories are standalone classes that use Drizzle ORM directly.
 * Each repository handles its own entity with common patterns for CRUD operations.
 */

// Add-on repository
export {
    type QZPayAddonSearchOptions,
    QZPayAddonsRepository,
    type QZPaySubscriptionAddonSearchOptions
} from './addons.repository.js';

export {
    type QZPayActorTypeValue,
    type QZPayAuditLogSearchOptions,
    QZPayAuditLogsRepository,
    type QZPayEntityTypeValue
} from './audit-logs.repository.js';
// Base types and utilities
export {
    assertExists,
    firstOrNull,
    firstOrThrow,
    QZPAY_DEFAULT_LIMIT,
    QZPAY_MAX_LIMIT,
    QZPAY_MAX_OFFSET,
    QZPayEntityNotFoundError,
    type QZPayFindManyOptions,
    QZPayOptimisticLockError,
    type QZPayOrderBy,
    type QZPayPaginatedResult,
    type QZPayPaginationValidationOptions,
    qzpayValidatePagination,
    type QZPayValidatedPagination
} from './base.repository.js';
// Entity repositories
export { type QZPayCustomerSearchOptions, QZPayCustomersRepository } from './customers.repository.js';
// Entitlement repository
export {
    type QZPayCustomerEntitlementSearchOptions,
    type QZPayEntitlementSearchOptions,
    QZPayEntitlementsRepository
} from './entitlements.repository.js';

export {
    type QZPayInvoiceSearchOptions,
    type QZPayInvoiceStatusValue,
    QZPayInvoicesRepository
} from './invoices.repository.js';
// Limit repository
export {
    type QZPayCustomerLimitSearchOptions,
    type QZPayLimitSearchOptions,
    QZPayLimitsRepository
} from './limits.repository.js';
export { type QZPayPaymentMethodSearchOptions, QZPayPaymentMethodsRepository } from './payment-methods.repository.js';
export {
    type QZPayPaymentSearchOptions,
    type QZPayPaymentStatusValue,
    QZPayPaymentsRepository
} from './payments.repository.js';
// Plan and Price repositories
export { type QZPayPlanSearchOptions, QZPayPlansRepository } from './plans.repository.js';
export { type QZPayPriceSearchOptions, QZPayPricesRepository } from './prices.repository.js';
export { type QZPayDiscountTypeValue, QZPayPromoCodesRepository } from './promo-codes.repository.js';
export {
    type QZPaySubscriptionSearchOptions,
    type QZPaySubscriptionStatusValue,
    QZPaySubscriptionsRepository
} from './subscriptions.repository.js';
export {
    type QZPayUsageActionValue,
    type QZPayUsageAggregationOptions,
    QZPayUsageRecordsRepository
} from './usage-records.repository.js';
export {
    type QZPayOnboardingStatusValue,
    type QZPayPayoutStatusValue,
    QZPayVendorsRepository
} from './vendors.repository.js';
export {
    type QZPayProviderValue,
    QZPayWebhookEventsRepository,
    type QZPayWebhookStatusValue
} from './webhook-events.repository.js';
