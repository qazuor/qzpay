import { Check, ChevronDown, ChevronRight, Copy, Database, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportPlaygroundData } from '../../../adapters/local-storage.adapter';

interface TreeNodeProps {
    label: string;
    data: unknown;
    depth?: number;
    defaultExpanded?: boolean;
}

function TreeNode({ label, data, depth = 0, defaultExpanded = false }: TreeNodeProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const isObject = typeof data === 'object' && data !== null;
    const isArray = Array.isArray(data);
    const isEmpty = isObject && Object.keys(data).length === 0;

    const getPreview = () => {
        if (data === null) return 'null';
        if (data === undefined) return 'undefined';
        if (typeof data === 'string') return `"${data.slice(0, 30)}${data.length > 30 ? '...' : ''}"`;
        if (typeof data === 'number' || typeof data === 'boolean') return String(data);
        if (isArray) return `[${data.length}]`;
        if (isObject) return `{${Object.keys(data).length}}`;
        return String(data);
    };

    const getValueColor = () => {
        if (data === null || data === undefined) return 'var(--color-text-muted)';
        if (typeof data === 'string') return '#a5d6a7'; // green
        if (typeof data === 'number') return '#90caf9'; // blue
        if (typeof data === 'boolean') return '#ffab91'; // orange
        return 'var(--color-text-secondary)';
    };

    if (!isObject || isEmpty) {
        return (
            <div className="flex items-center gap-1 py-0.5 text-xs font-mono">
                <span className="w-3" />
                <span style={{ color: 'var(--color-accent)' }}>{label}:</span>
                <span style={{ color: getValueColor() }}>{getPreview()}</span>
            </div>
        );
    }

    const entries = Object.entries(data as Record<string, unknown>);
    const displayEntries = depth >= 2 ? entries.slice(0, 5) : entries;
    const hasMore = entries.length > displayEntries.length;

    return (
        <div>
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-0.5 py-0.5 text-xs font-mono hover:bg-[var(--color-surface-elevated)] w-full text-left rounded"
            >
                {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                )}
                <span style={{ color: 'var(--color-accent)' }}>{label}:</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{getPreview()}</span>
            </button>
            {isExpanded && (
                <div className="ml-3 border-l pl-1" style={{ borderColor: 'var(--color-border)' }}>
                    {displayEntries.map(([key, value]) => (
                        <TreeNode key={key} label={key} data={value} depth={depth + 1} />
                    ))}
                    {hasMore && (
                        <div className="text-xs py-0.5 pl-4" style={{ color: 'var(--color-text-secondary)' }}>
                            ... {entries.length - displayEntries.length} more
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function StatePanel() {
    const { t } = useTranslation('sidebar');
    const [stateData, setStateData] = useState<Record<string, unknown> | null>(null);
    const [copied, setCopied] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const refresh = () => {
        const data = exportPlaygroundData();
        setStateData(data as unknown as Record<string, unknown>);
    };

    // Initial load and auto-refresh
    useEffect(() => {
        refresh();
        if (autoRefresh) {
            const interval = setInterval(refresh, 2000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    const handleCopyAll = async () => {
        if (stateData) {
            await navigator.clipboard.writeText(JSON.stringify(stateData, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    // Count items in each section
    const getCounts = () => {
        if (!stateData) return {};
        const counts: Record<string, number> = {};
        for (const [key, value] of Object.entries(stateData)) {
            if (typeof value === 'object' && value !== null) {
                counts[key] = Object.keys(value).length;
            }
        }
        return counts;
    };

    const counts = getCounts();

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="w-3.5 h-3.5 rounded"
                        />
                        <span style={{ color: 'var(--color-text-secondary)' }}>{t('state.autoRefresh')}</span>
                    </label>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleCopyAll}
                        className="p-1 rounded hover:bg-opacity-10 hover:bg-white transition-colors"
                        title={t('state.copyAll')}
                    >
                        {copied ? (
                            <Check className="h-3 w-3 text-green-400" />
                        ) : (
                            <Copy className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={refresh}
                        className="p-1 rounded hover:bg-opacity-10 hover:bg-white transition-colors"
                        title={t('state.refresh')}
                    >
                        <RefreshCw className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>
            </div>

            {/* Quick Overview */}
            <div className="px-3 py-2 border-b grid grid-cols-4 gap-1" style={{ borderColor: 'var(--color-border)' }}>
                {['customers', 'plans', 'subscriptions', 'payments'].map((key) => (
                    <div key={key} className="text-center">
                        <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                            {counts[key] || 0}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {key.slice(0, 4)}
                        </div>
                    </div>
                ))}
            </div>

            {/* State Tree */}
            <div className="flex-1 overflow-y-auto p-2">
                {stateData ? (
                    <div className="space-y-0.5">
                        {Object.entries(stateData).map(([key, value]) => (
                            <TreeNode
                                key={key}
                                label={key}
                                data={value}
                                defaultExpanded={['customers', 'plans', 'subscriptions'].includes(key)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                        <Database className="h-8 w-8 mb-2" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {t('state.noData')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
