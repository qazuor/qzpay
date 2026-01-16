import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    message: string;
    variant?: ToastVariant;
    duration?: number;
    onClose: () => void;
}

const variantStyles = {
    success: {
        iconColor: 'text-green-400',
        bgColor: 'bg-green-900/90',
        borderColor: 'border-green-500/50',
        Icon: CheckCircle
    },
    error: {
        iconColor: 'text-red-400',
        bgColor: 'bg-red-900/90',
        borderColor: 'border-red-500/50',
        Icon: XCircle
    },
    warning: {
        iconColor: 'text-yellow-400',
        bgColor: 'bg-yellow-900/90',
        borderColor: 'border-yellow-500/50',
        Icon: AlertTriangle
    },
    info: {
        iconColor: 'text-blue-400',
        bgColor: 'bg-blue-900/90',
        borderColor: 'border-blue-500/50',
        Icon: Info
    }
};

/**
 * Toast notification component
 * Displays a temporary notification message
 */
export function Toast({ message, variant = 'info', duration = 4000, onClose }: ToastProps) {
    const styles = variantStyles[variant];
    const Icon = styles.Icon;

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    return (
        <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm ${styles.bgColor} ${styles.borderColor}`}
            style={{ minWidth: '300px', maxWidth: '500px' }}
        >
            <Icon className={`h-5 w-5 flex-shrink-0 ${styles.iconColor}`} />
            <p className="flex-1 text-sm text-white">{message}</p>
            <button type="button" onClick={onClose} className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors">
                <X className="h-4 w-4 text-white/80" />
            </button>
        </div>
    );
}
