/**
 * Resilience service helpers for QZPay
 *
 * Provides utilities for circuit breaker pattern, retry logic,
 * timeout handling, and fault tolerance.
 */

// ==================== Types ====================

/**
 * Circuit breaker state
 */
export type QZPayCircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface QZPayCircuitBreakerConfig {
    /** Failure threshold to open circuit */
    failureThreshold: number;
    /** Success threshold to close circuit (from half-open) */
    successThreshold: number;
    /** Time in ms before attempting half-open */
    resetTimeout: number;
    /** Optional name for identification */
    name?: string;
}

/**
 * Circuit breaker state data
 */
export interface QZPayCircuitBreakerState {
    state: QZPayCircuitState;
    failures: number;
    successes: number;
    lastFailureTime: Date | null;
    lastStateChange: Date;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
}

/**
 * Retry configuration
 */
export interface QZPayRetryConfig {
    /** Maximum number of retries */
    maxRetries: number;
    /** Initial delay in ms */
    initialDelay: number;
    /** Maximum delay in ms */
    maxDelay: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
    /** Jitter factor (0-1) */
    jitterFactor: number;
    /** Retryable error codes/types */
    retryableErrors?: string[];
}

/**
 * Retry state
 */
export interface QZPayRetryState {
    attempt: number;
    maxAttempts: number;
    nextRetryDelay: number;
    lastError: string | null;
    startTime: Date;
    exhausted: boolean;
}

/**
 * Timeout configuration
 */
export interface QZPayTimeoutConfig {
    /** Operation timeout in ms */
    timeout: number;
    /** Optional message on timeout */
    message?: string;
}

/**
 * Bulkhead configuration
 */
export interface QZPayBulkheadConfig {
    /** Maximum concurrent executions */
    maxConcurrent: number;
    /** Maximum queue size */
    maxQueueSize: number;
    /** Queue timeout in ms */
    queueTimeout: number;
}

/**
 * Bulkhead state
 */
export interface QZPayBulkheadState {
    executing: number;
    queued: number;
    rejected: number;
    completed: number;
}

/**
 * Health check result
 */
export interface QZPayHealthCheckResult {
    healthy: boolean;
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime: number;
    lastChecked: Date;
    message?: string;
    details?: Record<string, unknown>;
}

// ==================== Circuit Breaker ====================

/**
 * Create circuit breaker configuration
 */
export function qzpayCreateCircuitBreakerConfig(overrides: Partial<QZPayCircuitBreakerConfig> = {}): QZPayCircuitBreakerConfig {
    return {
        failureThreshold: 5,
        successThreshold: 3,
        resetTimeout: 30000, // 30 seconds
        ...overrides
    };
}

/**
 * Create initial circuit breaker state
 */
export function qzpayCreateCircuitBreakerState(): QZPayCircuitBreakerState {
    return {
        state: 'closed',
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        lastStateChange: new Date(),
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0
    };
}

/**
 * Check if circuit allows request
 */
export function qzpayCircuitAllowsRequest(
    state: QZPayCircuitBreakerState,
    config: QZPayCircuitBreakerConfig,
    now: Date = new Date()
): boolean {
    switch (state.state) {
        case 'closed':
            return true;

        case 'open':
            // Check if reset timeout has passed
            if (state.lastFailureTime) {
                const timeSinceFailure = now.getTime() - state.lastFailureTime.getTime();
                return timeSinceFailure >= config.resetTimeout;
            }
            return false;

        case 'half-open':
            return true;

        default:
            return false;
    }
}

/**
 * Record successful request
 */
export function qzpayCircuitRecordSuccess(state: QZPayCircuitBreakerState, config: QZPayCircuitBreakerConfig): QZPayCircuitBreakerState {
    const newState = {
        ...state,
        totalRequests: state.totalRequests + 1,
        totalSuccesses: state.totalSuccesses + 1
    };

    switch (state.state) {
        case 'closed':
            return {
                ...newState,
                failures: 0,
                successes: state.successes + 1
            };

        case 'half-open': {
            const newSuccesses = state.successes + 1;
            if (newSuccesses >= config.successThreshold) {
                // Close the circuit
                return {
                    ...newState,
                    state: 'closed',
                    failures: 0,
                    successes: 0,
                    lastStateChange: new Date()
                };
            }
            return {
                ...newState,
                successes: newSuccesses
            };
        }

        default:
            return newState;
    }
}

