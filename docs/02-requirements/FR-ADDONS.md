# FR-ADDONS: Subscription Add-ons Requirements

## Overview

Add-ons extend subscription functionality by allowing customers to purchase additional features, seats, or services on top of their base plan. Add-ons can be recurring (charged each billing cycle) or one-time purchases attached to a subscription.

---

## FR-ADDONS-001: Add-on Definition

### Description

Define reusable add-on products that can be attached to subscriptions.

### Add-on Types

| Type | Description | Billing |
|------|-------------|---------|
| `recurring` | Billed every subscription cycle | Per-cycle charge |
| `one_time` | Single charge when added | One-time charge |
| `metered` | Based on usage | Calculated at cycle end |
| `seat` | Per-user/seat pricing | Quantity-based recurring |
| `tier_unlock` | Unlocks higher tier features | One-time or recurring |

### Add-on Configuration

```typescript
interface AddOnDefinition {
  id: string;
  name: string;
  description: string;

  /** Add-on type */
  type: 'recurring' | 'one_time' | 'metered' | 'seat' | 'tier_unlock';

  /** Pricing model */
  pricing: AddOnPricing;

  /** Which plans can have this add-on */
  applicablePlanIds: string[] | 'all';

  /** Plans where this add-on is already included */
  includedInPlanIds: string[];

  /** Entitlements granted */
  entitlements?: Record<string, boolean>;

  /** Limits modified */
  limitsModifier?: Record<string, number>;

  /** Can customer self-service manage? */
  customerManageable: boolean;

  /** Maximum quantity (null = unlimited) */
  maxQuantity: number | null;

  /** Minimum quantity when added */
  minQuantity: number;

  /** Requires another add-on first */
  requiresAddOnIds?: string[];

  /** Incompatible with these add-ons */
  incompatibleAddOnIds?: string[];

  /** Active status */
  active: boolean;

  /** Display order */
  sortOrder: number;

  /** Metadata */
  metadata: Record<string, unknown>;
}
```

### Add-on Pricing

```typescript
interface AddOnPricing {
  /** Pricing type */
  type: 'flat' | 'per_unit' | 'tiered' | 'volume';

  /** Flat rate or unit price (in cents) */
  unitAmount: number;

  /** Currency */
  currency: string;

  /** For tiered/volume pricing */
  tiers?: PricingTier[];

  /** Setup fee (one-time on first add) */
  setupFee?: number;

  /** Proration behavior */
  prorationBehavior: 'create_prorations' | 'none' | 'always_invoice';
}

interface PricingTier {
  upTo: number | null; // null = infinity
  unitAmount: number;
  flatAmount?: number;
}
```

### API

```typescript
// List available add-ons for a plan
billing.addons.listForPlan(planId: string): Promise<AddOnDefinition[]>

// Get add-on details
billing.addons.get(addonId: string): Promise<AddOnDefinition>

// Check if add-on applicable to subscription
billing.addons.isApplicable(addonId: string, subscriptionId: string): Promise<boolean>

// Calculate add-on price
billing.addons.calculatePrice(
  addonId: string,
  quantity: number,
  subscriptionId?: string
): Promise<PriceCalculation>
```

### Acceptance Criteria

- [ ] Add-ons can be defined with all pricing types
- [ ] Plan restrictions enforced when adding
- [ ] Included add-ons automatically present on qualifying plans
- [ ] Incompatibility rules prevent conflicting add-ons
- [ ] Price calculation accurate for all pricing types

---

## FR-ADDONS-002: Add-on Attachment

### Description

Attach add-ons to active subscriptions with proper billing and proration.

### API

```typescript
// Add an add-on to subscription
billing.subscriptions.addAddOn(
  subscriptionId: string,
  addonId: string,
  options?: AddAddOnOptions
): Promise<SubscriptionAddOn>

// Update add-on quantity
billing.subscriptions.updateAddOn(
  subscriptionId: string,
  subscriptionAddonId: string,
  quantity: number
): Promise<SubscriptionAddOn>

// Remove add-on
billing.subscriptions.removeAddOn(
  subscriptionId: string,
  subscriptionAddonId: string,
  options?: RemoveAddOnOptions
): Promise<void>

// List add-ons on subscription
billing.subscriptions.listAddOns(subscriptionId: string): Promise<SubscriptionAddOn[]>
```

### Add Add-on Options

