import { useState, useEffect, useCallback } from 'react';
import { QZPayProvider } from '@qazuor/qzpay-react';
import { Header } from './components/layout/Header';
import { MainPanel } from './components/layout/MainPanel';
import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { WelcomePage } from './features/welcome/WelcomePage';
import { WizardOverlay } from './components/wizard';
import { useConfigStore } from './stores/config.store';
import { useWizardStore } from './stores/wizard.store';

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
  const { isActive: isWizardActive, getCurrentStep } = useWizardStore();

  // Check if welcome was dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem(WELCOME_DISMISSED_KEY);
    if (dismissed === 'true' && isInitialized) {
      setShowWelcome(false);
    }
  }, [isInitialized]);

  // Sync view with wizard step when wizard is active
  useEffect(() => {
    if (isWizardActive) {
      const currentStep = getCurrentStep();
      if (currentStep && currentStep.targetView !== 'welcome') {
        setCurrentView(currentStep.targetView);
      }
    }
  }, [isWizardActive, getCurrentStep]);

  const handleGetStarted = () => {
    sessionStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    setShowWelcome(false);
  };

  const handleWizardNavigate = (view: string) => {
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
      <>
        <WelcomePage onGetStarted={handleGetStarted} />
        <WizardOverlay onNavigate={handleWizardNavigate} />
      </>
    );
  }

  const playgroundLayout = (
    <>
      <div className="flex h-screen flex-col">
        <Header
          onShowWelcome={() => setShowWelcome(true)}
          activePanels={activePanels}
          onTogglePanel={togglePanel}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            activePanels={activePanels}
          />
          <MainPanel currentView={currentView} />
          <RightSidebar
            currentView={currentView}
            activePanels={activePanels}
          />
        </div>
      </div>
      <WizardOverlay onNavigate={handleWizardNavigate} />
    </>
  );

  // Wrap with QZPayProvider when billing is initialized
  if (billing) {
    return (
      <QZPayProvider billing={billing}>
        {playgroundLayout}
      </QZPayProvider>
    );
  }

  return playgroundLayout;
}
