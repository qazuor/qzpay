/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Error boundary props
 */
export interface QZPayErrorBoundaryProps {
    /**
     * Child components to render
     */
    children: ReactNode;

    /**
     * Fallback UI to show when an error occurs
     * Can be a ReactNode or a function that receives the error
     */
    fallback?: ReactNode | ((error: Error) => ReactNode);

    /**
     * Callback when an error is caught
     */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Error boundary state
 */
interface QZPayErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Default fallback UI
 */
function DefaultFallback({ error }: { error: Error }): ReactNode {
    return (
        <div
            role="alert"
            aria-live="assertive"
            style={{
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626'
            }}
        >
            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem' }}>An error occurred while rendering this component.</p>
            {error.message && (
                <details style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.875rem', opacity: 0.8 }}>Error details</summary>
                    <pre
                        style={{
                            marginTop: '8px',
                            padding: '12px',
                            fontSize: '0.75rem',
                            backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            borderRadius: '4px',
                            overflow: 'auto',
                            maxHeight: '200px'
                        }}
                    >
                        {error.message}
                    </pre>
                </details>
            )}
        </div>
    );
}

/**
 * Error Boundary component for QZPay React components
 *
 * @example
 * ```tsx
 * // Basic usage with default fallback
 * <QZPayErrorBoundary>
 *   <PaymentForm {...props} />
 * </QZPayErrorBoundary>
 *
 * // With custom fallback
 * <QZPayErrorBoundary
 *   fallback={<div>Oops! Payment form failed to load.</div>}
 * >
 *   <PaymentForm {...props} />
 * </QZPayErrorBoundary>
 *
 * // With error callback
 * <QZPayErrorBoundary
 *   onError={(error, errorInfo) => {
 *     console.error('Payment error:', error, errorInfo);
 *     logErrorToService(error);
 *   }}
 * >
 *   <PaymentForm {...props} />
 * </QZPayErrorBoundary>
 *
 * // With dynamic fallback based on error
 * <QZPayErrorBoundary
 *   fallback={(error) => (
 *     <div>
 *       <h3>Payment Error</h3>
 *       <p>{error.message}</p>
 *       <button onClick={() => window.location.reload()}>
 *         Try Again
 *       </button>
 *     </div>
 *   )}
 * >
 *   <PaymentForm {...props} />
 * </QZPayErrorBoundary>
 * ```
 */
export class QZPayErrorBoundary extends Component<QZPayErrorBoundaryProps, QZPayErrorBoundaryState> {
    constructor(props: QZPayErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): QZPayErrorBoundaryState {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to error reporting service
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // Log to console in development
        // biome-ignore lint/complexity/useLiteralKeys: process.env requires bracket notation for index signature
        if (process.env['NODE_ENV'] === 'development') {
            console.error('QZPay Error Boundary caught an error:', error, errorInfo);
        }
    }

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            // Render fallback UI
            const { fallback } = this.props;

            if (fallback) {
                // If fallback is a function, call it with the error
                if (typeof fallback === 'function') {
                    return fallback(this.state.error);
                }
                // Otherwise render the provided ReactNode
                return fallback;
            }

            // Use default fallback
            return <DefaultFallback error={this.state.error} />;
        }

        return this.props.children;
    }
}
