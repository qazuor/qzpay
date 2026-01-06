/**
 * QZPay Logging Interceptor
 * Provides structured logging for billing operations
 */
import { Injectable, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { type Observable, tap } from 'rxjs';

/**
 * Configuration options for the logging interceptor
 */
export interface QZPayLoggingOptions {
    /**
     * Whether to log request bodies
     * @default true
     */
    logRequestBody?: boolean;

    /**
     * Whether to log response bodies
     * @default false
     */
    logResponseBody?: boolean;

    /**
     * Fields to mask in logged data (e.g., card numbers, secrets)
     * @default ['cardNumber', 'cvv', 'secret', 'password', 'token', 'signature']
     */
    sensitiveFields?: string[];

    /**
     * Maximum length for logged body data
     * @default 1000
     */
    maxBodyLength?: number;

    /**
     * Log level for successful requests
     * @default 'log'
     */
    successLogLevel?: 'log' | 'debug' | 'verbose';

    /**
     * Log level for errors
     * @default 'error'
     */
    errorLogLevel?: 'error' | 'warn';

    /**
     * Whether to include timing information
     * @default true
     */
    includeTiming?: boolean;

    /**
     * Custom logger name
     * @default 'QZPayLogging'
     */
    loggerName?: string;
}

const DEFAULT_SENSITIVE_FIELDS = [
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
    'secret',
    'password',
    'token',
    'signature',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token'
];

/**
 * QZPay Logging Interceptor
 *
 * Intercepts all requests to billing endpoints and logs:
 * - Request method and path
 * - Request body (sanitized)
 * - Response time
 * - Response status
 * - Error details (if applicable)
 *
 * @example
 * ```typescript
 * // Apply globally in module
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useClass: QZPayLoggingInterceptor,
 *     },
 *   ],
 * })
 *
 * // Or apply to specific controllers
 * @UseInterceptors(QZPayLoggingInterceptor)
 * @Controller('billing')
 * export class BillingController {}
 * ```
 */
@Injectable()
export class QZPayLoggingInterceptor implements NestInterceptor {
    private readonly logger: Logger;
    private readonly options: Required<QZPayLoggingOptions>;

    constructor(options: QZPayLoggingOptions = {}) {
        this.options = {
            logRequestBody: options.logRequestBody ?? true,
            logResponseBody: options.logResponseBody ?? false,
            sensitiveFields: options.sensitiveFields ?? DEFAULT_SENSITIVE_FIELDS,
            maxBodyLength: options.maxBodyLength ?? 1000,
            successLogLevel: options.successLogLevel ?? 'log',
            errorLogLevel: options.errorLogLevel ?? 'error',
            includeTiming: options.includeTiming ?? true,
            loggerName: options.loggerName ?? 'QZPayLogging'
        };
        this.logger = new Logger(this.options.loggerName);
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, ip, headers } = request;
        const userAgent = headers['user-agent'] ?? 'unknown';
        const requestId = headers['x-request-id'] ?? this.generateRequestId();
        const startTime = Date.now();

        // Log request
        const requestLog: Record<string, unknown> = {
            requestId,
            type: 'request',
            method,
            url,
            ip,
            userAgent: this.truncate(userAgent, 100)
        };

        if (this.options.logRequestBody && body && Object.keys(body).length > 0) {
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            requestLog['body'] = this.sanitizeData(body);
        }

        this.logger.debug(`[${requestId}] ${method} ${url} - Request started`, JSON.stringify(requestLog));

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const duration = Date.now() - startTime;
                    const responseLog: Record<string, unknown> = {
                        requestId,
                        type: 'response',
                        method,
                        url,
                        status: 'success'
                    };

                    if (this.options.includeTiming) {
                        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
                        responseLog['duration'] = `${duration}ms`;
                    }

                    if (this.options.logResponseBody && data) {
                        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
                        responseLog['body'] = this.sanitizeData(data);
                    }

                    this.logAtLevel(
                        this.options.successLogLevel,
                        `[${requestId}] ${method} ${url} - ${duration}ms`,
                        JSON.stringify(responseLog)
                    );
                },
                error: (error: Error) => {
                    const duration = Date.now() - startTime;
                    const errorLog: Record<string, unknown> = {
                        requestId,
                        type: 'error',
                        method,
                        url,
                        status: 'error',
                        errorName: error.name,
                        errorMessage: error.message
                    };

                    if (this.options.includeTiming) {
                        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
                        errorLog['duration'] = `${duration}ms`;
                    }

                    if (this.options.logRequestBody && body && Object.keys(body).length > 0) {
                        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
                        errorLog['requestBody'] = this.sanitizeData(body);
                    }

                    this.logAtLevel(
                        this.options.errorLogLevel,
                        `[${requestId}] ${method} ${url} - Error: ${error.message}`,
                        JSON.stringify(errorLog)
                    );
                }
            })
        );
    }

    /**
     * Sanitize data by masking sensitive fields
     */
    private sanitizeData(data: unknown): unknown {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.sanitizeData(item));
        }

        const sanitized: Record<string, unknown> = {};
        const record = data as Record<string, unknown>;

        for (const [key, value] of Object.entries(record)) {
            if (this.isSensitiveField(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeData(value);
            } else if (typeof value === 'string' && value.length > this.options.maxBodyLength) {
                sanitized[key] = `${value.substring(0, this.options.maxBodyLength)}...[truncated]`;
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Check if a field name is sensitive
     */
    private isSensitiveField(fieldName: string): boolean {
        const lowerField = fieldName.toLowerCase();
        return this.options.sensitiveFields.some((sensitive) => lowerField.includes(sensitive.toLowerCase()));
    }

    /**
     * Truncate a string to a maximum length
     */
    private truncate(str: string, maxLength: number): string {
        if (str.length <= maxLength) {
            return str;
        }
        return `${str.substring(0, maxLength)}...`;
    }

    /**
     * Generate a unique request ID
     */
    private generateRequestId(): string {
        return `qzpay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Log at the specified level
     */
    private logAtLevel(level: 'log' | 'debug' | 'verbose' | 'error' | 'warn', message: string, context?: string): void {
        switch (level) {
            case 'debug':
                this.logger.debug(message, context);
                break;
            case 'verbose':
                this.logger.verbose(message, context);
                break;
            case 'error':
                this.logger.error(message, context);
                break;
            case 'warn':
                this.logger.warn(message, context);
                break;
            default:
                this.logger.log(message, context);
        }
    }
}

/**
 * Factory function to create a configured logging interceptor
 */
export function createQZPayLoggingInterceptor(options?: QZPayLoggingOptions): QZPayLoggingInterceptor {
    return new QZPayLoggingInterceptor(options);
}
