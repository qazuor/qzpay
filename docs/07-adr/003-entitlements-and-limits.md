# ADR-003: Separate Entitlements and Limits

## Status

Accepted

## Date

2024-12-26

## Context

Plans grant access to features and impose restrictions. These need to be represented in a way that's:
- Type-safe for each project
- Easy to check in application code
- Clear in semantics

## Decision

Separate **Entitlements** (boolean features) from **Limits** (numeric restrictions):

### Entitlements

Boolean feature flags that a plan grants:

```typescript
interface QZPayEntitlements {
  canAccessAnalytics: boolean;
  hasAPIAccess: boolean;
  hasPrioritySupport: boolean;
}
```

### Limits

Numeric restrictions with `-1` meaning unlimited:

```typescript
interface QZPayLimits {
  maxProjects: number;        // -1 = unlimited
  maxUsersPerProject: number;
  monthlyAPIRequests: number;
}
```

### Usage

```typescript
const subscription = await billing.subscriptions.get(id);
const entitlements = subscription.getEntitlements<MyEntitlements>();
const limits = subscription.getLimits<MyLimits>();

if (entitlements.canAccessAnalytics) {
  // Show analytics
}

if (currentProjects >= limits.maxProjects && limits.maxProjects !== -1) {
  // Show upgrade prompt
}
```

## Consequences

### Positive

- Clear semantics: boolean vs numeric
- Different UI patterns (checkmarks vs progress bars)
- Type-safe per project
- Easy to extend
- Intuitive API

### Negative

- Two concepts to understand instead of one
- Projects must define both interfaces
- Slightly more complex plan configuration

## Alternatives Considered

### 1. Single "Features" Object

```typescript
interface Features {
  analytics: boolean | number;
  apiCalls: boolean | number;
}
```

- **Rejected**: Confusing semantics, hard to type properly

### 2. Feature Flags Only

Use only boolean flags, with limits checked separately.

- **Rejected**: Limits are inherent to plans, should be co-located

### 3. Generic Key-Value

```typescript
features: Record<string, boolean | number>
```

- **Rejected**: Loses type safety, no autocomplete

## References

- [Architecture Patterns](../03-architecture/PATTERNS.md)
- [Functional Requirements](../02-requirements/FUNCTIONAL.md)
