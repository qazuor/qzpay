import { Activity, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { type PlaygroundEvent, getEventTypeColor, getEventTypeLabel, useEventsStore } from '../../stores/events.store';

export function EventTimeline() {
    const { events, clearEvents, selectedEventId, selectEvent } = useEventsStore();
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const selectedEvent = events.find((e) => e.id === selectedEventId);

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
                return `${payload.id.slice(0, 12)}...`;
            }
            // Handle nested objects like subscription.addon_added
            if ('subscription' in payload) {
                const sub = payload.subscription as Record<string, unknown>;
                if (sub && 'id' in sub && typeof sub.id === 'string') {
                    return `${sub.id.slice(0, 12)}...`;
                }
            }
        }
        return '';
    };

    const handleEventClick = (event: PlaygroundEvent) => {
        selectEvent(event.id);
        setIsDetailOpen(true);
    };

    const closeDetail = () => {
        setIsDetailOpen(false);
        selectEvent(null);
    };

    return (
        <div className="border-t border-gray-200 bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                    <Activity className="h-4 w-4" />
                    Event Timeline
                    <span className="text-gray-400">({events.length})</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>

                {events.length > 0 && (
                    <button
                        type="button"
                        onClick={clearEvents}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                    >
                        <Trash2 className="h-3 w-3" />
                        Clear
                    </button>
                )}
            </div>

            {/* Timeline */}
            {isExpanded && (
                <div className="h-40 overflow-y-auto px-2 py-1 event-timeline">
                    {events.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm text-gray-400">
                            No events yet. Start simulating billing flows to see events here.
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {events.map((event) => (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => handleEventClick(event)}
                                    className={`
                    w-full event-timeline-item text-left
                    ${selectedEventId === event.id ? 'bg-primary-50' : ''}
                  `}
                                >
                                    <span className="event-timeline-time">{formatTime(event.timestamp)}</span>
                                    <span className={`event-timeline-type ${getEventTypeColor(event.type)}`}>{event.type}</span>
                                    <span className="event-timeline-id">{getEntityId(event)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Event Detail Modal */}
            {isDetailOpen && selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <div>
                                <h3 className={`font-medium ${getEventTypeColor(selectedEvent.type)}`}>
                                    {getEventTypeLabel(selectedEvent.type)}
                                </h3>
                                <p className="text-xs text-gray-500">{selectedEvent.timestamp.toLocaleString()}</p>
                            </div>
                            <button type="button" onClick={closeDetail} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto max-h-[60vh]">
                            <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-x-auto">
                                {JSON.stringify(selectedEvent.payload, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
