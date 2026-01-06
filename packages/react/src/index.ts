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
export {
    EntitlementGate,
    LimitGate,
    PricingTable,
    SubscriptionStatus,
    PaymentForm,
    CheckoutButton,
    InvoiceList,
    PaymentMethodManager
} from './components/index.js';

// Theme
export {
    // Theme provider and hook
    QZPayThemeProvider,
    useQZPayTheme,
    // Default themes
    qzpayDefaultTheme,
    qzpayDarkTheme,
    qzpayMergeTheme,
    // Styled hooks
    useThemedStyles,
    qzpayButtonStyles,
    qzpayInputStyles,
    qzpayCardStyles,
    qzpayBadgeStyles,
    qzpayTableStyles
} from './theme/index.js';

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
    LimitGateProps,
    PaymentFormProps,
    CheckoutButtonProps,
    CheckoutParams,
    CheckoutResult,
    InvoiceListProps,
    PaymentMethodManagerProps
} from './types.js';

// Theme types
export type {
    QZPayTheme,
    QZPayThemeColors,
    QZPayThemeTypography,
    QZPayThemeSpacing,
    QZPayThemeBorderRadius,
    QZPayThemeShadows,
    QZPayThemeTransitions,
    QZPayPartialTheme,
    QZPayStyleCreator
} from './theme/index.js';
