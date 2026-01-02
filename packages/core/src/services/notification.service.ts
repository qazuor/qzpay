/**
 * Notification service helpers for QZPay
 *
 * Provides utilities for creating, managing, and delivering
 * billing-related notifications across multiple channels.
 */
import type { QZPayBillingEvent, QZPayCurrency } from '../constants/index.js';
import { qzpayGenerateId } from '../utils/hash.utils.js';

// ==================== Types ====================

/**
 * Notification channels
 */
export type QZPayNotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'in_app';

/**
 * Notification priority
 */
export type QZPayNotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification status
 */
export type QZPayNotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';

/**
 * Notification template
 */
export interface QZPayNotificationTemplate {
    id: string;
    name: string;
    channel: QZPayNotificationChannel;
    subject?: string;
    body: string;
    variables: string[];
    active: boolean;
}

/**
 * Notification record
 */
export interface QZPayNotification {
    id: string;
    templateId: string | null;
    channel: QZPayNotificationChannel;
    recipientId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    subject?: string;
    body: string;
    priority: QZPayNotificationPriority;
    status: QZPayNotificationStatus;
    eventType?: QZPayBillingEvent;
    metadata: Record<string, unknown>;
    sentAt: Date | null;
    deliveredAt: Date | null;
    failedAt: Date | null;
    failureReason?: string;
    createdAt: Date;
}

/**
 * Notification preferences
 */
export interface QZPayNotificationPreferences {
    customerId: string;
    channels: {
        email: boolean;
        sms: boolean;
        push: boolean;
        inApp: boolean;
    };
    events: {
        paymentSucceeded: boolean;
        paymentFailed: boolean;
        subscriptionCreated: boolean;
        subscriptionCanceled: boolean;
        subscriptionRenewing: boolean;
        invoicePaid: boolean;
        invoicePaymentFailed: boolean;
        trialEnding: boolean;
    };
}

/**
 * Notification batch
 */
export interface QZPayNotificationBatch {
    id: string;
    notifications: QZPayNotification[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalCount: number;
    sentCount: number;
    failedCount: number;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
}

/**
 * Notification input
 */
export interface QZPayCreateNotificationInput {
    channel: QZPayNotificationChannel;
    recipientId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    templateId?: string;
    subject?: string;
    body: string;
    priority?: QZPayNotificationPriority;
    eventType?: QZPayBillingEvent;
    metadata?: Record<string, unknown>;
}

// ==================== Creation Helpers ====================

/**
 * Create a notification record
 */
export function qzpayCreateNotification(input: QZPayCreateNotificationInput): QZPayNotification {
    return {
        id: qzpayGenerateId('ntf'),
        templateId: input.templateId ?? null,
        channel: input.channel,
        recipientId: input.recipientId,
        ...(input.recipientEmail !== undefined && { recipientEmail: input.recipientEmail }),
        ...(input.recipientPhone !== undefined && { recipientPhone: input.recipientPhone }),
        ...(input.subject !== undefined && { subject: input.subject }),
        body: input.body,
        priority: input.priority ?? 'normal',
        status: 'pending',
        ...(input.eventType !== undefined && { eventType: input.eventType }),
        metadata: input.metadata ?? {},
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        createdAt: new Date()
    };
}

/**
 * Create a notification batch
 */
export function qzpayCreateNotificationBatch(notifications: QZPayNotification[]): QZPayNotificationBatch {
    return {
        id: qzpayGenerateId('batch'),
        notifications,
        status: 'pending',
        totalCount: notifications.length,
        sentCount: 0,
        failedCount: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date()
    };
}

/**
 * Create default notification preferences
 */
export function qzpayCreateDefaultPreferences(customerId: string): QZPayNotificationPreferences {
    return {
        customerId,
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
        }
    };
}

// ==================== Status Helpers ====================

/**
 * Mark notification as sent
 */
export function qzpayMarkNotificationSent(notification: QZPayNotification): QZPayNotification {
    return {
        ...notification,
        status: 'sent',
        sentAt: new Date()
    };
}

/**
 * Mark notification as delivered
 */
export function qzpayMarkNotificationDelivered(notification: QZPayNotification): QZPayNotification {
    return {
        ...notification,
        status: 'delivered',
        deliveredAt: new Date()
    };
}

/**
 * Mark notification as failed
 */
export function qzpayMarkNotificationFailed(notification: QZPayNotification, reason: string): QZPayNotification {
    return {
        ...notification,
        status: 'failed',
        failedAt: new Date(),
        failureReason: reason
    };
}

/**
 * Mark notification as skipped
 */
export function qzpayMarkNotificationSkipped(notification: QZPayNotification, reason: string): QZPayNotification {
    return {
        ...notification,
        status: 'skipped',
        failureReason: reason
    };
}