```typescript
interface AddAddOnOptions {
  /** Quantity (default: 1) */
  quantity?: number;

  /** Override price per unit */
  unitAmountOverride?: number;

  /** When to start billing (default: immediately) */
  billingStart?: 'now' | 'next_period';

  /** Proration behavior override */
  prorationBehavior?: 'create_prorations' | 'none';

  /** Metadata */
  metadata?: Record<string, unknown>;
}
```

### Remove Add-on Options

```typescript
interface RemoveAddOnOptions {
  /** When to remove */
  removeAt?: 'now' | 'period_end';

  /** Issue credit for unused portion */
  issueCredit?: boolean;
}
```

### Subscription Add-on Record

```typescript
interface SubscriptionAddOn {
  id: string;
  subscriptionId: string;
  addonId: string;
  addonName: string;

  /** Current quantity */
  quantity: number;

  /** Price per unit (may be overridden) */
  unitAmount: number;

  /** Current period charge */
  currentPeriodAmount: number;

  /** Billing type inherited from add-on */
  billingType: 'recurring' | 'one_time' | 'metered';

  /** Status */
  status: 'active' | 'pending_removal';

  /** When removal is scheduled */
  cancelsAt?: Date;

  /** Added at */
  createdAt: Date;

  /** Metadata */
  metadata: Record<string, unknown>;
}
```

### Acceptance Criteria

- [ ] Add-on can be added mid-cycle with proration
- [ ] Quantity changes create appropriate prorations
- [ ] One-time add-ons charged immediately
- [ ] Removal at period end stops next cycle billing
- [ ] Immediate removal with credit supported

---

## FR-ADDONS-003: Add-on Billing Integration

### Description

Integrate add-ons into the subscription billing cycle.

### Billing Rules

1. **Recurring Add-ons**:
   - Added to subscription invoice each cycle
   - Prorated when added/removed mid-cycle
   - Quantity changes prorated

2. **One-time Add-ons**:
   - Charged immediately when added
   - No recurring charge
   - No proration on removal

3. **Metered Add-ons**:
   - Usage aggregated during cycle
   - Charged at cycle end based on usage
   - Follow usage-based billing rules

4. **Seat Add-ons**:
   - Quantity = number of seats
   - Auto-adjust based on team size (optional)
   - Proration on seat count changes

### Invoice Line Item Format

```typescript
interface AddOnInvoiceLineItem {
  type: 'addon' | 'addon_proration';
  addonId: string;
  addonName: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  period: {
    start: Date;
    end: Date;
  };
  prorationDetails?: {
    type: 'credit' | 'charge';
    reason: string;
  };
}
```

### Proration Calculation

```typescript
// Add-on added mid-cycle
const daysRemaining = daysBetween(addDate, periodEnd);
const totalDays = daysBetween(periodStart, periodEnd);
const proratedAmount = Math.round(fullAmount * (daysRemaining / totalDays));

// Add-on quantity increased mid-cycle
const quantityDiff = newQuantity - oldQuantity;
const proratedIncrease = Math.round(
  quantityDiff * unitAmount * (daysRemaining / totalDays)
);

// Add-on removed mid-cycle (credit)
const daysUsed = daysBetween(periodStart, removeDate);
const creditAmount = Math.round(fullAmount * ((totalDays - daysUsed) / totalDays));
```

### Acceptance Criteria

- [ ] Recurring add-ons appear on subscription invoices
- [ ] Proration accurate to the day
- [ ] One-time add-ons create separate invoices
- [ ] Metered add-ons follow usage billing rules
- [ ] Credits issued for mid-cycle removals

---

## FR-ADDONS-004: Seat-Based Add-ons

### Description

Special handling for seat/user-based add-ons common in team/business plans.

### Seat Configuration

```typescript
interface SeatAddOnConfig extends AddOnDefinition {
  type: 'seat';

  /** Included seats in base plan */
  includedSeats: number;

  /** Maximum seats (null = unlimited) */
  maxSeats: number | null;

  /** Minimum seats when purchasing */
  minAdditionalSeats: number;

  /** Auto-adjust when team changes */
  autoAdjust: boolean;

  /** Grace period for seat reduction (days) */
  seatReductionGraceDays: number;
}
```

### Seat Management API