/**
 * Record failed request
 */
export function qzpayCircuitRecordFailure(state: QZPayCircuitBreakerState, config: QZPayCircuitBreakerConfig): QZPayCircuitBreakerState {
    const now = new Date();
    const newState = {
        ...state,
        totalRequests: state.totalRequests + 1,
        totalFailures: state.totalFailures + 1,
        lastFailureTime: now
    };

    switch (state.state) {
        case 'closed': {
            const newFailures = state.failures + 1;
            if (newFailures >= config.failureThreshold) {
                // Open the circuit
                return {
                    ...newState,
                    state: 'open',
                    failures: newFailures,
                    successes: 0,
                    lastStateChange: now
                };
            }
            return {
                ...newState,
                failures: newFailures
            };
        }

        case 'half-open':
            // Back to open
            return {
                ...newState,
                state: 'open',
                failures: 1,
                successes: 0,
                lastStateChange: now
            };

        case 'open':
            return {
                ...newState,
                failures: state.failures + 1
            };

        default:
            return newState;
    }
}

/**
 * Transition circuit to half-open (for testing after timeout)
 */
export function qzpayCircuitToHalfOpen(state: QZPayCircuitBreakerState): QZPayCircuitBreakerState {
    if (state.state !== 'open') {
        return state;
    }

    return {
        ...state,
        state: 'half-open',
        failures: 0,
        successes: 0,
        lastStateChange: new Date()
    };
}

/**
 * Get circuit breaker statistics
 */
export function qzpayGetCircuitStats(state: QZPayCircuitBreakerState): {
    state: QZPayCircuitState;
    failureRate: number;
    requestCount: number;
    uptime: number;
} {
    const failureRate = state.totalRequests > 0 ? (state.totalFailures / state.totalRequests) * 100 : 0;

    const uptime = Date.now() - state.lastStateChange.getTime();

    return {
        state: state.state,
        failureRate: Math.round(failureRate * 100) / 100,
        requestCount: state.totalRequests,
        uptime
    };
}

// ==================== Retry Logic ====================

/**
 * Create retry configuration
 */
export function qzpayCreateRetryConfig(overrides: Partial<QZPayRetryConfig> = {}): QZPayRetryConfig {
    return {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
        retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'SERVICE_UNAVAILABLE'],
        ...overrides
    };
}

/**
 * Create initial retry state
 */
export function qzpayCreateRetryState(config: QZPayRetryConfig): QZPayRetryState {
    return {
        attempt: 0,
        maxAttempts: config.maxRetries + 1,
        nextRetryDelay: config.initialDelay,
        lastError: null,
        startTime: new Date(),
        exhausted: false
    };
}

/**
 * Calculate next retry delay with exponential backoff
 */
export function qzpayCalculateNextDelay(attempt: number, config: QZPayRetryConfig): number {
    // Exponential backoff
    const exponentialDelay = config.initialDelay * config.backoffMultiplier ** attempt;

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    // Add jitter
    const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

    return Math.round(cappedDelay + jitter);
}

/**
 * Advance retry state after failure
 */
export function qzpayAdvanceRetryState(state: QZPayRetryState, config: QZPayRetryConfig, error: string): QZPayRetryState {
    const newAttempt = state.attempt + 1;
    const exhausted = newAttempt >= state.maxAttempts;

    return {
        ...state,
        attempt: newAttempt,
        nextRetryDelay: exhausted ? 0 : qzpayCalculateNextDelay(newAttempt, config),
        lastError: error,
        exhausted
    };
}

/**
 * Check if error is retryable
 */
