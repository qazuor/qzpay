import type { QZPayBilling, QZPayCustomer } from '@qazuor/qzpay-core';
/**
 * QZPay React Context
 *
 * Provides QZPay billing instance to React components
 */
import { type ReactNode, createContext, useContext, useMemo, useState } from 'react';
import type { QZPayContextValue, QZPayProviderProps } from '../types.js';

/**
 * QZPay context (internal)
 */
const QZPayContext = createContext<QZPayContextValue | null>(null);

/**
 * QZPay Provider component
 *
 * Wraps your application to provide QZPay billing functionality
 *
 * @example
 * ```tsx
 * import { QZPayProvider } from '@qazuor/qzpay-react';
 * import { createQZPayBilling } from '@qazuor/qzpay-core';
 *
 * const billing = createQZPayBilling({ storage });
 *
 * function App() {
 *   return (
 *     <QZPayProvider billing={billing}>
 *       <YourApp />
 *     </QZPayProvider>
 *   );
 * }
 * ```
 */
export function QZPayProvider({ billing, initialCustomer, children }: QZPayProviderProps): ReactNode {
    const [customer, setCustomer] = useState<QZPayCustomer | null>(initialCustomer ?? null);

    const value = useMemo<QZPayContextValue>(
        () => ({
            billing,
            isReady: true,
            customer,
            setCustomer,
            livemode: billing.isLivemode()
        }),
        [billing, customer]
    );

    return <QZPayContext.Provider value={value}>{children}</QZPayContext.Provider>;
}

/**
 * Hook to access QZPay context
 *
 * @throws Error if used outside QZPayProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { billing, customer } = useQZPayContext();
 *   // Use billing instance
 * }
 * ```
 */
export function useQZPayContext(): QZPayContextValue {
    const context = useContext(QZPayContext);

    if (!context) {
        throw new Error('useQZPayContext must be used within a QZPayProvider');
    }

    return context;
}

/**
 * Hook to get the QZPay billing instance
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const billing = useQZPay();
 *   // Use billing.customers, billing.subscriptions, etc.
 * }
 * ```
 */
export function useQZPay(): QZPayBilling {
    const { billing } = useQZPayContext();
    return billing;
}

/**
 * Hook to check if QZPay is in live mode
 */
export function useQZPayLivemode(): boolean {
    const { livemode } = useQZPayContext();
    return livemode;
}

/**
 * Hook to get/set the current customer
 */
export function useCurrentCustomer(): [QZPayCustomer | null, (customer: QZPayCustomer | null) => void] {
    const { customer, setCustomer } = useQZPayContext();
    return [customer, setCustomer];
}