```typescript
// Get current seat allocation
billing.seats.getStatus(subscriptionId: string): Promise<SeatStatus>

// Add seats
billing.seats.add(subscriptionId: string, count: number): Promise<SeatUpdate>

// Remove seats (at period end)
billing.seats.remove(subscriptionId: string, count: number): Promise<SeatUpdate>

// Set exact seat count
billing.seats.setCount(subscriptionId: string, count: number): Promise<SeatUpdate>
```

### Seat Status

```typescript
interface SeatStatus {
  subscriptionId: string;

  /** Total available seats */
  totalSeats: number;

  /** Seats from base plan */
  includedSeats: number;

  /** Additional seats purchased */
  additionalSeats: number;

  /** Currently assigned seats */
  assignedSeats: number;

  /** Available unassigned seats */
  availableSeats: number;

  /** Pending seat changes */
  pendingChanges?: {
    effectiveDate: Date;
    newTotalSeats: number;
    change: number;
  };

  /** Cost breakdown */
  monthlyAmount: number;
  perSeatAmount: number;
}
```

### Auto-Adjust Rules

When `autoAdjust` is enabled:

1. **Seat Added**: Automatically purchase if under limit
2. **Seat Removed**: Schedule reduction at period end
3. **Over Limit**: Block new seat assignment until upgraded

```gherkin
Scenario: Auto-add seat when team grows
  Given subscription has autoAdjust enabled
  And current seats: 5 (3 included + 2 additional)
  And all 5 seats assigned
  When a 6th team member is added
  Then an additional seat is purchased automatically
  And prorated charge is created
  And the new member can be assigned immediately

Scenario: Auto-reduce seats when team shrinks
  Given subscription has autoAdjust enabled
  And current seats: 5 (3 included + 2 additional)
  When team size reduces to 4
  Then 1 seat reduction is scheduled for period end
  And customer continues to have 5 seats until then
```

### Acceptance Criteria

- [ ] Included seats from plan not charged
- [ ] Additional seats charged per unit
- [ ] Auto-adjust purchases seats when needed
- [ ] Seat reductions apply at period end
- [ ] Cannot remove seats below assigned count

---

## FR-ADDONS-005: Feature Unlock Add-ons

### Description

Add-ons that unlock specific features or capabilities not included in the base plan.

### Configuration

```typescript
interface FeatureUnlockAddOn extends AddOnDefinition {
  type: 'tier_unlock';

  /** Feature flags to enable */
  enableFeatures: string[];

  /** Limits to modify */
  modifyLimits?: {
    limit: string;
    operation: 'set' | 'add' | 'multiply';
    value: number;
  }[];

  /** Description of what's unlocked */
  featureDescription: string;

  /** Icon for UI */
  icon?: string;
}
```

### Feature Access Check

```typescript
// Check if feature enabled (including via add-ons)
billing.features.isEnabled(
  subscriptionId: string,
  featureKey: string
): Promise<boolean>

// Get all enabled features
billing.features.listEnabled(subscriptionId: string): Promise<EnabledFeature[]>

// Get effective limits (plan + add-ons)
billing.limits.getEffective(subscriptionId: string): Promise<EffectiveLimits>
```

### Limit Modification Example

```typescript
// Base plan: 10 projects
// Add-on: "Extra Projects Pack" - adds 25 projects

const addon: FeatureUnlockAddOn = {
  id: 'addon_extra_projects',
  name: 'Extra Projects Pack',
  type: 'tier_unlock',
  pricing: { type: 'flat', unitAmount: 999, currency: 'USD' },
  enableFeatures: [],
  modifyLimits: [
    { limit: 'max_projects', operation: 'add', value: 25 }
  ],
  // ...
};

// Result: 35 total projects available
```

### Acceptance Criteria

- [ ] Features enabled immediately when add-on added
- [ ] Features disabled when add-on removed
- [ ] Limit modifications stack correctly
- [ ] Feature check fast (cached)
- [ ] Clear UI indication of add-on features

---

## FR-ADDONS-006: Add-on Bundles

### Description

Group multiple add-ons into discounted bundles.

### Bundle Configuration

```typescript
interface AddOnBundle {
  id: string;
  name: string;
  description: string;

  /** Add-ons included */
  includedAddOns: {
    addonId: string;
    quantity: number;
  }[];

  /** Bundle pricing (usually discounted vs individual) */
  pricing: {
    amount: number;
    currency: string;
    billingType: 'recurring' | 'one_time';
  };

  /** Savings vs buying individually */
  savingsPercent: number;

  /** Applicable plans */
  applicablePlanIds: string[] | 'all';

  /** Active status */
  active: boolean;

  /** Display order */
  sortOrder: number;
}
```

