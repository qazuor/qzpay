/**
 * Exception filter for QZPay errors
 *
 * Maps QZPay errors to appropriate HTTP exceptions
 */
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

/**
 * Error response structure
 */
interface ErrorResponse {
    statusCode: number;
    message: string;
    error: string;
    timestamp: string;
    path: string;
}

/**
 * Exception filter that catches all exceptions and maps them to HTTP responses
 *
 * @example
 * ```typescript
 * // Register globally in main.ts
 * app.useGlobalFilters(new QZPayExceptionFilter());
 *
 * // Or use in a controller
 * @UseFilters(QZPayExceptionFilter)
 * @Controller('billing')
 * export class BillingController {}
 * ```
 */
@Catch()
export class QZPayExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
        const request = ctx.getRequest<{ url: string }>();

        let status: number;
        let message: string;
        let error: string;

        if (exception instanceof HttpException) {
            // NestJS HTTP exceptions
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
                error = exception.name;
            } else {
                const responseObj = exceptionResponse as Record<string, unknown>;
                // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
                message = (responseObj['message'] as string) || exception.message;
                // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
                error = (responseObj['error'] as string) || exception.name;
            }
        } else if (exception instanceof Error) {
            // Map common QZPay errors to HTTP status codes
            status = this.mapErrorToStatus(exception);
            message = exception.message;
            error = exception.name || 'Error';
        } else {
            // Unknown errors
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'An unexpected error occurred';
            error = 'InternalServerError';
        }

        const errorResponse: ErrorResponse = {
            statusCode: status,
            message,
            error,
            timestamp: new Date().toISOString(),
            path: request.url
        };

        response.status(status).json(errorResponse);
    }

    /**
     * Map error messages to HTTP status codes
     */
    private mapErrorToStatus(error: Error): number {
        const message = error.message.toLowerCase();

        // Not found errors
        if (message.includes('not found') || message.includes('does not exist') || message.includes('could not find')) {
            return HttpStatus.NOT_FOUND;
        }

        // Validation errors
        if (message.includes('invalid') || message.includes('validation') || message.includes('must be') || message.includes('required')) {
            return HttpStatus.BAD_REQUEST;
        }

        // Authentication/Authorization errors
        if (message.includes('unauthorized') || message.includes('not authorized') || message.includes('permission denied')) {
            return HttpStatus.UNAUTHORIZED;
        }

        // Forbidden errors
        if (message.includes('forbidden') || message.includes('access denied')) {
            return HttpStatus.FORBIDDEN;
        }

        // Conflict errors
        if (message.includes('already exists') || message.includes('duplicate') || message.includes('conflict')) {
            return HttpStatus.CONFLICT;
        }

        // Payment/provider errors
        if (
            message.includes('payment failed') ||
            message.includes('payment error') ||
            message.includes('insufficient funds') ||
            message.includes('card declined')
        ) {
            return HttpStatus.PAYMENT_REQUIRED;
        }

        // Rate limit errors
        if (message.includes('rate limit') || message.includes('too many requests')) {
            return HttpStatus.TOO_MANY_REQUESTS;
        }

        // Default to internal server error
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
}
