/**
 * Error mapping utilities for MercadoPago
 */
import { MERCADOPAGO_STATUS_DETAIL } from '../types.js';

/**
 * QZPay error codes
 */
export enum QZPayErrorCode {
    INVALID_REQUEST = 'invalid_request',
    AUTHENTICATION_ERROR = 'authentication_error',
    RATE_LIMIT_ERROR = 'rate_limit_error',
    PROVIDER_ERROR = 'provider_error',
    RESOURCE_NOT_FOUND = 'resource_not_found',
    INVALID_CARD = 'invalid_card',
    INSUFFICIENT_FUNDS = 'insufficient_funds',
    CARD_DECLINED = 'card_declined',
    PROCESSING_ERROR = 'processing_error',
    DUPLICATE_TRANSACTION = 'duplicate_transaction'
}

/**
 * QZPay error class
 */
export class QZPayMercadoPagoError extends Error {
    constructor(
        public readonly code: QZPayErrorCode,
        message: string,
        public readonly originalError?: unknown,
        public readonly statusDetail?: string
    ) {
        super(message);
        this.name = 'QZPayMercadoPagoError';
    }
}

/**
 * Map MercadoPago error to QZPay error
 */
export function mapMercadoPagoError(error: unknown, context: string): QZPayMercadoPagoError {
    // Handle MercadoPago API errors
    if (error && typeof error === 'object') {
        // Check for API error response
        if ('cause' in error && Array.isArray(error.cause)) {
            const causes = error.cause as Array<{ code?: string; description?: string }>;
            const firstCause = causes[0];

            if (firstCause) {
                const code = firstCause.code ?? 'unknown';
                const description = firstCause.description ?? 'Unknown error';

                // Map by error code
                switch (code) {
                    case '2':
                    case '400':
                        return new QZPayMercadoPagoError(
                            QZPayErrorCode.INVALID_REQUEST,
                            `${context} - Invalid request: ${description}`,
                            error
                        );

                    case '401':
                    case '403':
                        return new QZPayMercadoPagoError(
                            QZPayErrorCode.AUTHENTICATION_ERROR,
                            `${context} - Authentication failed: ${description}`,
                            error
                        );

                    case '404':
                        return new QZPayMercadoPagoError(
                            QZPayErrorCode.RESOURCE_NOT_FOUND,
                            `${context} - Resource not found: ${description}`,
                            error
                        );

                    case '429':
                        return new QZPayMercadoPagoError(
                            QZPayErrorCode.RATE_LIMIT_ERROR,
                            `${context} - Rate limit exceeded: ${description}`,
                            error
                        );

                    case '101':
                        return new QZPayMercadoPagoError(
                            QZPayErrorCode.DUPLICATE_TRANSACTION,
                            `${context} - Resource already exists: ${description}`,
                            error
                        );

                    default:
                        return new QZPayMercadoPagoError(
                            QZPayErrorCode.PROVIDER_ERROR,
                            `${context} - Provider error [${code}]: ${description}`,
                            error
                        );
                }
            }
        }

        // Check for status_detail in payment errors
        if ('status_detail' in error && typeof error.status_detail === 'string') {
            const statusDetail = error.status_detail;
            const errorMessage = getStatusDetailMessage(statusDetail);

            const errorCode = mapStatusDetailToErrorCode(statusDetail);
            return new QZPayMercadoPagoError(errorCode, `${context} - ${errorMessage}`, error, statusDetail);
        }

        // Check for message property
        if ('message' in error && typeof error.message === 'string') {
            return new QZPayMercadoPagoError(QZPayErrorCode.PROVIDER_ERROR, `${context} - ${error.message}`, error);
        }
    }

    // Fallback for unknown errors
    return new QZPayMercadoPagoError(QZPayErrorCode.PROVIDER_ERROR, `${context} - Unknown error occurred`, error);
}

/**
 * Map status_detail to QZPay error code
 */
function mapStatusDetailToErrorCode(statusDetail: string): QZPayErrorCode {
    // Card-related errors
    if (statusDetail.startsWith('cc_rejected_bad_filled')) {
        return QZPayErrorCode.INVALID_CARD;
    }

    if (statusDetail === 'cc_rejected_insufficient_amount') {
        return QZPayErrorCode.INSUFFICIENT_FUNDS;
    }

    if (
        statusDetail.includes('cc_rejected_blacklist') ||
        statusDetail.includes('cc_rejected_high_risk') ||
        statusDetail.includes('cc_rejected_card_disabled')
    ) {
        return QZPayErrorCode.CARD_DECLINED;
    }

    if (statusDetail === 'cc_rejected_duplicated_payment') {
        return QZPayErrorCode.DUPLICATE_TRANSACTION;
    }

    if (statusDetail.startsWith('cc_rejected')) {
        return QZPayErrorCode.CARD_DECLINED;
    }

    // Processing errors
    if (statusDetail.startsWith('pending_')) {
        return QZPayErrorCode.PROCESSING_ERROR;
    }

    return QZPayErrorCode.PROVIDER_ERROR;
}

/**
 * Get human-readable status detail message
 */
function getStatusDetailMessage(statusDetail: string): string {
    const messages: Record<string, string> = MERCADOPAGO_STATUS_DETAIL;
    return messages[statusDetail] ?? statusDetail;
}

/**
 * Check if error is a "customer already exists" error
 */
export function isCustomerExistsError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'cause' in error) {
        const cause = (error as { cause: unknown }).cause;
        if (Array.isArray(cause)) {
            return cause.some((c) => typeof c === 'object' && c !== null && 'code' in c && c.code === '101');
        }
    }
    return false;
}

/**
 * Wrap async adapter method with error handling
 */
export async function wrapAdapterMethod<T>(context: string, operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        throw mapMercadoPagoError(error, context);
    }
}
