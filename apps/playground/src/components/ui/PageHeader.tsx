import { Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    description: string;
    icon?: LucideIcon;
    helpTitle?: string;
    helpContent?: ReactNode;
    actions?: ReactNode;
}

export function PageHeader({ title, description, icon: Icon, helpTitle, helpContent, actions }: PageHeaderProps) {
    return (
        <div className="space-y-4">
            {/* Title and Actions */}
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'var(--color-accent-low)' }}
                        >
                            <Icon className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                            {title}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            {description}
                        </p>
                    </div>
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>

            {/* Help Box */}
            {helpContent && (
                <div className="card p-4" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                        <div>
                            {helpTitle && (
                                <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                                    {helpTitle}
                                </h3>
                            )}
                            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                {helpContent}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
