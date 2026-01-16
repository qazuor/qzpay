import { QZPayProvider } from '@qazuor/qzpay-react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/layout/Header';
import { MainPanel } from './components/layout/MainPanel';
import { RightSidebar } from './components/layout/RightSidebar';
import { Sidebar } from './components/layout/Sidebar';
import { WelcomePage } from './features/welcome/WelcomePage';
import { useConfigStore } from './stores/config.store';

// Initialize i18n
import './i18n';

export type ViewType =
    | 'welcome'
    | 'setup'
    | 'plans'
    | 'prices'
    | 'addons'
    | 'products'
    | 'promos'
    | 'entitlements'
    | 'limits'
    | 'customers'
    | 'subscriptions'
    | 'payments'
    | 'savedCards'
    | 'invoices'
    | 'state'
    | 'events'
    | 'components';

const WELCOME_DISMISSED_KEY = 'qzpay-playground-welcome-dismissed';

// Panel types for right sidebar
export type PanelId = 'customers' | 'reference' | 'events' | 'state';

// For backwards compatibility
export type RightSidebarTab = 'reference' | 'events' | 'state';

export default function App() {
    const [currentView, setCurrentView] = useState<ViewType>('setup');
    const [showWelcome, setShowWelcome] = useState(true);
    const [activePanels, setActivePanels] = useState<Set<PanelId>>(new Set(['events']));
    const { isInitialized, billing } = useConfigStore();

    // Check if welcome was dismissed this session
    useEffect(() => {
        const dismissed = sessionStorage.getItem(WELCOME_DISMISSED_KEY);
        if (dismissed === 'true' && isInitialized) {
            setShowWelcome(false);
        }
    }, [isInitialized]);

    const handleGetStarted = () => {
        sessionStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
        setShowWelcome(false);
    };

    // Handle navigation from guided tour
    const handleTourNavigate = (view: string) => {
        if (view === 'welcome') {
            setShowWelcome(true);
        } else {
            setShowWelcome(false);
            setCurrentView(view as ViewType);
        }
    };

    // Toggle panel visibility (max 4 panels)
    const togglePanel = useCallback((panelId: PanelId) => {
        setActivePanels((prev) => {
            const next = new Set(prev);
            if (next.has(panelId)) {
                next.delete(panelId);
            } else if (next.size < 4) {
                next.add(panelId);
            }
            return next;
        });
    }, []);

    // Handle view change from sidebar
    const handleViewChange = (view: ViewType) => {
        if (view === 'events' || view === 'state') {
            // Toggle the corresponding panel
            togglePanel(view);
        } else {
            setCurrentView(view);
        }
    };

    // Show welcome page on first visit each session
    if (showWelcome) {
        return (
            <ErrorBoundary>
                <WelcomePage onGetStarted={handleGetStarted} onNavigate={handleTourNavigate} />
            </ErrorBoundary>
        );
    }

    const playgroundLayout = (
        <div className="flex h-screen flex-col">
            <Header onShowWelcome={() => setShowWelcome(true)} activePanels={activePanels} onTogglePanel={togglePanel} />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar currentView={currentView} onViewChange={handleViewChange} activePanels={activePanels} />
                <MainPanel currentView={currentView} />
                <RightSidebar currentView={currentView} activePanels={activePanels} />
            </div>
        </div>
    );

    // Wrap with QZPayProvider when billing is initialized
    if (billing) {
        return (
            <ErrorBoundary>
                <QZPayProvider billing={billing}>{playgroundLayout}</QZPayProvider>
            </ErrorBoundary>
        );
    }

    return <ErrorBoundary>{playgroundLayout}</ErrorBoundary>;
}
