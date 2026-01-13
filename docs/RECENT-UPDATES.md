# Recent Updates (v1.0.0 → v1.1.0)

Summary of recent improvements and changes to QZPay.

Last Updated: 2026-01-13

---

## Overview

This document summarizes all recent updates to QZPay since version 1.0.0. These changes improve reliability, accessibility, error handling, and user experience across all packages.

## Core Package (@qazuor/qzpay-core)

### Input Validation

**What Changed**: Added comprehensive Zod validation to all create methods.

**Impact**: Prevents invalid data from entering the system, improving data quality and reducing runtime errors.

**Affected Methods**:
- `customers.create()` - Validates email format, name, and external ID
- `payments.process()` - Validates amount (positive, non-zero), currency, customer ID
- `invoices.create()` - Validates line items (non-empty), customer data
- `addons.create()` - Validates pricing, plan associations

**Example**:
```typescript
// Before: Would accept invalid data
await billing.customers.create({
  email: 'not-an-email', // No validation
  name: ''
});

// Now: Throws validation error immediately
try {
  await billing.customers.create({
    email: 'not-an-email',
    name: ''
  });
} catch (error) {
  // error.code === 'VALIDATION_ERROR'
  // error.details contains field-level errors
}
```

### Enhanced Promo Code Validation

**What Changed**: Full validation system for promo codes with multiple checks.

**Impact**: Prevents invalid promo code usage and ensures business rules are enforced.

**New Validations**:
1. Plan applicability - Only works for specified plans
2. Per-customer usage limits - Enforces max uses per customer
3. Date range validation - Checks valid_from and valid_to dates
4. Active status - Only active codes can be used
5. Max uses enforcement - Total usage limit across all customers

**Example**:
```typescript
// Create promo code with restrictions
const promoCode = await billing.promoCodes.create({
  code: 'SUMMER2024',
  discountType: 'percentage',
  discountValue: 20,
  applicablePlans: ['plan_premium'], // Only for premium plan
  maxUses: 100,
  maxUsesPerCustomer: 1,
  validFrom: new Date('2024-06-01'),
  validTo: new Date('2024-08-31')
});

// Validation happens automatically
await billing.promoCodes.validate({
  code: 'SUMMER2024',
  customerId: 'cus_123',
  planId: 'plan_basic' // Will fail - not in applicablePlans
});
```

### Logger Integration

**What Changed**: Replaced all `console.error` calls with structured logger.

**Impact**: Better observability, consistent log format, configurable log levels.

**Migration**: No code changes required. Optionally configure custom logger:

```typescript
import { createDefaultLogger } from '@qazuor/qzpay-core';

const billing = new QZPayBilling({
  storage,
  paymentAdapter,
  logger: createDefaultLogger({
    level: 'debug', // or 'info', 'warn', 'error'
    colorize: true,
    timestamps: true
  })
});
```

---

## Stripe Package (@qazuor/qzpay-stripe)

### Error Mapping System

**What Changed**: New comprehensive error mapping with QZPayStripeError class.

**Impact**: Consistent error handling, better error messages, easier debugging.

**New File**: `/utils/error.utils.ts`

**Example**:
```typescript
import { mapStripeError, QZPayError } from '@qazuor/qzpay-stripe';

try {
  await stripeAdapter.payments.create(paymentData);
} catch (error) {
  const qzpayError = mapStripeError(error);

  // Standardized error codes
  console.log(qzpayError.code);
  // 'card_declined', 'insufficient_funds', etc.

  // Original Stripe error preserved
  console.log(qzpayError.originalError);
}
```

**Error Code Mapping**:
| Stripe Code | QZPay Code |
|-------------|------------|
| `card_declined` | `card_declined` |
| `insufficient_funds` | `insufficient_funds` |
| `expired_card` | `expired_card` |
| `authentication_required` | `authentication_required` |
| `rate_limit_error` | `rate_limit_exceeded` |

### 3D Secure Support

**What Changed**: Enhanced 3DS authentication flow with clientSecret and nextAction.

**Impact**: Full support for Strong Customer Authentication (SCA) requirements.

**New Properties**:
- `clientSecret` - For frontend Stripe.js integration
- `nextAction` - Describes required action (redirect, etc.)

**Example**:
```typescript
const payment = await stripeAdapter.payments.create({
  customerId: 'cus_123',
  amount: 5000,
  currency: 'EUR'
});

if (payment.status === 'requires_action') {
  // Pass to frontend
  return {
    clientSecret: payment.clientSecret,
    nextAction: payment.nextAction
  };
}

// Frontend handles authentication
// stripe.confirmCardPayment(clientSecret)
```

