import { Activity, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useConfigStore } from '../../stores/config.store';
import { type PlaygroundEvent, useEventsStore } from '../../stores/events.store';

const getEventTypeColor = (type: string): string => {
    if (type.startsWith('customer.')) return 'text-blue-400';
    if (type.startsWith('subscription.')) return 'text-green-400';
    if (type.startsWith('payment.')) {
        if (type.includes('failed') || type.includes('disputed')) return 'text-red-400';
        if (type.includes('refunded')) return 'text-orange-400';
        return 'text-emerald-400';
    }
    if (type.startsWith('invoice.')) {
        if (type.includes('failed')) return 'text-red-400';
        return 'text-purple-400';
    }
    if (type.startsWith('addon.')) return 'text-cyan-400';
    return 'text-gray-400';
};

const getEventTypeLabel = (type: string, t: (key: string) => string): string => {
    const eventTypeKey = `events.eventTypes.${type}`;
    const translated = t(eventTypeKey);
    // If translation returns the key itself, it means it doesn't exist, so return the type
    return translated !== eventTypeKey ? translated : type;
};

export function EventsView() {
    const { t } = useTranslation('visualization');
    const { t: tCommon } = useTranslation('common');
    const { isInitialized } = useConfigStore();
    const { events, clearEvents, selectedEventId, selectEvent } = useEventsStore();
    const [filter, setFilter] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<PlaygroundEvent | null>(null);

    const filteredEvents = filter
        ? events.filter((e) => {
              if (filter === 'customer') return e.type.startsWith('customer.');
              if (filter === 'subscription') return e.type.startsWith('subscription.');
              if (filter === 'payment') return e.type.startsWith('payment.');
              if (filter === 'invoice') return e.type.startsWith('invoice.');
              if (filter === 'addon') return e.type.startsWith('addon.');
              return true;
          })
        : events;

    const handleEventClick = (event: PlaygroundEvent) => {
        setSelectedEvent(event);
        selectEvent(event.id);
    };

    const closeDetail = () => {
        setSelectedEvent(null);
        selectEvent(null);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleString('en-US', {
            dateStyle: 'short',
            timeStyle: 'medium'
        });
    };

    if (!isInitialized) {
        return (
            <EmptyState
                icon={Activity}
                title={tCommon('billingNotInitialized.title')}
                description={tCommon('billingNotInitialized.description')}
            />
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <PageHeader
                title={t('events.title')}
                description={t('events.description')}
                icon={Activity}
                helpTitle={t('events.helpTitle')}
                helpContent={
                    <div className="space-y-2">
                        <p>{t('events.helpContent')}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                <span>{t('events.legend.customer')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-400" />
                                <span>{t('events.legend.subscription')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>{t('events.legend.payment')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                <span>{t('events.legend.invoice')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                <span>{t('events.legend.errors')}</span>
                            </div>
                        </div>
                    </div>
                }
                actions={
                    <div className="flex items-center gap-2">
                        <select value={filter || ''} onChange={(e) => setFilter(e.target.value || null)} className="select">
                            <option value="">{t('events.filters.all')}</option>
                            <option value="customer">{t('events.filters.customer')}</option>
                            <option value="subscription">{t('events.filters.subscription')}</option>
                            <option value="payment">{t('events.filters.payment')}</option>
                            <option value="invoice">{t('events.filters.invoice')}</option>
                            <option value="addon">{t('events.filters.addon')}</option>
                        </select>
                        {events.length > 0 && (
                            <button
                                type="button"
                                onClick={clearEvents}
                                className="btn btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/30"
                            >
                                <Trash2 className="h-4 w-4" />
                                {t('events.clear')}
                            </button>
                        )}
                    </div>
                }
            />

            {/* Events List */}
            {filteredEvents.length === 0 ? (
                <EmptyState
                    icon={Activity}
                    title={events.length === 0 ? t('events.empty.noEvents') : t('events.empty.noMatching')}
                    description={events.length === 0 ? t('events.empty.startSimulating') : t('events.empty.noMatchingFilter')}
                    tips={events.length === 0 ? [t('events.tips.tip1'), t('events.tips.tip2'), t('events.tips.tip3')] : undefined}
                />
            ) : (
                <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {filteredEvents.map((event) => (
                        <button
                            key={event.id}
                            type="button"
                            onClick={() => handleEventClick(event)}
                            className={`
                w-full p-4 text-left hover:bg-[var(--color-surface-elevated)] transition-colors
                ${selectedEventId === event.id ? 'bg-[var(--color-accent-low)]' : ''}
              `}
                            style={{ borderColor: 'var(--color-border)' }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Activity className={`h-5 w-5 ${getEventTypeColor(event.type)}`} />
                                    <div>
                                        <div className={`font-medium ${getEventTypeColor(event.type)}`}>
                                            {getEventTypeLabel(event.type, t)}
                                        </div>
                                        <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                            {event.type}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {formatTime(event.timestamp)}
                                    </div>
                                    <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                        {event.id.slice(0, 20)}...
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <div className="modal-overlay" onClick={closeDetail}>
                    <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className={`font-medium ${getEventTypeColor(selectedEvent.type)}`}>
                                    {getEventTypeLabel(selectedEvent.type, t)}
                                </h3>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                    {formatTime(selectedEvent.timestamp)} • {selectedEvent.id}
                                </p>
                            </div>
                            <button type="button" onClick={closeDetail} className="btn btn-ghost p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    {t('events.modal.webhookInfo')}
                                </p>
                            </div>
                            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                {t('events.modal.eventPayload')}
                            </h4>
                            <pre className="code-block text-xs overflow-x-auto" style={{ maxHeight: '50vh' }}>
                                {JSON.stringify(selectedEvent.payload, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
