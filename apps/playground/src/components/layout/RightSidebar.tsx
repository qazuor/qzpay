import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  Activity,
  Database,
  Users,
} from 'lucide-react';
import { QuickReferencePanel } from './panels/QuickReferencePanel';
import { EventsPanel } from './panels/EventsPanel';
import { StatePanel } from './panels/StatePanel';
import { CustomerPanel } from './panels/CustomerPanel';
import { useConfigStore } from '../../stores/config.store';
import type { ViewType, PanelId } from '../../App';

interface RightSidebarProps {
  currentView: ViewType;
  activePanels: Set<PanelId>;
}

// Panel configuration with icons and components
// Using 'any' for component type to allow flexible props
const panelConfig: Record<PanelId, {
  icon: typeof Users;
  labelKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
}> = {
  customers: {
    icon: Users,
    labelKey: 'tabs.customers',
    component: CustomerPanel,
  },
  reference: {
    icon: CreditCard,
    labelKey: 'tabs.reference',
    component: QuickReferencePanel,
  },
  events: {
    icon: Activity,
    labelKey: 'tabs.events',
    component: EventsPanel,
  },
  state: {
    icon: Database,
    labelKey: 'tabs.state',
    component: StatePanel,
  },
};

// Define panel order
const panelOrder: PanelId[] = ['customers', 'reference', 'events', 'state'];

export function RightSidebar({
  currentView,
  activePanels,
}: RightSidebarProps) {
  const { t } = useTranslation('sidebar');
  const { isInitialized } = useConfigStore();

  // No panels active
  if (activePanels.size === 0 || !isInitialized) {
    return null;
  }

  // Sort active panels by defined order
  const sortedPanels = panelOrder.filter((id) => activePanels.has(id));

  return (
    <div className="flex h-full">
      {sortedPanels.map((panelId) => {
        const config = panelConfig[panelId];
        const Icon = config.icon;
        const Component = config.component;

        return (
          <div
            key={panelId}
            className="w-72 border-l flex flex-col flex-shrink-0"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Panel Header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                  {t(config.labelKey, panelId)}
                </span>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              <Component currentView={currentView} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
