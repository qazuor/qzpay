import type { ViewType } from '../../App';
import { AddonsView } from '../../features/catalog/AddonsView';
import { EntitlementsView } from '../../features/catalog/EntitlementsView';
import { LimitsView } from '../../features/catalog/LimitsView';
import { PlansView } from '../../features/catalog/PlansView';
import { PricesView } from '../../features/catalog/PricesView';
import { ProductsView } from '../../features/catalog/ProductsView';
import { PromosView } from '../../features/catalog/PromosView';
import { ComponentsView } from '../../features/components/ComponentsView';
import { SetupView } from '../../features/setup/SetupView';
import { CustomersView } from '../../features/simulation/CustomersView';
import { InvoicesView } from '../../features/simulation/InvoicesView';
import { PaymentsView } from '../../features/simulation/PaymentsView';
import { SavedCardsView } from '../../features/simulation/SavedCardsView';
import { SubscriptionsView } from '../../features/simulation/SubscriptionsView';
import { EventsView } from '../../features/visualization/EventsView';
import { StateView } from '../../features/visualization/StateView';

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
            case 'savedCards':
                return <SavedCardsView />;
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
        <main className="flex-1 overflow-auto p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
            {renderView()}
        </main>
    );
}