export function qzpayIsRetryableError(error: string, config: QZPayRetryConfig): boolean {
    if (!config.retryableErrors || config.retryableErrors.length === 0) {
        return true; // Retry all errors if no filter specified
    }

    return config.retryableErrors.some((re) => error.includes(re));
}

/**
 * Check if should retry
 */
export function qzpayShouldRetry(state: QZPayRetryState, error: string, config: QZPayRetryConfig): boolean {
    if (state.exhausted) {
        return false;
    }

    return qzpayIsRetryableError(error, config);
}

/**
 * Get retry delay for next attempt
 */
export function qzpayGetRetryDelay(state: QZPayRetryState): Date {
    return new Date(Date.now() + state.nextRetryDelay);
}

// ==================== Bulkhead Pattern ====================

/**
 * Create bulkhead configuration
 */
export function qzpayCreateBulkheadConfig(overrides: Partial<QZPayBulkheadConfig> = {}): QZPayBulkheadConfig {
    return {
        maxConcurrent: 10,
        maxQueueSize: 100,
        queueTimeout: 10000,
        ...overrides
    };
}

/**
 * Create bulkhead state
 */
export function qzpayCreateBulkheadState(): QZPayBulkheadState {
    return {
        executing: 0,
        queued: 0,
        rejected: 0,
        completed: 0
    };
}

/**
 * Check if bulkhead can accept request
 */
export function qzpayBulkheadCanAccept(
    state: QZPayBulkheadState,
    config: QZPayBulkheadConfig
): {
    canAccept: boolean;
    willQueue: boolean;
    reason?: string;
} {
    // Can execute immediately
    if (state.executing < config.maxConcurrent) {
        return { canAccept: true, willQueue: false };
    }

    // Can queue
    if (state.queued < config.maxQueueSize) {
        return { canAccept: true, willQueue: true };
    }

    // Reject
    return {
        canAccept: false,
        willQueue: false,
        reason: 'Bulkhead at capacity'
    };
}

/**
 * Start execution in bulkhead
 */
export function qzpayBulkheadStartExecution(state: QZPayBulkheadState, fromQueue = false): QZPayBulkheadState {
    return {
        ...state,
        executing: state.executing + 1,
        queued: fromQueue ? state.queued - 1 : state.queued
    };
}

/**
 * Complete execution in bulkhead
 */
export function qzpayBulkheadCompleteExecution(state: QZPayBulkheadState): QZPayBulkheadState {
    return {
        ...state,
        executing: Math.max(0, state.executing - 1),
        completed: state.completed + 1
    };
}

/**
 * Add to bulkhead queue
 */
export function qzpayBulkheadAddToQueue(state: QZPayBulkheadState): QZPayBulkheadState {
    return {
        ...state,
        queued: state.queued + 1
    };
}

/**
 * Reject from bulkhead
 */
export function qzpayBulkheadReject(state: QZPayBulkheadState): QZPayBulkheadState {
    return {
        ...state,
        rejected: state.rejected + 1
    };
}

// ==================== Health Check ====================

/**
 * Create health check result
 */
export function qzpayCreateHealthCheckResult(
    name: string,
    healthy: boolean,
    responseTime: number,
    options: {
        status?: QZPayHealthCheckResult['status'];
        message?: string;
        details?: Record<string, unknown>;
    } = {}
): QZPayHealthCheckResult {
    return {
        healthy,
        name,
        status: options.status ?? (healthy ? 'up' : 'down'),
        responseTime,
        lastChecked: new Date(),
        ...(options.message !== undefined && { message: options.message }),
        ...(options.details !== undefined && { details: options.details })
    };
}

/**
 * Aggregate health check results
 */
