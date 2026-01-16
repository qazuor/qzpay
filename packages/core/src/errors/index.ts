/**
 * QZPay Error Classes
 *
 * Specialized error classes for the QZPay billing library.
 * All errors extend the base QZPayError class and provide
 * structured error information for better error handling.
 */

export { QZPayError } from './base.error.js';
export { QZPayValidationError } from './validation.error.js';
export { QZPayNotFoundError } from './not-found.error.js';
export { QZPayConflictError } from './conflict.error.js';
export { QZPayProviderSyncError } from './provider-sync.error.js';
export { QZPayErrorCode, QZPayErrorCodeDescription, type QZPayErrorCodeType } from './error-codes.js';
export {
    qzpayRedactSensitiveError,
    qzpayCreateErrorSanitizer,
    type QZPaySanitizeErrorOptions
} from './sanitize.utils.js';
