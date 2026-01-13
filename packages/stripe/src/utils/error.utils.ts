/**
 * Stripe Error Mapping Utilities
 *
 * Maps Stripe-specific errors to QZPay error types for consistent error handling
 */
import type Stripe from 'stripe';

/**
 * QZPay error codes
 */
export enum QZPayErrorCode {
    // Card errors
    CARD_DECLINED = 'card_declined',
    INSUFFICIENT_FUNDS = 'insufficient_funds',
    EXPIRED_CARD = 'expired_card',
    INCORRECT_CVC = 'incorrect_cvc',
    INCORRECT_NUMBER = 'incorrect_number',
    INVALID_EXPIRY = 'invalid_expiry',
    PROCESSING_ERROR = 'processing_error',

    // Validation errors
    INVALID_REQUEST = 'invalid_request',
    RESOURCE_NOT_FOUND = 'resource_not_found',
    INVALID_PARAMETER = 'invalid_parameter',

    // Rate limiting
    RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

    // API errors
    API_ERROR = 'api_error',
    CONNECTION_ERROR = 'connection_error',
    TIMEOUT_ERROR = 'timeout_error',

    // Authentication
    AUTHENTICATION_REQUIRED = 'authentication_required',
    AUTHENTICATION_FAILED = 'authentication_failed',

    // Generic
    UNKNOWN_ERROR = 'unknown_error'
}

/**
 * QZPay error class
 */
export class QZPayError extends Error {
    constructor(
        public code: QZPayErrorCode,
        message: string,
        public statusCode = 500,
        public originalError?: unknown
    ) {
        super(message);
        this.name = 'QZPayError';
    }
}

/**
 * Check if error is a Stripe error
 */
function isStripeError(error: unknown): error is Stripe.StripeRawError {
    return typeof error === 'object' && error !== null && 'type' in error && typeof (error as { type: unknown }).type === 'string';
}

/**
 * Map Stripe error to QZPay error
 */
export function mapStripeError(error: unknown): QZPayError {
    // Handle non-Stripe errors
    if (!isStripeError(error)) {
        if (error instanceof Error) {
            // Check for timeout errors
            if (error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout')) {
                return new QZPayError(QZPayErrorCode.TIMEOUT_ERROR, error.message, 408, error);
            }
            return new QZPayError(QZPayErrorCode.UNKNOWN_ERROR, error.message, 500, error);
        }
        return new QZPayError(QZPayErrorCode.UNKNOWN_ERROR, 'An unknown error occurred', 500, error);
    }

    const stripeError = error;
    const errorType = stripeError.type as string;
    const errorCode = stripeError.code;
    const message = stripeError.message || 'An error occurred';

    // Map Stripe error types to QZPay error codes
    if (errorType === 'card_error') {
        return mapCardError(errorCode, message, stripeError);
    }
    if (errorType === 'rate_limit_error') {
        return new QZPayError(QZPayErrorCode.RATE_LIMIT_EXCEEDED, message, 429, stripeError);
    }
    if (errorType === 'invalid_request_error') {
        return mapInvalidRequestError(errorCode, message, stripeError);
    }
    if (errorType === 'api_error') {
        return new QZPayError(QZPayErrorCode.API_ERROR, message, 500, stripeError);
    }
    if (errorType === 'authentication_error') {
        return new QZPayError(QZPayErrorCode.AUTHENTICATION_FAILED, message, 401, stripeError);
    }
    if (errorType === 'idempotency_error') {
        return new QZPayError(QZPayErrorCode.INVALID_REQUEST, message, 400, stripeError);
    }

    // Handle connection errors (no specific type in Stripe, check by name or message)
    if (message.toLowerCase().includes('connection')) {
        return new QZPayError(QZPayErrorCode.CONNECTION_ERROR, message, 503, stripeError);
    }

    return new QZPayError(QZPayErrorCode.UNKNOWN_ERROR, message, 500, stripeError);
}

/**
 * Map Stripe card errors
 */
function mapCardError(code: string | undefined, message: string, originalError: Stripe.StripeRawError): QZPayError {
    const codeMap: Record<string, QZPayErrorCode> = {
        card_declined: QZPayErrorCode.CARD_DECLINED,
        insufficient_funds: QZPayErrorCode.INSUFFICIENT_FUNDS,
        expired_card: QZPayErrorCode.EXPIRED_CARD,
        incorrect_cvc: QZPayErrorCode.INCORRECT_CVC,
        incorrect_number: QZPayErrorCode.INCORRECT_NUMBER,
        invalid_expiry_month: QZPayErrorCode.INVALID_EXPIRY,
        invalid_expiry_year: QZPayErrorCode.INVALID_EXPIRY,
        invalid_expiry_month_past: QZPayErrorCode.INVALID_EXPIRY,
        invalid_expiry_year_past: QZPayErrorCode.INVALID_EXPIRY,
        processing_error: QZPayErrorCode.PROCESSING_ERROR,
        card_velocity_exceeded: QZPayErrorCode.RATE_LIMIT_EXCEEDED,
        authentication_required: QZPayErrorCode.AUTHENTICATION_REQUIRED
    };

    const qzpayCode = (code && codeMap[code]) || QZPayErrorCode.CARD_DECLINED;
    return new QZPayError(qzpayCode, message, 402, originalError);
}

/**
 * Map Stripe invalid request errors
 */
function mapInvalidRequestError(code: string | undefined, message: string, originalError: Stripe.StripeRawError): QZPayError {
    // Check if it's a not found error
    if (message.toLowerCase().includes('no such')) {
        return new QZPayError(QZPayErrorCode.RESOURCE_NOT_FOUND, message, 404, originalError);
    }

    // Check if it's a parameter error
    if (code === 'parameter_invalid_empty' || code === 'parameter_invalid_integer' || code === 'parameter_missing') {
        return new QZPayError(QZPayErrorCode.INVALID_PARAMETER, message, 400, originalError);
    }

    return new QZPayError(QZPayErrorCode.INVALID_REQUEST, message, 400, originalError);
}

/**
 * Wrap async function with error mapping
 */
export function withErrorMapping<T extends (...args: never[]) => Promise<unknown>>(
    fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        try {
            return (await fn(...args)) as ReturnType<T>;
        } catch (error) {
            throw mapStripeError(error);
        }
    };
}
