/**
 * QZPay Drizzle Repositories
 *
 * Database repositories for all billing entities.
 *
 * Note: All repositories are standalone classes that use Drizzle ORM directly.
 * Each repository handles its own entity with common patterns for CRUD operations.
 */

// Base types and utilities
export {
    QZPayEntityNotFoundError,
    QZPayOptimisticLockError,
    assertExists,
    firstOrNull,
    firstOrThrow,
    type QZPayFindManyOptions,
    type QZPayOrderBy,
    type QZPayPaginatedResult
} from './base.repository.js';

// Entity repositories
export { QZPayCustomersRepository, type QZPayCustomerSearchOptions } from './customers.repository.js';

export {
    QZPaySubscriptionsRepository,
    type QZPaySubscriptionSearchOptions,
    type QZPaySubscriptionStatusValue
} from './subscriptions.repository.js';

export {
    QZPayPaymentsRepository,
    type QZPayPaymentSearchOptions,
    type QZPayPaymentStatusValue
} from './payments.repository.js';

export {
    QZPayInvoicesRepository,
    type QZPayInvoiceSearchOptions,
    type QZPayInvoiceStatusValue
} from './invoices.repository.js';

export { QZPayPaymentMethodsRepository, type QZPayPaymentMethodSearchOptions } from './payment-methods.repository.js';

export { QZPayPromoCodesRepository, type QZPayDiscountTypeValue } from './promo-codes.repository.js';

export {
    QZPayVendorsRepository,
    type QZPayOnboardingStatusValue,
    type QZPayPayoutStatusValue
} from './vendors.repository.js';

export {
    QZPayUsageRecordsRepository,
    type QZPayUsageActionValue,
    type QZPayUsageAggregationOptions
} from './usage-records.repository.js';

export {
    QZPayWebhookEventsRepository,
    type QZPayProviderValue,
    type QZPayWebhookStatusValue
} from './webhook-events.repository.js';

export {
    QZPayAuditLogsRepository,
    type QZPayActorTypeValue,
    type QZPayAuditLogSearchOptions,
    type QZPayEntityTypeValue
} from './audit-logs.repository.js';
