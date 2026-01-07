/**
 * Health Check Service for QZPay
 *
 * Provides health status information for monitoring and diagnostics.
 * Checks connectivity to storage and payment adapters.
 */
import type { QZPayPaymentAdapter } from '../adapters/payment.adapter.js';
import type { QZPayStorageAdapter } from '../adapters/storage.adapter.js';
import type { QZPayLogger } from '../types/logger.types.js';
import { noopLogger } from '../utils/default-logger.js';

/**
 * Component health status
 */
export type QZPayHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual component health check result
 */
export interface QZPayComponentHealth {
    /** Component name */
    name: string;
    /** Health status */
    status: QZPayHealthStatus;
    /** Response time in milliseconds */
    responseTimeMs?: number;
    /** Optional error message if unhealthy */
    error?: string;
    /** Additional details */
    details?: Record<string, unknown>;
}

/**
 * Overall system health status
 */
export interface QZPayHealthReport {
    /** Overall system status */
    status: QZPayHealthStatus;
    /** Timestamp of the health check */
    timestamp: Date;
    /** Version of QZPay (if available) */
    version?: string;
    /** Individual component health statuses */
    components: QZPayComponentHealth[];
    /** Total response time for all checks */
    totalResponseTimeMs: number;
}

/**
 * Health service configuration
 */
export interface QZPayHealthServiceConfig {
    /** Storage adapter to check */
    storage: QZPayStorageAdapter;
    /** Payment adapter to check (optional) */
    paymentAdapter?: QZPayPaymentAdapter;
    /** Logger instance */
    logger?: QZPayLogger;
    /** Timeout for individual health checks in ms */
    timeoutMs?: number;
    /** QZPay version string */
    version?: string;
}

/**
 * Health Service Implementation
 *
 * @example
 * ```typescript
 * const healthService = new QZPayHealthService({
 *   storage: drizzleAdapter,
 *   paymentAdapter: stripeAdapter,
 * });
 *
 * const status = await healthService.getHealthStatus();
 * console.log(status.status); // 'healthy' | 'degraded' | 'unhealthy'
 * ```
 */
export class QZPayHealthService {
    private readonly storage: QZPayStorageAdapter;
    private readonly paymentAdapter: QZPayPaymentAdapter | undefined;
    private readonly logger: QZPayLogger;
    private readonly timeoutMs: number;
    private readonly version: string | undefined;

    constructor(config: QZPayHealthServiceConfig) {
        this.storage = config.storage;
        this.paymentAdapter = config.paymentAdapter;
        this.logger = config.logger ?? noopLogger;
        this.timeoutMs = config.timeoutMs ?? 5000;
        this.version = config.version;
    }

    /**
     * Get the overall health status of the system
     */
    async getHealthStatus(): Promise<QZPayHealthReport> {
        const startTime = Date.now();
        const components: QZPayComponentHealth[] = [];

        this.logger.debug('Starting health check');

        // Check storage health
        const storageHealth = await this.checkStorageHealth();
        components.push(storageHealth);

        // Check payment adapter health if available
        if (this.paymentAdapter) {
            const paymentHealth = await this.checkPaymentAdapterHealth();
            components.push(paymentHealth);
        }

        // Determine overall status
        const hasUnhealthy = components.some((c) => c.status === 'unhealthy');
        const hasDegraded = components.some((c) => c.status === 'degraded');

        let overallStatus: QZPayHealthStatus;
        if (hasUnhealthy) {
            overallStatus = 'unhealthy';
        } else if (hasDegraded) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'healthy';
        }

        const totalResponseTimeMs = Date.now() - startTime;

        const report: QZPayHealthReport = {
            status: overallStatus,
            timestamp: new Date(),
            components,
            totalResponseTimeMs
        };

        if (this.version) {
            report.version = this.version;
        }

        this.logger.info('Health check completed', {
            operation: 'health_check',
            durationMs: totalResponseTimeMs
        });

