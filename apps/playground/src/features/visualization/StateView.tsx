import { ChevronDown, ChevronRight, Database, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config.store';
import { exportPlaygroundData } from '../../adapters/local-storage.adapter';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';

interface TreeNodeProps {
  label: string;
  data: unknown;
  defaultExpanded?: boolean;
}

function TreeNode({ label, data, defaultExpanded = false }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const isObject = typeof data === 'object' && data !== null;
  const isArray = Array.isArray(data);
  const isEmpty = isObject && Object.keys(data).length === 0;

  const getPreview = () => {
    if (data === null) return 'null';
    if (data === undefined) return 'undefined';
    if (typeof data === 'string') return `"${data.slice(0, 50)}${data.length > 50 ? '...' : ''}"`;
    if (typeof data === 'number' || typeof data === 'boolean') return String(data);
    if (isArray) return `Array(${data.length})`;
    if (isObject) return `{${Object.keys(data).length} keys}`;
    return String(data);
  };

  if (!isObject || isEmpty) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-sm">
        <span className="w-4" />
        <span style={{ color: 'var(--color-accent)' }}>{label}:</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{getPreview()}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 py-0.5 text-sm hover:bg-[var(--color-surface-elevated)] w-full text-left rounded"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
        ) : (
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
        )}
        <span style={{ color: 'var(--color-accent)' }}>{label}:</span>
        <span style={{ color: 'var(--color-text-muted)' }}>{getPreview()}</span>
      </button>
      {isExpanded && (
        <div className="ml-4 border-l pl-2" style={{ borderColor: 'var(--color-border)' }}>
          {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
            <TreeNode key={key} label={key} data={value} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StateView() {
  const { t } = useTranslation('visualization');
  const { t: tCommon } = useTranslation('common');
  const { isInitialized } = useConfigStore();
  const [stateData, setStateData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (isInitialized) {
      const data = exportPlaygroundData();
      setStateData(data as unknown as Record<string, unknown>);
    }
  }, [isInitialized]);

  const refresh = () => {
    const data = exportPlaygroundData();
    setStateData(data as unknown as Record<string, unknown>);
  };

  if (!isInitialized) {
    return (
      <EmptyState
        icon={Database}
        title={tCommon('billingNotInitialized.title')}
        description={tCommon('billingNotInitialized.description')}
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t('state.title')}
        description={t('state.description')}
        icon={Database}
        helpTitle={t('state.helpTitle')}
        helpContent={
          <div className="space-y-2">
            <p>
              {t('state.helpContent')}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('state.helpNote')}
            </p>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={refresh}
            className="btn btn-secondary"
          >
            <RefreshCw className="h-4 w-4" />
            {t('state.refresh')}
          </button>
        }
      />

      {/* State Tree */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          <Database className="h-5 w-5" />
          <span className="font-medium font-mono text-sm">{t('state.localStorageKey')}</span>
        </div>

        {stateData ? (
          <div className="font-mono text-xs overflow-auto max-h-[60vh]">
            {Object.entries(stateData).map(([key, value]) => (
              <TreeNode key={key} label={key} data={value} defaultExpanded />
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('state.noData')}</p>
        )}
      </div>
    </div>
  );
}
