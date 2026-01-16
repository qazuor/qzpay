/**
 * @qazuor/qzpay-nestjs
 *
 * NestJS integration for QZPay billing library
 */

// Module
export { QZPayModule } from './qzpay.module.js';

// Services
export { QZPayService } from './qzpay.service.js';
export { QZPayWebhookService } from './qzpay-webhook.service.js';

// Decorators
export { InjectQZPay, RequireEntitlement, RequireSubscription, RateLimit } from './decorators/index.js';
export type { RequireSubscriptionOptions } from './decorators/index.js';

// Guards
export { EntitlementGuard, SubscriptionGuard, RateLimitGuard } from './guards/index.js';

// Constants
export {
    QZPAY_BILLING_TOKEN,
    QZPAY_OPTIONS_TOKEN,
    REQUIRED_ENTITLEMENT_KEY,
    REQUIRED_SUBSCRIPTION_KEY,
    RATE_LIMIT_KEY
} from './constants.js';

// Types
export type {
    QZPayModuleOptions,
    QZPayModuleAsyncOptions,
    QZPayOptionsFactory,
    QZPayOptionsFactoryInterface,
    RateLimitConfig,
    WebhookEventHandler,
    WebhookHandlersMap
} from './types.js';

// Controllers
export {
    QZPayCustomersController,
    QZPaySubscriptionsController,
    QZPayPaymentsController,
    QZPayInvoicesController,
    QZPayPlansController,
    QZPayWebhooksController
} from './controllers/index.js';

// Controller DTOs (deprecated - use DTOs from ./dto instead)
export type {
    CreateCustomerDto as LegacyCreateCustomerDto,
    UpdateCustomerDto as LegacyUpdateCustomerDto,
    CreateSubscriptionDto as LegacyCreateSubscriptionDto,
    UpdateSubscriptionDto as LegacyUpdateSubscriptionDto,
    CancelSubscriptionDto as LegacyCancelSubscriptionDto,
    ProcessPaymentDto as LegacyProcessPaymentDto,
    RefundPaymentDto as LegacyRefundPaymentDto,
    CreateInvoiceDto as LegacyCreateInvoiceDto,
    CreateInvoiceLineDto as LegacyCreateInvoiceLineDto,
    MarkPaidDto as LegacyMarkPaidDto
} from './controllers/index.js';

// DTOs with validation
export {
    CreateCustomerDto,
    UpdateCustomerDto,
    CreateSubscriptionDto,
    UpdateSubscriptionDto,
    CancelSubscriptionDto,
    ProcessPaymentDto,
    RefundPaymentDto,
    CreateInvoiceDto,
    CreateInvoiceLineDto,
    MarkPaidDto
} from './dto/index.js';

// Filters
export { QZPayExceptionFilter } from './filters/index.js';

// Interceptors
export { QZPayLoggingInterceptor, createQZPayLoggingInterceptor } from './interceptors/index.js';
export type { QZPayLoggingOptions } from './interceptors/index.js';