// ==================== Batch Helpers ====================

/**
 * Start processing batch
 */
export function qzpayStartBatchProcessing(batch: QZPayNotificationBatch): QZPayNotificationBatch {
    return {
        ...batch,
        status: 'processing',
        startedAt: new Date()
    };
}

/**
 * Update batch progress
 */
export function qzpayUpdateBatchProgress(batch: QZPayNotificationBatch, sentCount: number, failedCount: number): QZPayNotificationBatch {
    return {
        ...batch,
        sentCount,
        failedCount
    };
}

/**
 * Complete batch
 */
export function qzpayCompleteBatch(batch: QZPayNotificationBatch): QZPayNotificationBatch {
    return {
        ...batch,
        status: batch.failedCount === batch.totalCount ? 'failed' : 'completed',
        completedAt: new Date()
    };
}

/**
 * Get batch completion percentage
 */
export function qzpayGetBatchProgress(batch: QZPayNotificationBatch): number {
    if (batch.totalCount === 0) return 100;
    return Math.round(((batch.sentCount + batch.failedCount) / batch.totalCount) * 100);
}

// ==================== Template Helpers ====================

/**
 * Render template with variables
 */
export function qzpayRenderTemplate(template: string, variables: Record<string, string | number>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
    }
    return result;
}

/**
 * Extract variable names from template
 */
export function qzpayExtractTemplateVariables(template: string): string[] {
    const regex = /{{\s*(\w+)\s*}}/g;
    const variables: string[] = [];

    for (const match of template.matchAll(regex)) {
        const varName = match[1];
        if (varName && !variables.includes(varName)) {
            variables.push(varName);
        }
    }

    return variables;
}

/**
 * Validate template has all required variables
 */
export function qzpayValidateTemplateVariables(
    template: string,
    providedVariables: Record<string, unknown>
): { valid: boolean; missing: string[] } {
    const required = qzpayExtractTemplateVariables(template);
    const missing = required.filter((v) => !(v in providedVariables));

    return {
        valid: missing.length === 0,
        missing
    };
}

// ==================== Preference Helpers ====================

/**
 * Check if notification should be sent based on preferences
 */
export function qzpayShouldSendNotification(
    preferences: QZPayNotificationPreferences,
    channel: QZPayNotificationChannel,
    eventType: string
): boolean {
    // Check channel enabled
    const channelKey = channel === 'in_app' ? 'inApp' : channel;
    if (channelKey in preferences.channels && !preferences.channels[channelKey as keyof typeof preferences.channels]) {
        return false;
    }

    // Check event enabled
    const eventKey = qzpayEventTypeToPreferenceKey(eventType);
    if (eventKey && eventKey in preferences.events && !preferences.events[eventKey as keyof typeof preferences.events]) {
        return false;
    }

    return true;
}

/**
 * Map event type to preference key
 */
export function qzpayEventTypeToPreferenceKey(eventType: string): string | null {
    const mapping: Record<string, string> = {
        'payment.succeeded': 'paymentSucceeded',
        'payment.failed': 'paymentFailed',
        'subscription.created': 'subscriptionCreated',
        'subscription.canceled': 'subscriptionCanceled',
        'subscription.trial_ending': 'trialEnding',
        'invoice.paid': 'invoicePaid',
        'invoice.payment_failed': 'invoicePaymentFailed'
    };

    return mapping[eventType] ?? null;
}

/**
 * Update preferences
 */
export function qzpayUpdatePreferences(
    current: QZPayNotificationPreferences,
    updates: Partial<QZPayNotificationPreferences>
): QZPayNotificationPreferences {
    return {
        ...current,
        channels: { ...current.channels, ...updates.channels },
        events: { ...current.events, ...updates.events }
    };
}

// ==================== Email Helpers ====================

/**
 * Common email variables for billing
 */
export interface QZPayBillingEmailVariables {
    customerName: string;
    customerEmail: string;
    amount?: number;
    currency?: QZPayCurrency;
    invoiceNumber?: string;
    planName?: string;
    subscriptionId?: string;
    paymentMethodLast4?: string;
    nextBillingDate?: string;
    trialEndDate?: string;
}

/**
 * Format amount for display in notifications
 */
export function qzpayFormatAmountForNotification(amount: number, currency: QZPayCurrency): string {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
    });
    return formatter.format(amount / 100);
}

/**
 * Create payment succeeded notification
 */
