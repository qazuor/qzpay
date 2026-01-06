/**
 * Tests for notification service helpers
 */
import { describe, expect, it } from 'vitest';
import type {
    QZPayBillingEmailVariables,
    QZPayNotification,
    QZPayNotificationBatch,
    QZPayNotificationPreferences
} from '../../src/index.js';
import {
    qzpayCalculateNotificationStats,
    qzpayCompleteBatch,
    qzpayCreateDefaultPreferences,
    qzpayCreateNotification,
    qzpayCreateNotificationBatch,
    qzpayCreatePaymentFailedNotification,
    qzpayCreatePaymentSucceededNotification,
    qzpayCreateSubscriptionCanceledNotification,
    qzpayCreateTrialEndingNotification,
    qzpayEventTypeToPreferenceKey,
    qzpayExtractTemplateVariables,
    qzpayFilterNotificationsByChannel,
    qzpayFilterNotificationsByPriority,
    qzpayFilterNotificationsByStatus,
    qzpayFormatAmountForNotification,
    qzpayGetBatchProgress,
    qzpayGetPendingNotifications,
    qzpayGetRetryableNotifications,
    qzpayMarkNotificationDelivered,
    qzpayMarkNotificationFailed,
    qzpayMarkNotificationSent,
    qzpayMarkNotificationSkipped,
    qzpayRenderTemplate,
    qzpayShouldSendNotification,
    qzpayStartBatchProcessing,
    qzpayUpdateBatchProgress,
    qzpayUpdatePreferences,
    qzpayValidateTemplateVariables
} from '../../src/index.js';

// ==================== Test Fixtures ====================