### Bundle API

```typescript
// List available bundles for subscription
billing.bundles.listForSubscription(subscriptionId: string): Promise<AddOnBundle[]>

// Purchase bundle
billing.bundles.purchase(
  subscriptionId: string,
  bundleId: string
): Promise<BundlePurchase>

// Remove bundle (removes all included add-ons)
billing.bundles.remove(
  subscriptionId: string,
  bundlePurchaseId: string,
  options?: RemoveAddOnOptions
): Promise<void>
```

### Acceptance Criteria

- [ ] Bundle price less than individual add-ons total
- [ ] All included add-ons activated together
- [ ] Bundle removal removes all included add-ons
- [ ] Cannot add individual add-on if already in bundle
- [ ] Bundle discount shown in pricing

---

## Database Schema

```sql
-- Add-on definitions
CREATE TABLE addon_definitions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  pricing JSONB NOT NULL,
  applicable_plan_ids TEXT[],
  included_in_plan_ids TEXT[],
  entitlements JSONB,
  limits_modifier JSONB,
  customer_manageable BOOLEAN NOT NULL DEFAULT true,
  max_quantity INTEGER,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  requires_addon_ids TEXT[],
  incompatible_addon_ids TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscription add-ons
CREATE TABLE subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  addon_id VARCHAR(50) NOT NULL REFERENCES addon_definitions(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount INTEGER NOT NULL,
  billing_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  cancels_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subscription_id, addon_id)
);

-- Add-on bundles
CREATE TABLE addon_bundles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  included_addons JSONB NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  billing_type VARCHAR(50) NOT NULL,
  savings_percent DECIMAL(5,2),
  applicable_plan_ids TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bundle purchases
CREATE TABLE bundle_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  bundle_id VARCHAR(50) NOT NULL REFERENCES addon_bundles(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  cancels_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add-on usage (for metered add-ons)
CREATE TABLE addon_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_addon_id UUID NOT NULL REFERENCES subscription_addons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action VARCHAR(50) NOT NULL DEFAULT 'increment',
  idempotency_key VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_subscription_addons_subscription ON subscription_addons(subscription_id);
CREATE INDEX idx_subscription_addons_addon ON subscription_addons(addon_id);
CREATE INDEX idx_bundle_purchases_subscription ON bundle_purchases(subscription_id);
CREATE INDEX idx_addon_usage_subscription_addon ON addon_usage_records(subscription_addon_id, timestamp);
CREATE UNIQUE INDEX idx_addon_usage_idempotency ON addon_usage_records(subscription_addon_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
```

---

## Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `addon.added` | `{ subscriptionId, addonId, quantity, amount }` | Add-on attached to subscription |
| `addon.updated` | `{ subscriptionId, addonId, oldQuantity, newQuantity }` | Add-on quantity changed |
| `addon.removed` | `{ subscriptionId, addonId }` | Add-on removed from subscription |
| `addon.scheduled_removal` | `{ subscriptionId, addonId, removalDate }` | Add-on scheduled for removal |
| `bundle.purchased` | `{ subscriptionId, bundleId, addons }` | Bundle purchased |
| `bundle.removed` | `{ subscriptionId, bundleId }` | Bundle removed |
| `seats.changed` | `{ subscriptionId, oldCount, newCount, effectiveDate }` | Seat count changed |
| `seats.auto_adjusted` | `{ subscriptionId, reason, change }` | Auto-adjustment occurred |

---

## User Stories

### US-ADDON-001: Add Extra Storage

**As a** customer on the Basic plan
**I want to** purchase additional storage
**So that** I can store more files

```gherkin
Scenario: Purchase storage add-on mid-cycle
  Given I have an active Basic subscription
  And Basic includes 10GB storage
  And "Extra Storage" add-on provides 50GB for $5/month
  And I'm 15 days into my billing cycle
  When I add the "Extra Storage" add-on
  Then I'm charged $2.50 (prorated for remaining 15 days)
  And my storage limit increases to 60GB immediately
  And my next invoice includes $5 for the add-on
```

### US-ADDON-002: Add Team Seats

**As a** team administrator
**I want to** add seats for new team members
**So that** they can access our account

