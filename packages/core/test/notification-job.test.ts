/**
 * Tests for notification and job service helpers
 */
import { describe, expect, it } from 'vitest';
import type {
    QZPayCreateNotificationInput,
    QZPayJob,
    QZPayJobSchedule,
    QZPayNotification,
    QZPayNotificationBatch,
    QZPayNotificationPreferences
} from '../src/index.js';
import {
    // Notification helpers
    QZPAY_CRON_EXPRESSIONS,
    qzpayCalculateAverageJobDuration,
    qzpayCalculateJobQueueStats,
    qzpayCalculateJobSuccessRate,
    qzpayCalculateNotificationStats,
    qzpayCalculateRetryDelay,
    qzpayCancelJob,
    qzpayCompleteBatch,
    qzpayCompleteJob,
    qzpayCreateDefaultPreferences,
    qzpayCreateInvoiceGenerationJob,
    qzpayCreateJob,
    qzpayCreateJobSchedule,
    qzpayCreateNotification,
    qzpayCreateNotificationBatch,
    qzpayCreatePaymentFailedNotification,
    qzpayCreatePaymentRetryJob,
    qzpayCreatePaymentSucceededNotification,
    qzpayCreatePayoutJob,
    qzpayCreateRenewalJob,
    qzpayCreateRetryJob,
    qzpayCreateSubscriptionCanceledNotification,
    qzpayCreateTrialEndingJob,
    qzpayCreateTrialEndingNotification,
    qzpayCreateWebhookJob,
    qzpayDisableSchedule,
    qzpayEnableSchedule,
    qzpayEventTypeToPreferenceKey,
    qzpayExtractTemplateVariables,
    qzpayFailJob,
    qzpayFilterNotificationsByChannel,
    qzpayFilterNotificationsByPriority,
    qzpayFilterNotificationsByStatus,
    qzpayFormatAmountForNotification,
    qzpayGetBatchProgress,
    qzpayGetDefaultSchedules,
    qzpayGetJobsByStatus,
    qzpayGetJobsByType,
    qzpayGetNextRetryDate,
    qzpayGetPendingNotifications,
    qzpayGetReadyJobs,
    qzpayGetRetryableNotifications,
    qzpayJobCanRetry,
    qzpayJobIsReady,
    qzpayJobIsRunning,
    qzpayJobIsTerminal,
    qzpayMarkNotificationDelivered,
    qzpayMarkNotificationFailed,
    qzpayMarkNotificationSent,
    qzpayMarkNotificationSkipped,
    qzpayRenderTemplate,
    qzpayRescheduleJob,
    qzpayShouldSendNotification,
    qzpaySortJobsByPriority,
    qzpayStartBatchProcessing,
    qzpayStartJob,
    qzpayUpdateBatchProgress,
    qzpayUpdatePreferences,
    qzpayUpdateScheduleLastRun,
    qzpayValidateTemplateVariables
} from '../src/index.js';

// ==================== Notification Fixtures ====================

function createNotificationInput(overrides: Partial<QZPayCreateNotificationInput> = {}): QZPayCreateNotificationInput {
    return {
        channel: 'email',
        recipientId: 'cus_123',
        recipientEmail: 'test@example.com',
        body: 'Test notification body',
        ...overrides
    };
}

function createNotification(overrides: Partial<QZPayNotification> = {}): QZPayNotification {
    return {
        id: 'ntf_123',
        templateId: null,
        channel: 'email',
        recipientId: 'cus_123',
        recipientEmail: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body',
        priority: 'normal',
        status: 'pending',
        metadata: {},
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        createdAt: new Date(),
        ...overrides
    };
}

function createPreferences(overrides: Partial<QZPayNotificationPreferences> = {}): QZPayNotificationPreferences {
    return {
        customerId: 'cus_123',
        channels: {
            email: true,
            sms: false,
            push: false,
            inApp: true
        },
        events: {
            paymentSucceeded: true,
            paymentFailed: true,
            subscriptionCreated: true,
            subscriptionCanceled: true,
            subscriptionRenewing: true,
            invoicePaid: true,
            invoicePaymentFailed: true,
            trialEnding: true
        },
        ...overrides
    };
}

