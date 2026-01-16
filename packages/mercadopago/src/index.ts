/**
 * @qazuor/qzpay-mercadopago
 *
 * MercadoPago payment adapter for QZPay billing library
 */

// Main adapter
export { QZPayMercadoPagoAdapter, createQZPayMercadoPagoAdapter } from './mercadopago.adapter.js';

// Sub-adapters for direct access
export {
    QZPayMercadoPagoCustomerAdapter,
    QZPayMercadoPagoSubscriptionAdapter,
    QZPayMercadoPagoPaymentAdapter,
    QZPayMercadoPagoCheckoutAdapter,
    QZPayMercadoPagoPriceAdapter,
    QZPayMercadoPagoWebhookAdapter,
    // CardToken adapter
    QZPayMercadoPagoCardTokenAdapterImpl,
    type QZPayMercadoPagoCardTokenAdapter,
    // Webhook config
    type QZPayMercadoPagoWebhookConfig,
    // IPN Handler
    QZPayMercadoPagoIPNHandler,
    // Webhook utilities
    extractMPPaymentEventData,
    extractMPSubscriptionEventData,
    extractMPChargebackEventData,
    classifyMPEvent,
    mpRequiresImmediateAction,
    // 3D Secure utilities
    isPaymentEventRequires3DS,
    extractMP3DSFromPaymentEvent,
    getMP3DSChallengeUrl,
    extractMP3DSPaymentInfo
} from './adapters/index.js';

// Types
export type {
    QZPayMercadoPagoConfig,
    QZPayMercadoPagoMarketplaceConfig,
    // Split Payment types
    QZPayMPSplitPaymentDisbursement,
    QZPayMPSplitPaymentConfig,
    QZPayMPSplitPaymentResult,
    // IPN types
    QZPayMPIPNType,
    QZPayMPIPNAction,
    QZPayMPIPNNotification,
    QZPayMPIPNPaymentDetails,
    QZPayMPIPNResult,
    QZPayMPIPNHandler,
    QZPayMPIPNHandlerMap,
    // Payment Method types
    QZPayMPPaymentMethod,
    QZPayMPPaymentMethodDetails,
    QZPayMPCardToken
} from './types.js';

// Constants and helpers
export {
    MERCADOPAGO_SUBSCRIPTION_STATUS,
    MERCADOPAGO_PAYMENT_STATUS,
    MERCADOPAGO_WEBHOOK_EVENTS,
    MERCADOPAGO_WEBHOOK_EVENTS_EXTENDED,
    MERCADOPAGO_BILLING_INTERVAL,
    MERCADOPAGO_STATUS_DETAIL,
    toMercadoPagoInterval,
    fromMercadoPagoInterval,
    // Webhook utilities
    isMPChargebackEvent,
    mpEventRequiresAction,
    mapMPPaymentStatus,
    getMPStatusDetailMessage
} from './types.js';

// Error handling utilities
export {
    QZPayMercadoPagoError,
    QZPayErrorCode,
    mapMercadoPagoError,
    isCustomerExistsError,
    wrapAdapterMethod
} from './utils/error-mapper.js';

// Retry utilities
export {
    type RetryConfig,
    DEFAULT_RETRY_CONFIG,
    isRetriableError,
    withRetry,
    createRetryWrapper
} from './utils/retry.utils.js';

// Sanitization utilities
export { sanitizeEmail, sanitizeName, sanitizePhone, sanitizeOptional } from './utils/sanitize.utils.js';

// Saved card service
export { createSavedCardService, MercadoPagoSavedCardService } from './services/saved-card.service.js';

// Re-export MercadoPago types for convenience
export type { MercadoPagoConfig } from 'mercadopago';