### External Customer ID Fix

**What Changed**: Now properly passes externalId to Stripe metadata.

**Impact**: Maintains sync between your system and Stripe.

**Example**:
```typescript
// Now works correctly
const customer = await stripeAdapter.customers.create({
  email: 'user@example.com',
  externalId: 'user_12345' // Stored in Stripe metadata
});

// Can retrieve by external ID
const found = await stripeAdapter.customers.getByExternalId('user_12345');
```

---

## MercadoPago Package (@qazuor/qzpay-mercadopago)

### Comprehensive Error Handling

**What Changed**: Added try/catch to all adapters with error mapping.

**Impact**: Better error messages, consistent error codes, preserved original errors.

**New File**: `/utils/error-mapper.ts`

**Affected Adapters**:
- Customer Adapter
- Payment Adapter
- Subscription Adapter
- Checkout Adapter
- Webhook Adapter

**Example**:
```typescript
import { QZPayMercadoPagoError, QZPayErrorCode } from '@qazuor/qzpay-mercadopago';

try {
  await mpAdapter.payments.create(customerId, paymentData);
} catch (error) {
  if (error instanceof QZPayMercadoPagoError) {
    console.log('Error code:', error.code);
    console.log('Status detail:', error.statusDetail);
    // 'cc_rejected_insufficient_amount', etc.
  }
}
```

### QZPayMercadoPagoError Class

**What Changed**: New error class for MercadoPago-specific errors.

**Impact**: Standardized error handling with preserved MP details.

**Properties**:
- `code` - QZPay error code
- `message` - Human-readable message
- `statusDetail` - MercadoPago status_detail
- `originalError` - Original MP error

**Error Code Mapping**:
| MP Status Detail | QZPay Code |
|------------------|------------|
| `cc_rejected_insufficient_amount` | `insufficient_funds` |
| `cc_rejected_bad_filled_security_code` | `invalid_card` |
| `cc_rejected_blacklist` | `card_declined` |
| `cc_rejected_duplicated_payment` | `duplicate_transaction` |

### Fixed payer_email in Subscriptions

**What Changed**: Now fetches customer email when creating preapprovals.

**Impact**: Complies with MercadoPago requirements, prevents subscription creation errors.

**Example**:
```typescript
// Before: Would fail without email
const subscription = await mpAdapter.subscriptions.create(
  customerId,
  { priceId: 'price_123' }
);

// Now: Automatically fetches email from customer
// No code changes needed
```

### Fixed Checkout Prices

**What Changed**: Properly fetches unit_price and currency_id from price objects.

**Impact**: Checkout sessions now work correctly with proper pricing.

**Example**:
```typescript
// Now works correctly
const session = await mpAdapter.checkout.createSession({
  customerId: 'cus_123',
  priceId: 'price_123' // Correctly extracts unit_price and currency
});
```

---

## React Package (@qazuor/qzpay-react)

### Accessibility (WCAG 2.1 AA)

**What Changed**: Full accessibility support across all components.

**Impact**: Components are now usable by people with disabilities, meets compliance requirements.

**Features Added**:
- ARIA labels and descriptions
- ARIA roles for semantic structure
- ARIA live regions for dynamic content
- Screen reader support
- Keyboard navigation
- Focus management

**Example**:
```tsx
// All components now include accessibility
<PricingTable
  plans={plans}
  onSelect={handleSelect}
  // Automatically includes:
  // - role="region"
  // - aria-label="Pricing plans"
  // - Keyboard navigation
/>

<SubscriptionStatus
  subscription={subscription}
  // Includes:
  // - aria-live="polite" for status changes
  // - Screen reader announcements
/>
```

**Accessible Components**:
- PricingTable
- SubscriptionStatus
- PaymentForm
- InvoiceList
- CheckoutButton
- PaymentMethodManager
- EntitlementGate
- LimitGate

### ErrorBoundary Component

**What Changed**: New ErrorBoundary component for graceful error handling.

**Impact**: Prevents component crashes from breaking entire app.

**Example**:
```tsx
import { QZPayErrorBoundary } from '@qazuor/qzpay-react';

function App() {
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
        logErrorToSentry(error, errorInfo);
      }}
    >
      <PaymentFlow />
    </QZPayErrorBoundary>
  );
}
```

### Fixed usePlans Hook

**What Changed**: Corrected API endpoint call and data fetching logic.

**Impact**: Hook now works correctly for fetching plans.

**Example**:
```tsx
import { usePlans } from '@qazuor/qzpay-react';

function PlanSelector() {
  const { plans, isLoading, error } = usePlans();

  // Now works correctly
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {plans?.map(plan => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
```