// ==================== Job Fixtures ====================

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

// ==================== Notification Creation Tests ====================

describe('Notification Creation', () => {
    describe('qzpayCreateNotification', () => {
        it('should create a notification', () => {
            const input = createNotificationInput();
            const notification = qzpayCreateNotification(input);

            expect(notification.id).toMatch(/^ntf_/);
            expect(notification.channel).toBe('email');
            expect(notification.status).toBe('pending');
            expect(notification.priority).toBe('normal');
        });

        it('should use provided priority', () => {
            const input = createNotificationInput({ priority: 'high' });
            const notification = qzpayCreateNotification(input);

            expect(notification.priority).toBe('high');
        });
    });

    describe('qzpayCreateNotificationBatch', () => {
        it('should create a batch', () => {
            const notifications = [createNotification(), createNotification({ id: 'ntf_456' })];
            const batch = qzpayCreateNotificationBatch(notifications);

            expect(batch.id).toMatch(/^batch_/);
            expect(batch.notifications).toHaveLength(2);
            expect(batch.totalCount).toBe(2);
            expect(batch.status).toBe('pending');
        });
    });

    describe('qzpayCreateDefaultPreferences', () => {
        it('should create default preferences', () => {
            const prefs = qzpayCreateDefaultPreferences('cus_123');

            expect(prefs.customerId).toBe('cus_123');
            expect(prefs.channels.email).toBe(true);
            expect(prefs.channels.sms).toBe(false);
            expect(prefs.events.paymentFailed).toBe(true);
        });
    });
});

// ==================== Notification Status Tests ====================

