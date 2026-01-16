import { useCallback, useState } from 'react';
import { Toast, type ToastVariant } from '../components/ui/Toast';

interface ToastOptions {
    message: string;
    variant?: ToastVariant;
    duration?: number;
}

interface ToastState extends ToastOptions {
    id: number;
}

/**
 * Hook to display toast notifications
 *
 * @example
 * const toast = useToast();
 *
 * toast.success('Operation completed successfully!');
 * toast.error('Something went wrong');
 * toast.warning('This action requires confirmation');
 * toast.info('New features available');
 */
export function useToast() {
    const [toasts, setToasts] = useState<ToastState[]>([]);

    const show = useCallback((options: ToastOptions) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { ...options, id }]);
    }, []);

    const remove = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const success = useCallback(
        (message: string, duration?: number) => {
            show({ message, variant: 'success', duration });
        },
        [show]
    );

    const error = useCallback(
        (message: string, duration?: number) => {
            show({ message, variant: 'error', duration });
        },
        [show]
    );

    const warning = useCallback(
        (message: string, duration?: number) => {
            show({ message, variant: 'warning', duration });
        },
        [show]
    );

    const info = useCallback(
        (message: string, duration?: number) => {
            show({ message, variant: 'info', duration });
        },
        [show]
    );

    const ToastContainer = useCallback(
        () => (
            <>
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        variant={toast.variant}
                        duration={toast.duration}
                        onClose={() => remove(toast.id)}
                    />
                ))}
            </>
        ),
        [toasts, remove]
    );

    return {
        show,
        success,
        error,
        warning,
        info,
        ToastContainer
    };
}
