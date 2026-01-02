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
    QZPayMercadoPagoWebhookAdapter
} from './adapters/index.js';

// Types
export type { QZPayMercadoPagoConfig, QZPayMercadoPagoMarketplaceConfig } from './types.js';

// Constants and helpers
export {
    MERCADOPAGO_SUBSCRIPTION_STATUS,
    MERCADOPAGO_PAYMENT_STATUS,
    MERCADOPAGO_WEBHOOK_EVENTS,
    MERCADOPAGO_BILLING_INTERVAL,
    toMercadoPagoInterval,
    fromMercadoPagoInterval
} from './types.js';

// Re-export MercadoPago types for convenience
export type { MercadoPagoConfig } from 'mercadopago';
