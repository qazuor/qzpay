import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  tips?: string[];
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tips,
}: EmptyStateProps) {
  return (
    <div className="card p-8">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-surface-elevated)' }}
        >
          <Icon className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        <p className="text-sm mb-4 max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
        {action && <div className="mb-4">{action}</div>}
        {tips && tips.length > 0 && (
          <div
            className="mt-6 p-4 rounded-lg text-left max-w-md mx-auto"
            style={{ backgroundColor: 'var(--color-surface-elevated)' }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
              TIPS
            </p>
            <ul className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span style={{ color: 'var(--color-accent)' }}>•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
