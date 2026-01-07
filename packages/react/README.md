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

### Data Hooks
- `useCustomer(id)` - Get single customer
- `useCustomers(options)` - List customers
- `useSubscriptions(customerId)` - List subscriptions
- `useSubscription(id)` - Get single subscription
- `usePayments(customerId)` - List payments
- `usePayment(id)` - Get single payment
- `useInvoices(customerId)` - List invoices
- `useInvoice(id)` - Get single invoice
- `usePlans()` - List plans
- `usePlan(id)` - Get single plan

### Mutation Hooks
- `useCreateCustomer()`
- `useUpdateCustomer()`
- `useCreateSubscription()`
- `useCancelSubscription()`
- `useProcessPayment()`
- `useRefundPayment()`
- `useCreateInvoice()`

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

## License

MIT
