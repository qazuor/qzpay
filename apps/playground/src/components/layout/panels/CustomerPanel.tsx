import type { QZPayCustomer, QZPayPayment, QZPaySubscription } from '@qazuor/qzpay-core';
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    Clock,
    CreditCard,
    DollarSign,
    Gauge,
    Pause,
    Plus,
    RefreshCw,
    RotateCcw,
    Shield,
    Users,
    XCircle
} from 'lucide-react';
/**
 * Customer Panel
 * Shows live customer information with subscriptions, entitlements, and payments
 */
import { useCallback, useEffect, useState } from 'react';
import { exportPlaygroundData } from '../../../adapters/local-storage.adapter';
import { useConfigStore } from '../../../stores/config.store';

interface CustomerInfo {
    customer: QZPayCustomer;
    subscription: QZPaySubscription | null;
    subscriptionStatus: string;
    timeRemaining: string;
    daysRemaining: number;
    planName: string;
    priceAmount: number;
    priceCurrency: string;
    billingInterval: string;
    entitlements: string[];
    limits: Array<{ key: string; current: number; max: number; isUnlimited: boolean }>;
    hasPaymentMethod: boolean;
    lastPayment: QZPayPayment | null;
    totalPayments: number;
    inGracePeriod: boolean;
}

export function CustomerPanel() {
    const { billing, isInitialized, getCurrentTime } = useConfigStore();
    const [customers, setCustomers] = useState<CustomerInfo[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const loadCustomerData = useCallback(async () => {
        if (!billing || !isInitialized) return;

        try {
            const data = exportPlaygroundData();
            const currentTime = getCurrentTime();

            // Get all customers
            const customerList = Object.values(data.customers || {}) as QZPayCustomer[];
            const subscriptions = Object.values(data.subscriptions || {}) as QZPaySubscription[];
            const payments = Object.values(data.payments || {}) as QZPayPayment[];
            const paymentMethods = Object.values(data.paymentMethods || {}) as Record<string, unknown>[];
            const plans = Object.values(data.plans || {}) as Record<string, unknown>[];
            const prices = Object.values(data.prices || {}) as Record<string, unknown>[];
            const customerEntitlements = Object.values(data.customerEntitlements || {}) as Record<string, unknown>[];
            const customerLimits = Object.values(data.customerLimits || {}) as Record<string, unknown>[];

            const customerInfoList: CustomerInfo[] = customerList.map((customer) => {
                // Find customer's subscription
                const subscription = subscriptions.find((s) => s.customerId === customer.id && s.status !== 'canceled') || null;

                // Get subscription status and time remaining
                let subscriptionStatus = 'none';
                let timeRemaining = '-';
                let daysRemaining = 0;
                let planName = '-';
                let priceAmount = 0;
                let priceCurrency = 'USD';
                let billingInterval = '-';
                let inGracePeriod = false;

                if (subscription) {
                    subscriptionStatus = subscription.status;

                    // Check if in grace period from metadata
                    // lifecycleState is stored as JSON string in metadata
                    let lifecycleState: Record<string, unknown> | null = null;
                    const lifecycleStateRaw = subscription.metadata?.lifecycleState;
                    if (typeof lifecycleStateRaw === 'string') {
                        try {
                            lifecycleState = JSON.parse(lifecycleStateRaw) as Record<string, unknown>;
                            inGracePeriod = !!lifecycleState.inGracePeriod;
                        } catch {
                            // Invalid JSON, ignore
                        }
                    }

                    // Get plan name
                    const plan = plans.find((p: Record<string, unknown>) => p.id === subscription.planId);
                    planName = (plan?.name as string) || subscription.planId;

                    // Get price info
                    const price = prices.find((p: Record<string, unknown>) => p.planId === subscription.planId);
                    if (price) {
                        priceAmount = (price.unitAmount as number) || 0;
                        priceCurrency = (price.currency as string) || 'USD';
                        billingInterval = (price.billingInterval as string) || 'month';
                    }

                    // Calculate time remaining
                    if (subscription.currentPeriodEnd) {
                        const endDate = new Date(subscription.currentPeriodEnd);
                        const diffMs = endDate.getTime() - currentTime.getTime();
                        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                        if (inGracePeriod && lifecycleState) {
                            // In grace period - show grace period info
                            const gracePeriodStart = lifecycleState.gracePeriodStartedAt
                                ? new Date(lifecycleState.gracePeriodStartedAt as string)
                                : currentTime;
                            const gracePeriodDays = 7; // Default grace period
                            const gracePeriodEnd = new Date(gracePeriodStart.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
                            const graceDaysRemaining = Math.ceil(
                                (gracePeriodEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
                            );

                            if (graceDaysRemaining <= 0) {
                                timeRemaining = 'Grace expired';
                            } else if (graceDaysRemaining === 1) {
                                timeRemaining = 'Grace: 1 day';
                            } else {
                                timeRemaining = `Grace: ${graceDaysRemaining}d`;
                            }
                            daysRemaining = graceDaysRemaining;
                        } else if (daysRemaining < 0) {
                            timeRemaining = 'Expired';
                        } else if (daysRemaining === 0) {
                            timeRemaining = 'Today';
                        } else if (daysRemaining === 1) {
                            timeRemaining = '1 day';
                        } else {
                            timeRemaining = `${daysRemaining} days`;
                        }
                    }
                }

                // Get customer entitlements
                const entitlements = customerEntitlements
                    .filter((e: Record<string, unknown>) => e.customerId === customer.id)
                    .map((e: Record<string, unknown>) => e.entitlementKey as string);

                // Get customer limits (filter out unlimited limits for cleaner display)
                const limits = customerLimits
                    .filter((l: Record<string, unknown>) => l.customerId === customer.id)
                    .map((l: Record<string, unknown>) => ({
                        key: l.limitKey as string,
                        current: (l.currentUsage as number) || 0,
                        max: (l.maxValue as number) ?? 0,
                        isUnlimited: (l.maxValue as number) === -1
                    }));

                // Check for payment methods
                const hasPaymentMethod = paymentMethods.some(
                    (pm: Record<string, unknown>) => pm.customerId === customer.id && pm.status === 'active'
                );

                // Get payments info
                const customerPayments = payments
                    .filter((p) => p.customerId === customer.id)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const lastPayment = customerPayments[0] || null;
                const totalPayments = customerPayments.filter((p) => p.status === 'succeeded').length;

                return {
                    customer,
                    subscription,
                    subscriptionStatus,
                    timeRemaining,
                    daysRemaining,
                    planName,
                    priceAmount,
                    priceCurrency,
                    billingInterval,
                    entitlements,
                    limits,
                    hasPaymentMethod,
                    lastPayment,
                    totalPayments,
                    inGracePeriod
                };
            });

            setCustomers(customerInfoList);
        } catch (error) {
            console.error('Error loading customer data:', error);
        }
    }, [billing, isInitialized, getCurrentTime]);

    // Initial load
    useEffect(() => {
        if (isInitialized) {
            loadCustomerData();
        }
    }, [isInitialized, loadCustomerData]);

    // Auto-refresh every 2 seconds
    useEffect(() => {
        if (!autoRefresh || !isInitialized) return;

        const interval = setInterval(loadCustomerData, 2000);
        return () => clearInterval(interval);
    }, [autoRefresh, isInitialized, loadCustomerData]);

    const getStatusIcon = (status: string, inGracePeriod: boolean) => {
        if (inGracePeriod) {
            return <AlertCircle className="h-3 w-3 text-orange-400" />;
        }
        switch (status) {
            case 'active':
                return <CheckCircle className="h-3 w-3 text-green-400" />;
            case 'trialing':
                return <Clock className="h-3 w-3 text-blue-400" />;
            case 'past_due':
                return <AlertCircle className="h-3 w-3 text-yellow-400" />;
            case 'canceled':
                return <XCircle className="h-3 w-3 text-red-400" />;
            case 'paused':
                return <Pause className="h-3 w-3 text-gray-400" />;
            default:
                return <XCircle className="h-3 w-3 text-gray-500" />;
        }
    };

    const getStatusColor = (status: string, inGracePeriod: boolean) => {
        if (inGracePeriod) {
            return 'text-orange-400 bg-orange-900/30';
        }
        switch (status) {
            case 'active':
                return 'text-green-400 bg-green-900/30';
            case 'trialing':
                return 'text-blue-400 bg-blue-900/30';
            case 'past_due':
                return 'text-yellow-400 bg-yellow-900/30';
            case 'canceled':
                return 'text-red-400 bg-red-900/30';
            case 'paused':
                return 'text-gray-400 bg-gray-700/50';
            default:
                return 'text-gray-500 bg-gray-800/50';
        }
    };

    const getStatusLabel = (status: string, inGracePeriod: boolean) => {
        if (inGracePeriod) return 'Grace Period';
        if (status === 'none') return 'No sub';
        return status;
    };

    const formatAmount = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount / 100);
    };

    // Increment limit usage
    const handleIncrementLimit = async (customerId: string, limitKey: string, amount = 1) => {
        if (!billing) return;
        try {
            await billing.limits.increment(customerId, limitKey, amount);
            loadCustomerData(); // Refresh data
        } catch (error) {
            console.error('Error incrementing limit:', error);
        }
    };

    // Reset limit usage (set current to 0)
    const handleResetLimit = async (customerId: string, limitKey: string, _maxValue: number) => {
        if (!billing) return;
        try {
            // We need to access the storage directly to reset the current usage
            const data = exportPlaygroundData();
            const key = `${customerId}:${limitKey}`;
            if (data.customerLimits[key]) {
                data.customerLimits[key].currentUsage = 0;
                const { importPlaygroundData } = await import('../../../adapters/local-storage.adapter');
                importPlaygroundData(data);
                loadCustomerData(); // Refresh data
            }
        } catch (error) {
            console.error('Error resetting limit:', error);
        }
    };

    const getTimeRemainingColor = (days: number, status: string, inGracePeriod: boolean) => {
        if (status === 'none' || status === 'canceled') return 'text-gray-500';
        if (inGracePeriod) return 'text-orange-400';
        if (days < 0) return 'text-red-400';
        if (days <= 3) return 'text-red-400';
        if (days <= 7) return 'text-yellow-400';
        return 'text-green-400';
    };

    if (!isInitialized) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4">
                <Users className="h-8 w-8 mb-2" style={{ color: 'var(--color-text-secondary)' }} />
                <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
                    Initialize billing to see customers
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
                style={{ borderColor: 'var(--color-border)' }}
            >
                <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                    {customers.length} customer{customers.length !== 1 ? 's' : ''}
                </span>
                <button
                    type="button"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`p-1 rounded text-xs ${autoRefresh ? 'text-green-400' : ''}`}
                    style={{ color: autoRefresh ? undefined : 'var(--color-text-muted)' }}
                    title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                >
                    <RefreshCw className={`h-3 w-3 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                </button>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-4">
                        <Users className="h-8 w-8 mb-2" style={{ color: 'var(--color-text-secondary)' }} />
                        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            No customers yet
                        </p>
                    </div>
                ) : (
                    customers.map((info) => (
                        <div
                            key={info.customer.id}
                            className="rounded-lg p-3 space-y-2"
                            style={{ backgroundColor: 'var(--color-surface-elevated)' }}
                        >
                            {/* Header: Name + Status */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    {/* Avatar */}
                                    <div
                                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                        style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                                    >
                                        {(info.customer.name?.[0] || info.customer.email?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                                            {info.customer.name || info.customer.email?.split('@')[0] || 'Unknown'}
                                        </div>
                                        <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                            {info.customer.email}
                                        </div>
                                    </div>
                                </div>
                                {/* Status Badge */}
                                <div
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColor(info.subscriptionStatus, info.inGracePeriod)}`}
                                >
                                    {getStatusIcon(info.subscriptionStatus, info.inGracePeriod)}
                                    <span>{getStatusLabel(info.subscriptionStatus, info.inGracePeriod)}</span>
                                </div>
                            </div>

                            {/* Subscription Info */}
                            {info.subscriptionStatus !== 'none' && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {/* Plan */}
                                    <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        <CreditCard className="h-3 w-3 flex-shrink-0" />
                                        <span className="truncate">{info.planName}</span>
                                    </div>
                                    {/* Price */}
                                    <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        <DollarSign className="h-3 w-3 flex-shrink-0" />
                                        <span>
                                            {formatAmount(info.priceAmount, info.priceCurrency)}/{info.billingInterval}
                                        </span>
                                    </div>
                                    {/* Time Remaining */}
                                    <div
                                        className={`flex items-center gap-1.5 ${getTimeRemainingColor(info.daysRemaining, info.subscriptionStatus, info.inGracePeriod)}`}
                                    >
                                        <Calendar className="h-3 w-3 flex-shrink-0" />
                                        <span>
                                            {info.timeRemaining}
                                            {!info.inGracePeriod && info.daysRemaining >= 0 ? ' left' : ''}
                                        </span>
                                    </div>
                                    {/* Payment Method */}
                                    <div
                                        className="flex items-center gap-1.5"
                                        style={{ color: info.hasPaymentMethod ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
                                    >
                                        <CreditCard className="h-3 w-3 flex-shrink-0" />
                                        <span>{info.hasPaymentMethod ? 'Card saved' : 'No card'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Entitlements */}
                            {info.entitlements.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                        <Shield className="h-3 w-3" />
                                        <span>Entitlements</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {info.entitlements.map((key) => (
                                            <span key={key} className="px-1.5 py-0.5 text-xs rounded bg-purple-900/40 text-purple-300">
                                                {key}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Limits */}
                            {info.limits.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                        <Gauge className="h-3 w-3" />
                                        <span>Limits (click to use)</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {info.limits.map((limit) => {
                                            // Handle unlimited limits
                                            if (limit.isUnlimited) {
                                                return (
                                                    <div key={limit.key}>
                                                        <div className="flex items-center justify-between text-xs mb-0.5">
                                                            <span style={{ color: 'var(--color-text-muted)' }}>{limit.key}</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-cyan-400">{limit.current} / ∞</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleIncrementLimit(info.customer.id, limit.key)}
                                                                    className="p-0.5 rounded hover:bg-cyan-900/50 text-cyan-400 transition-colors"
                                                                    title="Use 1"
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </button>
                                                                {limit.current > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleResetLimit(info.customer.id, limit.key, -1)}
                                                                        className="p-0.5 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                                                                        title="Reset"
                                                                    >
                                                                        <RotateCcw className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className="h-1.5 rounded-full overflow-hidden"
                                                            style={{ backgroundColor: 'var(--color-bg)' }}
                                                        >
                                                            <div className="h-full rounded-full bg-cyan-500" style={{ width: '100%' }} />
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const percentage = limit.max > 0 ? (limit.current / limit.max) * 100 : 0;
                                            const isNearLimit = percentage >= 80;
                                            const isAtLimit = limit.max > 0 && limit.current >= limit.max;
                                            return (
                                                <div key={limit.key}>
                                                    <div className="flex items-center justify-between text-xs mb-0.5">
                                                        <span style={{ color: 'var(--color-text-muted)' }}>{limit.key}</span>
                                                        <div className="flex items-center gap-1">
                                                            <span
                                                                className={
                                                                    isAtLimit
                                                                        ? 'text-red-400'
                                                                        : isNearLimit
                                                                          ? 'text-yellow-400'
                                                                          : 'text-green-400'
                                                                }
                                                            >
                                                                {limit.current}/{limit.max}
                                                            </span>
                                                            {!isAtLimit && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleIncrementLimit(info.customer.id, limit.key)}
                                                                    className={`p-0.5 rounded transition-colors ${
                                                                        isNearLimit
                                                                            ? 'hover:bg-yellow-900/50 text-yellow-400'
                                                                            : 'hover:bg-green-900/50 text-green-400'
                                                                    }`}
                                                                    title="Use 1"
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                            {limit.current > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResetLimit(info.customer.id, limit.key, limit.max)}
                                                                    className="p-0.5 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                                                                    title="Reset"
                                                                >
                                                                    <RotateCcw className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="h-1.5 rounded-full overflow-hidden cursor-pointer"
                                                        style={{ backgroundColor: 'var(--color-bg)' }}
                                                        onClick={() => !isAtLimit && handleIncrementLimit(info.customer.id, limit.key)}
                                                        title={isAtLimit ? 'Limit reached' : 'Click to use 1'}
                                                    >
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${Math.min(percentage, 100)}%`,
                                                                backgroundColor: isAtLimit ? '#ef4444' : isNearLimit ? '#eab308' : '#22c55e'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Payment History Summary */}
                            {info.lastPayment && (
                                <div
                                    className="flex items-center justify-between text-xs pt-1 border-t"
                                    style={{ borderColor: 'var(--color-border)' }}
                                >
                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                        {info.totalPayments} payment{info.totalPayments !== 1 ? 's' : ''}
                                    </span>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>
                                        Last: {formatAmount(info.lastPayment.amount, info.lastPayment.currency)}
                                        <span
                                            className={
                                                info.lastPayment.status === 'succeeded' ? 'text-green-400 ml-1' : 'text-red-400 ml-1'
                                            }
                                        >
                                            ({info.lastPayment.status === 'succeeded' ? 'OK' : 'Failed'})
                                        </span>
                                    </span>
                                </div>
                            )}

                            {/* No subscription message */}
                            {info.subscriptionStatus === 'none' && info.entitlements.length === 0 && info.limits.length === 0 && (
                                <div className="text-xs text-center py-1" style={{ color: 'var(--color-text-muted)' }}>
                                    No active subscription
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
