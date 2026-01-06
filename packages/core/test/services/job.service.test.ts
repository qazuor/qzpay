/**
 * Tests for job service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayJob, QZPayJobSchedule } from '../../src/index.js';
import {
    QZPAY_CRON_EXPRESSIONS,
    qzpayCalculateAverageJobDuration,
    qzpayCalculateJobQueueStats,
    qzpayCalculateJobSuccessRate,
    qzpayCalculateRetryDelay,
    qzpayCancelJob,
    qzpayCompleteJob,
    qzpayCreateJob,
    qzpayCreateJobSchedule,
    qzpayCreatePaymentRetryJob,
    qzpayCreateRenewalJob,
    qzpayCreateRetryJob,
    qzpayCreateTrialEndingJob,
    qzpayCreateWebhookJob,
    qzpayDisableSchedule,
    qzpayEnableSchedule,
    qzpayFailJob,
    qzpayGetDefaultSchedules,
    qzpayGetJobsByStatus,
    qzpayGetJobsByType,
    qzpayGetNextRetryDate,
    qzpayGetReadyJobs,
    qzpayJobCanRetry,
    qzpayJobIsReady,
    qzpayJobIsTerminal,
    qzpayRescheduleJob,
    qzpaySortJobsByPriority,
    qzpayStartJob
} from '../../src/index.js';

// ==================== Test Fixtures ====================

function createJob(overrides: Partial<QZPayJob> = {}): QZPayJob {
    const now = new Date();
    return {
        id: 'job_123',
        type: 'subscription_renewal',
        name: 'Test Job',
        priority: 'normal',
        status: 'pending',
        payload: {},
        scheduledAt: now,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        result: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

// ==================== Job Creation Tests ====================

describe('Job Creation', () => {
    describe('qzpayCreateJob', () => {
        it('should create job with defaults', () => {
            const job = qzpayCreateJob({
                type: 'subscription_renewal',
                name: 'Renew subscription'
            });

            expect(job.id).toMatch(/^job_/);
            expect(job.type).toBe('subscription_renewal');
            expect(job.status).toBe('pending');
            expect(job.priority).toBe('normal');
            expect(job.maxAttempts).toBe(3);
        });

        it('should set scheduled status for future jobs', () => {
            const futureDate = new Date(Date.now() + 60000);
            const job = qzpayCreateJob({
                type: 'subscription_renewal',
                name: 'Test',
                scheduledAt: futureDate
            });

            expect(job.status).toBe('scheduled');
        });

        it('should accept custom priority', () => {
            const job = qzpayCreateJob({
                type: 'webhook_delivery',
                name: 'Test',
                priority: 'high'
            });

            expect(job.priority).toBe('high');
        });
    });

    describe('qzpayCreateRenewalJob', () => {
        it('should create renewal job', () => {
            const renewalDate = new Date(Date.now() + 86400000);
            const job = qzpayCreateRenewalJob('sub_123', renewalDate);

            expect(job.type).toBe('subscription_renewal');
            expect(job.priority).toBe('high');
            expect(job.payload.subscriptionId).toBe('sub_123');
            expect(job.maxAttempts).toBe(5);
        });
    });

    describe('qzpayCreateTrialEndingJob', () => {
        it('should create trial ending job with default warning', () => {
            const trialEnd = new Date(Date.now() + 5 * 86400000);
            const job = qzpayCreateTrialEndingJob('sub_123', trialEnd);

            expect(job.type).toBe('subscription_trial_ending');
            expect(job.payload.subscriptionId).toBe('sub_123');
            expect(job.payload.daysBeforeNotify).toBe(3);
        });

        it('should schedule notification before trial end', () => {
            const trialEnd = new Date(Date.now() + 5 * 86400000);
            const job = qzpayCreateTrialEndingJob('sub_123', trialEnd, 3);
            const expectedSchedule = new Date(trialEnd.getTime() - 3 * 86400000);

            const diff = Math.abs(job.scheduledAt.getTime() - expectedSchedule.getTime());
            expect(diff).toBeLessThan(1000);
        });
    });

    describe('qzpayCreatePaymentRetryJob', () => {
        it('should create payment retry job', () => {
            const retryAt = new Date(Date.now() + 3600000);
            const job = qzpayCreatePaymentRetryJob('pay_123', retryAt, 2);

            expect(job.type).toBe('payment_retry');
            expect(job.priority).toBe('high');
            expect(job.payload.paymentId).toBe('pay_123');
            expect(job.payload.attemptNumber).toBe(2);
            expect(job.maxAttempts).toBe(1);
        });
    });

    describe('qzpayCreateWebhookJob', () => {
        it('should create webhook delivery job', () => {
            const job = qzpayCreateWebhookJob('wh_123', 'https://example.com/webhook', { event: 'test' });

            expect(job.type).toBe('webhook_delivery');
            expect(job.priority).toBe('high');
            expect(job.payload.webhookId).toBe('wh_123');
            expect(job.payload.url).toBe('https://example.com/webhook');
            expect(job.maxAttempts).toBe(5);
        });
    });
});

// ==================== Job Status Tests ====================

describe('Job Status', () => {
    describe('qzpayStartJob', () => {
        it('should mark job as running', () => {
            const job = createJob();
            const started = qzpayStartJob(job);

            expect(started.status).toBe('running');
            expect(started.startedAt).toBeInstanceOf(Date);
            expect(started.attempts).toBe(1);
        });
    });

    describe('qzpayCompleteJob', () => {
        it('should mark job as completed', () => {
            const job = createJob({ status: 'running' });
            const completed = qzpayCompleteJob(job, { success: true });

            expect(completed.status).toBe('completed');
            expect(completed.completedAt).toBeInstanceOf(Date);
            expect(completed.result).toEqual({ success: true });
        });
    });

    describe('qzpayFailJob', () => {
        it('should mark job as pending for retry if attempts remain', () => {
            const job = createJob({ attempts: 1, maxAttempts: 3 });
            const failed = qzpayFailJob(job, 'Error occurred');

            expect(failed.status).toBe('pending');
            expect(failed.lastError).toBe('Error occurred');
        });

        it('should mark job as failed if max attempts reached', () => {
            const job = createJob({ attempts: 3, maxAttempts: 3 });
            const failed = qzpayFailJob(job, 'Error occurred');

            expect(failed.status).toBe('failed');
            expect(failed.failedAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayCancelJob', () => {
        it('should mark job as canceled', () => {
            const job = createJob();
            const canceled = qzpayCancelJob(job);

            expect(canceled.status).toBe('canceled');
        });
    });

    describe('qzpayRescheduleJob', () => {
        it('should reschedule job', () => {
            const job = createJob();
            const newDate = new Date(Date.now() + 3600000);
            const rescheduled = qzpayRescheduleJob(job, newDate);

            expect(rescheduled.status).toBe('scheduled');
            expect(rescheduled.scheduledAt).toBe(newDate);
        });
    });
});

// ==================== Job Query Tests ====================

describe('Job Queries', () => {
    describe('qzpayJobIsReady', () => {
        it('should return true for pending job with past schedule', () => {
            const pastDate = new Date(Date.now() - 1000);
            const job = createJob({ status: 'pending', scheduledAt: pastDate });

            expect(qzpayJobIsReady(job)).toBe(true);
        });

        it('should return false for future scheduled job', () => {
            const futureDate = new Date(Date.now() + 60000);
            const job = createJob({ status: 'scheduled', scheduledAt: futureDate });

            expect(qzpayJobIsReady(job)).toBe(false);
        });

        it('should return false for running job', () => {
            const job = createJob({ status: 'running' });
            expect(qzpayJobIsReady(job)).toBe(false);
        });
    });

    describe('qzpayJobCanRetry', () => {
        it('should return true if attempts below max', () => {
            const job = createJob({ attempts: 1, maxAttempts: 3 });
            expect(qzpayJobCanRetry(job)).toBe(true);
        });

        it('should return false if max attempts reached', () => {
            const job = createJob({ attempts: 3, maxAttempts: 3 });
            expect(qzpayJobCanRetry(job)).toBe(false);
        });
    });

    describe('qzpayJobIsTerminal', () => {
        it('should return true for completed job', () => {
            const job = createJob({ status: 'completed' });
            expect(qzpayJobIsTerminal(job)).toBe(true);
        });

        it('should return true for failed job', () => {
            const job = createJob({ status: 'failed' });
            expect(qzpayJobIsTerminal(job)).toBe(true);
        });

        it('should return false for running job', () => {
            const job = createJob({ status: 'running' });
            expect(qzpayJobIsTerminal(job)).toBe(false);
        });
    });

    describe('qzpayGetReadyJobs', () => {
        it('should filter ready jobs', () => {
            const jobs = [
                createJob({ status: 'pending', scheduledAt: new Date(Date.now() - 1000) }),
                createJob({ status: 'scheduled', scheduledAt: new Date(Date.now() + 60000) }),
                createJob({ status: 'running' })
            ];

            const ready = qzpayGetReadyJobs(jobs);
            expect(ready).toHaveLength(1);
        });
    });

    describe('qzpayGetJobsByType', () => {
        it('should filter jobs by type', () => {
            const jobs = [
                createJob({ type: 'subscription_renewal' }),
                createJob({ type: 'webhook_delivery' }),
                createJob({ type: 'subscription_renewal' })
            ];

            const renewals = qzpayGetJobsByType(jobs, 'subscription_renewal');
            expect(renewals).toHaveLength(2);
        });
    });

    describe('qzpayGetJobsByStatus', () => {
        it('should filter jobs by status', () => {
            const jobs = [createJob({ status: 'pending' }), createJob({ status: 'running' }), createJob({ status: 'pending' })];

            const pending = qzpayGetJobsByStatus(jobs, 'pending');
            expect(pending).toHaveLength(2);
        });
    });

    describe('qzpaySortJobsByPriority', () => {
        it('should sort jobs by priority', () => {
            const jobs = [
                createJob({ priority: 'low' }),
                createJob({ priority: 'critical' }),
                createJob({ priority: 'normal' }),
                createJob({ priority: 'high' })
            ];

            const sorted = qzpaySortJobsByPriority(jobs);

            expect(sorted[0]?.priority).toBe('critical');
            expect(sorted[1]?.priority).toBe('high');
            expect(sorted[2]?.priority).toBe('normal');
            expect(sorted[3]?.priority).toBe('low');
        });
    });
});

// ==================== Retry Logic Tests ====================

describe('Job Retry Logic', () => {
    describe('qzpayCalculateRetryDelay', () => {
        it('should calculate exponential backoff', () => {
            // Note: Formula is baseDelay * 2^(attempt-1), so attempt 1 = base, attempt 2 = 2x, etc.
            const delay1 = qzpayCalculateRetryDelay(1, 1000, 60000, 0);
            const delay2 = qzpayCalculateRetryDelay(2, 1000, 60000, 0);
            const delay3 = qzpayCalculateRetryDelay(3, 1000, 60000, 0);

            expect(delay1).toBe(1000);
            expect(delay2).toBe(2000);
            expect(delay3).toBe(4000);
        });

        it('should cap at max delay', () => {
            const delay = qzpayCalculateRetryDelay(10, 1000, 5000, 0);
            expect(delay).toBeLessThanOrEqual(5000);
        });

        it('should add jitter', () => {
            // With attempt=1 and base=1000, delay is 1000 * 2^0 = 1000
            // With 10% jitter: range is 900-1100
            const delay1 = qzpayCalculateRetryDelay(1, 1000, 60000, 0.1);

            // With jitter, delays should be within jitter range of base delay
            expect(delay1).toBeGreaterThanOrEqual(900);
            expect(delay1).toBeLessThanOrEqual(1100);
        });
    });

    describe('qzpayGetNextRetryDate', () => {
        it('should calculate future retry date', () => {
            const now = new Date();
            const retryDate = qzpayGetNextRetryDate(1, now);

            expect(retryDate.getTime()).toBeGreaterThan(now.getTime());
        });
    });

    describe('qzpayCreateRetryJob', () => {
        it('should create retry job', () => {
            const failedJob = createJob({ attempts: 1, maxAttempts: 3 });
            const retryJob = qzpayCreateRetryJob(failedJob);

            expect(retryJob).toBeTruthy();
            expect(retryJob?.status).toBe('scheduled');
        });

        it('should return null if max retries reached', () => {
            const failedJob = createJob({ attempts: 3, maxAttempts: 3 });
            const retryJob = qzpayCreateRetryJob(failedJob);

            expect(retryJob).toBeNull();
        });
    });
});

// ==================== Schedule Tests ====================

describe('Job Schedules', () => {
    describe('qzpayCreateJobSchedule', () => {
        it('should create schedule', () => {
            const schedule = qzpayCreateJobSchedule('subscription_renewal', 'Renew subscriptions', '0 0 * * *');

            expect(schedule.id).toMatch(/^sched_/);
            expect(schedule.type).toBe('subscription_renewal');
            expect(schedule.cronExpression).toBe('0 0 * * *');
            expect(schedule.enabled).toBe(true);
        });
    });

    describe('qzpayEnableSchedule', () => {
        it('should enable schedule', () => {
            const schedule: QZPayJobSchedule = {
                id: 'sched_123',
                type: 'cleanup',
                name: 'Cleanup',
                cronExpression: '0 0 * * *',
                timezone: 'UTC',
                enabled: false,
                payload: {},
                lastRunAt: null,
                nextRunAt: null,
                metadata: {}
            };

            const enabled = qzpayEnableSchedule(schedule);
            expect(enabled.enabled).toBe(true);
        });
    });

    describe('qzpayDisableSchedule', () => {
        it('should disable schedule', () => {
            const schedule: QZPayJobSchedule = {
                id: 'sched_123',
                type: 'cleanup',
                name: 'Cleanup',
                cronExpression: '0 0 * * *',
                timezone: 'UTC',
                enabled: true,
                payload: {},
                lastRunAt: null,
                nextRunAt: null,
                metadata: {}
            };

            const disabled = qzpayDisableSchedule(schedule);
            expect(disabled.enabled).toBe(false);
        });
    });

    describe('qzpayGetDefaultSchedules', () => {
        it('should return default schedules', () => {
            const schedules = qzpayGetDefaultSchedules();

            expect(schedules.length).toBeGreaterThan(0);
            expect(schedules.some((s) => s.type === 'subscription_renewal')).toBe(true);
            expect(schedules.some((s) => s.type === 'payment_retry')).toBe(true);
        });
    });
});

// ==================== Stats Tests ====================

describe('Job Statistics', () => {
    describe('qzpayCalculateJobQueueStats', () => {
        it('should calculate queue stats', () => {
            const jobs = [
                createJob({ status: 'pending' }),
                createJob({ status: 'running' }),
                createJob({ status: 'completed' }),
                createJob({ status: 'failed' }),
                createJob({ status: 'pending' })
            ];

            const stats = qzpayCalculateJobQueueStats(jobs);

            expect(stats.pending).toBe(2);
            expect(stats.running).toBe(1);
            expect(stats.completed).toBe(1);
            expect(stats.failed).toBe(1);
        });
    });

    describe('qzpayCalculateAverageJobDuration', () => {
        it('should calculate average duration', () => {
            const now = new Date();
            const jobs = [
                createJob({
                    status: 'completed',
                    startedAt: new Date(now.getTime() - 5000),
                    completedAt: now
                }),
                createJob({
                    status: 'completed',
                    startedAt: new Date(now.getTime() - 3000),
                    completedAt: now
                })
            ];

            const avgDuration = qzpayCalculateAverageJobDuration(jobs);
            expect(avgDuration).toBe(4000);
        });

        it('should return 0 for no completed jobs', () => {
            const jobs = [createJob({ status: 'pending' })];
            const avgDuration = qzpayCalculateAverageJobDuration(jobs);
            expect(avgDuration).toBe(0);
        });
    });

    describe('qzpayCalculateJobSuccessRate', () => {
        it('should calculate success rate', () => {
            const jobs = [
                createJob({ status: 'completed' }),
                createJob({ status: 'completed' }),
                createJob({ status: 'failed' }),
                createJob({ status: 'pending' }) // Not counted
            ];

            const rate = qzpayCalculateJobSuccessRate(jobs);
            expect(rate).toBeCloseTo(66.67, 1);
        });

        it('should return 0 for no terminal jobs', () => {
            const jobs = [createJob({ status: 'pending' })];
            const rate = qzpayCalculateJobSuccessRate(jobs);
            expect(rate).toBe(0);
        });
    });
});

// ==================== Cron Expressions Tests ====================

describe('Cron Expressions', () => {
    it('should have common cron expressions', () => {
        expect(QZPAY_CRON_EXPRESSIONS.EVERY_MINUTE).toBe('* * * * *');
        expect(QZPAY_CRON_EXPRESSIONS.EVERY_HOUR).toBe('0 * * * *');
        expect(QZPAY_CRON_EXPRESSIONS.DAILY_MIDNIGHT).toBe('0 0 * * *');
        expect(QZPAY_CRON_EXPRESSIONS.MONTHLY_FIRST).toBe('0 0 1 * *');
    });
});
