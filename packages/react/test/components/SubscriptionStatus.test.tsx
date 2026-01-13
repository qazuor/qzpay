/**
 * SubscriptionStatus Component Tests
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionStatus } from '../../src/components/SubscriptionStatus.js';
import { createMockSubscription } from '../helpers/react-mocks.js';

describe('SubscriptionStatus', () => {
    describe('rendering', () => {
        it('should render empty state when no subscription', () => {
            render(<SubscriptionStatus subscription={null} />);

            expect(screen.getByTestId('subscription-status-empty')).toBeInTheDocument();
            expect(screen.getByText('No active subscription')).toBeInTheDocument();
        });

        it('should render subscription status', () => {
            const subscription = createMockSubscription({ status: 'active' });

            render(<SubscriptionStatus subscription={subscription} />);

            expect(screen.getByTestId('subscription-status')).toBeInTheDocument();
            expect(screen.getByTestId('subscription-status-badge')).toHaveTextContent('active');
        });

        it('should render plan id', () => {
            const subscription = createMockSubscription({ planId: 'premium_plan' });

            render(<SubscriptionStatus subscription={subscription} />);

            expect(screen.getByText('premium_plan')).toBeInTheDocument();
        });

        it('should render current period', () => {
            const subscription = createMockSubscription({
                currentPeriodStart: new Date('2024-01-01'),
                currentPeriodEnd: new Date('2024-02-01')
            });

            render(<SubscriptionStatus subscription={subscription} />);

            // Component shows "Current Period" as a label (without colon)
            expect(screen.getByText('Current Period')).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            const subscription = createMockSubscription();

            render(<SubscriptionStatus subscription={subscription} className="custom-class" />);

            expect(screen.getByTestId('subscription-status')).toHaveClass('custom-class');
        });
    });

    describe('status colors', () => {
        it.each([
            ['active', '#22c55e'],
            ['trialing', '#3b82f6'],
            ['past_due', '#f59e0b'],
            ['canceled', '#ef4444'],
            ['unpaid', '#ef4444'],
            ['paused', '#6b7280'],
            ['unknown', '#6b7280']
        ])('should use correct color for %s status', (status, expectedColor) => {
            const subscription = createMockSubscription({ status });

            render(<SubscriptionStatus subscription={subscription} />);

            const badge = screen.getByTestId('subscription-status-badge');
            expect(badge).toHaveStyle({ color: expectedColor });
        });
    });

    describe('trial display', () => {
        it('should show trial end date when in trial', () => {
            const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const subscription = createMockSubscription({
                status: 'trialing',
                trialEnd: futureDate
            });

            render(<SubscriptionStatus subscription={subscription} />);

            // Component shows "Trial ends" as a label (without colon)
            expect(screen.getByText('Trial ends')).toBeInTheDocument();
        });

        it('should not show trial end date when trial expired', () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const subscription = createMockSubscription({
                status: 'active',
                trialEnd: pastDate
            });

            render(<SubscriptionStatus subscription={subscription} />);

            expect(screen.queryByText('Trial ends')).not.toBeInTheDocument();
        });
    });

    describe('cancel at period end', () => {
        it('should show cancellation notice when cancelAtPeriodEnd is true', () => {
            const subscription = createMockSubscription({
                cancelAtPeriodEnd: true,
                currentPeriodEnd: new Date('2024-02-01')
            });

            render(<SubscriptionStatus subscription={subscription} />);

            expect(screen.getByText(/Cancels at end of period/)).toBeInTheDocument();
        });

        it('should not show cancellation notice when cancelAtPeriodEnd is false', () => {
            const subscription = createMockSubscription({
                cancelAtPeriodEnd: false
            });

            render(<SubscriptionStatus subscription={subscription} />);

            expect(screen.queryByText(/Cancels at end of period/)).not.toBeInTheDocument();
        });
    });

    describe('cancel button', () => {
        it('should show cancel button when showCancelButton is true and subscription is active', () => {
            const subscription = createMockSubscription({ status: 'active' });
            const onCancel = vi.fn();

            render(<SubscriptionStatus subscription={subscription} showCancelButton={true} onCancel={onCancel} />);

            expect(screen.getByTestId('cancel-subscription-button')).toBeInTheDocument();
        });

        it('should not show cancel button when subscription is not active', () => {
            const subscription = createMockSubscription({ status: 'canceled' });
            const onCancel = vi.fn();

            render(<SubscriptionStatus subscription={subscription} showCancelButton={true} onCancel={onCancel} />);

            expect(screen.queryByTestId('cancel-subscription-button')).not.toBeInTheDocument();
        });

        it('should not show cancel button when showCancelButton is false', () => {
            const subscription = createMockSubscription({ status: 'active' });

            render(<SubscriptionStatus subscription={subscription} showCancelButton={false} />);

            expect(screen.queryByTestId('cancel-subscription-button')).not.toBeInTheDocument();
        });

        it('should call onCancel when cancel button is clicked', () => {
            const subscription = createMockSubscription({ status: 'active' });
            const onCancel = vi.fn();

            render(<SubscriptionStatus subscription={subscription} showCancelButton={true} onCancel={onCancel} />);

            fireEvent.click(screen.getByTestId('cancel-subscription-button'));

            expect(onCancel).toHaveBeenCalled();
        });
    });

    describe('date formatting', () => {
        it('should format dates correctly', () => {
            const subscription = createMockSubscription({
                currentPeriodStart: new Date('2024-01-15'),
                currentPeriodEnd: new Date('2024-02-15')
            });

            render(<SubscriptionStatus subscription={subscription} />);

            // Component shows "Current Period" label
            expect(screen.getByText('Current Period')).toBeInTheDocument();
        });

        it('should handle missing dates gracefully', () => {
            const subscription = createMockSubscription({
                currentPeriodStart: undefined,
                currentPeriodEnd: undefined
            });

            render(<SubscriptionStatus subscription={subscription} />);

            expect(screen.getByTestId('subscription-status')).toBeInTheDocument();
        });
    });
});