```gherkin
Scenario: Add additional seats
  Given my team plan includes 5 seats
  And I have 5 team members
  When I try to invite a 6th member
  Then I'm prompted to purchase an additional seat
  And I see the per-seat price and proration
  When I confirm the purchase
  Then the seat is added immediately
  And I can invite the new team member
```

### US-ADDON-003: Purchase Feature Pack

**As a** customer
**I want to** unlock advanced reporting
**So that** I can analyze my data better

```gherkin
Scenario: Purchase feature unlock add-on
  Given my plan doesn't include advanced reporting
  And "Advanced Reports" add-on costs $10/month
  When I purchase the "Advanced Reports" add-on
  Then I gain access to advanced reporting features immediately
  And I see "Advanced Reports" in my active add-ons
  And my next invoice includes the add-on charge
```

### US-ADDON-004: Remove Add-on at Period End

**As a** customer
**I want to** cancel an add-on at the end of my billing period
**So that** I get the full value of what I paid

```gherkin
Scenario: Schedule add-on removal
  Given I have the "Extra Storage" add-on active
  And I'm 10 days into my billing cycle
  When I remove the add-on with "at period end" option
  Then the add-on is marked for removal
  And I keep the extra storage until period end
  And my next invoice won't include the add-on
```

### US-ADDON-005: Purchase Add-on Bundle

**As a** customer
**I want to** purchase a bundle of add-ons
**So that** I save money compared to buying individually

```gherkin
Scenario: Purchase "Power User Bundle"
  Given "Power User Bundle" includes Storage + Reports + Priority Support
  And individual total would be $25/month
  And bundle price is $20/month (20% savings)
  When I purchase the bundle
  Then all three features are activated
  And I'm charged $20 (prorated if mid-cycle)
  And I see the bundle in my subscription
```

---

## Example Add-on Configurations

### Storage Add-on (Per Unit)

```typescript
const storageAddon: AddOnDefinition = {
  id: 'addon_extra_storage',
  name: 'Extra Storage',
  description: 'Additional 50GB of storage',
  type: 'recurring',
  pricing: {
    type: 'per_unit',
    unitAmount: 500, // $5 per 50GB
    currency: 'USD',
    prorationBehavior: 'create_prorations',
  },
  applicablePlanIds: ['basic', 'pro'],
  includedInPlanIds: ['enterprise'],
  entitlements: {},
  limitsModifier: { storage_gb: 50 },
  customerManageable: true,
  maxQuantity: 10,
  minQuantity: 1,
  active: true,
  sortOrder: 1,
  metadata: {},
};
```

### Seat Add-on

```typescript
const seatAddon: SeatAddOnConfig = {
  id: 'addon_team_seat',
  name: 'Team Seat',
  description: 'Additional team member seat',
  type: 'seat',
  pricing: {
    type: 'per_unit',
    unitAmount: 1000, // $10/seat/month
    currency: 'USD',
    prorationBehavior: 'create_prorations',
  },
  applicablePlanIds: ['team', 'business'],
  includedInPlanIds: [],
  includedSeats: 0, // From plan
  maxSeats: 100,
  minAdditionalSeats: 1,
  autoAdjust: true,
  seatReductionGraceDays: 3,
  customerManageable: true,
  active: true,
  sortOrder: 0,
  metadata: {},
};
```

### Feature Unlock Add-on

```typescript
const reportsAddon: FeatureUnlockAddOn = {
  id: 'addon_advanced_reports',
  name: 'Advanced Reports',
  description: 'Unlock advanced analytics and reporting',
  type: 'tier_unlock',
  pricing: {
    type: 'flat',
    unitAmount: 1000, // $10/month
    currency: 'USD',
    prorationBehavior: 'create_prorations',
  },
  applicablePlanIds: ['basic', 'pro'],
  includedInPlanIds: ['enterprise'],
  enableFeatures: ['advanced_reports', 'export_csv', 'scheduled_reports'],
  modifyLimits: [
    { limit: 'report_retention_days', operation: 'set', value: 365 },
  ],
  featureDescription: 'Full analytics suite with custom reports and exports',
  customerManageable: true,
  maxQuantity: 1,
  minQuantity: 1,
  active: true,
  sortOrder: 2,
  metadata: {},
};
```

---

## Related Documents

- [Functional Requirements](./FUNCTIONAL.md)
- [Usage-Based Billing](./FR-USAGE.md)
- [Invoice Requirements](./FR-INVOICE.md)
- [Data Model](../04-data-model/TABLES.md)
