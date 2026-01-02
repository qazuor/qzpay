/**
 * @qazuor/qzpay-react
 *
 * React components and hooks for QZPay billing integration
 */

// Context and Provider
export {
    QZPayProvider,
    useQZPayContext,
    useQZPay,
    useQZPayLivemode,
    useCurrentCustomer
} from './context/index.js';

// Hooks
export {
    useCustomer,
    useSubscription,
    usePlans,
    useEntitlements,
    useLimits,
    usePayment,
    useInvoices
} from './hooks/index.js';

// Components
export { EntitlementGate, LimitGate, PricingTable, SubscriptionStatus } from './components/index.js';

// Types
export type {
    // Context types
    QZPayContextValue,
    QZPayProviderProps,
    // Hook types
    QZPayAsyncState,
    UseCustomerReturn,
    UseSubscriptionOptions,
    UseSubscriptionReturn,
    UsePlansReturn,
    UsePaymentOptions,
    UsePaymentReturn,
    UseEntitlementsOptions,
    UseEntitlementsReturn,
    UseLimitsOptions,
    UseLimitsReturn,
    QZPayLimitCheckResult,
    UseInvoicesOptions,
    UseInvoicesReturn,
    // Component props
    PricingTableProps,
    SubscriptionStatusProps,
    EntitlementGateProps,
    LimitGateProps
} from './types.js';
