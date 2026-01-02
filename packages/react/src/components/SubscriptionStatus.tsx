/**
 * Subscription Status Component
 *
 * Displays the current subscription status
 */
import type { ReactNode } from 'react';
import type { SubscriptionStatusProps } from '../types.js';

/**
 * Format date for display
 */
function formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Get status color
 */
function getStatusColor(status: string): string {
    switch (status) {
        case 'active':
            return '#22c55e'; // green
        case 'trialing':
            return '#3b82f6'; // blue
        case 'past_due':
            return '#f59e0b'; // amber
        case 'canceled':
        case 'unpaid':
            return '#ef4444'; // red
        case 'paused':
            return '#6b7280'; // gray
        default:
            return '#6b7280';
    }
}

/**
 * Subscription status component that displays subscription information
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SubscriptionStatus subscription={subscription} />
 *
 * // With cancel button
 * <SubscriptionStatus
 *   subscription={subscription}
 *   showCancelButton
 *   onCancel={() => handleCancel(subscription.id)}
 * />
 * ```
 */
export function SubscriptionStatus({ subscription, showCancelButton = false, onCancel, className }: SubscriptionStatusProps): ReactNode {
    if (!subscription) {
        return (
            <div className={className} data-testid="subscription-status-empty">
                No active subscription
            </div>
        );
    }

    const statusColor = getStatusColor(subscription.status);

    return (
        <div className={className} data-testid="subscription-status">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                    style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: statusColor
                    }}
                />
                <span
                    style={{
                        textTransform: 'capitalize',
                        fontWeight: 'bold',
                        color: statusColor
                    }}
                    data-testid="subscription-status-badge"
                >
                    {subscription.status}
                </span>
            </div>

            <div style={{ marginBottom: '4px' }}>
                <strong>Plan:</strong> {subscription.planId}
            </div>

            {subscription.currentPeriodStart && (
                <div style={{ marginBottom: '4px' }}>
                    <strong>Current Period:</strong> {formatDate(subscription.currentPeriodStart)} -{' '}
                    {formatDate(subscription.currentPeriodEnd)}
                </div>
            )}

            {subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && (
                <div style={{ marginBottom: '4px', color: '#3b82f6' }}>
                    <strong>Trial ends:</strong> {formatDate(subscription.trialEnd)}
                </div>
            )}

            {subscription.cancelAtPeriodEnd && (
                <div style={{ marginBottom: '4px', color: '#f59e0b' }}>
                    Cancels at end of period ({formatDate(subscription.currentPeriodEnd)})
                </div>
            )}

            {showCancelButton && subscription.status === 'active' && onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    data-testid="cancel-subscription-button"
                    style={{
                        marginTop: '8px',
                        padding: '8px 16px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Cancel Subscription
                </button>
            )}
        </div>
    );
}
