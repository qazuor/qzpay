import type { ViewType } from '../../App';
import { SetupView } from '../../features/setup/SetupView';
import { PlansView } from '../../features/catalog/PlansView';
import { PricesView } from '../../features/catalog/PricesView';
import { AddonsView } from '../../features/catalog/AddonsView';
import { ProductsView } from '../../features/catalog/ProductsView';
import { PromosView } from '../../features/catalog/PromosView';
import { EntitlementsView } from '../../features/catalog/EntitlementsView';
import { LimitsView } from '../../features/catalog/LimitsView';
import { CustomersView } from '../../features/simulation/CustomersView';
import { SubscriptionsView } from '../../features/simulation/SubscriptionsView';
import { PaymentsView } from '../../features/simulation/PaymentsView';
import { InvoicesView } from '../../features/simulation/InvoicesView';
import { StateView } from '../../features/visualization/StateView';
import { EventsView } from '../../features/visualization/EventsView';
import { ComponentsView } from '../../features/components/ComponentsView';

interface MainPanelProps {
  currentView: ViewType;
}

export function MainPanel({ currentView }: MainPanelProps) {
  const renderView = () => {
    switch (currentView) {
      case 'setup':
        return <SetupView />;
      case 'plans':
        return <PlansView />;
      case 'prices':
        return <PricesView />;
      case 'addons':
        return <AddonsView />;
      case 'products':
        return <ProductsView />;
      case 'promos':
        return <PromosView />;
      case 'entitlements':
        return <EntitlementsView />;
      case 'limits':
        return <LimitsView />;
      case 'customers':
        return <CustomersView />;
      case 'subscriptions':
        return <SubscriptionsView />;
      case 'payments':
        return <PaymentsView />;
      case 'invoices':
        return <InvoicesView />;
      case 'state':
        return <StateView />;
      case 'events':
        return <EventsView />;
      case 'components':
        return <ComponentsView />;
      default:
        return <SetupView />;
    }
  };

  return (
    <main
      className="flex-1 overflow-auto p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {renderView()}
    </main>
  );
}