        return report;
    }

    /**
     * Check if the system is healthy (quick check)
     */
    async isHealthy(): Promise<boolean> {
        const status = await this.getHealthStatus();
        return status.status === 'healthy';
    }

    /**
     * Check storage adapter health
     */
    private async checkStorageHealth(): Promise<QZPayComponentHealth> {
        const startTime = Date.now();

        try {
            // Try to perform a simple query to verify connectivity
            // Using customers.list with limit 1 as a connectivity test
            await Promise.race([this.storage.customers.list({ limit: 1 }), this.createTimeout('Storage health check timed out')]);

            const responseTimeMs = Date.now() - startTime;

            // Warn if response time is high
            const status: QZPayHealthStatus = responseTimeMs > 2000 ? 'degraded' : 'healthy';

            return {
                name: 'storage',
                status,
                responseTimeMs,
                details: {
                    type: 'drizzle'
                }
            };
        } catch (error) {
            const responseTimeMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            this.logger.error('Storage health check failed', {
                operation: 'health_check_storage',
                error,
                durationMs: responseTimeMs
            });

            return {
                name: 'storage',
                status: 'unhealthy',
                responseTimeMs,
                error: errorMessage
            };
        }
    }

    /**
     * Check payment adapter health
     *
     * Uses a probe approach: attempt to retrieve a non-existent customer.
     * - If API returns "not found" error → API is reachable (healthy)
     * - If API returns connection/timeout error → API is down (unhealthy)
     */
    private async checkPaymentAdapterHealth(): Promise<QZPayComponentHealth> {
        const startTime = Date.now();

        if (!this.paymentAdapter) {
            return {
                name: 'payment_adapter',
                status: 'degraded',
                error: 'No payment adapter configured'
            };
        }

        try {
            // Try to retrieve a non-existent customer as a connectivity test
            // The probe ID is designed to never exist but trigger an API call
            const probeId = `qzpay_health_probe_${Date.now()}`;
            await Promise.race([
                this.paymentAdapter.customers.retrieve(probeId).catch((err: Error) => {
                    // "Not found" errors mean the API is reachable - this is expected
                    const errorMsg = err.message.toLowerCase();
                    if (
                        errorMsg.includes('not found') ||
                        errorMsg.includes('no such customer') ||
                        errorMsg.includes('resource not found') ||
                        errorMsg.includes('404') ||
                        errorMsg.includes('does not exist')
                    ) {
                        // API is reachable, the customer just doesn't exist (expected)
                        return { probeSuccess: true };
                    }
                    // Re-throw connection/auth errors
                    throw err;
                }),
                this.createTimeout('Payment adapter health check timed out')
            ]);

            const responseTimeMs = Date.now() - startTime;

            // Warn if response time is high (external API might be slow)
            const status: QZPayHealthStatus = responseTimeMs > 3000 ? 'degraded' : 'healthy';

            return {
                name: 'payment_adapter',
                status,
                responseTimeMs,
                details: {
                    provider: this.paymentAdapter.provider
                }
            };
        } catch (error) {
            const responseTimeMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            this.logger.error('Payment adapter health check failed', {
                operation: 'health_check_payment',
                provider: this.paymentAdapter.provider,
                error,
                durationMs: responseTimeMs
            });

            return {
                name: 'payment_adapter',
                status: 'unhealthy',
                responseTimeMs,
                error: errorMessage,
                details: {
                    provider: this.paymentAdapter.provider
                }
            };
        }
    }

    /**
     * Create a timeout promise
     */
    private createTimeout(message: string): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(message));
            }, this.timeoutMs);
        });
    }
}

/**
 * Create a health service instance
 *
 * @param config Health service configuration
 * @returns QZPayHealthService instance
 *
 * @example
 * ```typescript
 * const healthService = createHealthService({
 *   storage: drizzleAdapter,
 *   paymentAdapter: stripeAdapter,
 *   logger: myLogger,
 * });
 *
 * // Use in an HTTP endpoint
 * app.get('/health', async (c) => {
 *   const status = await healthService.getHealthStatus();
 *   const httpStatus = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;
 *   return c.json(status, httpStatus);
 * });
 * ```
 */
export function createHealthService(config: QZPayHealthServiceConfig): QZPayHealthService {
    return new QZPayHealthService(config);
}
