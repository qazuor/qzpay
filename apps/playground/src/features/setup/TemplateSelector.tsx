import { Briefcase, Check, Code, Gift, Package, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PlaygroundData, importPlaygroundData } from '../../adapters/local-storage.adapter';
import { HintIcon } from '../../components/ui/HintIcon';
import { type PlaygroundTemplate, templates } from '../../data/templates';
import { useCatalogStore } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';
import { useEventsStore } from '../../stores/events.store';

interface TemplateSelectorProps {
    onTemplateLoaded?: () => void;
    showTitle?: boolean;
    compact?: boolean;
}

const iconMap = {
    Briefcase,
    Code,
    Package,
    Gift
};

export function TemplateSelector({ onTemplateLoaded, showTitle = true, compact = false }: TemplateSelectorProps) {
    const { t } = useTranslation('setup');
    const { loadCatalog } = useCatalogStore();
    const { clearEvents } = useEventsStore();
    useConfigStore(); // Access store to trigger re-renders if needed
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Generate a simulated provider customer ID for the playground
    // Always uses 'mock' prefix since playground always uses mock adapter internally
    const generateProviderCustomerId = (customerId: string): string => {
        return `mock_cus_${customerId.replace('cus_template_', '')}`;
    };

    const handleLoadTemplate = async (template: PlaygroundTemplate) => {
        setIsLoading(true);
        setSelectedTemplate(template.id);

        try {
            // Prepare customers with providerCustomerIds for the current payment mode
            // This allows payments to work without needing to call the real provider API
            const templateCustomers = template.data.customers || {};
            const customersWithProviderIds: PlaygroundData['customers'] = {};

            for (const [key, customer] of Object.entries(templateCustomers)) {
                const typedCustomer = customer as {
                    id: string;
                    externalId: string;
                    email: string;
                    name: string | null;
                    phone: string | null;
                    providerCustomerIds: Record<string, string>;
                    metadata: Record<string, unknown>;
                    livemode: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    deletedAt: Date | null;
                };

                // Add the provider customer ID for the mock adapter
                // The playground always uses mock adapter internally, regardless of selected mode
                customersWithProviderIds[key] = {
                    ...typedCustomer,
                    providerCustomerIds: {
                        ...typedCustomer.providerCustomerIds,
                        mock: generateProviderCustomerId(typedCustomer.id)
                    }
                };
            }

            // Import ALL template data including customers with provider IDs
            const fullData: PlaygroundData = {
                customers: customersWithProviderIds,
                subscriptions: {},
                payments: {},
                paymentMethods: {},
                invoices: {},
                plans: template.data.plans || {},
                prices: template.data.prices || {},
                promoCodes: template.data.promoCodes || {},
                vendors: {},
                vendorPayouts: {},
                addons: template.data.addons || {},
                subscriptionAddons: {},
                entitlementDefinitions: template.data.entitlementDefinitions || {},
                customerEntitlements: {},
                limitDefinitions: template.data.limitDefinitions || {},
                customerLimits: {},
                usageRecords: {},
                products: template.data.products || {}
            };

            // Import the template data (plans, prices, customers with provider IDs, etc.)
            importPlaygroundData(fullData);

            // Clear events from previous data
            clearEvents();

            // Reload the catalog to reflect changes
            loadCatalog();

            // Small delay for visual feedback
            await new Promise((resolve) => setTimeout(resolve, 500));

            onTemplateLoaded?.();
        } finally {
            setIsLoading(false);
            setSelectedTemplate(null);
        }
    };

    const { t: tTour } = useTranslation('tour');

    return (
        <div data-tour="template-selector" className={compact ? 'space-y-3' : 'space-y-4'}>
            {showTitle && (
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {t('templates.title')}
                    </h3>
                    <HintIcon
                        title={tTour('tour.hints.template.saas.title')}
                        content={tTour('tour.hints.template.saas.content')}
                        position="right"
                    />
                </div>
            )}

            {showTitle && (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('templates.description')}
                </p>
            )}

            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {templates.map((template) => {
                    const IconComponent = iconMap[template.icon];
                    const isSelected = selectedTemplate === template.id;
                    const planCount = Object.keys(template.data.plans || {}).length;
                    const priceCount = Object.keys(template.data.prices || {}).length;
                    const addonCount = Object.keys(template.data.addons || {}).length;
                    const promoCount = Object.keys(template.data.promoCodes || {}).length;
                    const customerCount = Object.keys(template.data.customers || {}).length;
                    const entitlementCount = Object.keys(template.data.entitlementDefinitions || {}).length;
                    const limitCount = Object.keys(template.data.limitDefinitions || {}).length;

                    return (
                        <button
                            key={template.id}
                            type="button"
                            onClick={() => handleLoadTemplate(template)}
                            disabled={isLoading}
                            className={`
                card p-4 text-left transition-all hover:scale-[1.02]
                ${isSelected ? 'ring-2' : 'hover:border-[var(--color-accent)]'}
              `}
                            style={{
                                borderColor: isSelected ? 'var(--color-accent)' : undefined,
                                opacity: isLoading && !isSelected ? 0.5 : 1
                            }}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: 'var(--color-accent-low)' }}
                                >
                                    {isSelected && isLoading ? (
                                        <div
                                            className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"
                                            style={{ color: 'var(--color-accent)' }}
                                        />
                                    ) : isSelected ? (
                                        <Check className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                                    ) : (
                                        <IconComponent className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>
                                        {t(template.nameKey)}
                                    </h4>
                                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        {t(template.descriptionKey)}
                                    </p>

                                    {!compact && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="badge badge-primary text-xs">
                                                {planCount} {t('templates.plans', { count: planCount })}
                                            </span>
                                            <span className="badge badge-secondary text-xs">
                                                {priceCount} {t('templates.prices', { count: priceCount })}
                                            </span>
                                            {customerCount > 0 && (
                                                <span
                                                    className="badge text-xs"
                                                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                                >
                                                    {customerCount} {t('templates.customers', { count: customerCount })}
                                                </span>
                                            )}
                                            {entitlementCount > 0 && (
                                                <span
                                                    className="badge text-xs"
                                                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                                >
                                                    {entitlementCount} {t('templates.entitlements', { count: entitlementCount })}
                                                </span>
                                            )}
                                            {limitCount > 0 && (
                                                <span
                                                    className="badge text-xs"
                                                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                                >
                                                    {limitCount} {t('templates.limits', { count: limitCount })}
                                                </span>
                                            )}
                                            {addonCount > 0 && (
                                                <span
                                                    className="badge text-xs"
                                                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                                >
                                                    {addonCount} {t('templates.addons', { count: addonCount })}
                                                </span>
                                            )}
                                            {promoCount > 0 && (
                                                <span
                                                    className="badge text-xs"
                                                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                                >
                                                    {promoCount} {t('templates.promos', { count: promoCount })}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