describe('Notification Status', () => {
    describe('qzpayMarkNotificationSent', () => {
        it('should mark as sent', () => {
            const notification = createNotification();
            const updated = qzpayMarkNotificationSent(notification);

            expect(updated.status).toBe('sent');
            expect(updated.sentAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayMarkNotificationDelivered', () => {
        it('should mark as delivered', () => {
            const notification = createNotification();
            const updated = qzpayMarkNotificationDelivered(notification);

            expect(updated.status).toBe('delivered');
            expect(updated.deliveredAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayMarkNotificationFailed', () => {
        it('should mark as failed with reason', () => {
            const notification = createNotification();
            const updated = qzpayMarkNotificationFailed(notification, 'Invalid email');

            expect(updated.status).toBe('failed');
            expect(updated.failedAt).toBeInstanceOf(Date);
            expect(updated.failureReason).toBe('Invalid email');
        });
    });

    describe('qzpayMarkNotificationSkipped', () => {
        it('should mark as skipped', () => {
            const notification = createNotification();
            const updated = qzpayMarkNotificationSkipped(notification, 'User opted out');

            expect(updated.status).toBe('skipped');
            expect(updated.failureReason).toBe('User opted out');
        });
    });
});

// ==================== Batch Tests ====================

describe('Notification Batch', () => {
    describe('qzpayStartBatchProcessing', () => {
        it('should start processing', () => {
            const batch = qzpayCreateNotificationBatch([createNotification()]);
            const started = qzpayStartBatchProcessing(batch);

            expect(started.status).toBe('processing');
            expect(started.startedAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayUpdateBatchProgress', () => {
        it('should update counts', () => {
            const batch = qzpayCreateNotificationBatch([createNotification()]);
            const updated = qzpayUpdateBatchProgress(batch, 5, 2);

            expect(updated.sentCount).toBe(5);
            expect(updated.failedCount).toBe(2);
        });
    });

    describe('qzpayCompleteBatch', () => {
        it('should mark as completed', () => {
            const batch = qzpayCreateNotificationBatch([createNotification()]);
            batch.sentCount = 1;
            const completed = qzpayCompleteBatch(batch);

            expect(completed.status).toBe('completed');
            expect(completed.completedAt).toBeInstanceOf(Date);
        });

        it('should mark as failed if all failed', () => {
            const batch = qzpayCreateNotificationBatch([createNotification()]);
            batch.failedCount = 1;
            batch.totalCount = 1;
            const completed = qzpayCompleteBatch(batch);

            expect(completed.status).toBe('failed');
        });
    });

    describe('qzpayGetBatchProgress', () => {
        it('should calculate percentage', () => {
            const batch: QZPayNotificationBatch = {
                id: 'batch_1',
                notifications: [],
                status: 'processing',
                totalCount: 10,
                sentCount: 5,
                failedCount: 2,
                startedAt: new Date(),
                completedAt: null,
                createdAt: new Date()
            };

            expect(qzpayGetBatchProgress(batch)).toBe(70);
        });

        it('should return 100 for empty batch', () => {
            const batch: QZPayNotificationBatch = {
                id: 'batch_1',
                notifications: [],
                status: 'pending',
                totalCount: 0,
                sentCount: 0,
                failedCount: 0,
                startedAt: null,
                completedAt: null,
                createdAt: new Date()
            };

            expect(qzpayGetBatchProgress(batch)).toBe(100);
        });
    });
});

// ==================== Template Tests ====================

describe('Notification Templates', () => {
    describe('qzpayRenderTemplate', () => {
        it('should replace variables', () => {
            const template = 'Hello {{name}}, your balance is {{amount}}';
            const result = qzpayRenderTemplate(template, { name: 'John', amount: '$100' });

            expect(result).toBe('Hello John, your balance is $100');
        });

        it('should handle spaces in variable names', () => {
            const template = 'Hello {{ name }}';
            const result = qzpayRenderTemplate(template, { name: 'John' });

            expect(result).toBe('Hello John');
        });

        it('should handle multiple occurrences', () => {
            const template = '{{name}} hello {{name}}';
            const result = qzpayRenderTemplate(template, { name: 'John' });

            expect(result).toBe('John hello John');
        });
    });

    describe('qzpayExtractTemplateVariables', () => {
        it('should extract variable names', () => {
            const template = 'Hello {{name}}, your {{item}} costs {{amount}}';
            const variables = qzpayExtractTemplateVariables(template);

            expect(variables).toEqual(['name', 'item', 'amount']);
        });

        it('should deduplicate variables', () => {
            const template = '{{name}} hello {{name}}';
            const variables = qzpayExtractTemplateVariables(template);

            expect(variables).toEqual(['name']);
        });
    });

    describe('qzpayValidateTemplateVariables', () => {
        it('should validate all variables provided', () => {
            const template = 'Hello {{name}}, balance: {{amount}}';
            const result = qzpayValidateTemplateVariables(template, { name: 'John', amount: 100 });

            expect(result.valid).toBe(true);
            expect(result.missing).toHaveLength(0);
        });

        it('should report missing variables', () => {
            const template = 'Hello {{name}}, balance: {{amount}}';
            const result = qzpayValidateTemplateVariables(template, { name: 'John' });

            expect(result.valid).toBe(false);
            expect(result.missing).toEqual(['amount']);
        });
    });
});

// ==================== Preference Tests ====================

describe('Notification Preferences', () => {
    describe('qzpayShouldSendNotification', () => {
        it('should allow enabled channel and event', () => {
            const prefs = createPreferences();
            const result = qzpayShouldSendNotification(prefs, 'email', 'payment.succeeded');

            expect(result).toBe(true);
        });

        it('should block disabled channel', () => {
            const prefs = createPreferences({ channels: { email: true, sms: false, push: false, inApp: false } });
            const result = qzpayShouldSendNotification(prefs, 'sms', 'payment.succeeded');

            expect(result).toBe(false);
        });

        it('should block disabled event', () => {
            const prefs = createPreferences();
            prefs.events.paymentSucceeded = false;
            const result = qzpayShouldSendNotification(prefs, 'email', 'payment.succeeded');

            expect(result).toBe(false);
        });
    });

    describe('qzpayEventTypeToPreferenceKey', () => {
        it('should map event types', () => {
            expect(qzpayEventTypeToPreferenceKey('payment.succeeded')).toBe('paymentSucceeded');
            expect(qzpayEventTypeToPreferenceKey('payment.failed')).toBe('paymentFailed');
            expect(qzpayEventTypeToPreferenceKey('subscription.canceled')).toBe('subscriptionCanceled');
        });

        it('should return null for unknown types', () => {
            expect(qzpayEventTypeToPreferenceKey('unknown.event')).toBeNull();
        });
    });

    describe('qzpayUpdatePreferences', () => {
        it('should update channel preferences', () => {
            const current = createPreferences();
            const updated = qzpayUpdatePreferences(current, {
                channels: { email: true, sms: true, push: false, inApp: true }
            });

            expect(updated.channels.sms).toBe(true);
        });
    });
});

// ==================== Email Notification Tests ====================

describe('Email Notifications', () => {
    describe('qzpayFormatAmountForNotification', () => {
        it('should format USD', () => {
            const formatted = qzpayFormatAmountForNotification(10000, 'usd');
            expect(formatted).toBe('$100.00');
        });

        it('should format EUR', () => {
            const formatted = qzpayFormatAmountForNotification(5000, 'eur');
            expect(formatted).toContain('50');
        });
    });

    describe('qzpayCreatePaymentSucceededNotification', () => {
        it('should create payment succeeded notification', () => {
            const notification = qzpayCreatePaymentSucceededNotification('cus_123', 'test@example.com', {
                customerName: 'John',
                customerEmail: 'test@example.com',
                amount: 5000,
                currency: 'usd'
            });

            expect(notification.subject).toBe('Payment Successful');
            expect(notification.body).toContain('John');
            expect(notification.body).toContain('$50.00');
            expect(notification.eventType).toBe('payment.succeeded');
        });
    });

    describe('qzpayCreatePaymentFailedNotification', () => {
        it('should create payment failed notification', () => {
            const notification = qzpayCreatePaymentFailedNotification(
                'cus_123',
                'test@example.com',
                { customerName: 'John', customerEmail: 'test@example.com', amount: 5000, currency: 'usd' },
                'Card declined'
            );

            expect(notification.subject).toBe('Payment Failed');
            expect(notification.body).toContain('Card declined');
            expect(notification.priority).toBe('high');
        });
    });

    describe('qzpayCreateTrialEndingNotification', () => {
        it('should create trial ending notification', () => {
            const notification = qzpayCreateTrialEndingNotification(
                'cus_123',
                'test@example.com',
                { customerName: 'John', customerEmail: 'test@example.com', planName: 'Pro Plan' },
                3
            );

            expect(notification.subject).toContain('3 days');
            expect(notification.body).toContain('Pro Plan');
        });
    });

    describe('qzpayCreateSubscriptionCanceledNotification', () => {
        it('should create cancellation notification', () => {
            const effectiveDate = new Date('2025-07-01');
            const notification = qzpayCreateSubscriptionCanceledNotification(
                'cus_123',
                'test@example.com',
                { customerName: 'John', customerEmail: 'test@example.com', planName: 'Pro Plan' },
                effectiveDate
            );

            expect(notification.subject).toBe('Subscription Canceled');
            expect(notification.body).toContain('Pro Plan');
        });
    });
});

// ==================== Notification Filter Tests ====================

describe('Notification Filters', () => {
    const notifications = [
        createNotification({ id: 'n1', status: 'pending', channel: 'email', priority: 'normal' }),
        createNotification({ id: 'n2', status: 'sent', channel: 'sms', priority: 'high' }),
        createNotification({ id: 'n3', status: 'failed', channel: 'email', priority: 'high' }),
        createNotification({ id: 'n4', status: 'delivered', channel: 'push', priority: 'low' })
    ];

    describe('qzpayFilterNotificationsByStatus', () => {
        it('should filter by status', () => {
            expect(qzpayFilterNotificationsByStatus(notifications, 'sent')).toHaveLength(1);
        });
    });

    describe('qzpayFilterNotificationsByChannel', () => {
        it('should filter by channel', () => {
            expect(qzpayFilterNotificationsByChannel(notifications, 'email')).toHaveLength(2);
        });
    });

    describe('qzpayFilterNotificationsByPriority', () => {
        it('should filter by priority', () => {
            expect(qzpayFilterNotificationsByPriority(notifications, 'high')).toHaveLength(2);
        });
    });

    describe('qzpayGetPendingNotifications', () => {
        it('should get pending', () => {
            expect(qzpayGetPendingNotifications(notifications)).toHaveLength(1);
        });
    });

    describe('qzpayGetRetryableNotifications', () => {
        it('should get failed for retry', () => {
            expect(qzpayGetRetryableNotifications(notifications)).toHaveLength(1);
        });
    });
});

// ==================== Notification Stats Tests ====================

describe('Notification Stats', () => {
    describe('qzpayCalculateNotificationStats', () => {
        it('should calculate statistics', () => {
            const notifications = [
                createNotification({ status: 'pending' }),
                createNotification({ status: 'sent' }),
                createNotification({ status: 'sent' }),
                createNotification({ status: 'delivered' }),
                createNotification({ status: 'failed' })
            ];

            const stats = qzpayCalculateNotificationStats(notifications);

            expect(stats.total).toBe(5);
            expect(stats.pending).toBe(1);
            expect(stats.sent).toBe(2);
            expect(stats.delivered).toBe(1);
            expect(stats.failed).toBe(1);
            expect(stats.deliveryRate).toBe(75); // 3/4 attempted delivered
        });
    });
});

// ==================== Job Creation Tests ====================

describe('Job Creation', () => {
    describe('qzpayCreateJob', () => {
        it('should create a job', () => {
            const job = qzpayCreateJob({
                type: 'subscription_renewal',
                name: 'Renew subscription'
            });

            expect(job.id).toMatch(/^job_/);
            expect(job.type).toBe('subscription_renewal');
            expect(job.status).toBe('pending');
            expect(job.attempts).toBe(0);
        });

        it('should set scheduled status for future jobs', () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);

            const job = qzpayCreateJob({
                type: 'subscription_renewal',
                name: 'Renew subscription',
                scheduledAt: futureDate
            });

            expect(job.status).toBe('scheduled');
        });
    });

    describe('qzpayCreateRenewalJob', () => {
        it('should create renewal job', () => {
            const renewalDate = new Date();
            const job = qzpayCreateRenewalJob('sub_123', renewalDate);

            expect(job.type).toBe('subscription_renewal');
            expect(job.priority).toBe('high');
            expect(job.payload.subscriptionId).toBe('sub_123');
        });
    });

    describe('qzpayCreateTrialEndingJob', () => {
        it('should create trial ending job scheduled before trial end', () => {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 10);

            const job = qzpayCreateTrialEndingJob('sub_123', trialEndDate, 3);

            expect(job.type).toBe('subscription_trial_ending');
            expect(job.payload.daysBeforeNotify).toBe(3);

            const scheduledDiff = trialEndDate.getTime() - job.scheduledAt.getTime();
            expect(scheduledDiff).toBeCloseTo(3 * 24 * 60 * 60 * 1000, -4);
        });
    });

    describe('qzpayCreatePaymentRetryJob', () => {
        it('should create payment retry job', () => {
            const retryAt = new Date();
            const job = qzpayCreatePaymentRetryJob('pay_123', retryAt, 2);

            expect(job.type).toBe('payment_retry');
            expect(job.payload.attemptNumber).toBe(2);
            expect(job.maxAttempts).toBe(1);
        });
    });

    describe('qzpayCreateWebhookJob', () => {
        it('should create webhook job', () => {
            const job = qzpayCreateWebhookJob('wh_123', 'https://example.com/webhook', { event: 'test' });

            expect(job.type).toBe('webhook_delivery');
            expect(job.payload.url).toBe('https://example.com/webhook');
            expect(job.maxAttempts).toBe(5);
        });
    });

    describe('qzpayCreateInvoiceGenerationJob', () => {
        it('should create invoice generation job', () => {
            const start = new Date('2025-06-01');
            const end = new Date('2025-06-30');
            const job = qzpayCreateInvoiceGenerationJob('sub_123', start, end);

            expect(job.type).toBe('invoice_generation');
            expect(job.payload.subscriptionId).toBe('sub_123');
        });
    });

    describe('qzpayCreatePayoutJob', () => {
        it('should create payout job', () => {
            const payoutDate = new Date();
            const job = qzpayCreatePayoutJob('vendor_123', payoutDate);

            expect(job.type).toBe('payout_processing');
            expect(job.payload.vendorId).toBe('vendor_123');
        });
    });
});

// ==================== Job Status Tests ====================

describe('Job Status', () => {
    describe('qzpayStartJob', () => {
        it('should start job', () => {
            const job = createJob();
            const started = qzpayStartJob(job);

            expect(started.status).toBe('running');
            expect(started.startedAt).toBeInstanceOf(Date);
            expect(started.attempts).toBe(1);
        });
    });

    describe('qzpayCompleteJob', () => {
        it('should complete job', () => {
            const job = createJob({ status: 'running' });
            const completed = qzpayCompleteJob(job, { processed: 10 });

            expect(completed.status).toBe('completed');
            expect(completed.completedAt).toBeInstanceOf(Date);
            expect(completed.result).toEqual({ processed: 10 });
        });
    });

    describe('qzpayFailJob', () => {
        it('should set pending if retries available', () => {
            const job = createJob({ attempts: 1, maxAttempts: 3 });
            const failed = qzpayFailJob(job, 'Connection timeout');

            expect(failed.status).toBe('pending');
            expect(failed.lastError).toBe('Connection timeout');
        });

        it('should set failed if no retries left', () => {
            const job = createJob({ attempts: 3, maxAttempts: 3 });
            const failed = qzpayFailJob(job, 'Connection timeout');

            expect(failed.status).toBe('failed');
            expect(failed.failedAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayCancelJob', () => {
        it('should cancel job', () => {
            const job = createJob();
            const canceled = qzpayCancelJob(job);

            expect(canceled.status).toBe('canceled');
        });
    });

    describe('qzpayRescheduleJob', () => {
        it('should reschedule job', () => {
            const job = createJob();
            const newDate = new Date();
            newDate.setHours(newDate.getHours() + 2);

            const rescheduled = qzpayRescheduleJob(job, newDate);

            expect(rescheduled.status).toBe('scheduled');
            expect(rescheduled.scheduledAt).toEqual(newDate);
        });
    });
});

// ==================== Job Query Tests ====================

describe('Job Queries', () => {
    describe('qzpayJobIsReady', () => {
        it('should return true for ready job', () => {
            const job = createJob();
            expect(qzpayJobIsReady(job)).toBe(true);
        });

        it('should return false for future scheduled job', () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);
            const job = createJob({ status: 'scheduled', scheduledAt: futureDate });

            expect(qzpayJobIsReady(job)).toBe(false);
        });

        it('should return false for running job', () => {
            const job = createJob({ status: 'running' });
            expect(qzpayJobIsReady(job)).toBe(false);
        });
    });

    describe('qzpayJobCanRetry', () => {
        it('should return true if attempts < maxAttempts', () => {
            const job = createJob({ attempts: 1, maxAttempts: 3 });
            expect(qzpayJobCanRetry(job)).toBe(true);
        });

        it('should return false if attempts >= maxAttempts', () => {
            const job = createJob({ attempts: 3, maxAttempts: 3 });
            expect(qzpayJobCanRetry(job)).toBe(false);
        });
    });

    describe('qzpayJobIsTerminal', () => {
        it('should return true for completed', () => {
            expect(qzpayJobIsTerminal(createJob({ status: 'completed' }))).toBe(true);
        });

        it('should return true for failed', () => {
            expect(qzpayJobIsTerminal(createJob({ status: 'failed' }))).toBe(true);
        });

        it('should return true for canceled', () => {
            expect(qzpayJobIsTerminal(createJob({ status: 'canceled' }))).toBe(true);
        });

        it('should return false for pending', () => {
            expect(qzpayJobIsTerminal(createJob({ status: 'pending' }))).toBe(false);
        });
    });

    describe('qzpayJobIsRunning', () => {
        it('should check running status', () => {
            expect(qzpayJobIsRunning(createJob({ status: 'running' }))).toBe(true);
            expect(qzpayJobIsRunning(createJob({ status: 'pending' }))).toBe(false);
        });
    });

    describe('qzpayGetReadyJobs', () => {
        it('should get ready jobs', () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);

            const jobs = [
                createJob({ id: 'j1', status: 'pending' }),
                createJob({ id: 'j2', status: 'scheduled', scheduledAt: futureDate }),
                createJob({ id: 'j3', status: 'running' })
            ];

            expect(qzpayGetReadyJobs(jobs)).toHaveLength(1);
        });
    });

    describe('qzpayGetJobsByType', () => {
        it('should filter by type', () => {
            const jobs = [
                createJob({ type: 'subscription_renewal' }),
                createJob({ type: 'payment_retry' }),
                createJob({ type: 'subscription_renewal' })
            ];

            expect(qzpayGetJobsByType(jobs, 'subscription_renewal')).toHaveLength(2);
        });
    });

    describe('qzpayGetJobsByStatus', () => {
        it('should filter by status', () => {
            const jobs = [createJob({ status: 'pending' }), createJob({ status: 'completed' }), createJob({ status: 'pending' })];

            expect(qzpayGetJobsByStatus(jobs, 'pending')).toHaveLength(2);
        });
    });

    describe('qzpaySortJobsByPriority', () => {
        it('should sort by priority and time', () => {
            const now = new Date();
            const jobs = [
                createJob({ id: 'j1', priority: 'low', scheduledAt: now }),
                createJob({ id: 'j2', priority: 'critical', scheduledAt: now }),
                createJob({ id: 'j3', priority: 'high', scheduledAt: now }),
                createJob({ id: 'j4', priority: 'normal', scheduledAt: now })
            ];

            const sorted = qzpaySortJobsByPriority(jobs);

            expect(sorted.map((j) => j.id)).toEqual(['j2', 'j3', 'j4', 'j1']);
        });
    });
});

// ==================== Schedule Tests ====================

describe('Job Schedules', () => {
    describe('qzpayCreateJobSchedule', () => {
        it('should create schedule', () => {
            const schedule = qzpayCreateJobSchedule('subscription_renewal', 'Hourly renewals', '0 * * * *');

            expect(schedule.id).toMatch(/^sched_/);
            expect(schedule.cronExpression).toBe('0 * * * *');
            expect(schedule.enabled).toBe(true);
        });
    });

    describe('qzpayEnableSchedule', () => {
        it('should enable schedule', () => {
            const schedule: QZPayJobSchedule = {
                id: 'sched_1',
                type: 'cleanup',
                name: 'Test',
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
                id: 'sched_1',
                type: 'cleanup',
                name: 'Test',
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

    describe('qzpayUpdateScheduleLastRun', () => {
        it('should update last run', () => {
            const schedule: QZPayJobSchedule = {
                id: 'sched_1',
                type: 'cleanup',
                name: 'Test',
                cronExpression: '0 0 * * *',
                timezone: 'UTC',
                enabled: true,
                payload: {},
                lastRunAt: null,
                nextRunAt: null,
                metadata: {}
            };

            const runAt = new Date();
            const nextRunAt = new Date(runAt.getTime() + 86400000);
            const updated = qzpayUpdateScheduleLastRun(schedule, runAt, nextRunAt);

            expect(updated.lastRunAt).toEqual(runAt);
            expect(updated.nextRunAt).toEqual(nextRunAt);
        });
    });

    describe('qzpayGetDefaultSchedules', () => {
        it('should return default schedules', () => {
            const schedules = qzpayGetDefaultSchedules();

            expect(schedules.length).toBeGreaterThan(0);
            expect(schedules.find((s) => s.type === 'subscription_renewal')).toBeDefined();
            expect(schedules.find((s) => s.type === 'payment_retry')).toBeDefined();
        });
    });
});

// ==================== Retry Tests ====================

describe('Job Retry', () => {
    describe('qzpayCalculateRetryDelay', () => {
        it('should calculate exponential backoff', () => {
            const delay1 = qzpayCalculateRetryDelay(1, 1000, 3600000, 0);
            const delay2 = qzpayCalculateRetryDelay(2, 1000, 3600000, 0);
            const delay3 = qzpayCalculateRetryDelay(3, 1000, 3600000, 0);

            expect(delay1).toBe(1000);
            expect(delay2).toBe(2000);
            expect(delay3).toBe(4000);
        });

        it('should cap at max delay', () => {
            const delay = qzpayCalculateRetryDelay(20, 1000, 5000, 0);
            expect(delay).toBe(5000);
        });
    });

    describe('qzpayGetNextRetryDate', () => {
        it('should return future date', () => {
            const now = new Date();
            const nextRetry = qzpayGetNextRetryDate(1, now);

            expect(nextRetry.getTime()).toBeGreaterThan(now.getTime());
        });
    });

    describe('qzpayCreateRetryJob', () => {
        it('should create retry job', () => {
            const job = createJob({ attempts: 1, maxAttempts: 3, status: 'failed' });
            const retry = qzpayCreateRetryJob(job);

            expect(retry).not.toBeNull();
            expect(retry?.status).toBe('scheduled');
        });

        it('should return null if no retries left', () => {
            const job = createJob({ attempts: 3, maxAttempts: 3 });
            const retry = qzpayCreateRetryJob(job);

            expect(retry).toBeNull();
        });
    });
});

// ==================== Job Stats Tests ====================

describe('Job Stats', () => {
    describe('qzpayCalculateJobQueueStats', () => {
        it('should calculate stats', () => {
            const jobs = [
                createJob({ status: 'pending' }),
                createJob({ status: 'pending' }),
                createJob({ status: 'running' }),
                createJob({ status: 'completed' }),
                createJob({ status: 'failed' })
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
            const now = Date.now();
            const jobs = [
                createJob({
                    status: 'completed',
                    startedAt: new Date(now - 5000),
                    completedAt: new Date(now)
                }),
                createJob({
                    status: 'completed',
                    startedAt: new Date(now - 3000),
                    completedAt: new Date(now)
                })
            ];

            const avg = qzpayCalculateAverageJobDuration(jobs);
            expect(avg).toBe(4000);
        });

        it('should return 0 for no completed jobs', () => {
            const jobs = [createJob({ status: 'pending' })];
            expect(qzpayCalculateAverageJobDuration(jobs)).toBe(0);
        });
    });

    describe('qzpayCalculateJobSuccessRate', () => {
        it('should calculate success rate', () => {
            const jobs = [
                createJob({ status: 'completed' }),
                createJob({ status: 'completed' }),
                createJob({ status: 'failed' }),
                createJob({ status: 'canceled' }),
                createJob({ status: 'pending' })
            ];

            const rate = qzpayCalculateJobSuccessRate(jobs);
            expect(rate).toBe(50); // 2/4 terminal
        });
    });
});

// ==================== Cron Expressions Tests ====================

describe('Cron Expressions', () => {
    it('should have valid expressions', () => {
        expect(QZPAY_CRON_EXPRESSIONS.EVERY_MINUTE).toBe('* * * * *');
        expect(QZPAY_CRON_EXPRESSIONS.DAILY_MIDNIGHT).toBe('0 0 * * *');
        expect(QZPAY_CRON_EXPRESSIONS.WEEKLY_MONDAY).toBe('0 0 * * 1');
        expect(QZPAY_CRON_EXPRESSIONS.MONTHLY_FIRST).toBe('0 0 1 * *');
    });
});
