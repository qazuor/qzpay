/**
 * Logger types for QZPay
 *
 * Defines a minimal logger interface that users can implement
 * with their preferred logging library (pino, winston, etc.)
 */

/**
 * Log level for structured logging
 */
export type QZPayLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log metadata
 */
export interface QZPayLogMeta {
    /** Correlation ID for request tracing */
    correlationId?: string;
    /** Customer ID if applicable */
    customerId?: string;
    /** Subscription ID if applicable */
    subscriptionId?: string;
    /** Payment ID if applicable */
    paymentId?: string;
    /** Invoice ID if applicable */
    invoiceId?: string;
    /** Payment provider name */
    provider?: string;
    /** Operation name */
    operation?: string;
    /** Duration in milliseconds */
    durationMs?: number;
    /** Error details */
    error?: Error | unknown;
    /** Additional arbitrary metadata */
    [key: string]: unknown;
}

/**
 * QZPay Logger Interface
 *
 * Implement this interface to integrate with your preferred logging library.
 *
 * @example
 * ```typescript
 * // Using with pino
 * import pino from 'pino';
 *
 * const pinoLogger = pino();
 *
 * const qzpayLogger: QZPayLogger = {
 *   debug: (msg, meta) => pinoLogger.debug(meta, msg),
 *   info: (msg, meta) => pinoLogger.info(meta, msg),
 *   warn: (msg, meta) => pinoLogger.warn(meta, msg),
 *   error: (msg, meta) => pinoLogger.error(meta, msg),
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using with winston
 * import winston from 'winston';
 *
 * const winstonLogger = winston.createLogger({
 *   level: 'info',
 *   format: winston.format.json(),
 *   transports: [new winston.transports.Console()],
 * });
 *
 * const qzpayLogger: QZPayLogger = {
 *   debug: (msg, meta) => winstonLogger.debug(msg, meta),
 *   info: (msg, meta) => winstonLogger.info(msg, meta),
 *   warn: (msg, meta) => winstonLogger.warn(msg, meta),
 *   error: (msg, meta) => winstonLogger.error(msg, meta),
 * };
 * ```
 */
export interface QZPayLogger {
    /**
     * Log a debug message
     * Use for detailed debugging information
     */
    debug(message: string, meta?: QZPayLogMeta): void;

    /**
     * Log an info message
     * Use for general informational messages
     */
    info(message: string, meta?: QZPayLogMeta): void;

    /**
     * Log a warning message
     * Use for potentially problematic situations
     */
    warn(message: string, meta?: QZPayLogMeta): void;

    /**
     * Log an error message
     * Use for error conditions
     */
    error(message: string, meta?: QZPayLogMeta): void;
}

/**
 * Logger configuration options
 */
export interface QZPayLoggerConfig {
    /**
     * Minimum log level to output
     * @default 'info'
     */
    level?: QZPayLogLevel;

    /**
     * Whether to include timestamps
     * @default true
     */
    timestamps?: boolean;

    /**
     * Whether to colorize output (for console loggers)
     * @default true
     */
    colorize?: boolean;

    /**
     * Custom logger implementation
     * If provided, overrides the default console logger
     */
    logger?: QZPayLogger;
}