function createNotification(overrides: Partial<QZPayNotification> = {}): QZPayNotification {
    return {
        id: 'ntf_123',
        templateId: null,
        channel: 'email',
        recipientId: 'cus_123',
        recipientEmail: 'test@example.com',
        subject: 'Test Notification',
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

function createBatch(overrides: Partial<QZPayNotificationBatch> = {}): QZPayNotificationBatch {
    return {
        id: 'batch_123',
        notifications: [],
        status: 'pending',
        totalCount: 0,
        sentCount: 0,
        failedCount: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        ...overrides
    };
}

// ==================== Creation Tests ====================

describe('Notification Creation', () => {
    describe('qzpayCreateNotification', () => {
        it('should create notification with defaults', () => {
            const notification = qzpayCreateNotification({
                channel: 'email',
                recipientId: 'cus_123',
                recipientEmail: 'test@example.com',
                body: 'Test message'
            });

            expect(notification.id).toMatch(/^ntf_/);
            expect(notification.status).toBe('pending');
            expect(notification.priority).toBe('normal');
        });

        it('should include optional fields', () => {
            const notification = qzpayCreateNotification({
                channel: 'email',
                recipientId: 'cus_123',
                body: 'Test',
                subject: 'Test Subject',
                priority: 'high',
                eventType: 'payment.succeeded'
            });

            expect(notification.subject).toBe('Test Subject');
            expect(notification.priority).toBe('high');
            expect(notification.eventType).toBe('payment.succeeded');
        });
    });

    describe('qzpayCreateNotificationBatch', () => {
        it('should create batch with notifications', () => {
            const notifications = [createNotification(), createNotification()];
            const batch = qzpayCreateNotificationBatch(notifications);

            expect(batch.id).toMatch(/^batch_/);
            expect(batch.totalCount).toBe(2);
            expect(batch.status).toBe('pending');
        });
    });

    describe('qzpayCreateDefaultPreferences', () => {
        it('should create default preferences', () => {
            const prefs = qzpayCreateDefaultPreferences('cus_123');

            expect(prefs.customerId).toBe('cus_123');
            expect(prefs.channels.email).toBe(true);
            expect(prefs.events.paymentSucceeded).toBe(true);
        });
    });
});

// ==================== Status Management Tests ====================

describe('Notification Status', () => {
    describe('qzpayMarkNotificationSent', () => {
        it('should mark notification as sent', () => {
            const notification = createNotification();
            const sent = qzpayMarkNotificationSent(notification);

            expect(sent.status).toBe('sent');
            expect(sent.sentAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayMarkNotificationDelivered', () => {
        it('should mark notification as delivered', () => {
            const notification = createNotification();
            const delivered = qzpayMarkNotificationDelivered(notification);

            expect(delivered.status).toBe('delivered');
            expect(delivered.deliveredAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayMarkNotificationFailed', () => {
        it('should mark notification as failed', () => {
            const notification = createNotification();
            const failed = qzpayMarkNotificationFailed(notification, 'SMTP error');

            expect(failed.status).toBe('failed');
            expect(failed.failedAt).toBeInstanceOf(Date);
            expect(failed.failureReason).toBe('SMTP error');
        });
    });

    describe('qzpayMarkNotificationSkipped', () => {
        it('should mark notification as skipped', () => {
            const notification = createNotification();
            const skipped = qzpayMarkNotificationSkipped(notification, 'User opted out');

            expect(skipped.status).toBe('skipped');
            expect(skipped.failureReason).toBe('User opted out');
        });
    });
});

// ==================== Batch Management Tests ====================

describe('Batch Management', () => {
    describe('qzpayStartBatchProcessing', () => {
        it('should start batch processing', () => {
            const batch = createBatch();
            const started = qzpayStartBatchProcessing(batch);

            expect(started.status).toBe('processing');
            expect(started.startedAt).toBeInstanceOf(Date);
        });
    });

    describe('qzpayUpdateBatchProgress', () => {
        it('should update batch progress', () => {
            const batch = createBatch({ totalCount: 10 });
            const updated = qzpayUpdateBatchProgress(batch, 5, 2);

            expect(updated.sentCount).toBe(5);
            expect(updated.failedCount).toBe(2);
        });
    });

    describe('qzpayCompleteBatch', () => {
        it('should mark batch as completed', () => {
            const batch = createBatch({ totalCount: 10, sentCount: 8, failedCount: 2 });
            const completed = qzpayCompleteBatch(batch);

            expect(completed.status).toBe('completed');
            expect(completed.completedAt).toBeInstanceOf(Date);
        });

        it('should mark batch as failed if all failed', () => {
            const batch = createBatch({ totalCount: 10, sentCount: 0, failedCount: 10 });
            const completed = qzpayCompleteBatch(batch);

            expect(completed.status).toBe('failed');
        });
    });

    describe('qzpayGetBatchProgress', () => {
        it('should calculate batch progress percentage', () => {
            const batch = createBatch({ totalCount: 100, sentCount: 50, failedCount: 10 });
            const progress = qzpayGetBatchProgress(batch);

            expect(progress).toBe(60);
        });

        it('should return 100 for empty batch', () => {
            const batch = createBatch({ totalCount: 0 });
            const progress = qzpayGetBatchProgress(batch);

            expect(progress).toBe(100);
        });
    });
});

// ==================== Template Tests ====================

describe('Template Helpers', () => {
    describe('qzpayRenderTemplate', () => {
        it('should render template with variables', () => {
            const template = 'Hello {{ name }}, you have {{ count }} items.';
            const rendered = qzpayRenderTemplate(template, { name: 'John', count: 5 });

            expect(rendered).toBe('Hello John, you have 5 items.');
        });

        it('should handle whitespace in variable names', () => {
            const template = 'Hello {{  name  }}';
            const rendered = qzpayRenderTemplate(template, { name: 'John' });

            expect(rendered).toBe('Hello John');
        });
    });

    describe('qzpayExtractTemplateVariables', () => {
        it('should extract variable names', () => {
            const template = 'Hello {{ name }}, {{ greeting }}!';
            const variables = qzpayExtractTemplateVariables(template);

            expect(variables).toEqual(['name', 'greeting']);
        });

        it('should deduplicate variables', () => {
            const template = 'Hello {{ name }}, goodbye {{ name }}!';
            const variables = qzpayExtractTemplateVariables(template);

            expect(variables).toEqual(['name']);
        });
    });

    describe('qzpayValidateTemplateVariables', () => {
        it('should validate complete variables', () => {
            const template = 'Hello {{ name }}';
            const result = qzpayValidateTemplateVariables(template, { name: 'John' });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });

        it('should detect missing variables', () => {
            const template = 'Hello {{ name }}, {{ greeting }}!';
            const result = qzpayValidateTemplateVariables(template, { name: 'John' });

            expect(result.valid).toBe(false);
            expect(result.missing).toEqual(['greeting']);
        });
    });
});

// ==================== Preference Tests ====================

describe('Notification Preferences', () => {
    describe('qzpayShouldSendNotification', () => {
        it('should send if channel and event enabled', () => {
            const prefs: QZPayNotificationPreferences = {
                customerId: 'cus_123',
                channels: { email: true, sms: false, push: false, inApp: true },
                events: {
                    paymentSucceeded: true,
                    paymentFailed: true,
                    subscriptionCreated: true,
                    subscriptionCanceled: true,
                    subscriptionRenewing: true,
                    invoicePaid: true,
                    invoicePaymentFailed: true,
                    trialEnding: true
                }
            };

            expect(qzpayShouldSendNotification(prefs, 'email', 'payment.succeeded')).toBe(true);
        });

        it('should not send if channel disabled', () => {
            const prefs = qzpayCreateDefaultPreferences('cus_123');
            prefs.channels.sms = false;

            expect(qzpayShouldSendNotification(prefs, 'sms', 'payment.succeeded')).toBe(false);
        });

        it('should not send if event disabled', () => {
            const prefs = qzpayCreateDefaultPreferences('cus_123');
            prefs.events.paymentSucceeded = false;

            expect(qzpayShouldSendNotification(prefs, 'email', 'payment.succeeded')).toBe(false);
        });
    });

    describe('qzpayEventTypeToPreferenceKey', () => {
        it('should map event types to preference keys', () => {
            expect(qzpayEventTypeToPreferenceKey('payment.succeeded')).toBe('paymentSucceeded');
            expect(qzpayEventTypeToPreferenceKey('subscription.created')).toBe('subscriptionCreated');
            expect(qzpayEventTypeToPreferenceKey('invoice.paid')).toBe('invoicePaid');
        });

        it('should return null for unknown events', () => {
            expect(qzpayEventTypeToPreferenceKey('unknown.event')).toBeNull();
        });
    });

    describe('qzpayUpdatePreferences', () => {
        it('should update preferences', () => {
            const current = qzpayCreateDefaultPreferences('cus_123');
            const updated = qzpayUpdatePreferences(current, {
                channels: { email: false }
            });

            expect(updated.channels.email).toBe(false);
            expect(updated.channels.inApp).toBe(true); // Preserved
        });
    });
});

// ==================== Filter Tests ====================

describe('Notification Filtering', () => {
    describe('qzpayFilterNotificationsByStatus', () => {
        it('should filter by status', () => {
            const notifications = [
                createNotification({ status: 'sent' }),
                createNotification({ status: 'pending' }),
                createNotification({ status: 'sent' })
            ];

            const sent = qzpayFilterNotificationsByStatus(notifications, 'sent');
            expect(sent).toHaveLength(2);
        });
    });

    describe('qzpayFilterNotificationsByChannel', () => {
        it('should filter by channel', () => {
            const notifications = [
                createNotification({ channel: 'email' }),
                createNotification({ channel: 'sms' }),
                createNotification({ channel: 'email' })
            ];

            const emails = qzpayFilterNotificationsByChannel(notifications, 'email');
            expect(emails).toHaveLength(2);
        });
    });

    describe('qzpayFilterNotificationsByPriority', () => {
        it('should filter by priority', () => {
            const notifications = [
                createNotification({ priority: 'high' }),
                createNotification({ priority: 'normal' }),
                createNotification({ priority: 'high' })
            ];

            const high = qzpayFilterNotificationsByPriority(notifications, 'high');
            expect(high).toHaveLength(2);
        });
    });

    describe('qzpayGetPendingNotifications', () => {
        it('should get pending notifications', () => {
            const notifications = [
                createNotification({ status: 'pending' }),
                createNotification({ status: 'sent' }),
                createNotification({ status: 'pending' })
            ];

            const pending = qzpayGetPendingNotifications(notifications);
            expect(pending).toHaveLength(2);
        });
    });

    describe('qzpayGetRetryableNotifications', () => {
        it('should get failed notifications', () => {
            const notifications = [
                createNotification({ status: 'failed' }),
                createNotification({ status: 'sent' }),
                createNotification({ status: 'failed' })
            ];

            const retryable = qzpayGetRetryableNotifications(notifications);
            expect(retryable).toHaveLength(2);
        });
    });
});

// ==================== Stats Tests ====================

describe('Notification Statistics', () => {
    describe('qzpayCalculateNotificationStats', () => {
        it('should calculate notification stats', () => {
            const notifications = [
                createNotification({ status: 'sent' }),
                createNotification({ status: 'delivered' }),
                createNotification({ status: 'failed' }),
                createNotification({ status: 'pending' }),
                createNotification({ status: 'skipped' })
            ];

            const stats = qzpayCalculateNotificationStats(notifications);

            expect(stats.total).toBe(5);
            expect(stats.sent).toBe(1);
            expect(stats.delivered).toBe(1);
            expect(stats.failed).toBe(1);
            expect(stats.pending).toBe(1);
            expect(stats.skipped).toBe(1);
            expect(stats.deliveryRate).toBeCloseTo(66.67, 1);
        });
    });
});

// ==================== Email Helper Tests ====================

describe('Email Helpers', () => {
    describe('qzpayFormatAmountForNotification', () => {
        it('should format amount for display', () => {
            const formatted = qzpayFormatAmountForNotification(1000, 'USD');
            expect(formatted).toContain('10');
            expect(formatted).toContain('$');
        });
    });

    describe('qzpayCreatePaymentSucceededNotification', () => {
        it('should create payment succeeded notification', () => {
            const variables: QZPayBillingEmailVariables = {
                customerName: 'John Doe',
                customerEmail: 'john@example.com',
                amount: 1000,
                currency: 'USD'
            };

            const notification = qzpayCreatePaymentSucceededNotification('cus_123', 'john@example.com', variables);

            expect(notification.subject).toBe('Payment Successful');
            expect(notification.body).toContain('John Doe');
            expect(notification.eventType).toBe('payment.succeeded');
        });
    });

    describe('qzpayCreatePaymentFailedNotification', () => {
        it('should create payment failed notification', () => {
            const variables: QZPayBillingEmailVariables = {
                customerName: 'John Doe',
                customerEmail: 'john@example.com',
                amount: 1000,
                currency: 'USD'
            };

            const notification = qzpayCreatePaymentFailedNotification('cus_123', 'john@example.com', variables, 'Insufficient funds');

            expect(notification.subject).toBe('Payment Failed');
            expect(notification.body).toContain('Insufficient funds');
            expect(notification.priority).toBe('high');
        });
    });

    describe('qzpayCreateTrialEndingNotification', () => {
        it('should create trial ending notification', () => {
            const variables: QZPayBillingEmailVariables = {
                customerName: 'John Doe',
                customerEmail: 'john@example.com',
                planName: 'Pro Plan'
            };

            const notification = qzpayCreateTrialEndingNotification('cus_123', 'john@example.com', variables, 3);

            expect(notification.subject).toContain('3 days');
            expect(notification.body).toContain('Pro Plan');
            expect(notification.priority).toBe('high');
        });
    });

    describe('qzpayCreateSubscriptionCanceledNotification', () => {
        it('should create subscription canceled notification', () => {
            const variables: QZPayBillingEmailVariables = {
                customerName: 'John Doe',
                customerEmail: 'john@example.com',
                planName: 'Pro Plan'
            };

            const effectiveDate = new Date('2024-12-31');
            const notification = qzpayCreateSubscriptionCanceledNotification('cus_123', 'john@example.com', variables, effectiveDate);

            expect(notification.subject).toBe('Subscription Canceled');
            expect(notification.body).toContain('Pro Plan');
        });
    });
});
