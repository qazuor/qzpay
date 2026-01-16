/**
 * HTTP Error handling for QZPay Hono
 *
 * Defines custom error classes and status code constants for consistent error responses
 */

/**
 * Custom HTTP error for QZPay operations
 *
 * @example
 * ```typescript
 * throw new QZPayHttpError(404, 'NOT_FOUND', 'Customer not found');
 * ```
 */
export class QZPayHttpError extends Error {
    /**
     * Create a new QZPayHttpError
     *
     * @param statusCode - HTTP status code
     * @param code - Error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
     * @param message - Human-readable error message
     */
    constructor(
        public statusCode: number,
        public code: string,
        message: string
    ) {
        super(message);
        this.name = 'QZPayHttpError';

        // Maintain proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, QZPayHttpError.prototype);
    }
}

/**
 * Standard HTTP status codes used in QZPay
 */
export const HttpStatus = Object.freeze({
    /** 200 OK - Request succeeded */
    OK: 200,
    /** 201 Created - Resource created successfully */
    CREATED: 201,
    /** 400 Bad Request - Invalid request data */
    BAD_REQUEST: 400,
    /** 401 Unauthorized - Authentication required */
    UNAUTHORIZED: 401,
    /** 403 Forbidden - Insufficient permissions */
    FORBIDDEN: 403,
    /** 404 Not Found - Resource not found */
    NOT_FOUND: 404,
    /** 409 Conflict - Resource already exists or conflict */
    CONFLICT: 409,
    /** 422 Unprocessable Entity - Validation error */
    UNPROCESSABLE_ENTITY: 422,
    /** 429 Too Many Requests - Rate limit exceeded */
    TOO_MANY_REQUESTS: 429,
    /** 500 Internal Server Error - Server error */
    INTERNAL_SERVER_ERROR: 500
} as const);

/**
 * Type for HTTP status codes
 */
export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];