export function qzpayAggregateHealthChecks(results: QZPayHealthCheckResult[]): QZPayHealthCheckResult {
    const allHealthy = results.every((r) => r.healthy);
    const anyUp = results.some((r) => r.status === 'up');
    const avgResponseTime = results.length > 0 ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length : 0;

    let status: QZPayHealthCheckResult['status'];
    if (allHealthy) {
        status = 'up';
    } else if (anyUp) {
        status = 'degraded';
    } else {
        status = 'down';
    }

    const unhealthyServices = results.filter((r) => !r.healthy).map((r) => r.name);

    return {
        healthy: allHealthy,
        name: 'aggregate',
        status,
        responseTime: Math.round(avgResponseTime),
        lastChecked: new Date(),
        message: allHealthy ? 'All services healthy' : `Unhealthy: ${unhealthyServices.join(', ')}`,
        details: {
            total: results.length,
            healthy: results.filter((r) => r.healthy).length,
            unhealthy: unhealthyServices.length,
            services: results.map((r) => ({ name: r.name, status: r.status }))
        }
    };
}

// ==================== Fallback ====================

/**
 * Fallback configuration
 */
export interface QZPayFallbackConfig<T> {
    /** Static fallback value */
    value?: T;
    /** Fallback function */
    fn?: () => T;
    /** Whether to cache fallback result */
    cache?: boolean;
}

/**
 * Execute with fallback
 */
export function qzpayWithFallback<T>(
    result: { success: boolean; value?: T; error?: string },
    fallback: QZPayFallbackConfig<T>
): T | undefined {
    if (result.success && result.value !== undefined) {
        return result.value;
    }

    if (fallback.fn) {
        return fallback.fn();
    }

    return fallback.value;
}

// ==================== Timeout Helpers ====================

/**
 * Create timeout configuration
 */
export function qzpayCreateTimeoutConfig(overrides: Partial<QZPayTimeoutConfig> = {}): QZPayTimeoutConfig {
    return {
        timeout: 30000, // 30 seconds
        message: 'Operation timed out',
        ...overrides
    };
}

/**
 * Check if deadline has passed
 */
export function qzpayDeadlinePassed(startTime: Date, timeout: number, now: Date = new Date()): boolean {
    return now.getTime() - startTime.getTime() >= timeout;
}

/**
 * Get remaining time until deadline
 */
export function qzpayGetRemainingTime(startTime: Date, timeout: number, now: Date = new Date()): number {
    const elapsed = now.getTime() - startTime.getTime();
    return Math.max(0, timeout - elapsed);
}

/**
 * Create deadline from timeout
 */
export function qzpayCreateDeadline(timeout: number, startTime: Date = new Date()): Date {
    return new Date(startTime.getTime() + timeout);
}

// ==================== Common Resilience Presets ====================

/**
 * Preset configurations for common scenarios
 */
export const QZPAY_RESILIENCE_PRESETS = {
    /** Payment processing - high reliability */
    PAYMENT: {
        circuitBreaker: qzpayCreateCircuitBreakerConfig({
            failureThreshold: 3,
            successThreshold: 2,
            resetTimeout: 60000
        }),
        retry: qzpayCreateRetryConfig({
            maxRetries: 3,
            initialDelay: 2000,
            maxDelay: 30000
        }),
        timeout: qzpayCreateTimeoutConfig({ timeout: 30000 })
    },
    /** Webhook delivery - many retries */
    WEBHOOK: {
        circuitBreaker: qzpayCreateCircuitBreakerConfig({
            failureThreshold: 10,
            successThreshold: 5,
            resetTimeout: 30000
        }),
        retry: qzpayCreateRetryConfig({
            maxRetries: 5,
            initialDelay: 1000,
            maxDelay: 60000
        }),
        timeout: qzpayCreateTimeoutConfig({ timeout: 10000 })
    },
    /** Database operations - quick failures */
    DATABASE: {
        circuitBreaker: qzpayCreateCircuitBreakerConfig({
            failureThreshold: 5,
            successThreshold: 3,
            resetTimeout: 10000
        }),
        retry: qzpayCreateRetryConfig({
            maxRetries: 2,
            initialDelay: 100,
            maxDelay: 1000
        }),
        timeout: qzpayCreateTimeoutConfig({ timeout: 5000 })
    }
} as const;
