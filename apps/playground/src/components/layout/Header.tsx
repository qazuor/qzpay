import { Activity, CreditCard, Database, Download, HelpCircle, RefreshCw, Upload, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PanelId } from '../../App';
import { clearPlaygroundStorage, exportPlaygroundData, importPlaygroundData } from '../../adapters/local-storage.adapter';
import { resetMockPaymentAdapter } from '../../adapters/mock-payment.adapter';
import { TimeSimulator } from '../../features/simulation/TimeSimulator';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useConfigStore } from '../../stores/config.store';
import { useEventsStore } from '../../stores/events.store';
import { LanguageSelector } from '../LanguageSelector';

interface HeaderProps {
    onShowWelcome?: () => void;
    activePanels: Set<PanelId>;
    onTogglePanel: (panelId: PanelId) => void;
}

// Panel configuration
const panels: { id: PanelId; icon: typeof Users; label: string }[] = [
    { id: 'customers', icon: Users, label: 'Customers' },
    { id: 'reference', icon: CreditCard, label: 'Reference' },
    { id: 'events', icon: Activity, label: 'Events' },
    { id: 'state', icon: Database, label: 'State' }
];

export function Header({ onShowWelcome, activePanels, onTogglePanel }: HeaderProps) {
    const { t } = useTranslation('components');
    const { paymentMode, resetConfig, initializeBilling } = useConfigStore();
    const { clearEvents } = useEventsStore();
    const confirm = useConfirm();
    const toast = useToast();

    const handleExport = () => {
        const data = exportPlaygroundData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qzpay-playground-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                importPlaygroundData(data);
                await initializeBilling();
                clearEvents();
                toast.success(t('header.importSuccess', 'Data imported successfully'));
            } catch {
                toast.error(t('header.errors.importFailed'));
            }
        };
        input.click();
    };

    const handleReset = async () => {
        const confirmed = await confirm.show({
            title: t('header.reset'),
            message: t('header.confirmReset', 'Are you sure you want to reset all data? This cannot be undone.'),
            variant: 'danger',
            confirmText: t('header.reset')
        });

        if (confirmed) {
            clearPlaygroundStorage();
            resetMockPaymentAdapter();
            resetConfig();
            clearEvents();
            window.location.reload();
        }
    };

    const getModeLabel = () => {
        switch (paymentMode) {
            case 'stripe':
                return t('header.modes.stripe');
            case 'mercadopago':
                return t('header.modes.mercadopago');
            default:
                return t('header.modes.mock');
        }
    };

    const getModeColor = () => {
        switch (paymentMode) {
            case 'stripe':
                return 'bg-purple-900/50 text-purple-300';
            case 'mercadopago':
                return 'bg-cyan-900/50 text-cyan-300';
            default:
                return 'badge-primary';
        }
    };

    return (
        <header
            data-tour="header"
            className="flex items-center justify-between px-6"
            style={{
                height: 'var(--header-height)',
                backgroundColor: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)'
            }}
        >
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold gradient-text">QZPay Playground</h1>
                <span className={`badge ${getModeColor()}`} data-tour="payment-mode-badge">
                    {getModeLabel()}
                </span>
                <TimeSimulator compact />
            </div>

            <div className="flex items-center gap-2">
                {/* Panel Toggle Buttons */}
                <div
                    data-tour="panel-toggles"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg"
                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                >
                    {panels.map((panel) => {
                        const Icon = panel.icon;
                        const isActive = activePanels.has(panel.id);
                        return (
                            <button
                                key={panel.id}
                                type="button"
                                onClick={() => onTogglePanel(panel.id)}
                                className={`p-2 rounded-md transition-all ${
                                    isActive ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-opacity-10 hover:bg-white'
                                }`}
                                style={{
                                    color: isActive ? undefined : 'var(--color-text-muted)'
                                }}
                                title={`${panel.label} ${isActive ? '(active)' : ''}`}
                            >
                                <Icon className="h-4 w-4" />
                            </button>
                        );
                    })}
                </div>

                <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--color-border)' }} />

                <LanguageSelector />

                <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--color-border)' }} />

                <div data-tour="header-actions" className="flex items-center gap-2">
                    {onShowWelcome && (
                        <button type="button" onClick={onShowWelcome} className="btn btn-ghost" title={t('header.tooltips.help')}>
                            <HelpCircle className="h-4 w-4" />
                            {t('header.help')}
                        </button>
                    )}

                    <button type="button" onClick={handleExport} className="btn btn-ghost" title={t('header.tooltips.export')}>
                        <Download className="h-4 w-4" />
                        {t('header.export')}
                    </button>

                    <button type="button" onClick={handleImport} className="btn btn-ghost" title={t('header.tooltips.import')}>
                        <Upload className="h-4 w-4" />
                        {t('header.import')}
                    </button>

                    <button
                        type="button"
                        onClick={handleReset}
                        className="btn btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/30"
                        title={t('header.tooltips.reset')}
                    >
                        <RefreshCw className="h-4 w-4" />
                        {t('header.reset')}
                    </button>
                </div>
            </div>

            {/* Confirm Dialog */}
            <confirm.ConfirmDialog />

            {/* Toast Container */}
            <toast.ToastContainer />
        </header>
    );
}
