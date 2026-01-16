import { Activity, Check, ChevronDown, ChevronRight, Copy, Download, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PlaygroundEvent, getEventTypeColor, getEventTypeLabel, useEventsStore } from '../../../stores/events.store';

/**
 * Convert events to JSON string
 */
function eventsToJsonString(events: PlaygroundEvent[]) {
    const exportData = events.map((event) => ({
        id: event.id,
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        payload: event.payload
    }));
    return JSON.stringify(exportData, null, 2);
}

/**
 * Export events to JSON file
 */
function exportEventsToJson(events: PlaygroundEvent[]) {
    const jsonString = eventsToJsonString(events);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `qzpay-events-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function EventsPanel() {
    const { t } = useTranslation('sidebar');
    const { events, clearEvents, selectEvent } = useEventsStore();
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCopyToClipboard = async () => {
        const jsonString = eventsToJsonString(events);
        try {
            await navigator.clipboard.writeText(jsonString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = jsonString;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getEntityId = (event: PlaygroundEvent): string => {
        const payload = event.payload as unknown as Record<string, unknown>;
        if (typeof payload === 'object' && payload !== null) {
            if ('id' in payload && typeof payload.id === 'string') {
                return payload.id;
            }
            if ('subscription' in payload) {
                const sub = payload.subscription as Record<string, unknown>;
                if (sub && 'id' in sub && typeof sub.id === 'string') {
                    return sub.id;
                }
            }
        }
        return '';
    };

    const handleEventClick = (event: PlaygroundEvent) => {
        if (expandedEventId === event.id) {
            setExpandedEventId(null);
            selectEvent(null);
        } else {
            setExpandedEventId(event.id);
            selectEvent(event.id);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {t('events.count', { count: events.length })}
                </span>
                {events.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopyToClipboard}
                            className={`flex items-center gap-1 text-xs transition-colors ${copied ? 'text-green-400' : 'hover:text-blue-400'}`}
                            style={{ color: copied ? undefined : 'var(--color-text-muted)' }}
                            title={t('events.copy') || 'Copy to clipboard'}
                        >
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => exportEventsToJson(events)}
                            className="flex items-center gap-1 text-xs hover:text-blue-400 transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            title={t('events.export') || 'Export JSON'}
                        >
                            <Download className="h-3 w-3" />
                        </button>
                        <button
                            type="button"
                            onClick={clearEvents}
                            className="flex items-center gap-1 text-xs hover:text-red-400 transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            <Trash2 className="h-3 w-3" />
                            {t('events.clear')}
                        </button>
                    </div>
                )}
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-y-auto">
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                        <Activity className="h-8 w-8 mb-2" style={{ color: 'var(--color-text-secondary)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {t('events.empty')}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            {t('events.emptyHint')}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        {events.map((event) => {
                            const isExpanded = expandedEventId === event.id;
                            return (
                                <div key={event.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleEventClick(event)}
                                        className={`w-full text-left p-2 hover:bg-opacity-5 hover:bg-white transition-colors ${
                                            isExpanded ? 'bg-[var(--color-accent-low)]' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {isExpanded ? (
                                                    <ChevronDown className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                                                ) : (
                                                    <ChevronRight className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {formatTime(event.timestamp)}
                                                    </span>
                                                    <span className={`text-sm font-medium ${getEventTypeColor(event.type)}`}>
                                                        {event.type.split('.').pop()}
                                                    </span>
                                                </div>
                                                <div
                                                    className="text-xs font-mono break-all"
                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                >
                                                    {getEntityId(event)}
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div
                                            className="px-3 py-2 border-t"
                                            style={{
                                                backgroundColor: 'var(--color-bg)',
                                                borderColor: 'var(--color-border)'
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-xs font-medium ${getEventTypeColor(event.type)}`}>
                                                    {getEventTypeLabel(event.type)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExpandedEventId(null);
                                                        selectEvent(null);
                                                    }}
                                                    className="p-0.5 rounded hover:bg-opacity-10 hover:bg-white"
                                                >
                                                    <X className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                                                </button>
                                            </div>
                                            <pre
                                                className="text-xs font-mono overflow-x-auto p-2 rounded whitespace-pre-wrap break-all"
                                                style={{
                                                    backgroundColor: 'var(--color-surface)',
                                                    color: 'var(--color-text)'
                                                }}
                                            >
                                                {JSON.stringify(event.payload, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
