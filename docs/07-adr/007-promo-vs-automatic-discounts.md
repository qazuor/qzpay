# ADR-007: Promo Codes vs Automatic Discounts

## Status

Accepted

## Date

2024-12-26

## Context

There are two distinct discount mechanisms needed:

1. **Promo Codes**: Customer-entered codes (e.g., "SAVE20", "LAUNCH50")
2. **Automatic Discounts**: System-applied discounts based on conditions (e.g., "10% off annual plans", "Volume discounts")

Without clear separation:
- Code becomes complex trying to handle both in one system
- Business rules get mixed and confusing
- Stacking behavior becomes unpredictable

## Decision

Implement as **two separate systems** with clear stacking rules:

### Promo Codes

Manually entered by customer at checkout:

```typescript
// Apply promo code
await billing.promoCodes.apply({
  subscriptionId: 'sub_123',
  code: 'SAVE20',
});

// Promo code definition
const promoCode: QZPayPromoCode = {
  code: 'SAVE20',
  type: QZPayDiscountType.PERCENTAGE,
  value: 20,
  maxUses: 100,
  expiresAt: new Date('2024-12-31'),
  applicablePlans: ['pro', 'enterprise'],
  stackable: false, // Cannot combine with other promos
};
```

### Automatic Discounts

Applied automatically when conditions are met:

```typescript
// Automatic discount definition
const autoDiscount: QZPayAutomaticDiscount = {
  id: 'annual_discount',
  name: 'Annual Plan Discount',
  type: QZPayDiscountType.PERCENTAGE,
  value: 20,
  priority: 1, // Lower = higher priority
  stackable: true,
  conditions: {
    billingInterval: 'year', // Only for annual plans
  },
};

// Volume discount
const volumeDiscount: QZPayAutomaticDiscount = {
  id: 'volume_10plus',
  name: 'Volume Discount (10+ seats)',
  type: QZPayDiscountType.PERCENTAGE,
  value: 15,
  priority: 2,
  stackable: true,
  conditions: {
    minQuantity: 10,
  },
};
```

### Stacking Behavior

```typescript
discountStacking: {
  mode: QZPayDiscountStackingMode.ALL_STACKABLE,
  maxStackedDiscounts: 3,
}
```

**Stacking Modes**:

| Mode | Behavior |
|------|----------|
| `BEST_DISCOUNT` | Only highest single discount applies |
| `ALL_STACKABLE` | All stackable discounts apply (multiplicative) |
| `AUTOMATIC_FIRST` | Auto discounts first, then promo if stackable |
| `NONE` | Only one discount ever (first matching) |

**Calculation Order**:
1. Automatic discounts evaluated (by priority)
2. Promo code evaluated (if any)
3. Stacking rules applied
4. Final discount calculated

### Example Calculation

```typescript
// Base price: $100
// Automatic: 20% annual discount (stackable)
// Automatic: 15% volume discount (stackable)
// Promo: 10% SAVE10 code (stackable)

// With ALL_STACKABLE mode:
// $100 * (1 - 0.20) * (1 - 0.15) * (1 - 0.10) = $61.20

// With BEST_DISCOUNT mode:
// $100 * (1 - 0.20) = $80.00 (highest single discount wins)
```

## Consequences

### Positive

- Clear mental model for each discount type
- Predictable stacking behavior
- Easy to explain to customers
- Flexible configuration
- Automatic discounts reduce manual work
- Promo codes maintain marketing flexibility

### Negative

- Two systems to maintain
- Stacking calculation can be complex
- Must document behavior clearly for users
- Need UI for both discount types

## Alternatives Considered

### 1. Single Unified Discount System

Treat all discounts the same, just with different triggers.

- **Rejected**: Confusing distinction between manual and automatic
- **Rejected**: Hard to configure stacking for mixed types

### 2. No Automatic Discounts

Only support promo codes, projects implement their own automatic logic.

- **Rejected**: Automatic discounts are a common need
- **Rejected**: Would force duplicate implementation across projects

### 3. Always Stack All Discounts

No configuration, always apply all applicable discounts.

- **Rejected**: Projects need control over stacking behavior
- **Rejected**: Could lead to excessive discounts

## References

- [Functional Requirements](../02-requirements/FUNCTIONAL.md)
- [Design Patterns](../03-architecture/PATTERNS.md)
