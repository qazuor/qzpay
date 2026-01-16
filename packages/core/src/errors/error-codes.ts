/**
 * Standard error codes for QZPay operations.
 *
 * These codes provide consistent, machine-readable error identification
 * across the entire library.
 *
 * @example
 * ```ts
 * throw new QZPayError('Operation failed', {
 *   code: QZPayErrorCode.PROVIDER_SYNC_FAILED
 * });
 * ```
 */
export const QZPayErrorCode = {
    // Validation errors (1000-1999)
    VALIDATION_FAILED: 'validation_failed',
    INVALID_EMAIL: 'invalid_email',
    INVALID_AMOUNT: 'invalid_amount',
    INVALID_CURRENCY: 'invalid_currency',
    INVALID_QUANTITY: 'invalid_quantity',
    MISSING_REQUIRED_FIELD: 'missing_required_field',

    // Not found errors (2000-2999)
    ENTITY_NOT_FOUND: 'entity_not_found',
    CUSTOMER_NOT_FOUND: 'customer_not_found',
    SUBSCRIPTION_NOT_FOUND: 'subscription_not_found',
    PLAN_NOT_FOUND: 'plan_not_found',
    PRICE_NOT_FOUND: 'price_not_found',
    PAYMENT_NOT_FOUND: 'payment_not_found',
    INVOICE_NOT_FOUND: 'invoice_not_found',
    ADDON_NOT_FOUND: 'addon_not_found',
    PROMO_CODE_NOT_FOUND: 'promo_code_not_found',

    // Conflict errors (3000-3999)
    RESOURCE_CONFLICT: 'resource_conflict',
    DUPLICATE_RESOURCE: 'duplicate_resource',
    INCOMPATIBLE_RESOURCE: 'incompatible_resource',
    RESOURCE_ALREADY_EXISTS: 'resource_already_exists',

    // Payment provider errors (4000-4999)
    PROVIDER_SYNC_FAILED: 'provider_sync_failed',
    PROVIDER_CREATE_CUSTOMER_FAILED: 'provider_create_customer_failed',
    PROVIDER_UPDATE_CUSTOMER_FAILED: 'provider_update_customer_failed',
    PROVIDER_PAYMENT_FAILED: 'provider_payment_failed',
    PROVIDER_REFUND_FAILED: 'provider_refund_failed',
    PROVIDER_NOT_LINKED: 'provider_not_linked',
    PROVIDER_CONNECTION_FAILED: 'provider_connection_failed',

    // Payment errors (5000-5999)
    PAYMENT_FAILED: 'payment_failed',
    PAYMENT_DECLINED: 'payment_declined',
    PAYMENT_INSUFFICIENT_FUNDS: 'payment_insufficient_funds',
    PAYMENT_CARD_INVALID: 'payment_card_invalid',
    PAYMENT_PROCESSING_ERROR: 'payment_processing_error',

    // Subscription errors (6000-6999)
    SUBSCRIPTION_EXPIRED: 'subscription_expired',
    SUBSCRIPTION_CANCELED: 'subscription_canceled',
    SUBSCRIPTION_PAUSED: 'subscription_paused',
    SUBSCRIPTION_PAST_DUE: 'subscription_past_due',
    TRIAL_CONVERSION_FAILED: 'trial_conversion_failed',
    RENEWAL_FAILED: 'renewal_failed',

    // Invoice errors (7000-7999)
    INVOICE_CREATION_FAILED: 'invoice_creation_failed',
    INVOICE_VOID_FAILED: 'invoice_void_failed',
    INVOICE_ALREADY_PAID: 'invoice_already_paid',

    // Generic errors (9000-9999)
    INTERNAL_ERROR: 'internal_error',
    OPERATION_FAILED: 'operation_failed',
    UNKNOWN_ERROR: 'unknown_error'
} as const;

/**
 * Type representing all possible error codes.
 */
export type QZPayErrorCodeType = (typeof QZPayErrorCode)[keyof typeof QZPayErrorCode];

/**
 * Maps error codes to human-readable descriptions.
 */
