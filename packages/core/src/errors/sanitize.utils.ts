/**
 * QZPay Error Sanitization Utilities
 *
 * Functions for sanitizing sensitive data from errors before logging.
 */

/**
 * Default list of sensitive field names to redact
 */
const DEFAULT_SENSITIVE_PATTERNS = [
    // Card/Payment data
    /card.?number/i,
    /cvv/i,
    /cvc/i,
    /security.?code/i,
    /expir/i,
    /account.?number/i,
    /routing.?number/i,
    // Secrets and tokens
    /secret/i,
    /password/i,
    /token/i,
    /signature/i,
    /api.?key/i,
    /private.?key/i,
    /access.?token/i,
    /refresh.?token/i,
    /bearer/i,
    /id.?token/i,
    // Auth headers
    /authorization/i,
    /auth/i,
    /x-api-key/i,
    /x-auth-token/i,
    // Webhooks
    /webhook.?secret/i,
    /webhook.?signature/i,
    /stripe.?signature/i,
    // Provider credentials
    /stripe.?secret/i,
    /mercadopago.?access/i,
    /mp.?access/i
];

/**
 * Options for error sanitization
 */
export interface QZPaySanitizeErrorOptions {
    /**
     * Custom patterns to match sensitive field names
     */
    sensitivePatterns?: RegExp[];

    /**
     * The string to use when redacting sensitive values
     * @default '[REDACTED]'
     */
    redactString?: string;

    /**
     * Maximum depth to traverse in nested objects
     * @default 10
     */
    maxDepth?: number;
}

/**
 * Check if a field name matches any sensitive pattern
 */
function isSensitiveField(fieldName: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(fieldName));
}

/**
 * Sanitize a value recursively, redacting sensitive fields
 */
function sanitizeValue(value: unknown, patterns: RegExp[], redactString: string, depth: number, maxDepth: number): unknown {
    // Prevent infinite recursion
    if (depth >= maxDepth) {
        return '[MAX_DEPTH_EXCEEDED]';
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
        return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
        return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, patterns, redactString, depth + 1, maxDepth));
    }

    // Handle Date objects
    if (value instanceof Date) {
        return value;
    }

    // Handle Error objects
    if (value instanceof Error) {
        const sanitizedError: Record<string, unknown> = {
            name: value.name,
            message: sanitizeValue(value.message, patterns, redactString, depth + 1, maxDepth)
        };

        // Include stack in non-production environments
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for process.env index signature
        if (process.env['NODE_ENV'] !== 'production' && value.stack) {
            // biome-ignore lint/complexity/useLiteralKeys: Record type requires bracket notation for TypeScript
            sanitizedError['stack'] = value.stack;
        }

        // Sanitize any additional properties on the error
        for (const key of Object.keys(value)) {
            if (key !== 'name' && key !== 'message' && key !== 'stack') {
                const propValue = (value as unknown as Record<string, unknown>)[key];
                if (isSensitiveField(key, patterns)) {
                    sanitizedError[key] = redactString;
                } else {
                    sanitizedError[key] = sanitizeValue(propValue, patterns, redactString, depth + 1, maxDepth);
                }
            }
        }

        return sanitizedError;
    }

    // Handle plain objects
    const sanitized: Record<string, unknown> = {};
    const record = value as Record<string, unknown>;

    for (const [key, propValue] of Object.entries(record)) {
        if (isSensitiveField(key, patterns)) {
            sanitized[key] = redactString;
        } else {
            sanitized[key] = sanitizeValue(propValue, patterns, redactString, depth + 1, maxDepth);
        }
    }

    return sanitized;
}

/**
 * Redact sensitive data from an error object or any data structure.
 *
 * This function recursively traverses the input and replaces values
 * of sensitive fields with a redaction string. Use this before logging
 * errors or sending error data to external services.
 *
 * @param error - The error or data to sanitize
 * @param options - Sanitization options
 * @returns A sanitized copy of the input with sensitive fields redacted
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   const safeError = qzpayRedactSensitiveError(error);
 *   logger.error('Operation failed', safeError);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom patterns
 * const safeData = qzpayRedactSensitiveError(webhookPayload, {
 *   sensitivePatterns: [/custom_secret/i],
 *   redactString: '***'
 * });
 * ```
 */
export function qzpayRedactSensitiveError(error: unknown, options: QZPaySanitizeErrorOptions = {}): unknown {
    const patterns = options.sensitivePatterns ?? DEFAULT_SENSITIVE_PATTERNS;
    const redactString = options.redactString ?? '[REDACTED]';
    const maxDepth = options.maxDepth ?? 10;

    return sanitizeValue(error, patterns, redactString, 0, maxDepth);
}

/**
 * Create a sanitization function with pre-configured options.
 *
 * Useful when you want to reuse the same sanitization configuration
 * across multiple places in your application.
 *
 * @param defaultOptions - Default options for all sanitization calls
 * @returns A configured sanitization function
 *
 * @example
 * ```typescript
 * const sanitize = qzpayCreateErrorSanitizer({
 *   redactString: '***HIDDEN***'
 * });
 *
 * const safeError = sanitize(error);
 * ```
 */
export function qzpayCreateErrorSanitizer(
    defaultOptions: QZPaySanitizeErrorOptions = {}
): (error: unknown, options?: QZPaySanitizeErrorOptions) => unknown {
    return (error: unknown, options?: QZPaySanitizeErrorOptions) => {
        return qzpayRedactSensitiveError(error, { ...defaultOptions, ...options });
    };
}
