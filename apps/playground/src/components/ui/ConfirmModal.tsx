import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    isProcessing?: boolean;
}

const variantStyles = {
    danger: {
        iconColor: 'text-red-400',
        bgColor: 'bg-red-900/20',
        borderColor: 'border-red-500/30',
        buttonClass: 'bg-red-600 hover:bg-red-700',
        Icon: XCircle
    },
    warning: {
        iconColor: 'text-yellow-400',
        bgColor: 'bg-yellow-900/20',
        borderColor: 'border-yellow-500/30',
        buttonClass: 'bg-yellow-600 hover:bg-yellow-700',
        Icon: AlertTriangle
    },
    info: {
        iconColor: 'text-blue-400',
        bgColor: 'bg-blue-900/20',
        borderColor: 'border-blue-500/30',
        buttonClass: 'btn-primary',
        Icon: Info
    },
    success: {
        iconColor: 'text-green-400',
        bgColor: 'bg-green-900/20',
        borderColor: 'border-green-500/30',
        buttonClass: 'bg-green-600 hover:bg-green-700',
        Icon: CheckCircle
    }
};

/**
 * Confirm modal component
 * Displays a confirmation dialog with customizable variant styles
 */
export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    cancelText,
    variant = 'warning',
    isProcessing = false
}: ConfirmModalProps) {
    const { t } = useTranslation('common');
    const styles = variantStyles[variant];
    const Icon = styles.Icon;

    const handleConfirm = () => {
        onConfirm();
    };

    const handleClose = () => {
        if (!isProcessing) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="modal-overlay"
            onClick={handleClose}
            onKeyDown={(e) => e.key === 'Escape' && handleClose()}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
        >
            <div
                className="modal-content max-w-md"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="document"
            >
                <div className="modal-header">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                        {title}
                    </h3>
                    <button type="button" onClick={handleClose} className="btn btn-ghost p-1" disabled={isProcessing}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="modal-body space-y-4">
                    <div className={`p-4 rounded-lg flex items-start gap-3 border ${styles.bgColor} ${styles.borderColor}`}>
                        <Icon className={`h-6 w-6 flex-shrink-0 mt-0.5 ${styles.iconColor}`} />
                        <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                            {message}
                        </p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={isProcessing}>
                        {cancelText || t('buttons.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`btn ${styles.buttonClass} text-white`}
                        disabled={isProcessing}
                    >
                        {confirmText || t('buttons.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}
