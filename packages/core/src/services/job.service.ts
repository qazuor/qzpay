/**
 * Job scheduling service helpers for QZPay
 *
 * Provides utilities for scheduling, managing, and executing
 * background jobs for billing operations.
 */
import { qzpayGenerateId } from '../utils/hash.utils.js';

// ==================== Types ====================

/**
 * Job types for billing operations
 */
export type QZPayJobType =
    | 'subscription_renewal'
    | 'subscription_trial_ending'
    | 'subscription_cancel'
    | 'invoice_generation'
    | 'invoice_reminder'
    | 'payment_retry'
    | 'payment_method_expiry'
    | 'webhook_delivery'
    | 'webhook_retry'
    | 'payout_processing'
    | 'usage_aggregation'
    | 'cleanup'
    | 'custom';

/**
 * Job status
 */
export type QZPayJobStatus = 'pending' | 'scheduled' | 'running' | 'completed' | 'failed' | 'canceled';

/**
 * Job priority
 */
export type QZPayJobPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Job record
 */
export interface QZPayJob {
    id: string;
    type: QZPayJobType;
    name: string;
    priority: QZPayJobPriority;
    status: QZPayJobStatus;
    payload: Record<string, unknown>;
    scheduledAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    result: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Job schedule configuration
 */
export interface QZPayJobSchedule {
    id: string;
    type: QZPayJobType;
    name: string;
    cronExpression: string;
    timezone: string;
    enabled: boolean;
    payload: Record<string, unknown>;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    metadata: Record<string, unknown>;
}

/**
 * Job input
 */
export interface QZPayCreateJobInput {
    type: QZPayJobType;
    name: string;
    priority?: QZPayJobPriority;
    payload?: Record<string, unknown>;
    scheduledAt?: Date;
    maxAttempts?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Job execution result
 */
export interface QZPayJobExecutionResult {
    success: boolean;
    duration: number;
    result?: Record<string, unknown>;
    error?: string;
}

/**
 * Job queue stats
 */
export interface QZPayJobQueueStats {
    pending: number;
    scheduled: number;
    running: number;
    completed: number;
    failed: number;
    canceled: number;
}

// ==================== Creation Helpers ====================

/**
 * Create a new job
 */
export function qzpayCreateJob(input: QZPayCreateJobInput): QZPayJob {
    const now = new Date();
    return {
        id: qzpayGenerateId('job'),
        type: input.type,
        name: input.name,
        priority: input.priority ?? 'normal',
        status: input.scheduledAt && input.scheduledAt > now ? 'scheduled' : 'pending',
        payload: input.payload ?? {},
        scheduledAt: input.scheduledAt ?? now,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        lastError: null,
        result: null,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Create subscription renewal job
 */
export function qzpayCreateRenewalJob(subscriptionId: string, renewalDate: Date, metadata?: Record<string, unknown>): QZPayJob {
    return qzpayCreateJob({
        type: 'subscription_renewal',
        name: `Renew subscription ${subscriptionId}`,
        priority: 'high',
        payload: { subscriptionId },
        scheduledAt: renewalDate,
        maxAttempts: 5,
        ...(metadata !== undefined && { metadata })
    });
}

/**
 * Create trial ending reminder job
 */
export function qzpayCreateTrialEndingJob(subscriptionId: string, trialEndDate: Date, daysBeforeNotify = 3): QZPayJob {
    const notifyDate = new Date(trialEndDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeNotify);

    return qzpayCreateJob({
        type: 'subscription_trial_ending',
        name: `Trial ending reminder for ${subscriptionId}`,
        priority: 'normal',
        payload: { subscriptionId, trialEndDate: trialEndDate.toISOString(), daysBeforeNotify },
        scheduledAt: notifyDate
    });
}

/**
 * Create payment retry job
 */
export function qzpayCreatePaymentRetryJob(paymentId: string, retryAt: Date, attemptNumber: number): QZPayJob {
    return qzpayCreateJob({
        type: 'payment_retry',
        name: `Retry payment ${paymentId} (attempt ${attemptNumber})`,
        priority: 'high',
        payload: { paymentId, attemptNumber },
        scheduledAt: retryAt,
        maxAttempts: 1
    });
}

/**
 * Create webhook delivery job
 */
export function qzpayCreateWebhookJob(webhookId: string, url: string, payload: Record<string, unknown>): QZPayJob {
    return qzpayCreateJob({
        type: 'webhook_delivery',
        name: `Deliver webhook ${webhookId}`,
        priority: 'high',
        payload: { webhookId, url, payload },
        maxAttempts: 5
    });
}

/**
 * Create invoice generation job
 */
export function qzpayCreateInvoiceGenerationJob(subscriptionId: string, periodStart: Date, periodEnd: Date): QZPayJob {
    return qzpayCreateJob({
        type: 'invoice_generation',
        name: `Generate invoice for ${subscriptionId}`,
        priority: 'normal',
        payload: {
            subscriptionId,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString()
        }
    });
}

/**
 * Create payout processing job
 */
export function qzpayCreatePayoutJob(vendorId: string, payoutDate: Date): QZPayJob {
    return qzpayCreateJob({
        type: 'payout_processing',
        name: `Process payout for vendor ${vendorId}`,
        priority: 'normal',
        payload: { vendorId },
        scheduledAt: payoutDate
    });
}

// ==================== Status Helpers ====================

/**
 * Start job execution
 */
export function qzpayStartJob(job: QZPayJob): QZPayJob {
    return {
        ...job,
        status: 'running',
        startedAt: new Date(),
        attempts: job.attempts + 1,
        updatedAt: new Date()
    };
}

/**
 * Complete job successfully
 */
export function qzpayCompleteJob(job: QZPayJob, result?: Record<string, unknown>): QZPayJob {
    return {
        ...job,
        status: 'completed',
        completedAt: new Date(),
        result: result ?? null,
        updatedAt: new Date()
    };
}

/**
 * Fail job with error
 */
export function qzpayFailJob(job: QZPayJob, error: string): QZPayJob {
    const canRetry = job.attempts < job.maxAttempts;

    return {
        ...job,
        status: canRetry ? 'pending' : 'failed',
        failedAt: canRetry ? null : new Date(),
        lastError: error,
        updatedAt: new Date()
    };
}

/**
 * Cancel job
 */
export function qzpayCancelJob(job: QZPayJob): QZPayJob {
    return {
        ...job,
        status: 'canceled',
        updatedAt: new Date()
    };
}

/**
 * Reschedule job
 */
export function qzpayRescheduleJob(job: QZPayJob, newScheduledAt: Date): QZPayJob {
    return {
        ...job,
        status: 'scheduled',
        scheduledAt: newScheduledAt,
        updatedAt: new Date()
    };
}

// ==================== Query Helpers ====================

/**
 * Check if job is ready to run
 */
export function qzpayJobIsReady(job: QZPayJob): boolean {
    if (job.status !== 'pending' && job.status !== 'scheduled') {
        return false;
    }
    return job.scheduledAt <= new Date();
}

/**
 * Check if job can be retried
 */
export function qzpayJobCanRetry(job: QZPayJob): boolean {
    return job.attempts < job.maxAttempts;
}

/**
 * Check if job is terminal (completed, failed, or canceled)
 */
export function qzpayJobIsTerminal(job: QZPayJob): boolean {
    return job.status === 'completed' || job.status === 'failed' || job.status === 'canceled';
}

/**
 * Check if job is running
 */
export function qzpayJobIsRunning(job: QZPayJob): boolean {
    return job.status === 'running';
}

/**
 * Get jobs ready to run
 */
export function qzpayGetReadyJobs(jobs: QZPayJob[]): QZPayJob[] {
    return jobs.filter(qzpayJobIsReady);
}

/**
 * Get jobs by type
 */
export function qzpayGetJobsByType(jobs: QZPayJob[], type: QZPayJobType): QZPayJob[] {
    return jobs.filter((j) => j.type === type);
}

/**
 * Get jobs by status
 */
export function qzpayGetJobsByStatus(jobs: QZPayJob[], status: QZPayJobStatus): QZPayJob[] {
    return jobs.filter((j) => j.status === status);
}

/**
 * Sort jobs by priority
 */
export function qzpaySortJobsByPriority(jobs: QZPayJob[]): QZPayJob[] {
    const priorityOrder: Record<QZPayJobPriority, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        low: 3
    };

    return [...jobs].sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
}

// ==================== Schedule Helpers ====================

/**
 * Create a job schedule
 */
export function qzpayCreateJobSchedule(
    type: QZPayJobType,
    name: string,
    cronExpression: string,
    payload?: Record<string, unknown>,
    timezone = 'UTC'
): QZPayJobSchedule {
    return {
        id: qzpayGenerateId('sched'),
        type,
        name,
        cronExpression,
        timezone,
        enabled: true,
        payload: payload ?? {},
        lastRunAt: null,
        nextRunAt: null,
        metadata: {}
    };
}

/**
 * Enable schedule
 */
export function qzpayEnableSchedule(schedule: QZPayJobSchedule): QZPayJobSchedule {
    return { ...schedule, enabled: true };
}

/**
 * Disable schedule
 */
export function qzpayDisableSchedule(schedule: QZPayJobSchedule): QZPayJobSchedule {
    return { ...schedule, enabled: false };
}

/**
 * Update schedule last run
 */
export function qzpayUpdateScheduleLastRun(schedule: QZPayJobSchedule, runAt: Date, nextRunAt: Date): QZPayJobSchedule {
    return {
        ...schedule,
        lastRunAt: runAt,
        nextRunAt
    };
}

// ==================== Retry Helpers ====================

/**
 * Calculate next retry delay (exponential backoff)
 */
export function qzpayCalculateRetryDelay(attempt: number, baseDelayMs = 1000, maxDelayMs = 3600000, jitterFactor = 0.1): number {
    const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

    // Add jitter
    const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
    return Math.round(cappedDelay + jitter);
}

/**
 * Get next retry date
 */
export function qzpayGetNextRetryDate(
    attempt: number,
    fromDate: Date = new Date(),
    options?: { baseDelayMs?: number; maxDelayMs?: number }
): Date {
    const delay = qzpayCalculateRetryDelay(attempt, options?.baseDelayMs, options?.maxDelayMs);
    return new Date(fromDate.getTime() + delay);
}

/**
 * Create retry job from failed job
 */
export function qzpayCreateRetryJob(failedJob: QZPayJob): QZPayJob | null {
    if (!qzpayJobCanRetry(failedJob)) {
        return null;
    }

    const nextRetryDate = qzpayGetNextRetryDate(failedJob.attempts + 1);

    return {
        ...failedJob,
        status: 'scheduled',
        scheduledAt: nextRetryDate,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        updatedAt: new Date()
    };
}

// ==================== Stats Helpers ====================

/**
 * Calculate queue statistics
 */
export function qzpayCalculateJobQueueStats(jobs: QZPayJob[]): QZPayJobQueueStats {
    const stats: QZPayJobQueueStats = {
        pending: 0,
        scheduled: 0,
        running: 0,
        completed: 0,
        failed: 0,
        canceled: 0
    };

    for (const job of jobs) {
        stats[job.status]++;
    }

    return stats;
}

/**
 * Calculate average job duration
 */
export function qzpayCalculateAverageJobDuration(jobs: QZPayJob[]): number {
    const completedJobs = jobs.filter(
        (j): j is QZPayJob & { startedAt: Date; completedAt: Date } =>
            j.status === 'completed' && j.startedAt !== null && j.completedAt !== null
    );

    if (completedJobs.length === 0) return 0;

    const totalDuration = completedJobs.reduce((sum, job) => {
        const duration = job.completedAt.getTime() - job.startedAt.getTime();
        return sum + duration;
    }, 0);

    return totalDuration / completedJobs.length;
}

/**
 * Calculate job success rate
 */
export function qzpayCalculateJobSuccessRate(jobs: QZPayJob[]): number {
    const terminalJobs = jobs.filter(qzpayJobIsTerminal);

    if (terminalJobs.length === 0) return 0;

    const successfulJobs = terminalJobs.filter((j) => j.status === 'completed');
    return (successfulJobs.length / terminalJobs.length) * 100;
}

// ==================== Common Cron Expressions ====================

/**
 * Common cron expressions for billing jobs
 */
export const QZPAY_CRON_EXPRESSIONS = {
    /** Every minute */
    EVERY_MINUTE: '* * * * *',
    /** Every 5 minutes */
    EVERY_5_MINUTES: '*/5 * * * *',
    /** Every 15 minutes */
    EVERY_15_MINUTES: '*/15 * * * *',
    /** Every hour */
    EVERY_HOUR: '0 * * * *',
    /** Every day at midnight */
    DAILY_MIDNIGHT: '0 0 * * *',
    /** Every day at 6 AM */
    DAILY_6AM: '0 6 * * *',
    /** Every Monday at midnight */
    WEEKLY_MONDAY: '0 0 * * 1',
    /** First day of month at midnight */
    MONTHLY_FIRST: '0 0 1 * *',
    /** Last day of month at midnight */
    MONTHLY_LAST: '0 0 L * *'
} as const;

/**
 * Pre-configured job schedules
 */
export function qzpayGetDefaultSchedules(): QZPayJobSchedule[] {
    return [
        qzpayCreateJobSchedule('subscription_renewal', 'Process subscription renewals', QZPAY_CRON_EXPRESSIONS.EVERY_HOUR, {
            batchSize: 100
        }),
        qzpayCreateJobSchedule('payment_retry', 'Retry failed payments', QZPAY_CRON_EXPRESSIONS.EVERY_15_MINUTES, { maxRetries: 3 }),
        qzpayCreateJobSchedule('invoice_reminder', 'Send invoice reminders', QZPAY_CRON_EXPRESSIONS.DAILY_6AM, {
            daysBeforeDue: [7, 3, 1]
        }),
        qzpayCreateJobSchedule('payment_method_expiry', 'Check expiring payment methods', QZPAY_CRON_EXPRESSIONS.DAILY_MIDNIGHT, {
            daysBeforeExpiry: 30
        }),
        qzpayCreateJobSchedule('payout_processing', 'Process vendor payouts', QZPAY_CRON_EXPRESSIONS.WEEKLY_MONDAY),
        qzpayCreateJobSchedule('cleanup', 'Clean up old data', QZPAY_CRON_EXPRESSIONS.MONTHLY_FIRST, {
            retentionDays: 90
        })
    ];
}
