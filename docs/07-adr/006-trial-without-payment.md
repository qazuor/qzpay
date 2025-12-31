# ADR-006: Trial Without Payment Method

## Status

Accepted

## Date

2024-12-26

## Context

Many SaaS applications want to offer free trials to reduce friction for new users. Two approaches exist:

1. **Trial with payment method required**: User must enter card to start trial
2. **Trial without payment method**: User starts trial immediately, prompted for payment later

Each has trade-offs:
- Requiring payment upfront reduces trial abuse but increases friction
- Not requiring payment increases signups but may lead to more unconverted trials

## Decision

Support **both approaches** through configuration:

### Configuration

```typescript
const billing = createQZPayBilling({
  subscriptions: {
    trialRequiresPaymentMethod: false, // Default: no card required
  },
  plans: [
    {
      id: 'pro',
      trial: {
        days: 14,
        requiresPaymentMethod: false, // Can override at plan level
      },
    },
  ],
});
```

### Behavior by Configuration

| Config | Trial Start | Before Trial End | At Trial End |
|--------|-------------|------------------|--------------|
| `requiresPaymentMethod: false` | No card needed | Prompt to add card | If no card: expires |
| `requiresPaymentMethod: true` | Card required | Card already on file | Auto-converts to paid |

### Events and Notifications

```typescript
// Trial approaching end (card required but missing)
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, (event) => {
  if (!event.subscription.hasPaymentMethod) {
    // Send "Add payment method" email
  }
});

// Trial conversion
billing.on(QZPayBillingEvent.TRIAL_CONVERTED, (event) => {
  // User successfully converted from trial to paid
});

// Trial expired without conversion
billing.on(QZPayBillingEvent.TRIAL_EXPIRED, (event) => {
  // User didn't add payment method, trial ended
});
```

## Consequences

### Positive

- Flexibility for different business models
- Reduced friction for trial-without-card approach
- Clear conversion path with events
- Projects can customize trial experience
- Supports hybrid approach (different per plan)

### Negative

- More complex logic for trial handling
- Must handle "no payment method" state gracefully
- Risk of trial abuse without card requirement
- Need clear UX for prompting payment before trial ends

## Alternatives Considered

### 1. Always Require Payment Method

All trials require card upfront.

- **Rejected**: Too restrictive, many projects want frictionless trials

### 2. Always Allow Trial Without Payment

Never require card for trials.

- **Rejected**: Some projects specifically want card-required trials for quality leads

### 3. Global Setting Only

Only global configuration, no per-plan override.

- **Rejected**: Projects may want different behavior for different plan tiers

## References

- [Subscription Management](../02-requirements/FUNCTIONAL.md)
- [User Stories](../02-requirements/USER-STORIES.md)
