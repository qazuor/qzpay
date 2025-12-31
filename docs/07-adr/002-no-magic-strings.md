# ADR-002: No Magic Strings - Exported Constants

## Status

Accepted

## Date

2024-12-26

## Context

Comparing statuses and event types with string literals is error-prone:

```typescript
// Error-prone, no autocomplete, typos possible
if (subscription.status === 'active') { ... }
billing.on('subscription.created', handler);
```

Problems:
- Typos not caught at compile time
- No TypeScript autocomplete
- Refactoring is risky
- No documentation at usage site

## Decision

All status values, event types, and configuration options use exported constants with the `QZPay` prefix:

```typescript
export const QZPaySubscriptionStatus = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  // ...
} as const;

export type QZPaySubscriptionStatusType =
  typeof QZPaySubscriptionStatus[keyof typeof QZPaySubscriptionStatus];
```

Usage:

```typescript
import { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';

if (subscription.status === QZPaySubscriptionStatus.ACTIVE) { ... }
```

### Why QZPay Prefix?

- Avoids collisions with other packages (e.g., another package's `Currency`)
- Instantly recognizable as QZPay exports
- Allows clean imports without aliasing

## Consequences

### Positive

- Full TypeScript autocomplete
- Compile-time error checking
- Self-documenting code
- Safe refactoring
- Tree-shakeable constants
- No naming collisions

### Negative

- Slightly more verbose code
- Must remember to use constants
- Need to export and import constants

## Alternatives Considered

### 1. TypeScript Enums

```typescript
enum SubscriptionStatus {
  ACTIVE = 'active',
  // ...
}
```

- **Rejected**: Enums have runtime overhead and don't tree-shake well

### 2. Plain String Types

```typescript
type SubscriptionStatus = 'active' | 'trialing' | 'canceled';
```

- **Rejected**: No autocomplete for actual values, still allows typos in usage

### 3. Class-based Constants

```typescript
class SubscriptionStatus {
  static readonly ACTIVE = 'active';
}
```

- **Rejected**: Classes are heavier than const objects, less idiomatic

## References

- [Constants Reference](../05-api/CONSTANTS.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
