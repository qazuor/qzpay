# @qazuor/qzpay-react

React hooks and components for the QZPay billing library.

## Installation

```bash
pnpm add @qazuor/qzpay-react react
```

## Features

- **Provider Context**: Global billing context
- **Data Hooks**: Fetch and manage billing data
- **Mutation Hooks**: Create/update operations
- **Theme System**: Customizable styling
- **Accessibility**: WCAG 2.1 AA compliant with ARIA support
- **Error Boundary**: Graceful error handling for components
- **TypeScript**: Full type safety

## Usage

### Provider Setup

```tsx
import { QZPayProvider } from '@qazuor/qzpay-react';

function App() {
  return (
    <QZPayProvider config={{
      baseUrl: '/api/billing',
      headers: { 'Authorization': 'Bearer token' }
    }}>
      <YourApp />
    </QZPayProvider>
  );
}
```

### Customer Hooks

```tsx
import { useCustomer, useCustomers } from '@qazuor/qzpay-react';

function CustomerProfile() {
  const { customer, isLoading, error } = useCustomer('cus_123');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{customer?.name}</h1>
      <p>{customer?.email}</p>
    </div>
  );
}
```

### Subscription Hooks

```tsx
import { useSubscriptions, useCreateSubscription } from '@qazuor/qzpay-react';

function SubscriptionManager({ customerId }) {
  const { subscriptions, isLoading } = useSubscriptions(customerId);
  const { createSubscription, isCreating } = useCreateSubscription();

  const handleSubscribe = async (planId) => {
    await createSubscription({ customerId, planId });
  };

  return (
    <div>
      {subscriptions?.map(sub => (
        <div key={sub.id}>
          {sub.planId} - {sub.status}
        </div>
      ))}
    </div>
  );
}
```

### Payment Hooks

```tsx
import { usePayments, useProcessPayment } from '@qazuor/qzpay-react';

function PaymentHistory({ customerId }) {
  const { payments } = usePayments(customerId);
  const { processPayment, isProcessing } = useProcessPayment();

  const handlePayment = async () => {
    await processPayment({
      customerId,
      amount: 2999,
      currency: 'USD'
    });
  };

  return (
    <div>
      <button onClick={handlePayment} disabled={isProcessing}>
        Pay $29.99
      </button>
      {payments?.map(p => (
        <div key={p.id}>{p.amount} - {p.status}</div>
      ))}
    </div>
  );
}
```

### Plan Hooks

```tsx
import { usePlans } from '@qazuor/qzpay-react';

function PlanSelector({ onSelect }) {
  const { plans, isLoading } = usePlans();

  return (
    <div className="plans-grid">
      {plans?.map(plan => (
        <div key={plan.id} onClick={() => onSelect(plan)}>
          <h3>{plan.name}</h3>
          <p>{plan.description}</p>
        </div>
      ))}
    </div>
  );
}
```

## Available Hooks

### Context Hooks
- `useQZPayContext()` - Get the full QZPay context (billing instance, customer, etc.)
- `useQZPay()` - Get the billing instance directly
- `useQZPayLivemode()` - Check if running in live mode
- `useCurrentCustomer()` - Get the current customer from context

### Data Hooks
- `useCustomer(customerId)` - Get customer by ID with helper methods
- `useSubscription(customerId, options?)` - Get active subscription with helpers
- `usePlans()` - Get available plans with pricing
- `useEntitlements(customerId)` - Check feature entitlements
- `useLimits(customerId)` - Check usage limits
- `usePayment(customerId, options?)` - Process payments
- `useInvoices(customerId, options?)` - List customer invoices

### Utility Hooks
- `useIsomorphicLayoutEffect()` - SSR-safe useLayoutEffect

## Components

### PricingTable

Display pricing plans with selection:

```tsx
import { PricingTable } from '@qazuor/qzpay-react';

<PricingTable
  plans={plans}
  currentPlanId={subscription?.planId}
  onSelect={(plan) => handlePlanSelect(plan)}
  currency="USD"
/>
```

### SubscriptionStatus

Display subscription status with actions:

```tsx
import { SubscriptionStatus } from '@qazuor/qzpay-react';

<SubscriptionStatus
  subscription={subscription}
  onCancel={() => handleCancel()}
  onPause={() => handlePause()}
  onResume={() => handleResume()}
/>
```

### EntitlementGate

Conditionally render content based on entitlements:

```tsx
import { EntitlementGate } from '@qazuor/qzpay-react';

<EntitlementGate
  customerId="cus_123"
  entitlementKey="advanced_analytics"
  fallback={<UpgradePrompt />}
>
  <AdvancedAnalyticsDashboard />
</EntitlementGate>
```

### LimitGate

Conditionally render content based on usage limits:

```tsx
import { LimitGate } from '@qazuor/qzpay-react';

<LimitGate
  customerId="cus_123"
  limitKey="api_calls"
  fallback={<LimitReachedMessage />}
>
  <APICallButton />
</LimitGate>
```

### PaymentForm

Collect payment information:

```tsx
import { PaymentForm } from '@qazuor/qzpay-react';

<PaymentForm
  amount={2999}
  currency="USD"
  onSubmit={async (data) => {
    await processPayment(data);
  }}
  onSuccess={() => showSuccessMessage()}
  onError={(error) => showErrorMessage(error)}
/>
```

### CheckoutButton

Quick checkout button:

```tsx
import { CheckoutButton } from '@qazuor/qzpay-react';

<CheckoutButton
  planId="plan_pro"
  customerId="cus_123"
  onSuccess={(result) => redirectToSuccess(result)}
>
  Subscribe to Pro
</CheckoutButton>
```

### InvoiceList

Display customer invoices:

```tsx
import { InvoiceList } from '@qazuor/qzpay-react';

<InvoiceList
  customerId="cus_123"
  onDownload={(invoice) => downloadInvoicePdf(invoice)}
  onPay={(invoice) => payInvoice(invoice)}
/>
```

### PaymentMethodManager

Manage customer payment methods:

```tsx
import { PaymentMethodManager } from '@qazuor/qzpay-react';

<PaymentMethodManager
  customerId="cus_123"
  onAdd={() => openAddPaymentMethodModal()}
  onRemove={(pm) => removePaymentMethod(pm)}
  onSetDefault={(pm) => setDefaultPaymentMethod(pm)}
/>
```

## Theme System

```tsx
import { QZPayThemeProvider } from '@qazuor/qzpay-react';

const customTheme = {
  colors: {
    primary: '#6366f1',
    success: '#22c55e',
    error: '#ef4444'
  },
  spacing: {
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem'
  }
};

function App() {
  return (
    <QZPayThemeProvider theme={customTheme}>
      <QZPayProvider config={config}>
        <YourApp />
      </QZPayProvider>
    </QZPayThemeProvider>
  );
}
```

## Accessibility

All components are WCAG 2.1 AA compliant with full accessibility support:

```tsx
import { PricingTable, SubscriptionStatus, PaymentForm } from '@qazuor/qzpay-react';

// All components include:
// - ARIA labels and descriptions
// - Semantic HTML roles
// - Keyboard navigation support
// - Screen reader announcements
// - Focus management

function AccessibleBillingUI() {
  return (
    <div>
      {/* PricingTable with ARIA attributes */}
      <PricingTable
        plans={plans}
        onSelect={handleSelect}
        // Automatically includes:
        // - role="region"
        // - aria-label="Pricing plans"
        // - aria-describedby for plan descriptions
      />

      {/* SubscriptionStatus with live region */}
      <SubscriptionStatus
        subscription={subscription}
        // Includes:
        // - aria-live="polite" for status changes
        // - Semantic status indicators
      />

      {/* PaymentForm with validation messages */}
      <PaymentForm
        onSubmit={handlePayment}
        // Includes:
        // - aria-invalid for validation
        // - aria-describedby for error messages
        // - Keyboard accessible buttons
      />
    </div>
  );
}
```

## Error Boundary

Wrap components with ErrorBoundary for graceful error handling:

```tsx
import { QZPayErrorBoundary } from '@qazuor/qzpay-react';

// Basic usage with default fallback
function App() {
  return (
    <QZPayErrorBoundary>
      <PricingTable plans={plans} onSelect={handleSelect} />
    </QZPayErrorBoundary>
  );
}

// Custom fallback UI
function AppWithCustomFallback() {
  return (
    <QZPayErrorBoundary
      fallback={
        <div>
          <h3>Oops! Something went wrong</h3>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      }
    >
      <PaymentForm {...props} />
    </QZPayErrorBoundary>
  );
}

// Dynamic fallback based on error
function AppWithDynamicFallback() {
  return (
    <QZPayErrorBoundary
      fallback={(error) => (
        <div>
          <h3>Payment Error</h3>
          <p>{error.message}</p>
          <button onClick={retryPayment}>Try Again</button>
        </div>
      )}
      onError={(error, errorInfo) => {
        // Log to error tracking service
        logErrorToSentry(error, errorInfo);
      }}
    >
      <CheckoutFlow {...props} />
    </QZPayErrorBoundary>
  );
}
```

## Fixed Issues

1. **usePlans Hook**: Fixed API endpoint call and data fetching logic.
2. **Accessibility**: All components now include proper ARIA attributes.
3. **Error Handling**: Added ErrorBoundary component for robust error management.

## License

MIT
