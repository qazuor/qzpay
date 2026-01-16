/**
 * Error Mapper
 *
 * Maps different error types to appropriate HTTP status codes and error codes
 */

import { HttpStatus } from './http-error.js';
import { QZPayHttpError } from './http-error.js';

/**
 * Result of error mapping
 */
export interface ErrorMappingResult {
    /** HTTP status code */
    status: number;
    /** Error code */
    code: string;
    /** Error message */
    message: string;
}

/**
 * Error patterns to match against error messages
 */
const ERROR_PATTERNS: Array<{
    pattern: RegExp | string;
    status: number;
    code: string;
}> = [
    // Not Found (404)
    { pattern: /not found/i, status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' },
    { pattern: /does not exist/i, status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' },
    { pattern: /no.*found/i, status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' },

    // Conflict (409)
    { pattern: /already exists/i, status: HttpStatus.CONFLICT, code: 'CONFLICT' },
    { pattern: /duplicate/i, status: HttpStatus.CONFLICT, code: 'CONFLICT' },
    { pattern: /conflict/i, status: HttpStatus.CONFLICT, code: 'CONFLICT' },

    // Validation/Invalid Data (422)
    { pattern: /invalid/i, status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'VALIDATION_ERROR' },
    { pattern: /validation/i, status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'VALIDATION_ERROR' },
    { pattern: /required/i, status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'VALIDATION_ERROR' },
    { pattern: /must be/i, status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'VALIDATION_ERROR' },
    { pattern: /expected/i, status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'VALIDATION_ERROR' },

    // Bad Request (400)
    { pattern: /bad request/i, status: HttpStatus.BAD_REQUEST, code: 'BAD_REQUEST' },
    { pattern: /malformed/i, status: HttpStatus.BAD_REQUEST, code: 'BAD_REQUEST' },

    // Unauthorized (401)
    { pattern: /unauthorized/i, status: HttpStatus.UNAUTHORIZED, code: 'UNAUTHORIZED' },
    { pattern: /authentication/i, status: HttpStatus.UNAUTHORIZED, code: 'UNAUTHORIZED' },

    // Forbidden (403)
    { pattern: /forbidden/i, status: HttpStatus.FORBIDDEN, code: 'FORBIDDEN' },
    { pattern: /permission/i, status: HttpStatus.FORBIDDEN, code: 'FORBIDDEN' },
    { pattern: /access denied/i, status: HttpStatus.FORBIDDEN, code: 'FORBIDDEN' },

    // Rate Limit (429)
    { pattern: /rate limit/i, status: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMIT_EXCEEDED' },
    { pattern: /too many requests/i, status: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMIT_EXCEEDED' }
];

/**
 * Map an error to HTTP status code and error code
 *
 * @param error - Error to map
 * @returns Error mapping result with status, code, and message
 *
 * @example
 * ```typescript
 * const result = mapErrorToHttpStatus(new Error('Customer not found'));
 * // { status: 404, code: 'NOT_FOUND', message: 'Customer not found' }
 * ```
 */
export function mapErrorToHttpStatus(error: unknown): ErrorMappingResult {
    // Handle QZPayHttpError (already has status and code)
    if (error instanceof QZPayHttpError) {
        return {
            status: error.statusCode,
            code: error.code,
            message: error.message
        };
    }

    // Handle standard Error objects
    if (error instanceof Error) {
        const message = error.message;

        // Check against all error patterns
        for (const { pattern, status, code } of ERROR_PATTERNS) {
            if (typeof pattern === 'string') {
                if (message.toLowerCase().includes(pattern.toLowerCase())) {
                    return { status, code, message };
                }
            } else if (pattern.test(message)) {
                return { status, code, message };
            }
        }

        // Default to 500 for unmatched errors
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: 'INTERNAL_ERROR',
            message
        };
    }

    // Handle non-Error objects (strings, etc.)
    const message = String(error);
    return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message
    };
}

/**
 * Check if an error should be treated as a "not found" error
 *
 * @param error - Error to check
 * @returns True if error indicates resource not found
 */
export function isNotFoundError(error: unknown): boolean {
    const result = mapErrorToHttpStatus(error);
    return result.status === HttpStatus.NOT_FOUND;
}

/**
 * Check if an error should be treated as a validation error
 *
 * @param error - Error to check
 * @returns True if error indicates validation failure
 */
export function isValidationError(error: unknown): boolean {
    const result = mapErrorToHttpStatus(error);
    return result.status === HttpStatus.UNPROCESSABLE_ENTITY;
}

/**
 * Check if an error should be treated as a conflict error
 *
 * @param error - Error to check
 * @returns True if error indicates resource conflict
 */
export function isConflictError(error: unknown): boolean {
    const result = mapErrorToHttpStatus(error);
    return result.status === HttpStatus.CONFLICT;
}