export function qzpayCreatePaymentSucceededNotification(
    recipientId: string,
    recipientEmail: string,
    variables: QZPayBillingEmailVariables
): QZPayNotification {
    const amount = variables.amount ? qzpayFormatAmountForNotification(variables.amount, variables.currency ?? 'USD') : '';

    return qzpayCreateNotification({
        channel: 'email',
        recipientId,
        recipientEmail,
        subject: 'Payment Successful',
        body: `Hi ${variables.customerName},\n\nYour payment of ${amount} has been processed successfully.\n\nThank you for your business!`,
        priority: 'normal',
        eventType: 'payment.succeeded',
        metadata: { ...variables }
    });
}

/**
 * Create payment failed notification
 */
export function qzpayCreatePaymentFailedNotification(
    recipientId: string,
    recipientEmail: string,
    variables: QZPayBillingEmailVariables,
    failureReason?: string
): QZPayNotification {
    const amount = variables.amount ? qzpayFormatAmountForNotification(variables.amount, variables.currency ?? 'USD') : '';

    return qzpayCreateNotification({
        channel: 'email',
        recipientId,
        recipientEmail,
        subject: 'Payment Failed',
        body: `Hi ${variables.customerName},\n\nWe were unable to process your payment of ${amount}.${failureReason ? ` Reason: ${failureReason}` : ''}\n\nPlease update your payment method to continue your service.`,
        priority: 'high',
        eventType: 'payment.failed',
        metadata: { ...variables, failureReason }
    });
}

/**
 * Create trial ending notification
 */
export function qzpayCreateTrialEndingNotification(
    recipientId: string,
    recipientEmail: string,
    variables: QZPayBillingEmailVariables,
    daysRemaining: number
): QZPayNotification {
    return qzpayCreateNotification({
        channel: 'email',
        recipientId,
        recipientEmail,
        subject: `Your trial ends in ${daysRemaining} days`,
        body: `Hi ${variables.customerName},\n\nYour free trial for ${variables.planName ?? 'your subscription'} will end in ${daysRemaining} days.\n\nAdd a payment method to continue using our service without interruption.`,
        priority: 'high',
        eventType: 'subscription.trial_ending',
        metadata: { ...variables, daysRemaining }
    });
}

/**
 * Create subscription canceled notification
 */
export function qzpayCreateSubscriptionCanceledNotification(
    recipientId: string,
    recipientEmail: string,
    variables: QZPayBillingEmailVariables,
    effectiveDate: Date
): QZPayNotification {
    return qzpayCreateNotification({
        channel: 'email',
        recipientId,
        recipientEmail,
        subject: 'Subscription Canceled',
        body: `Hi ${variables.customerName},\n\nYour subscription to ${variables.planName ?? 'our service'} has been canceled and will end on ${effectiveDate.toLocaleDateString()}.\n\nWe're sorry to see you go. You can resubscribe at any time.`,
        priority: 'normal',
        eventType: 'subscription.canceled',
        metadata: { ...variables, effectiveDate: effectiveDate.toISOString() }
    });
}

// ==================== Filter Helpers ====================

/**
 * Filter notifications by status
 */
export function qzpayFilterNotificationsByStatus(notifications: QZPayNotification[], status: QZPayNotificationStatus): QZPayNotification[] {
    return notifications.filter((n) => n.status === status);
}

/**
 * Filter notifications by channel
 */
export function qzpayFilterNotificationsByChannel(
    notifications: QZPayNotification[],
    channel: QZPayNotificationChannel
): QZPayNotification[] {
    return notifications.filter((n) => n.channel === channel);
}

/**
 * Filter notifications by priority
 */
export function qzpayFilterNotificationsByPriority(
    notifications: QZPayNotification[],
    priority: QZPayNotificationPriority
): QZPayNotification[] {
    return notifications.filter((n) => n.priority === priority);
}

/**
 * Get pending notifications
 */
export function qzpayGetPendingNotifications(notifications: QZPayNotification[]): QZPayNotification[] {
    return qzpayFilterNotificationsByStatus(notifications, 'pending');
}

/**
 * Get failed notifications for retry
 */
export function qzpayGetRetryableNotifications(notifications: QZPayNotification[]): QZPayNotification[] {
    return notifications.filter((n) => n.status === 'failed');
}

// ==================== Stats Helpers ====================

/**
 * Notification statistics
 */
export interface QZPayNotificationStats {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
    skipped: number;
    deliveryRate: number;
}

/**
 * Calculate notification statistics
 */
export function qzpayCalculateNotificationStats(notifications: QZPayNotification[]): QZPayNotificationStats {
    const stats = {
        total: notifications.length,
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        skipped: 0,
        deliveryRate: 0
    };

    for (const notification of notifications) {
        stats[notification.status]++;
    }

    const attempted = stats.sent + stats.delivered + stats.failed;
    stats.deliveryRate = attempted > 0 ? ((stats.sent + stats.delivered) / attempted) * 100 : 0;

    return stats;
}