export const QZPayErrorCodeDescription: Record<QZPayErrorCodeType, string> = {
    // Validation errors
    [QZPayErrorCode.VALIDATION_FAILED]: 'Input validation failed',
    [QZPayErrorCode.INVALID_EMAIL]: 'Invalid email format',
    [QZPayErrorCode.INVALID_AMOUNT]: 'Invalid amount value',
    [QZPayErrorCode.INVALID_CURRENCY]: 'Invalid currency code',
    [QZPayErrorCode.INVALID_QUANTITY]: 'Invalid quantity value',
    [QZPayErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing',

    // Not found errors
    [QZPayErrorCode.ENTITY_NOT_FOUND]: 'Requested entity not found',
    [QZPayErrorCode.CUSTOMER_NOT_FOUND]: 'Customer not found',
    [QZPayErrorCode.SUBSCRIPTION_NOT_FOUND]: 'Subscription not found',
    [QZPayErrorCode.PLAN_NOT_FOUND]: 'Plan not found',
    [QZPayErrorCode.PRICE_NOT_FOUND]: 'Price not found',
    [QZPayErrorCode.PAYMENT_NOT_FOUND]: 'Payment not found',
    [QZPayErrorCode.INVOICE_NOT_FOUND]: 'Invoice not found',
    [QZPayErrorCode.ADDON_NOT_FOUND]: 'Add-on not found',
    [QZPayErrorCode.PROMO_CODE_NOT_FOUND]: 'Promo code not found',

    // Conflict errors
    [QZPayErrorCode.RESOURCE_CONFLICT]: 'Resource conflict detected',
    [QZPayErrorCode.DUPLICATE_RESOURCE]: 'Duplicate resource found',
    [QZPayErrorCode.INCOMPATIBLE_RESOURCE]: 'Incompatible resource',
    [QZPayErrorCode.RESOURCE_ALREADY_EXISTS]: 'Resource already exists',

    // Payment provider errors
    [QZPayErrorCode.PROVIDER_SYNC_FAILED]: 'Failed to sync with payment provider',
    [QZPayErrorCode.PROVIDER_CREATE_CUSTOMER_FAILED]: 'Failed to create customer in payment provider',
    [QZPayErrorCode.PROVIDER_UPDATE_CUSTOMER_FAILED]: 'Failed to update customer in payment provider',
    [QZPayErrorCode.PROVIDER_PAYMENT_FAILED]: 'Payment provider processing failed',
    [QZPayErrorCode.PROVIDER_REFUND_FAILED]: 'Provider refund failed',
    [QZPayErrorCode.PROVIDER_NOT_LINKED]: 'Customer not linked to payment provider',
    [QZPayErrorCode.PROVIDER_CONNECTION_FAILED]: 'Payment provider connection failed',

    // Payment errors
    [QZPayErrorCode.PAYMENT_FAILED]: 'Payment failed',
    [QZPayErrorCode.PAYMENT_DECLINED]: 'Payment declined by provider',
    [QZPayErrorCode.PAYMENT_INSUFFICIENT_FUNDS]: 'Insufficient funds',
    [QZPayErrorCode.PAYMENT_CARD_INVALID]: 'Invalid card details',
    [QZPayErrorCode.PAYMENT_PROCESSING_ERROR]: 'Payment processing error',

    // Subscription errors
    [QZPayErrorCode.SUBSCRIPTION_EXPIRED]: 'Subscription has expired',
    [QZPayErrorCode.SUBSCRIPTION_CANCELED]: 'Subscription is canceled',
    [QZPayErrorCode.SUBSCRIPTION_PAUSED]: 'Subscription is paused',
    [QZPayErrorCode.SUBSCRIPTION_PAST_DUE]: 'Subscription is past due',
    [QZPayErrorCode.TRIAL_CONVERSION_FAILED]: 'Failed to convert trial subscription',
    [QZPayErrorCode.RENEWAL_FAILED]: 'Subscription renewal failed',

    // Invoice errors
    [QZPayErrorCode.INVOICE_CREATION_FAILED]: 'Invoice creation failed',
    [QZPayErrorCode.INVOICE_VOID_FAILED]: 'Failed to void invoice',
    [QZPayErrorCode.INVOICE_ALREADY_PAID]: 'Invoice is already paid',

    // Generic errors
    [QZPayErrorCode.INTERNAL_ERROR]: 'Internal error occurred',
    [QZPayErrorCode.OPERATION_FAILED]: 'Operation failed',
    [QZPayErrorCode.UNKNOWN_ERROR]: 'Unknown error occurred'
};
