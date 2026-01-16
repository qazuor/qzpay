import { AlertTriangle } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component
 * Catches React errors and displays a fallback UI
 */
class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} onReload={this.handleReload} />;
        }

        return this.props.children;
    }
}

/**
 * Error fallback UI component
 */
interface ErrorFallbackProps {
    error: Error | null;
    onReload: () => void;
}

function ErrorFallback({ error, onReload }: ErrorFallbackProps) {
    const { t } = useTranslation('common');

    return (
        <div className="flex items-center justify-center min-h-screen p-4" style={{ backgroundColor: 'var(--color-background)' }}>
            <div className="card p-8 max-w-lg w-full">
                <div className="text-center">
                    <div
                        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                    >
                        <AlertTriangle className="h-8 w-8" style={{ color: 'var(--color-danger)' }} />
                    </div>

                    <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                        {t('errorBoundary.title')}
                    </h1>

                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                        {t('errorBoundary.description')}
                    </p>

                    {error && (
                        <div
                            className="mb-6 p-4 rounded-lg text-left overflow-x-auto"
                            style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                        >
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                {t('errorBoundary.errorDetails')}
                            </p>
                            <code className="text-xs block" style={{ color: 'var(--color-danger)' }}>
                                {error.name}: {error.message}
                            </code>
                        </div>
                    )}

                    <button onClick={onReload} className="btn btn-primary" aria-label={t('errorBoundary.reload')}>
                        {t('errorBoundary.reload')}
                    </button>

                    <div className="mt-6 p-4 rounded-lg text-left" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t('tips')}
                        </p>
                        <ul className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--color-accent)' }}>•</span>
                                {t('errorBoundary.tip1')}
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--color-accent)' }}>•</span>
                                {t('errorBoundary.tip2')}
                            </li>
                            <li className="flex items-start gap-2">
                                <span style={{ color: 'var(--color-accent)' }}>•</span>
                                {t('errorBoundary.tip3')}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { ErrorBoundaryClass as ErrorBoundary };
