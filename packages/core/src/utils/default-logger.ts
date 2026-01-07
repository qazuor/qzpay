/**
 * Default Logger Implementation for QZPay
 *
 * A simple console-based logger with no external dependencies.
 * For production, users should provide their own logger implementation
 * using pino, winston, or another logging library.
 */
import type { QZPayLogLevel, QZPayLogMeta, QZPayLogger, QZPayLoggerConfig } from '../types/logger.types.js';

/**
 * Log level priority (lower = more verbose)
 */
const LOG_LEVELS: Record<QZPayLogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
} as const;

/**
 * Format metadata for logging
 */
function formatMeta(meta?: QZPayLogMeta): string {
    if (!meta || Object.keys(meta).length === 0) {
        return '';
    }

    // Extract error separately for better formatting
    const { error, ...rest } = meta;
    const parts: string[] = [];

    // Format regular metadata
    if (Object.keys(rest).length > 0) {
        parts.push(JSON.stringify(rest));
    }

    // Format error with stack trace
    if (error) {
        if (error instanceof Error) {
            parts.push(`Error: ${error.message}`);
            if (error.stack) {
                parts.push(`Stack: ${error.stack}`);
            }
        } else {
            parts.push(`Error: ${String(error)}`);
        }
    }

    return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

/**
 * Get ISO timestamp string
 */
function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Create the default console logger
 *
 * @param config Logger configuration options
 * @returns A QZPayLogger implementation
 *
 * @example
 * ```typescript
 * // Basic usage with defaults (colorize enabled)
 * const logger = createDefaultLogger();
 *
 * // Disable colors for production
 * const logger = createDefaultLogger({
 *   level: 'info',
 *   colorize: false,
 *   timestamps: true,
 * });
 *
 * // Consumer controls environment-based config
 * const logger = createDefaultLogger({
 *   level: isProduction ? 'warn' : 'debug',
 *   colorize: !isProduction,
 * });
 * ```
 */
export function createDefaultLogger(config: QZPayLoggerConfig = {}): QZPayLogger {
    const { level: minLevel = 'info', timestamps = true, colorize = true } = config;

    const minLevelPriority = LOG_LEVELS[minLevel];

    const shouldLog = (level: QZPayLogLevel): boolean => {
        return LOG_LEVELS[level] >= minLevelPriority;
    };

    const formatLevel = (level: QZPayLogLevel): string => {
        const paddedLevel = level.toUpperCase().padEnd(5);

        if (!colorize) {
            return paddedLevel;
        }

        switch (level) {
            case 'debug':
                return `${COLORS.dim}${paddedLevel}${COLORS.reset}`;
            case 'info':
                return `${COLORS.green}${paddedLevel}${COLORS.reset}`;
            case 'warn':
                return `${COLORS.yellow}${paddedLevel}${COLORS.reset}`;
            case 'error':
                return `${COLORS.red}${paddedLevel}${COLORS.reset}`;
            default:
                return paddedLevel;
        }
    };

    const formatMessage = (level: QZPayLogLevel, message: string, meta?: QZPayLogMeta): string => {
        const parts: string[] = [];

        if (timestamps) {
            const ts = getTimestamp();
            parts.push(colorize ? `${COLORS.dim}${ts}${COLORS.reset}` : ts);
        }

        parts.push(`[${formatLevel(level)}]`);

        if (colorize) {
            parts.push(`${COLORS.blue}[QZPay]${COLORS.reset}`);
        } else {
            parts.push('[QZPay]');
        }

        parts.push(message);

        const metaStr = formatMeta(meta);
        if (metaStr) {
            parts.push(metaStr);
        }

        return parts.join(' ');
    };

    return {
        debug: (message: string, meta?: QZPayLogMeta): void => {
            if (shouldLog('debug')) {
                console.debug(formatMessage('debug', message, meta));
            }
        },

        info: (message: string, meta?: QZPayLogMeta): void => {
            if (shouldLog('info')) {
                console.info(formatMessage('info', message, meta));
            }
        },

        warn: (message: string, meta?: QZPayLogMeta): void => {
            if (shouldLog('warn')) {
                console.warn(formatMessage('warn', message, meta));
            }
        },

        error: (message: string, meta?: QZPayLogMeta): void => {
            if (shouldLog('error')) {
                console.error(formatMessage('error', message, meta));
            }
        }
    };
}

/**
 * No-op logger that discards all messages
 * Useful for testing or when logging should be completely disabled
 */
export const noopLogger: QZPayLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
};
