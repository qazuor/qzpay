# ADR-004: Rich Subscription Objects with Helpers

## Status

Accepted

## Date

2024-12-26

## Context

Checking subscription access involves complex logic:

```typescript
// Scattered, error-prone logic
const hasAccess =
  subscription.status === 'active' ||
  subscription.status === 'trialing' ||
  (subscription.status === 'past_due' && isWithinGracePeriod(subscription));
```

Problems:
- Logic duplicated across application
- Easy to forget edge cases
- Changes require updates everywhere

## Decision

Return subscription objects with helper methods:

```typescript
interface QZPaySubscriptionWithHelpers extends QZPaySubscription {
  // Status checks
  isActive(): boolean;
  isTrial(): boolean;
  hasAccess(): boolean;  // active OR trialing OR grace period
  isInGracePeriod(): boolean;
  willCancel(): boolean;

  // Property shortcuts
  hasPaymentMethod: boolean;  // Pre-calculated

  // Time calculations
  daysUntilRenewal(): number;
  daysUntilTrialEnd(): number | null;

  // Feature access
  getEntitlements<T extends QZPayEntitlements>(): T;
  getLimits<T extends QZPayLimits>(): T;
}
```

Usage:

```typescript
const subscription = await billing.subscriptions.get(id);

if (subscription.hasAccess()) {
  // Grant access to premium features
}

const daysLeft = subscription.daysUntilRenewal();
```

## Consequences

### Positive

- Single source of truth for access logic
- Thoroughly tested in one place
- Consistent behavior across applications
- Clean, readable code at usage sites
- Encapsulates complex edge cases

### Negative

- Slightly larger object size
- Methods must be reattached after serialization
- Pattern may be unfamiliar to some developers

## Alternatives Considered

### 1. Standalone Helper Functions

```typescript
import { hasAccess } from '@qazuor/qzpay-core';
if (hasAccess(subscription)) { ... }
```

- **Rejected**: Less discoverable, must import separately

### 2. Computed Properties Only

Only provide pre-calculated boolean properties.

- **Rejected**: Can't handle dynamic calculations like `daysUntilRenewal()`

### 3. Service Methods

```typescript
if (billing.subscriptions.hasAccess(subscriptionId)) { ... }
```

- **Rejected**: Requires extra API calls, less ergonomic

## References

- [Public API](../05-api/PUBLIC-API.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
