# Functional Requirements: Usage-Based Billing

Requirements for metered/usage-based billing functionality.

## Table of Contents

1. [Overview](#overview)
2. [FR-USAGE-001: Record Usage](#fr-usage-001-record-usage)
3. [FR-USAGE-002: Get Usage Summary](#fr-usage-002-get-usage-summary)
4. [FR-USAGE-003: Configure Usage Pricing](#fr-usage-003-configure-usage-pricing)
5. [FR-USAGE-004: Calculate Usage Charges](#fr-usage-004-calculate-usage-charges)
6. [FR-USAGE-005: Usage Alerts](#fr-usage-005-usage-alerts)
7. [Pricing Models](#pricing-models)
8. [User Stories](#user-stories)

---

## Overview

Usage-based billing allows charging customers based on actual consumption rather than flat subscription fees. This is essential for:

- **API-based products**: Charge per API call
- **AI/ML services**: Charge per token, inference, or compute time
- **Storage services**: Charge per GB stored
- **Communication services**: Charge per message, minute, or SMS

### Key Concepts

| Term | Description |
|------|-------------|
| **Metric** | What is being measured (api_calls, messages, storage_gb) |
| **Usage Record** | A single usage event with quantity and timestamp |
| **Billing Period** | Time window for aggregating usage (usually subscription period) |
| **Overage** | Usage exceeding included limits |
| **Tier** | Price bracket based on usage volume |

---

## FR-USAGE-001: Record Usage

**Priority**: Critical

**Description**: Record usage events for metered billing.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subscriptionId | string | Yes | Subscription to bill |
| metricId | string | Yes | What is being measured |
| quantity | number | Yes | Amount consumed (positive integer) |
| timestamp | Date | No | When usage occurred (default: now) |
| action | enum | No | `increment` (default) or `set` |
| idempotencyKey | string | Yes | Prevent duplicate records |
| metadata | object | No | Additional context |

### Output

| Field | Type | Description |
|-------|------|-------------|
| usageRecord | UsageRecord | Created usage record |
| periodTotal | number | Total usage for current billing period |
| remainingIncluded | number | Remaining included usage (if applicable) |

### Business Rules

1. **Idempotency**: Same idempotencyKey returns existing record
2. **Validation**: quantity must be positive integer
3. **Aggregation**: Usage aggregated per billing period
4. **Timestamp bounds**: Cannot record usage in future or past closed periods
5. **Metric validation**: metricId must exist in plan configuration

### Example

```typescript
// Record API usage
const usage = await billing.usage.record({
  subscriptionId: 'sub_123',
  metricId: 'api_calls',
  quantity: 150,
  idempotencyKey: `api-batch-${requestId}`,
  metadata: {
    endpoint: '/v1/analyze',
    responseTime: 234,
  },
});

// Result
{
  usageRecord: {
    id: 'usr_abc123',
    subscriptionId: 'sub_123',
    metricId: 'api_calls',
    quantity: 150,
    timestamp: '2025-01-15T10:30:00Z',
  },
  periodTotal: 12500,      // Total API calls this period
  remainingIncluded: 7500, // 20000 included - 12500 used
}
```

### Acceptance Criteria

```gherkin
Scenario: Record usage successfully
  Given a subscription with metricId "api_calls" configured
  When I record 100 API calls with idempotencyKey "req_123"
  Then usage record is created
  And periodTotal reflects new total
  And remainingIncluded is updated

Scenario: Idempotent recording
  Given I recorded 100 API calls with idempotencyKey "req_123"
  When I record again with same idempotencyKey
  Then existing record is returned
  And periodTotal is unchanged
  And no duplicate charge occurs

Scenario: Recording exceeds included amount
  Given subscription includes 1000 API calls
  And current periodTotal is 950
  When I record 100 API calls
  Then usage record is created
  And remainingIncluded becomes 0
  And overage of 50 calls is tracked
  And event USAGE_LIMIT_EXCEEDED is emitted

Scenario: Record usage for closed period
  Given current billing period started Jan 1
  When I try to record usage with timestamp Dec 15 (previous period)
  Then error USAGE_PERIOD_CLOSED is returned
  And no usage is recorded
```

---

## FR-USAGE-002: Get Usage Summary

**Priority**: High

**Description**: Retrieve usage summary for a subscription.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subscriptionId | string | Yes | Subscription ID |
| metricId | string | No | Filter by specific metric |
| periodStart | Date | No | Start of period (default: current period) |
| periodEnd | Date | No | End of period |
| granularity | enum | No | `hour`, `day`, `week`, `month` |

### Output

```typescript
interface UsageSummary {
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: {
    [metricId: string]: {
      total: number;
      included: number;
      overage: number;
      estimatedCharge: number;
      breakdown?: {
        timestamp: Date;
        quantity: number;
      }[];
    };
  };
  totalEstimatedCharge: number;
}
```

### Example

```typescript
const summary = await billing.usage.getSummary({
  subscriptionId: 'sub_123',
  granularity: 'day',
});

// Result
{
  subscriptionId: 'sub_123',
  periodStart: '2025-01-01T00:00:00Z',
  periodEnd: '2025-02-01T00:00:00Z',
  metrics: {
    api_calls: {
      total: 25000,
      included: 20000,
      overage: 5000,
      estimatedCharge: 500, // $5.00 at $0.001/call overage
      breakdown: [
        { timestamp: '2025-01-01', quantity: 800 },
        { timestamp: '2025-01-02', quantity: 950 },
        // ...
      ],
    },
    storage_gb: {
      total: 50,
      included: 10,
      overage: 40,
      estimatedCharge: 400, // $4.00 at $0.10/GB overage
    },
  },
  totalEstimatedCharge: 900, // $9.00 total overage
}
```

### Acceptance Criteria

```gherkin
Scenario: Get current period summary
  Given a subscription with usage this month
  When I request usage summary
  Then I receive totals for all metrics
  And included vs overage is calculated
  And estimated charges are shown

Scenario: Get historical period summary
  Given usage records exist for January
  When I request summary for January
  Then I receive historical totals
  And charges match what was invoiced

Scenario: Get daily breakdown
  Given usage recorded throughout the month
  When I request summary with granularity "day"
  Then breakdown shows daily totals
  And I can identify peak usage days
```

---

## FR-USAGE-003: Configure Usage Pricing

**Priority**: High

**Description**: Define how usage is priced for each metric.

### Pricing Configuration

```typescript
interface UsagePricingConfig {
  metricId: string;
  displayName: string;
  unit: string; // "call", "GB", "message", "minute"

  // Included in base subscription
  includedQuantity: number;

  // Pricing model
  pricingModel: 'per_unit' | 'tiered' | 'volume' | 'package';

  // Per-unit pricing
  perUnit?: {
    amount: number; // in cents
    currency: string;
  };

  // Tiered pricing
  tiers?: {
    upTo: number | 'inf';
    unitAmount: number;
    flatAmount?: number;
  }[];

  // Volume pricing
  volumeTiers?: {
    upTo: number | 'inf';
    unitAmount: number;
  }[];

  // Package pricing
  packages?: {
    quantity: number;
    amount: number;
  }[];

  // Billing behavior
  aggregation: 'sum' | 'max' | 'last_during_period';
  billingCycle: 'per_period' | 'per_day' | 'per_hour';
}
```

### Example Configurations

```typescript
// Per-unit pricing (simple)
const apiCallsPricing: UsagePricingConfig = {
  metricId: 'api_calls',
  displayName: 'API Calls',
  unit: 'call',
  includedQuantity: 10000,
  pricingModel: 'per_unit',
  perUnit: {
    amount: 1, // $0.01 per call over limit
    currency: 'USD',
  },
  aggregation: 'sum',
  billingCycle: 'per_period',
};

// Tiered pricing (graduated)
const messagePricing: UsagePricingConfig = {
  metricId: 'messages',
  displayName: 'Messages Sent',
  unit: 'message',
  includedQuantity: 0,
  pricingModel: 'tiered',
  tiers: [
    { upTo: 1000, unitAmount: 10, flatAmount: 0 },    // $0.10/msg for first 1000
    { upTo: 10000, unitAmount: 5, flatAmount: 0 },   // $0.05/msg for 1001-10000
    { upTo: 'inf', unitAmount: 2, flatAmount: 0 },   // $0.02/msg for 10001+
  ],
  aggregation: 'sum',
  billingCycle: 'per_period',
};

// Volume pricing (all units at tier rate)
const storagePricing: UsagePricingConfig = {
  metricId: 'storage_gb',
  displayName: 'Storage',
  unit: 'GB',
  includedQuantity: 5,
  pricingModel: 'volume',
  volumeTiers: [
    { upTo: 10, unitAmount: 100 },     // $1.00/GB if total <= 10GB
    { upTo: 100, unitAmount: 80 },     // $0.80/GB if total <= 100GB
    { upTo: 'inf', unitAmount: 50 },   // $0.50/GB if total > 100GB
  ],
  aggregation: 'max', // Bill based on peak storage
  billingCycle: 'per_period',
};

// Package pricing (buy in bundles)
const creditsPricing: UsagePricingConfig = {
  metricId: 'ai_credits',
  displayName: 'AI Credits',
  unit: 'credit',
  includedQuantity: 100,
  pricingModel: 'package',
  packages: [
    { quantity: 100, amount: 999 },    // 100 credits for $9.99
    { quantity: 500, amount: 3999 },   // 500 credits for $39.99
    { quantity: 1000, amount: 6999 },  // 1000 credits for $69.99
  ],
  aggregation: 'sum',
  billingCycle: 'per_period',
};
```

---

## FR-USAGE-004: Calculate Usage Charges

**Priority**: Critical

**Description**: Calculate charges based on usage and pricing configuration.

### Calculation Logic

```typescript
function calculateUsageCharge(
  usage: number,
  config: UsagePricingConfig
): {
  includedUsage: number;
  overageUsage: number;
  charge: number;
  breakdown: ChargeBreakdown[];
} {
  const includedUsage = Math.min(usage, config.includedQuantity);
  const overageUsage = Math.max(0, usage - config.includedQuantity);

  let charge = 0;
  const breakdown: ChargeBreakdown[] = [];

  switch (config.pricingModel) {
    case 'per_unit':
      charge = overageUsage * config.perUnit.amount;
      breakdown.push({
        description: `${overageUsage} ${config.unit}s @ $${config.perUnit.amount / 100}`,
        quantity: overageUsage,
        unitAmount: config.perUnit.amount,
        total: charge,
      });
      break;

    case 'tiered':
      // Graduated pricing - each tier applies to its range
      let remaining = overageUsage;
      let processed = 0;
      for (const tier of config.tiers) {
        const tierLimit = tier.upTo === 'inf' ? Infinity : tier.upTo;
        const tierQuantity = Math.min(remaining, tierLimit - processed);
        if (tierQuantity > 0) {
          const tierCharge = tierQuantity * tier.unitAmount + (tier.flatAmount || 0);
          charge += tierCharge;
          breakdown.push({
            description: `${tierQuantity} ${config.unit}s @ $${tier.unitAmount / 100}`,
            quantity: tierQuantity,
            unitAmount: tier.unitAmount,
            total: tierCharge,
          });
          remaining -= tierQuantity;
          processed += tierQuantity;
        }
        if (remaining <= 0) break;
      }
      break;

    case 'volume':
      // All units at the tier rate
      for (const tier of config.volumeTiers) {
        const tierLimit = tier.upTo === 'inf' ? Infinity : tier.upTo;
        if (overageUsage <= tierLimit) {
          charge = overageUsage * tier.unitAmount;
          breakdown.push({
            description: `${overageUsage} ${config.unit}s @ $${tier.unitAmount / 100} (volume)`,
            quantity: overageUsage,
            unitAmount: tier.unitAmount,
            total: charge,
          });
          break;
        }
      }
      break;

    case 'package':
      // Round up to nearest package
      // Implementation depends on business rules
      break;
  }

  return { includedUsage, overageUsage, charge, breakdown };
}
```

### Acceptance Criteria

```gherkin
Scenario: Calculate per-unit overage
  Given plan includes 10000 API calls
  And overage rate is $0.01/call
  When customer uses 15000 calls
  Then charge is $50.00 (5000 overage × $0.01)

Scenario: Calculate tiered pricing
  Given tiered pricing:
    | Up To | Rate |
    | 1000  | $0.10 |
    | 10000 | $0.05 |
    | inf   | $0.02 |
  When customer sends 15000 messages
  Then charge breakdown is:
    | Tier | Quantity | Rate | Amount |
    | 1    | 1000     | $0.10 | $100 |
    | 2    | 9000     | $0.05 | $450 |
    | 3    | 5000     | $0.02 | $100 |
  And total charge is $650.00

Scenario: Calculate volume pricing
  Given volume pricing:
    | Up To | Rate |
    | 10GB  | $1.00 |
    | 100GB | $0.80 |
    | inf   | $0.50 |
  When customer uses 50GB storage
  Then all 50GB is billed at $0.80/GB
  And total charge is $40.00

Scenario: No charge when within included
  Given plan includes 10000 API calls
  When customer uses 8000 calls
  Then overage charge is $0.00
  And 2000 remaining included is shown
```

---

## FR-USAGE-005: Usage Alerts

**Priority**: High

**Description**: Alert customers when approaching or exceeding usage limits.

### Alert Configuration

```typescript
interface UsageAlertConfig {
  metricId: string;
  thresholds: {
    percentage: number; // 50, 80, 90, 100, 150
    action: 'notify' | 'notify_and_block' | 'notify_only_once';
  }[];
  notificationChannels: ('email' | 'webhook' | 'in_app')[];
}

// Default alerts
const defaultAlerts: UsageAlertConfig = {
  metricId: '*', // All metrics
  thresholds: [
    { percentage: 80, action: 'notify' },
    { percentage: 100, action: 'notify' },
    { percentage: 150, action: 'notify' },
  ],
  notificationChannels: ['email', 'in_app'],
};
```

### Events Emitted

| Event | When |
|-------|------|
| `USAGE_THRESHOLD_REACHED` | Usage crosses a threshold (80%, 100%, etc.) |
| `USAGE_LIMIT_EXCEEDED` | Usage exceeds included amount |
| `USAGE_ALERT_SENT` | Alert notification was sent |

### Acceptance Criteria

```gherkin
Scenario: 80% usage alert
  Given subscription includes 10000 API calls
  And usage alert at 80% is configured
  When usage reaches 8000 calls
  Then event USAGE_THRESHOLD_REACHED is emitted
  And email "Approaching API limit" is sent
  And in-app notification is shown

Scenario: 100% usage alert
  Given subscription includes 10000 API calls
  When usage reaches 10000 calls
  Then event USAGE_LIMIT_EXCEEDED is emitted
  And email "API limit reached" is sent
  And email includes overage pricing info

Scenario: Alert only sent once per threshold
  Given 80% alert was sent
  When usage fluctuates around 80%
  Then no duplicate alerts are sent
  And alert is reset at period start
```

---

## Pricing Models

### Comparison Table

| Model | Description | Best For |
|-------|-------------|----------|
| **Per-Unit** | Fixed price per unit over included | API calls, simple metering |
| **Tiered** | Decreasing rate as volume increases | Encouraging higher usage |
| **Volume** | All units at the tier rate | Storage, bandwidth |
| **Package** | Pre-purchased bundles | Credits, tokens |

### Visual Examples

#### Per-Unit Pricing

```
Usage:     0 -------- 10,000 -------- 15,000
           |  Included  |   Overage   |
Price:     $0           $0    $0.01/unit
Total:     $0           $0      $50
```

#### Tiered Pricing (Graduated)

```
Usage:     0 --- 1,000 --- 10,000 --- 15,000
           |  T1   |    T2    |   T3   |
Rate:      $0.10   $0.05      $0.02
Charge:    $100  + $450     + $100 = $650
```

#### Volume Pricing

```
Usage:     0 --- 10GB --- 100GB --- 150GB
           |  T1   |   T2   |   T3   |
If 50GB:   All 50GB × $0.80 = $40
If 150GB:  All 150GB × $0.50 = $75
```

---

## User Stories

### US-USAGE-001: Record API Usage

**As a** developer integrating QZPay
**I want to** record API usage for my customers
**So that** they are billed accurately for their consumption

**Priority**: Critical

**Acceptance Criteria**:
- [ ] Can record usage with quantity and metric ID
- [ ] Idempotency prevents duplicate charges
- [ ] Period total is returned for real-time tracking
- [ ] Invalid metrics are rejected with clear error

```gherkin
Scenario: Record usage from API middleware
  Given customer subscription includes API metering
  When API request completes successfully
  Then usage.record() is called with endpoint details
  And response includes updated period total
  And customer can see real-time usage in dashboard

Scenario: Batch usage recording
  Given multiple usage events accumulated
  When batch is submitted with unique idempotencyKey per event
  Then all events are recorded
  And period total reflects sum of batch
  And duplicate batches are handled gracefully
```

### US-USAGE-002: View Usage Dashboard

**As a** customer
**I want to** see my current usage and estimated charges
**So that** I can manage my costs

**Priority**: High

**Acceptance Criteria**:
- [ ] Dashboard shows current period usage
- [ ] Included vs overage clearly displayed
- [ ] Estimated charges calculated in real-time
- [ ] Historical usage available for comparison

```gherkin
Scenario: View current usage
  Given I am logged into my account
  When I visit the usage dashboard
  Then I see usage for each metric:
    | Metric | Used | Included | Overage | Est. Charge |
    | API Calls | 12,500 | 10,000 | 2,500 | $25.00 |
    | Storage | 8 GB | 10 GB | 0 GB | $0.00 |
  And I see total estimated overage charge

Scenario: Compare usage trends
  Given I have usage history for 3 months
  When I view usage trends
  Then I see month-over-month comparison
  And I can identify usage patterns
  And I can export data to CSV
```

### US-USAGE-003: Receive Usage Alerts

**As a** customer
**I want to** be notified when approaching usage limits
**So that** I can avoid unexpected charges

**Priority**: High

**Acceptance Criteria**:
- [ ] Alert at 80% of included usage
- [ ] Alert at 100% (limit reached)
- [ ] Alert includes current usage and pricing info
- [ ] Can configure alert preferences

```gherkin
Scenario: Receive 80% warning
  Given my plan includes 10,000 API calls
  And I have usage alert enabled at 80%
  When my usage reaches 8,000 calls
  Then I receive email "You've used 80% of your API calls"
  And email shows remaining calls and overage pricing
  And in-app notification appears

Scenario: Configure custom alerts
  Given I want alerts at different thresholds
  When I configure alerts at 50%, 75%, 90%
  Then I receive notifications at each threshold
  And I can disable default alerts
```

### US-USAGE-004: Purchase Usage Package

**As a** customer on package-based pricing
**I want to** buy additional credits
**So that** I can continue using the service

**Priority**: Medium

**Acceptance Criteria**:
- [ ] Can purchase credit packages
- [ ] Credits added immediately
- [ ] Purchase history available
- [ ] Unused credits roll over (if configured)

```gherkin
Scenario: Purchase credit package
  Given I have 50 AI credits remaining
  And I need more credits
  When I purchase 500-credit package for $39.99
  Then my credit balance becomes 550
  And I receive purchase confirmation
  And transaction appears in billing history

Scenario: Credits expire warning
  Given I have credits expiring in 7 days
  When expiration warning is triggered
  Then I receive email about expiring credits
  And I see option to use or extend credits
```

---

## Integration with Subscription Billing

### Combined Billing

Usage charges are added to subscription invoices:

```typescript
// Invoice structure with usage
{
  subscription: {
    planName: 'Pro',
    amount: 4900, // $49.00 base
  },
  usage: {
    api_calls: {
      quantity: 15000,
      included: 10000,
      overage: 5000,
      charge: 500, // $5.00
    },
    storage_gb: {
      quantity: 25,
      included: 10,
      overage: 15,
      charge: 1500, // $15.00
    },
  },
  subtotal: 6900, // $69.00
  tax: 0,
  total: 6900,
}
```

### End-of-Period Processing

1. Aggregate all usage records for the period
2. Calculate charges per metric
3. Add usage charges to subscription invoice
4. Reset usage counters for new period
5. Emit `USAGE_PERIOD_CLOSED` event

---

## Database Schema

```sql
CREATE TABLE billing_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  metric_id VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_usage_idempotency UNIQUE (idempotency_key),
  INDEX idx_usage_subscription_metric (subscription_id, metric_id),
  INDEX idx_usage_timestamp (timestamp)
);

CREATE TABLE billing_usage_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  metric_id VARCHAR(100) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  included_quantity INTEGER NOT NULL DEFAULT 0,
  overage_quantity INTEGER NOT NULL DEFAULT 0,
  charge_amount INTEGER NOT NULL DEFAULT 0,
  charge_currency VARCHAR(3) NOT NULL,
  finalized_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_usage_summary UNIQUE (subscription_id, metric_id, period_start),
  INDEX idx_usage_summary_period (period_start, period_end)
);

CREATE TABLE billing_usage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  metric_id VARCHAR(100) NOT NULL,
  threshold_percentage INTEGER NOT NULL,
  triggered_at TIMESTAMP NOT NULL,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_usage_alert UNIQUE (subscription_id, metric_id, threshold_percentage, DATE(triggered_at))
);
```

---

## References

- [Functional Requirements](./FUNCTIONAL.md)
- [Data Model](../04-data-model/TABLES.md)
- [Events Reference](../05-api/EVENTS.md)
- [Asist.IA Example](../examples/ASISTIA-EXAMPLE.md) - Usage-based AI billing
