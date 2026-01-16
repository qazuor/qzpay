/**
 * Global Error Handling Middleware
 *
 * Provides consistent error handling across all QZPay Hono routes
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { mapErrorToHttpStatus } from '../errors/error-mapper.js';
import { HttpStatus, QZPayHttpError } from '../errors/http-error.js';
import type { QZPayApiResponse } from '../types.js';

/**
 * Configuration for error middleware
 */
export interface QZPayErrorMiddlewareConfig {
    /**
     * Whether to include stack traces in error responses
     * @default false (true in development)
     */
    includeStackTrace?: boolean;

    /**
     * Custom error handler to override default behavior
     */
    onError?: (error: unknown, c: Context) => Response | Promise<Response>;

    /**
     * Whether to log errors to console
     * @default true
     */
    logErrors?: boolean;
}

/**
 * Create error response from error object
 *
 * @param error - Error to convert to response
 * @param includeStackTrace - Whether to include stack trace
 * @returns API response object
 */
export function createErrorResponse(error: unknown, includeStackTrace = false): { response: QZPayApiResponse; status: number } {
    const { status, code, message } = mapErrorToHttpStatus(error);

    const response: QZPayApiResponse = {
        success: false,
        error: {
            code,
            message,
            ...(includeStackTrace && error instanceof Error && { stack: error.stack })
        }
    };

    return { response, status };
}

/**
 * Create global error handling middleware
 *
 * Catches all errors thrown in routes and converts them to consistent error responses
 *
 * @param config - Error middleware configuration
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createErrorMiddleware } from '@qazuor/qzpay-hono';
 *
 * const app = new Hono();
 * app.use('*', createErrorMiddleware({ includeStackTrace: true }));
 * ```
 */
export function createErrorMiddleware(config: QZPayErrorMiddlewareConfig = {}): MiddlewareHandler {
    const { includeStackTrace = false, onError, logErrors = true } = config;

    return async (c: Context, next) => {
        try {
            return await next();
        } catch (error) {
            // Log error if enabled
            if (logErrors) {
                console.error('[QZPay Error]', error);
            }

            // Use custom error handler if provided
            if (onError) {
                return onError(error, c);
            }

            // Default error handling
            const { response, status } = createErrorResponse(error, includeStackTrace);
            return c.json(response, status as ContentfulStatusCode);
        }
    };
}

/**
 * Middleware to handle 404 errors for unmatched routes
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { notFoundMiddleware } from '@qazuor/qzpay-hono';
 *
 * const app = new Hono();
 * app.use('*', notFoundMiddleware);
 * ```
 */
export const notFoundMiddleware: MiddlewareHandler = async (c: Context, next) => {
    await next();

    // Check if response was not set (404)
    if (c.res.status === 404) {
        const response: QZPayApiResponse = {
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Route not found: ${c.req.method} ${c.req.path}`
            }
        };
        return c.json(response, HttpStatus.NOT_FOUND as ContentfulStatusCode);
    }

    return c.res;
};

/**
 * Helper to throw a QZPayHttpError with proper status code
 *
 * @param statusCode - HTTP status code
 * @param code - Error code
 * @param message - Error message
 * @throws QZPayHttpError
 *
 * @example
 * ```typescript
 * import { throwHttpError, HttpStatus } from '@qazuor/qzpay-hono';
 *
 * if (!customer) {
 *   throwHttpError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
 * }
 * ```
 */
export function throwHttpError(statusCode: number, code: string, message: string): never {
    throw new QZPayHttpError(statusCode, code, message);
}

/**
 * Create an error handler for use with app.onError()
 *
 * This is the recommended way to handle errors in Hono applications.
 * Use this with app.onError() for consistent error handling.
 *
 * @param config - Error handler configuration
 * @returns Error handler function compatible with Hono's onError
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createErrorHandler } from '@qazuor/qzpay-hono';
 *
 * const app = new Hono();
 * app.onError(createErrorHandler({ includeStackTrace: true }));
 * ```
 */
export function createErrorHandler(config: QZPayErrorMiddlewareConfig = {}) {
    const { includeStackTrace = false, onError, logErrors = true } = config;

    return (error: Error, c: Context): Response => {
        // Log error if enabled
        if (logErrors) {
            console.error(error);
        }

        // Use custom error handler if provided
        if (onError) {
            return onError(error, c) as Response;
        }

        // Default error handling
        const { response, status } = createErrorResponse(error, includeStackTrace);
        return c.json(response, status as ContentfulStatusCode);
    };
}

/**
 * Helper to handle errors in route handlers
 *
 * Wraps route handler logic to automatically catch and format errors
 *
 * @param handler - Route handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```typescript
 * import { withErrorHandling } from '@qazuor/qzpay-hono';
 *
 * router.get('/customers/:id', withErrorHandling(async (c) => {
 *   const customer = await billing.customers.get(c.req.param('id'));
 *   if (!customer) {
 *     throw new QZPayHttpError(404, 'NOT_FOUND', 'Customer not found');
 *   }
 *   return c.json({ success: true, data: customer });
 * }));
 * ```
 */
export function withErrorHandling<T>(handler: (c: Context) => Promise<T>): (c: Context) => Promise<Response> {
    return async (c: Context) => {
        try {
            const result = await handler(c);
            // If handler returns Response, return it
            if (result instanceof Response) {
                return result;
            }
            // Otherwise assume it's JSON data
            return c.json(result as never);
        } catch (error) {
            const { response, status } = createErrorResponse(error);
            return c.json(response, status as ContentfulStatusCode);
        }
    };
}
