/**
 * Tests for resilience service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayCircuitBreakerState, QZPayRetryState } from '../../src/index.js';
import {
    QZPAY_RESILIENCE_PRESETS,
    qzpayAdvanceRetryState,
    qzpayAggregateHealthChecks,
    qzpayBulkheadAddToQueue,
    qzpayBulkheadCanAccept,
    qzpayBulkheadCompleteExecution,
    qzpayBulkheadReject,
    qzpayBulkheadStartExecution,
    qzpayCalculateNextDelay,
    qzpayCircuitAllowsRequest,
    qzpayCircuitRecordFailure,
    qzpayCircuitRecordSuccess,
    qzpayCircuitToHalfOpen,
    qzpayCreateBulkheadConfig,
    qzpayCreateBulkheadState,
    qzpayCreateCircuitBreakerConfig,
    qzpayCreateCircuitBreakerState,
    qzpayCreateDeadline,
    qzpayCreateHealthCheckResult,
    qzpayCreateRetryConfig,
    qzpayCreateRetryState,
    qzpayDeadlinePassed,
    qzpayGetCircuitStats,
    qzpayGetRemainingTime,
    qzpayGetRetryDelay,
    qzpayIsRetryableError,
    qzpayShouldRetry,
    qzpayWithFallback
} from '../../src/index.js';

// ==================== Circuit Breaker Tests ====================

describe('Circuit Breaker', () => {
    describe('qzpayCreateCircuitBreakerState', () => {
        it('should create initial state', () => {
            const state = qzpayCreateCircuitBreakerState();

            expect(state.state).toBe('closed');
            expect(state.failures).toBe(0);
            expect(state.successes).toBe(0);
        });
    });

    describe('qzpayCircuitAllowsRequest', () => {
        it('should allow requests when closed', () => {
            const state = qzpayCreateCircuitBreakerState();
            const config = qzpayCreateCircuitBreakerConfig();

            expect(qzpayCircuitAllowsRequest(state, config)).toBe(true);
        });

        it('should block requests when open', () => {
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                state: 'open',
                lastFailureTime: new Date()
            };
            const config = qzpayCreateCircuitBreakerConfig();

            expect(qzpayCircuitAllowsRequest(state, config)).toBe(false);
        });

        it('should allow after reset timeout', () => {
            const pastDate = new Date(Date.now() - 60000);
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                state: 'open',
                lastFailureTime: pastDate
            };
            const config = qzpayCreateCircuitBreakerConfig({ resetTimeout: 30000 });

            expect(qzpayCircuitAllowsRequest(state, config)).toBe(true);
        });
    });

    describe('qzpayCircuitRecordSuccess', () => {
        it('should reset failures when closed', () => {
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                failures: 3
            };
            const config = qzpayCreateCircuitBreakerConfig();

            const newState = qzpayCircuitRecordSuccess(state, config);

            expect(newState.failures).toBe(0);
            expect(newState.totalSuccesses).toBe(1);
        });

        it('should close circuit from half-open after threshold', () => {
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                state: 'half-open',
                successes: 2
            };
            const config = qzpayCreateCircuitBreakerConfig({ successThreshold: 3 });

            const newState = qzpayCircuitRecordSuccess(state, config);

            expect(newState.state).toBe('closed');
        });
    });

    describe('qzpayCircuitRecordFailure', () => {
        it('should increment failures when closed', () => {
            const state = qzpayCreateCircuitBreakerState();
            const config = qzpayCreateCircuitBreakerConfig();

            const newState = qzpayCircuitRecordFailure(state, config);

            expect(newState.failures).toBe(1);
            expect(newState.totalFailures).toBe(1);
        });

        it('should open circuit after threshold', () => {
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                failures: 4
            };
            const config = qzpayCreateCircuitBreakerConfig({ failureThreshold: 5 });

            const newState = qzpayCircuitRecordFailure(state, config);

            expect(newState.state).toBe('open');
        });

        it('should return to open from half-open on failure', () => {
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                state: 'half-open'
            };
            const config = qzpayCreateCircuitBreakerConfig();

            const newState = qzpayCircuitRecordFailure(state, config);

            expect(newState.state).toBe('open');
        });
    });

    describe('qzpayCircuitToHalfOpen', () => {
        it('should transition to half-open', () => {
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                state: 'open',
                failures: 5
            };

            const newState = qzpayCircuitToHalfOpen(state);

            expect(newState.state).toBe('half-open');
            expect(newState.failures).toBe(0);
            expect(newState.successes).toBe(0);
        });
    });

    describe('qzpayGetCircuitStats', () => {
        it('should calculate circuit stats', () => {
            const state: QZPayCircuitBreakerState = {
                ...qzpayCreateCircuitBreakerState(),
                totalRequests: 100,
                totalFailures: 15
            };

            const stats = qzpayGetCircuitStats(state);

            expect(stats.failureRate).toBe(15);
            expect(stats.requestCount).toBe(100);
        });
    });
});

// ==================== Retry Logic Tests ====================

describe('Retry Logic', () => {
    describe('qzpayCreateRetryState', () => {
        it('should create initial retry state', () => {
            const config = qzpayCreateRetryConfig();
            const state = qzpayCreateRetryState(config);

            expect(state.attempt).toBe(0);
            expect(state.exhausted).toBe(false);
        });
    });

    describe('qzpayCalculateNextDelay', () => {
        it('should calculate exponential backoff', () => {
            const config = qzpayCreateRetryConfig({
                initialDelay: 1000,
                backoffMultiplier: 2,
                jitterFactor: 0 // Disable jitter for deterministic test
            });

            expect(qzpayCalculateNextDelay(0, config)).toBe(1000);
            expect(qzpayCalculateNextDelay(1, config)).toBe(2000);
            expect(qzpayCalculateNextDelay(2, config)).toBe(4000);
        });

        it('should cap at max delay', () => {
            const config = qzpayCreateRetryConfig({
                initialDelay: 1000,
                maxDelay: 5000,
                backoffMultiplier: 2,
                jitterFactor: 0 // Disable jitter for deterministic test
            });

            const delay = qzpayCalculateNextDelay(10, config);
            expect(delay).toBeLessThanOrEqual(5000);
        });
    });

    describe('qzpayAdvanceRetryState', () => {
        it('should advance retry state', () => {
            const config = qzpayCreateRetryConfig({ maxRetries: 3 });
            const state = qzpayCreateRetryState(config);

            const newState = qzpayAdvanceRetryState(state, config, 'Connection failed');

            expect(newState.attempt).toBe(1);
            expect(newState.lastError).toBe('Connection failed');
            expect(newState.exhausted).toBe(false);
        });

        it('should mark as exhausted after max retries', () => {
            const config = qzpayCreateRetryConfig({ maxRetries: 2 });
            let state = qzpayCreateRetryState(config);

            state = qzpayAdvanceRetryState(state, config, 'Error');
            state = qzpayAdvanceRetryState(state, config, 'Error');
            state = qzpayAdvanceRetryState(state, config, 'Error');

            expect(state.exhausted).toBe(true);
        });
    });

    describe('qzpayIsRetryableError', () => {
        it('should check retryable errors', () => {
            const config = qzpayCreateRetryConfig({
                retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR']
            });

            expect(qzpayIsRetryableError('TIMEOUT', config)).toBe(true);
            expect(qzpayIsRetryableError('CONNECTION_ERROR', config)).toBe(true);
            expect(qzpayIsRetryableError('VALIDATION_ERROR', config)).toBe(false);
        });

        it('should retry all errors if no filter', () => {
            const config = qzpayCreateRetryConfig({ retryableErrors: [] });

            expect(qzpayIsRetryableError('ANY_ERROR', config)).toBe(true);
        });
    });

    describe('qzpayShouldRetry', () => {
        it('should retry if not exhausted and error is retryable', () => {
            const config = qzpayCreateRetryConfig();
            const state: QZPayRetryState = {
                attempt: 1,
                maxAttempts: 4,
                nextRetryDelay: 2000,
                lastError: null,
                startTime: new Date(),
                exhausted: false
            };

            expect(qzpayShouldRetry(state, 'TIMEOUT', config)).toBe(true);
        });

        it('should not retry if exhausted', () => {
            const config = qzpayCreateRetryConfig();
            const state: QZPayRetryState = {
                attempt: 4,
                maxAttempts: 4,
                nextRetryDelay: 0,
                lastError: null,
                startTime: new Date(),
                exhausted: true
            };

            expect(qzpayShouldRetry(state, 'TIMEOUT', config)).toBe(false);
        });
    });

    describe('qzpayGetRetryDelay', () => {
        it('should get retry delay as date', () => {
            const state: QZPayRetryState = {
                attempt: 1,
                maxAttempts: 4,
                nextRetryDelay: 5000,
                lastError: null,
                startTime: new Date(),
                exhausted: false
            };

            const retryDate = qzpayGetRetryDelay(state);
            const diff = retryDate.getTime() - Date.now();

            expect(diff).toBeGreaterThan(4000);
            expect(diff).toBeLessThan(6000);
        });
    });
});

// ==================== Bulkhead Pattern Tests ====================

describe('Bulkhead Pattern', () => {
    describe('qzpayBulkheadCanAccept', () => {
        it('should accept if below max concurrent', () => {
            const state = qzpayCreateBulkheadState();
            const config = qzpayCreateBulkheadConfig({ maxConcurrent: 10 });

            const result = qzpayBulkheadCanAccept(state, config);

            expect(result.canAccept).toBe(true);
            expect(result.willQueue).toBe(false);
        });

        it('should queue if at max concurrent', () => {
            const state = { ...qzpayCreateBulkheadState(), executing: 10 };
            const config = qzpayCreateBulkheadConfig({ maxConcurrent: 10, maxQueueSize: 100 });

            const result = qzpayBulkheadCanAccept(state, config);

            expect(result.canAccept).toBe(true);
            expect(result.willQueue).toBe(true);
        });

        it('should reject if queue full', () => {
            const state = { ...qzpayCreateBulkheadState(), executing: 10, queued: 100 };
            const config = qzpayCreateBulkheadConfig({ maxConcurrent: 10, maxQueueSize: 100 });

            const result = qzpayBulkheadCanAccept(state, config);

            expect(result.canAccept).toBe(false);
        });
    });

    describe('qzpayBulkheadStartExecution', () => {
        it('should increment executing count', () => {
            const state = qzpayCreateBulkheadState();
            const newState = qzpayBulkheadStartExecution(state);

            expect(newState.executing).toBe(1);
        });

        it('should decrement queue when starting from queue', () => {
            const state = { ...qzpayCreateBulkheadState(), queued: 5 };
            const newState = qzpayBulkheadStartExecution(state, true);

            expect(newState.executing).toBe(1);
            expect(newState.queued).toBe(4);
        });
    });

    describe('qzpayBulkheadCompleteExecution', () => {
        it('should decrement executing and increment completed', () => {
            const state = { ...qzpayCreateBulkheadState(), executing: 5 };
            const newState = qzpayBulkheadCompleteExecution(state);

            expect(newState.executing).toBe(4);
            expect(newState.completed).toBe(1);
        });
    });

    describe('qzpayBulkheadAddToQueue', () => {
        it('should increment queued count', () => {
            const state = qzpayCreateBulkheadState();
            const newState = qzpayBulkheadAddToQueue(state);

            expect(newState.queued).toBe(1);
        });
    });

    describe('qzpayBulkheadReject', () => {
        it('should increment rejected count', () => {
            const state = qzpayCreateBulkheadState();
            const newState = qzpayBulkheadReject(state);

            expect(newState.rejected).toBe(1);
        });
    });
});

// ==================== Health Check Tests ====================

describe('Health Checks', () => {
    describe('qzpayCreateHealthCheckResult', () => {
        it('should create health check result', () => {
            const result = qzpayCreateHealthCheckResult('database', true, 50);

            expect(result.name).toBe('database');
            expect(result.healthy).toBe(true);
            expect(result.status).toBe('up');
            expect(result.responseTime).toBe(50);
        });

        it('should set degraded status', () => {
            const result = qzpayCreateHealthCheckResult('api', true, 100, { status: 'degraded' });

            expect(result.status).toBe('degraded');
        });
    });

    describe('qzpayAggregateHealthChecks', () => {
        it('should aggregate healthy services', () => {
            const results = [qzpayCreateHealthCheckResult('db', true, 50), qzpayCreateHealthCheckResult('api', true, 100)];

            const aggregate = qzpayAggregateHealthChecks(results);

            expect(aggregate.healthy).toBe(true);
            expect(aggregate.status).toBe('up');
        });

        it('should mark degraded if any unhealthy', () => {
            const results = [qzpayCreateHealthCheckResult('db', true, 50), qzpayCreateHealthCheckResult('api', false, 0)];

            const aggregate = qzpayAggregateHealthChecks(results);

            expect(aggregate.healthy).toBe(false);
            expect(aggregate.status).toBe('degraded');
        });

        it('should mark down if all unhealthy', () => {
            const results = [qzpayCreateHealthCheckResult('db', false, 0), qzpayCreateHealthCheckResult('api', false, 0)];

            const aggregate = qzpayAggregateHealthChecks(results);

            expect(aggregate.status).toBe('down');
        });
    });
});

// ==================== Fallback Tests ====================

describe('Fallback', () => {
    describe('qzpayWithFallback', () => {
        it('should return result value on success', () => {
            const result = { success: true, value: 'data' };
            const fallback = { value: 'fallback' };

            expect(qzpayWithFallback(result, fallback)).toBe('data');
        });

        it('should return fallback value on failure', () => {
            const result = { success: false, error: 'Failed' };
            const fallback = { value: 'fallback' };

            expect(qzpayWithFallback(result, fallback)).toBe('fallback');
        });

        it('should call fallback function', () => {
            const result = { success: false, error: 'Failed' };
            const fallback = { fn: () => 'computed' };

            expect(qzpayWithFallback(result, fallback)).toBe('computed');
        });
    });
});

// ==================== Timeout Tests ====================

describe('Timeout Helpers', () => {
    describe('qzpayDeadlinePassed', () => {
        it('should return false before deadline', () => {
            const startTime = new Date();
            const now = new Date(startTime.getTime() + 5000);

            expect(qzpayDeadlinePassed(startTime, 10000, now)).toBe(false);
        });

        it('should return true after deadline', () => {
            const startTime = new Date();
            const now = new Date(startTime.getTime() + 15000);

            expect(qzpayDeadlinePassed(startTime, 10000, now)).toBe(true);
        });
    });

    describe('qzpayGetRemainingTime', () => {
        it('should calculate remaining time', () => {
            const startTime = new Date();
            const now = new Date(startTime.getTime() + 5000);

            const remaining = qzpayGetRemainingTime(startTime, 10000, now);
            expect(remaining).toBe(5000);
        });

        it('should return 0 after deadline', () => {
            const startTime = new Date();
            const now = new Date(startTime.getTime() + 15000);

            const remaining = qzpayGetRemainingTime(startTime, 10000, now);
            expect(remaining).toBe(0);
        });
    });

    describe('qzpayCreateDeadline', () => {
        it('should create deadline', () => {
            const startTime = new Date();
            const deadline = qzpayCreateDeadline(10000, startTime);

            expect(deadline.getTime()).toBe(startTime.getTime() + 10000);
        });
    });
});

// ==================== Presets Tests ====================

describe('Resilience Presets', () => {
    it('should have payment preset', () => {
        expect(QZPAY_RESILIENCE_PRESETS.PAYMENT).toBeDefined();
        expect(QZPAY_RESILIENCE_PRESETS.PAYMENT.circuitBreaker).toBeDefined();
        expect(QZPAY_RESILIENCE_PRESETS.PAYMENT.retry).toBeDefined();
        expect(QZPAY_RESILIENCE_PRESETS.PAYMENT.timeout).toBeDefined();
    });

    it('should have webhook preset', () => {
        expect(QZPAY_RESILIENCE_PRESETS.WEBHOOK).toBeDefined();
    });

    it('should have database preset', () => {
        expect(QZPAY_RESILIENCE_PRESETS.DATABASE).toBeDefined();
    });
});
