import { Box, CreditCard, FileText, Gift, LayoutGrid, Package, Settings, Shield, ShoppingBag, Sliders, Tag, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PanelId, ViewType } from '../../App';

interface SidebarProps {
    currentView: ViewType;
    onViewChange: (view: ViewType) => void;
    activePanels?: Set<PanelId>;
}

interface NavItem {
    id: ViewType;
    labelKey: string;
    icon: React.ReactNode;
    tourId?: string;
}

interface NavSection {
    titleKey: string;
    tourId?: string;
    items: NavItem[];
}

const navSections: NavSection[] = [
    {
        titleKey: 'sidebar.sections.setup',
        tourId: 'sidebar-setup',
        items: [
            { id: 'setup', labelKey: 'sidebar.items.configuration', icon: <Settings className="h-4 w-4" />, tourId: 'sidebar-setup-item' }
        ]
    },
    {
        titleKey: 'sidebar.sections.catalog',
        tourId: 'sidebar-catalog',
        items: [
            { id: 'plans', labelKey: 'sidebar.items.plans', icon: <LayoutGrid className="h-4 w-4" />, tourId: 'sidebar-plans' },
            { id: 'prices', labelKey: 'sidebar.items.prices', icon: <Tag className="h-4 w-4" />, tourId: 'sidebar-prices' },
            { id: 'addons', labelKey: 'sidebar.items.addons', icon: <Package className="h-4 w-4" /> },
            { id: 'products', labelKey: 'sidebar.items.products', icon: <ShoppingBag className="h-4 w-4" /> },
            { id: 'promos', labelKey: 'sidebar.items.promos', icon: <Gift className="h-4 w-4" /> },
            {
                id: 'entitlements',
                labelKey: 'sidebar.items.entitlements',
                icon: <Shield className="h-4 w-4" />,
                tourId: 'sidebar-entitlements'
            },
            { id: 'limits', labelKey: 'sidebar.items.limits', icon: <Sliders className="h-4 w-4" /> }
        ]
    },
    {
        titleKey: 'sidebar.sections.simulate',
        tourId: 'sidebar-simulate',
        items: [
            { id: 'customers', labelKey: 'sidebar.items.customers', icon: <Users className="h-4 w-4" />, tourId: 'sidebar-customers' },
            {
                id: 'subscriptions',
                labelKey: 'sidebar.items.subscriptions',
                icon: <CreditCard className="h-4 w-4" />,
                tourId: 'sidebar-subscriptions'
            },
            { id: 'payments', labelKey: 'sidebar.items.payments', icon: <CreditCard className="h-4 w-4" />, tourId: 'sidebar-payments' },
            { id: 'savedCards', labelKey: 'sidebar.items.savedCards', icon: <CreditCard className="h-4 w-4" /> },
            { id: 'invoices', labelKey: 'sidebar.items.invoices', icon: <FileText className="h-4 w-4" /> }
        ]
    },
    {
        titleKey: 'sidebar.sections.components',
        tourId: 'sidebar-components',
        items: [
            {
                id: 'components',
                labelKey: 'sidebar.items.reactComponents',
                icon: <Box className="h-4 w-4" />,
                tourId: 'sidebar-components-item'
            }
        ]
    }
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
    const { t } = useTranslation('components');

    return (
        <aside
            data-tour="sidebar"
            className="flex-shrink-0 overflow-y-auto"
            style={{
                width: 'var(--sidebar-width)',
                backgroundColor: 'var(--color-surface)',
                borderRight: '1px solid var(--color-border)'
            }}
        >
            <nav className="p-4 space-y-6">
                {navSections.map((section) => (
                    <div key={section.titleKey} data-tour={section.tourId}>
                        <h3
                            className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            {t(section.titleKey)}
                        </h3>
                        <ul className="space-y-1">
                            {section.items.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => onViewChange(item.id)}
                                        data-tour={item.tourId}
                                        className={`sidebar-item w-full ${currentView === item.id ? 'active' : ''}`}
                                    >
                                        {item.icon}
                                        {t(item.labelKey)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
