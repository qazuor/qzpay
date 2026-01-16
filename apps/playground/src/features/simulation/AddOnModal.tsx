import type { QZPayAddOn, QZPaySubscription, QZPaySubscriptionAddOn } from '@qazuor/qzpay-core';
import { AlertTriangle, Check, Loader2, Minus, Package, Plus, X } from 'lucide-react';
/**
 * Add-On Modal Component
 * Allows adding add-ons to an existing subscription
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportPlaygroundData } from '../../adapters/local-storage.adapter';
import { useConfigStore } from '../../stores/config.store';

interface AddOnModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscription: QZPaySubscription;
    onAddOnAdded: () => void;
}

export function AddOnModal({ isOpen, onClose, subscription, onAddOnAdded }: AddOnModalProps) {
    const { t: tc } = useTranslation('common');
    const { billing } = useConfigStore();

    const [availableAddOns, setAvailableAddOns] = useState<QZPayAddOn[]>([]);
    const [subscriptionAddOns, setSubscriptionAddOns] = useState<QZPaySubscriptionAddOn[]>([]);
    const [selectedAddOnId, setSelectedAddOnId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load add-ons data
    useEffect(() => {
        if (!isOpen) return;

        const loadAddOns = async () => {
            try {
                const data = exportPlaygroundData();

                // Get all active add-ons compatible with the subscription's plan
                const allAddOns = Object.values(data.addons || {}) as QZPayAddOn[];
                const compatible = allAddOns.filter((addon) => {
                    if (!addon.active) return false;
                    // If no compatible plans specified, it's compatible with all
                    if (!addon.compatiblePlanIds || addon.compatiblePlanIds.length === 0) return true;
                    return addon.compatiblePlanIds.includes(subscription.planId);
                });
                setAvailableAddOns(compatible);

                // Get subscription's current add-ons
                const subAddOns = Object.values(data.subscriptionAddons || {}) as QZPaySubscriptionAddOn[];
                const currentAddOns = subAddOns.filter((sa) => sa.subscriptionId === subscription.id && sa.status === 'active');
                setSubscriptionAddOns(currentAddOns);
            } catch (err) {
                console.error('Error loading add-ons:', err);
            }
        };

        loadAddOns();
    }, [isOpen, subscription.id, subscription.planId]);

    // Selected add-on details
    const selectedAddOn = useMemo(() => {
        if (!selectedAddOnId) return null;
        return availableAddOns.find((a) => a.id === selectedAddOnId) || null;
    }, [selectedAddOnId, availableAddOns]);

    // Check if add-on is already added
    const isAlreadyAdded = (addOnId: string) => {
        return subscriptionAddOns.some((sa) => sa.addOnId === addOnId);
    };

    // Format price
    const formatAmount = (cents: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency
        }).format(cents / 100);
    };

    // Handle add add-on
    const handleAddAddOn = async () => {
        if (!billing || !selectedAddOnId) return;

        setIsProcessing(true);
        setError(null);

        try {
            await billing.addons.addToSubscription({
                subscriptionId: subscription.id,
                addOnId: selectedAddOnId,
                quantity
            });

            onAddOnAdded();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add add-on');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle remove add-on
    const handleRemoveAddOn = async (addOnId: string) => {
        if (!billing) return;

        try {
            await billing.addons.removeFromSubscription(subscription.id, addOnId);

            // Refresh subscription add-ons
            const data = exportPlaygroundData();
            const subAddOns = Object.values(data.subscriptionAddons || {}) as QZPaySubscriptionAddOn[];
            const currentAddOns = subAddOns.filter((sa) => sa.subscriptionId === subscription.id && sa.status === 'active');
            setSubscriptionAddOns(currentAddOns);
            onAddOnAdded();
        } catch (err) {
            console.error('Error removing add-on:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                        <Package className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                        Manage Add-ons
                    </h3>
                    <button type="button" onClick={onClose} className="btn btn-ghost p-1">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="modal-body space-y-4">
                    {/* Current Add-ons */}
                    {subscriptionAddOns.length > 0 && (
                        <div>
                            <label className="label">Current Add-ons</label>
                            <div className="space-y-2">
                                {subscriptionAddOns.map((subAddOn) => {
                                    const addon = availableAddOns.find((a) => a.id === subAddOn.addOnId);
                                    return (
                                        <div
                                            key={subAddOn.id}
                                            className="flex items-center justify-between p-3 rounded-lg"
                                            style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                                        >
                                            <div>
                                                <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                                                    {addon?.name || subAddOn.addOnId}
                                                </div>
                                                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    {subAddOn.quantity}x @ {formatAmount(subAddOn.unitAmount, subAddOn.currency)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAddOn(subAddOn.addOnId)}
                                                className="btn btn-ghost text-red-400 hover:bg-red-900/30 p-1.5"
                                                title="Remove"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Available Add-ons */}
                    <div>
                        <label className="label">Available Add-ons</label>
                        {availableAddOns.length === 0 ? (
                            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                                <p style={{ color: 'var(--color-text-muted)' }}>No add-ons available for this plan</p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {availableAddOns.map((addon) => {
                                    const alreadyAdded = isAlreadyAdded(addon.id);
                                    const isSelected = selectedAddOnId === addon.id;
                                    const billingType = addon.billingInterval === 'one_time' ? 'one-time' : `/${addon.billingInterval}`;

                                    return (
                                        <button
                                            key={addon.id}
                                            type="button"
                                            onClick={() => !alreadyAdded && setSelectedAddOnId(isSelected ? null : addon.id)}
                                            disabled={alreadyAdded}
                                            className={`
                        p-3 rounded-lg border text-left transition-all
                        ${alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isSelected ? 'ring-2' : 'hover:border-[var(--color-accent)]'}
                      `}
                                            style={{
                                                backgroundColor: isSelected ? 'var(--color-accent-low)' : 'var(--color-surface)',
                                                borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)'
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {isSelected && <Check className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}
                                                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                                        {addon.name}
                                                    </span>
                                                    {alreadyAdded && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">
                                                            Added
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {formatAmount(addon.unitAmount, addon.currency)}
                                                    <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                                                        {billingType}
                                                    </span>
                                                </span>
                                            </div>
                                            {addon.description && (
                                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                                    {addon.description}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Quantity Selector */}
                    {selectedAddOn?.allowMultiple && (
                        <div>
                            <label className="label">Quantity</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="btn btn-secondary p-2"
                                    disabled={quantity <= 1}
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="text-xl font-mono w-12 text-center" style={{ color: 'var(--color-text)' }}>
                                    {quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="btn btn-secondary p-2"
                                    disabled={selectedAddOn.maxQuantity !== null && quantity >= selectedAddOn.maxQuantity}
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Price Summary */}
                    {selectedAddOn && (
                        <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                            <div className="flex justify-between items-center">
                                <span style={{ color: 'var(--color-text-secondary)' }}>Total</span>
                                <span className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
                                    {formatAmount(selectedAddOn.unitAmount * quantity, selectedAddOn.currency)}
                                    {selectedAddOn.billingInterval !== 'one_time' && (
                                        <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
                                            /{selectedAddOn.billingInterval}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button type="button" onClick={onClose} className="btn btn-secondary">
                        {tc('buttons.cancel')}
                    </button>
                    <button type="button" onClick={handleAddAddOn} className="btn btn-primary" disabled={!selectedAddOnId || isProcessing}>
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                Add to Subscription
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
