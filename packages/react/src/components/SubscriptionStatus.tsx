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
            <div
                className={className}
                data-testid="subscription-status-empty"
                role="status"
                aria-live="polite"
                style={{
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    textAlign: 'center',
                    opacity: 0.7
                }}
            >
                No active subscription
            </div>
        );
    }

    const statusColor = getStatusColor(subscription.status);

    return (
        <div
            className={className}
            data-testid="subscription-status"
            role="status"
            aria-live="polite"
            aria-label="Subscription status"
            style={{
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)'
            }}
        >
            {/* Status Badge */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '20px'
                }}
            >
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        backgroundColor: `${statusColor}20`,
                        border: `1px solid ${statusColor}40`
                    }}
                >
                    <span
                        style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: statusColor,
                            boxShadow: `0 0 8px ${statusColor}`
                        }}
                    />
                    <span
                        style={{
                            textTransform: 'capitalize',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: statusColor
                        }}
                        data-testid="subscription-status-badge"
                    >
                        {subscription.status}
                    </span>
                </span>
            </div>

            {/* Plan Info */}
            <div
                style={{
                    marginBottom: '16px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)'
                }}
            >
                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '4px' }}>Plan</div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>{subscription.planId}</div>
            </div>

            {/* Period Info */}
            {subscription.currentPeriodStart && (
                <div
                    style={{
                        marginBottom: '16px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.03)'
                    }}
                >
                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '4px' }}>Current Period</div>
                    <div style={{ fontSize: '0.875rem' }}>
                        {formatDate(subscription.currentPeriodStart)} — {formatDate(subscription.currentPeriodEnd)}
                    </div>
                </div>
            )}

            {/* Trial Info */}
            {subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && (
                <div
                    style={{
                        marginBottom: '16px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                >
                    <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginBottom: '4px' }}>Trial ends</div>
                    <div style={{ fontSize: '0.875rem', color: '#3b82f6', fontWeight: 500 }}>{formatDate(subscription.trialEnd)}</div>
                </div>
            )}

            {/* Cancellation Warning */}
            {subscription.cancelAtPeriodEnd && (
                <div
                    style={{
                        marginBottom: '16px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}
                >
                    <div style={{ fontSize: '0.875rem', color: '#f59e0b' }}>
                        ⚠️ Cancels at end of period ({formatDate(subscription.currentPeriodEnd)})
                    </div>
                </div>
            )}

            {/* Cancel Button */}
            {showCancelButton && subscription.status === 'active' && onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    data-testid="cancel-subscription-button"
                    aria-label="Cancel subscription"
                    style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '12px 16px',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Cancel Subscription
                </button>
            )}
        </div>
    );
}
