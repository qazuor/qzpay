import { useCallback, useState } from 'react';
import { ConfirmModal, type ConfirmVariant } from '../components/ui/ConfirmModal';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
}

/**
 * Hook to display confirmation dialogs
 *
 * @example
 * const confirm = useConfirm();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm.show({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item?',
 *     variant: 'danger',
 *   });
 *
 *   if (confirmed) {
 *     // Proceed with deletion
 *   }
 * };
 */
export function useConfirm() {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: '',
        message: ''
    });
    const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

    const show = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions(opts);
            setIsOpen(true);
            setResolveRef(() => resolve);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setIsOpen(false);
        if (resolveRef) {
            resolveRef(true);
            setResolveRef(null);
        }
    }, [resolveRef]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        if (resolveRef) {
            resolveRef(false);
            setResolveRef(null);
        }
    }, [resolveRef]);

    const ConfirmDialog = useCallback(
        () => (
            <ConfirmModal
                isOpen={isOpen}
                onClose={handleClose}
                onConfirm={handleConfirm}
                title={options.title}
                message={options.message}
                confirmText={options.confirmText}
                cancelText={options.cancelText}
                variant={options.variant}
            />
        ),
        [isOpen, handleClose, handleConfirm, options]
    );

    return {
        show,
        ConfirmDialog
    };
}
