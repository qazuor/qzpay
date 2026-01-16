/**
 * Events Store
 * Manages the event timeline for visualization
 */
import type { QZPayEventMap } from '@qazuor/qzpay-core';
import { create } from 'zustand';

export interface PlaygroundEvent {
    id: string;
    type: keyof QZPayEventMap | string; // Allow lifecycle events not yet in core types
    payload: QZPayEventMap[keyof QZPayEventMap] | Record<string, unknown>;
    timestamp: Date;
}

interface EventsState {
    events: PlaygroundEvent[];
    maxEvents: number;
    selectedEventId: string | null;

    // Actions
    addEvent: (event: { type: string; payload: Record<string, unknown>; timestamp: Date }) => void;
    clearEvents: () => void;
    selectEvent: (id: string | null) => void;
    setMaxEvents: (max: number) => void;
}

let eventCounter = 0;

export const useEventsStore = create<EventsState>()((set) => ({
    events: [],
    maxEvents: 100,
    selectedEventId: null,

    addEvent: (event) => {
        const id = `evt_${++eventCounter}_${Date.now()}`;
        const newEvent: PlaygroundEvent = { ...event, id };

        set((state) => {
            const events = [newEvent, ...state.events];
            // Keep only maxEvents
            if (events.length > state.maxEvents) {
                events.pop();
            }
            return { events };
        });
    },

    clearEvents: () => {
        set({ events: [], selectedEventId: null });
    },

    selectEvent: (id) => {
        set({ selectedEventId: id });
    },

    setMaxEvents: (max) => {
        set((state) => {
            const events = state.events.length > max ? state.events.slice(0, max) : state.events;
            return { maxEvents: max, events };
        });
    }
}));

/**
 * Get a formatted event type label
 */
export function getEventTypeLabel(type: keyof QZPayEventMap | string): string {
    const labels: Record<string, string> = {
        // Customer events
        'customer.created': 'Customer Created',
        'customer.updated': 'Customer Updated',
        'customer.deleted': 'Customer Deleted',
        // Subscription events
        'subscription.created': 'Subscription Created',
        'subscription.updated': 'Subscription Updated',
        'subscription.canceled': 'Subscription Canceled',
        'subscription.paused': 'Subscription Paused',
        'subscription.resumed': 'Subscription Resumed',
        'subscription.trial_ending': 'Trial Ending Soon',
        'subscription.trial_ended': 'Trial Ended',
        'subscription.trial_converted': 'Trial Converted',
        'subscription.addon_added': 'Add-on Added',
        'subscription.addon_removed': 'Add-on Removed',
        'subscription.addon_updated': 'Add-on Updated',
        // Lifecycle events
        'subscription.expiring': 'Subscription Expiring',
        'subscription.renewed': 'Subscription Renewed',
        'subscription.renewal_failed': 'Renewal Failed',
        'subscription.grace_period_started': 'Grace Period Started',
        'subscription.grace_period_ending': 'Grace Period Ending',
        'subscription.canceled_nonpayment': 'Canceled (Non-Payment)',
        // Payment events
        'payment.succeeded': 'Payment Succeeded',
        'payment.failed': 'Payment Failed',
        'payment.refunded': 'Payment Refunded',
        'payment.disputed': 'Payment Disputed',
        'payment.retry_scheduled': 'Payment Retry Scheduled',
        'payment.retry_attempted': 'Payment Retry Attempted',
        // Invoice events
        'invoice.created': 'Invoice Created',
        'invoice.paid': 'Invoice Paid',
        'invoice.payment_failed': 'Invoice Payment Failed',
        'invoice.voided': 'Invoice Voided',
        // Checkout events
        'checkout.completed': 'Checkout Completed',
        'checkout.expired': 'Checkout Expired',
        // Vendor events
        'vendor.created': 'Vendor Created',
        'vendor.updated': 'Vendor Updated',
        'vendor.payout': 'Vendor Payout',
        // Add-on events
        'addon.created': 'Add-on Created',
        'addon.updated': 'Add-on Updated',
        'addon.deleted': 'Add-on Deleted'
    };

    return labels[type] ?? type;
}

/**
 * Get the color class for an event type
 */
export function getEventTypeColor(type: keyof QZPayEventMap | string): string {
    if (type.startsWith('customer.')) return 'text-blue-400';

    if (type.startsWith('subscription.')) {
        // Lifecycle warning/error events
        if (type === 'subscription.canceled' || type === 'subscription.canceled_nonpayment') return 'text-red-400';
        if (type === 'subscription.renewal_failed' || type === 'subscription.trial_ended') return 'text-orange-400';
        if (type === 'subscription.grace_period_started' || type === 'subscription.grace_period_ending') return 'text-yellow-400';
        if (type === 'subscription.expiring' || type === 'subscription.trial_ending') return 'text-amber-400';
        // Success events
        if (type === 'subscription.renewed' || type === 'subscription.trial_converted') return 'text-emerald-400';
        return 'text-green-400';
    }

    if (type.startsWith('payment.')) {
        if (type === 'payment.failed' || type === 'payment.disputed') return 'text-red-400';
        if (type === 'payment.refunded') return 'text-orange-400';
        if (type === 'payment.retry_scheduled' || type === 'payment.retry_attempted') return 'text-yellow-400';
        return 'text-emerald-400';
    }

    if (type.startsWith('invoice.')) {
        if (type === 'invoice.payment_failed') return 'text-red-400';
        return 'text-purple-400';
    }

    if (type.startsWith('checkout.')) return 'text-indigo-400';
    if (type.startsWith('vendor.')) return 'text-amber-400';
    if (type.startsWith('addon.')) return 'text-cyan-400';
    return 'text-gray-400';
}

/**
 * Get an icon name for an event type (for lucide-react)
 */
export function getEventTypeIcon(type: keyof QZPayEventMap | string): string {
    if (type.startsWith('customer.')) return 'User';

    if (type.startsWith('subscription.')) {
        if (type === 'subscription.renewed' || type === 'subscription.trial_converted') return 'CheckCircle';
        if (type === 'subscription.canceled' || type === 'subscription.canceled_nonpayment') return 'XCircle';
        if (type === 'subscription.grace_period_started' || type === 'subscription.grace_period_ending') return 'Clock';
        if (type === 'subscription.expiring' || type === 'subscription.trial_ending') return 'AlertTriangle';
        if (type === 'subscription.renewal_failed') return 'AlertCircle';
        return 'CreditCard';
    }

    if (type.startsWith('payment.')) {
        if (type === 'payment.retry_scheduled' || type === 'payment.retry_attempted') return 'RefreshCw';
        return 'DollarSign';
    }

    if (type.startsWith('invoice.')) return 'FileText';
    if (type.startsWith('addon.')) return 'Package';
    return 'Activity';
}
