import type { QZPayCustomer } from '@qazuor/qzpay-core';
import { AlertTriangle, CreditCard, RefreshCw, Trash2, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { type BackendSavedCard, deleteCustomerCard, getCustomerCards } from '../../lib/backend-client';
import { useConfigStore } from '../../stores/config.store';

export function SavedCardsView() {
    const { t } = useTranslation('simulation');
    const { t: tc } = useTranslation('common');
    const { billing, isInitialized, paymentMode, isBackendConnected, backendSessionId, getBackendSessionId } = useConfigStore();

    const [customers, setCustomers] = useState<QZPayCustomer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [savedCards, setSavedCards] = useState<BackendSavedCard[]>([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [isLoadingCards, setIsLoadingCards] = useState(false);
    const [isDeletingCard, setIsDeletingCard] = useState<string | null>(null);

    // Only works with MercadoPago + backend for now
    const isSupported = paymentMode === 'mercadopago' && isBackendConnected;

    const loadCustomers = useCallback(async () => {
        if (!billing) return;
        setIsLoadingCustomers(true);
        try {
            const result = await billing.customers.list();
            setCustomers(result.data);
            if (result.data.length > 0 && !selectedCustomerId) {
                setSelectedCustomerId(result.data[0].id);
            }
        } finally {
            setIsLoadingCustomers(false);
        }
    }, [billing, selectedCustomerId]);

    const loadSavedCards = useCallback(
        async (customerId: string) => {
            if (!isSupported || !customerId) return;

            setIsLoadingCards(true);
            try {
                const sessionId = backendSessionId || getBackendSessionId();
                const response = await getCustomerCards(sessionId, customerId);
                if (response.success && response.data?.cards) {
                    setSavedCards(response.data.cards);
                } else {
                    setSavedCards([]);
                }
            } catch (error) {
                console.error('Failed to load saved cards:', error);
                setSavedCards([]);
            } finally {
                setIsLoadingCards(false);
            }
        },
        [isSupported, backendSessionId, getBackendSessionId]
    );

    // Load customers on mount
    useEffect(() => {
        if (isInitialized) {
            loadCustomers();
        }
    }, [isInitialized, loadCustomers]);

    // Load cards when customer changes
    useEffect(() => {
        if (selectedCustomerId) {
            loadSavedCards(selectedCustomerId);
        }
    }, [selectedCustomerId, loadSavedCards]);

    const handleDeleteCard = async (cardId: string) => {
        if (!selectedCustomerId || !isSupported) return;
        if (!confirm(t('savedCards.confirmDelete'))) return;

        setIsDeletingCard(cardId);
        try {
            const sessionId = backendSessionId || getBackendSessionId();
            await deleteCustomerCard(sessionId, selectedCustomerId, cardId);

            // Refresh cards list
            await loadSavedCards(selectedCustomerId);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to delete card');
        } finally {
            setIsDeletingCard(null);
        }
    };

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

    if (!isInitialized) {
        return (
            <EmptyState icon={CreditCard} title={tc('billingNotInitialized.title')} description={tc('billingNotInitialized.description')} />
        );
    }

    if (!isSupported) {
        return (
            <div className="max-w-4xl space-y-6">
                <PageHeader title={t('savedCards.title')} description={t('savedCards.description')} icon={CreditCard} />

                <div
                    className="card p-6 flex items-start gap-4"
                    style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: '#eab308' }}
                >
                    <AlertTriangle className="h-6 w-6 mt-0.5 flex-shrink-0" style={{ color: '#eab308' }} />
                    <div>
                        <p className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                            {t('savedCards.notSupported.title')}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {t('savedCards.notSupported.description')}
                        </p>
                        <ul className="list-disc list-inside mt-3 space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            <li>{t('savedCards.notSupported.requirement1')}</li>
                            <li>{t('savedCards.notSupported.requirement2')}</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <PageHeader
                title={t('savedCards.title')}
                description={t('savedCards.description')}
                icon={CreditCard}
                helpTitle={t('savedCards.helpTitle')}
                helpContent={
                    <div className="space-y-2">
                        <p>{t('savedCards.helpContent')}</p>
                        <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            <li>{t('savedCards.helpPoint1')}</li>
                            <li>{t('savedCards.helpPoint2')}</li>
                            <li>{t('savedCards.helpPoint3')}</li>
                        </ul>
                    </div>
                }
                actions={
                    selectedCustomerId && (
                        <button
                            type="button"
                            onClick={() => loadSavedCards(selectedCustomerId)}
                            className="btn btn-ghost p-2"
                            title={t('savedCards.refresh')}
                            disabled={isLoadingCards}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoadingCards ? 'animate-spin' : ''}`} />
                        </button>
                    )
                }
            />

            {/* Customer Selector */}
            {isLoadingCustomers ? (
                <div className="card p-8">
                    <div className="text-center">
                        <p style={{ color: 'var(--color-text-secondary)' }}>{t('savedCards.loadingCustomers')}</p>
                    </div>
                </div>
            ) : customers.length === 0 ? (
                <EmptyState icon={User} title={t('savedCards.noCustomers.title')} description={t('savedCards.noCustomers.description')} />
            ) : (
                <>
                    <div className="card p-4">
                        <label htmlFor="customerSelect" className="label">
                            {t('savedCards.selectCustomer')}
                        </label>
                        <select
                            id="customerSelect"
                            value={selectedCustomerId || ''}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            className="select"
                        >
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name || customer.email}
                                </option>
                            ))}
                        </select>
                        {selectedCustomer && (
                            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                {selectedCustomer.email}
                            </p>
                        )}
                    </div>

                    {/* Cards List */}
                    {isLoadingCards ? (
                        <div className="card p-8">
                            <div className="text-center">
                                <p style={{ color: 'var(--color-text-secondary)' }}>{t('savedCards.loadingCards')}</p>
                            </div>
                        </div>
                    ) : savedCards.length === 0 ? (
                        <EmptyState
                            icon={CreditCard}
                            title={t('savedCards.empty.title')}
                            description={t('savedCards.empty.description')}
                            tips={[t('savedCards.tips.tip1'), t('savedCards.tips.tip2'), t('savedCards.tips.tip3')]}
                        />
                    ) : (
                        <div className="space-y-3">
                            {savedCards.map((card) => (
                                <div key={card.id} className="card p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {card.paymentMethodThumbnail ? (
                                                <img
                                                    src={card.paymentMethodThumbnail}
                                                    alt={card.paymentMethodName || 'Card'}
                                                    className="h-8"
                                                />
                                            ) : (
                                                <div
                                                    className="h-12 w-12 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                                >
                                                    <CreditCard className="h-6 w-6" style={{ color: 'var(--color-text-secondary)' }} />
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                                                    {card.paymentMethodName || 'Card'} ****{card.lastFourDigits}
                                                </div>
                                                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {t('savedCards.expires')}: {card.expirationMonth.toString().padStart(2, '0')}/
                                                    {card.expirationYear}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                                {card.id}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCard(card.id)}
                                                disabled={isDeletingCard === card.id}
                                                className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                                title={t('savedCards.deleteCard')}
                                            >
                                                {isDeletingCard === card.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Info card */}
                            <div className="card p-4 flex items-start gap-3" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                                <CreditCard className="h-5 w-5 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                                <div>
                                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                                        {t('savedCards.info.title')}
                                    </p>
                                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        {t('savedCards.info.description')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