---

## Dev Package (@qazuor/qzpay-dev)

### Documentation Added

**What Changed**: Created comprehensive README for dev package.

**Impact**: Developers can now easily use mock adapters and test utilities.

**Features**:
- Mock Payment Adapter
- Memory Storage Adapter
- Test Cards
- Data Seeds

**Example**:
```typescript
import {
  createMockPaymentAdapter,
  createMemoryStorageAdapter,
  TEST_CARDS
} from '@qazuor/qzpay-dev';

// Fast testing with mocks
const billing = new QZPayBilling({
  storage: createMemoryStorageAdapter(),
  paymentAdapter: createMockPaymentAdapter()
});

// Use test cards
const payment = await billing.payments.process({
  customerId: 'cus_123',
  amount: 2999,
  paymentMethodId: TEST_CARDS.VISA_SUCCESS.number
});
```

---

## New Documentation

### Error Handling Guide

**Location**: `/docs/08-guides/error-handling.md`

**Content**:
- Error hierarchy and classes
- Error codes by category
- Provider-specific error handling
- Frontend error handling
- Best practices
- Testing error scenarios

### Accessibility Guide

**Location**: `/docs/08-guides/accessibility.md`

**Content**:
- WCAG 2.1 AA compliance
- Component accessibility features
- ARIA patterns
- Keyboard navigation
- Screen reader support
- Color and contrast guidelines
- Testing accessibility
- Best practices

---

## Migration Guide

### From v1.0.0 to Current

#### No Breaking Changes

All changes are backwards compatible. No code changes required for existing implementations.

#### Optional Improvements

1. **Add Error Handling**:
```typescript
// Add try/catch blocks
try {
  await billing.payments.process(data);
} catch (error) {
  // Handle QZPay errors
  if (error instanceof QZPayError) {
    handleError(error.code);
  }
}
```

2. **Use ErrorBoundary in React**:
```tsx
import { QZPayErrorBoundary } from '@qazuor/qzpay-react';

<QZPayErrorBoundary>
  <PaymentForm {...props} />
</QZPayErrorBoundary>
```

3. **Configure Logger**:
```typescript
import { createDefaultLogger } from '@qazuor/qzpay-core';

const billing = new QZPayBilling({
  storage,
  paymentAdapter,
  logger: createDefaultLogger({ level: 'info' })
});
```

4. **Leverage Validation**:
```typescript
// Validation now happens automatically
// Catch validation errors for better UX
try {
  await billing.customers.create({ email, name });
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    showValidationErrors(error.details);
  }
}
```

---

## Testing Updates

### Recommended Test Updates

1. **Add error scenario tests**:
```typescript
it('should handle card decline', async () => {
  await expect(
    billing.payments.process({
      paymentMethodId: TEST_CARDS.VISA_DECLINED.number
    })
  ).rejects.toThrow('card_declined');
});
```

2. **Test validation**:
```typescript
it('should validate email format', async () => {
  await expect(
    billing.customers.create({ email: 'invalid' })
  ).rejects.toThrow('VALIDATION_ERROR');
});
```

3. **Test accessibility**:
```typescript
import { axe } from 'jest-axe';

it('should have no accessibility violations', async () => {
  const { container } = render(<PricingTable {...props} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## Benefits Summary

### Reliability
- Input validation prevents bad data
- Comprehensive error handling
- Better error messages
- Preserved error context

### Developer Experience
- Consistent error codes across providers
- Better TypeScript types
- Comprehensive documentation
- Development utilities

### User Experience
- Accessible components
- Better error messages
- 3DS support
- ErrorBoundary prevents crashes

### Compliance
- WCAG 2.1 AA accessibility
- Better logging for auditing
- Validation enforcement

---

## Next Steps

### Recommended Actions

1. **Read the guides**:
   - [Error Handling Guide](./08-guides/error-handling.md)
   - [Accessibility Guide](./08-guides/accessibility.md)

2. **Update error handling** in your application

3. **Add ErrorBoundary** to React components

4. **Test accessibility** of your implementation

5. **Review validation** requirements for your data

---

## Support

- **Issues**: https://github.com/qazuor/qzpay/issues
- **Discussions**: https://github.com/qazuor/qzpay/discussions
- **Email**: qazuor@gmail.com

---

## Related Documents

- [CHANGELOG.md](../CHANGELOG.md) - Detailed changelog
- [Error Catalog](./05-api/ERROR-CATALOG.md) - Complete error reference
- [Package READMEs](../packages/) - Package-specific documentation
