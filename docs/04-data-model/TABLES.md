# Table Definitions

## Core Tables

### billing_customers

Stores billing customer information linked to external user IDs.

```sql
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  mp_customer_id VARCHAR(255),
  preferred_language VARCHAR(10) DEFAULT 'en',
  segment VARCHAR(50),           -- retail, wholesale, enterprise, vip
  tier VARCHAR(20),              -- free, basic, pro, enterprise
  billing_address JSONB,
  shipping_address JSONB,
  tax_id VARCHAR(50),
  tax_id_type VARCHAR(20),       -- vat, rfc, cuit, ein, gst
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT uq_customers_external_id_livemode UNIQUE (external_id, livemode),
  CONSTRAINT chk_customer_email_format CHECK (email ~ '.+@.+\..+')
);

CREATE INDEX idx_customers_external_id ON billing_customers(external_id);
CREATE INDEX idx_customers_email ON billing_customers(email);
CREATE INDEX idx_customers_active ON billing_customers(id) WHERE deleted_at IS NULL;
```

---

### billing_plans

Stores subscription plan definitions with features, entitlements, and limits.

```sql
CREATE TABLE billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  features JSONB NOT NULL DEFAULT '[]',
  entitlements TEXT[] NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  version UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_plans_active ON billing_plans(active);
CREATE INDEX idx_plans_livemode ON billing_plans(livemode);
```

---

### billing_prices

Stores price configurations for plans (monthly, yearly, etc.).

```sql
CREATE TABLE billing_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
  nickname VARCHAR(255),
  currency VARCHAR(3) NOT NULL,
  unit_amount INTEGER NOT NULL,
  billing_interval VARCHAR(50) NOT NULL,
  interval_count INTEGER NOT NULL DEFAULT 1,
  trial_days INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_price_id VARCHAR(255),
  mp_price_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prices_plan_id ON billing_prices(plan_id);
CREATE INDEX idx_prices_active ON billing_prices(active);
CREATE INDEX idx_prices_stripe_price_id ON billing_prices(stripe_price_id);
CREATE INDEX idx_prices_mp_price_id ON billing_prices(mp_price_id);
CREATE INDEX idx_prices_currency_interval ON billing_prices(currency, billing_interval);
```

---

### billing_subscriptions

Stores subscription records with complete lifecycle data.

```sql
CREATE TABLE billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
  plan_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,           -- active, trialing, past_due, canceled, etc.
  billing_interval VARCHAR(50) NOT NULL, -- day, week, month, year
  interval_count INTEGER DEFAULT 1,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  trial_converted BOOLEAN DEFAULT FALSE,
  trial_converted_at TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  promo_code_id UUID REFERENCES billing_promo_codes(id),
  default_payment_method_id UUID,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id VARCHAR(255),
  mp_subscription_id VARCHAR(255),
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_subscription_status CHECK (
    status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete', 'incomplete_expired')
  )
);

CREATE INDEX idx_subscriptions_customer ON billing_subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON billing_subscriptions(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_subscriptions_renewal ON billing_subscriptions(current_period_end)
  WHERE status IN ('active', 'trialing') AND deleted_at IS NULL;
```

---

### billing_payments

Stores payment transaction records.

```sql
CREATE TABLE billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES billing_subscriptions(id),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  base_amount INTEGER,           -- Amount in base currency
  base_currency VARCHAR(3),
  exchange_rate DECIMAL(18, 8),
  status VARCHAR(50) NOT NULL,   -- pending, processing, succeeded, failed, refunded
  provider VARCHAR(50) NOT NULL, -- stripe, mercadopago
  provider_payment_id VARCHAR(255),
  payment_method_id UUID,
  refunded_amount INTEGER DEFAULT 0,
  failure_code VARCHAR(100),
  failure_message TEXT,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_payment_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_refund_not_exceed_amount CHECK (refunded_amount <= amount)
);

CREATE INDEX idx_payments_customer ON billing_payments(customer_id);
CREATE INDEX idx_payments_subscription ON billing_payments(subscription_id);
CREATE INDEX idx_payments_status ON billing_payments(status);
CREATE INDEX idx_payments_provider_id ON billing_payments(provider_payment_id);
```

---

### billing_invoices

Stores invoice records as legal documents.

```sql
CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES billing_subscriptions(id),
  number VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,   -- draft, open, paid, void, uncollectible
  subtotal INTEGER NOT NULL,
  discount INTEGER DEFAULT 0,
  tax INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  amount_paid INTEGER DEFAULT 0,
  amount_remaining INTEGER,
  currency VARCHAR(3) NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  voided_at TIMESTAMP WITH TIME ZONE,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT uq_invoice_number_livemode UNIQUE (number, livemode),
  CONSTRAINT chk_invoice_amounts CHECK (total = subtotal - discount + tax)
);

CREATE INDEX idx_invoices_customer ON billing_invoices(customer_id);
CREATE INDEX idx_invoices_status ON billing_invoices(status);
CREATE INDEX idx_invoices_due_date ON billing_invoices(due_date) WHERE status = 'open';
```

---

### billing_promo_codes

Stores promotional code definitions.

```sql
CREATE TABLE billing_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,     -- percentage, fixed_amount, free_trial
  value INTEGER NOT NULL,
  config JSONB DEFAULT '{}',     -- Additional configuration
  max_uses INTEGER,              -- NULL = unlimited
  used_count INTEGER DEFAULT 0,
  max_per_customer INTEGER DEFAULT 1,
  valid_plans TEXT[],            -- NULL = all plans
  new_customers_only BOOLEAN DEFAULT FALSE,
  existing_customers_only BOOLEAN DEFAULT FALSE,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  combinable BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_promo_code UNIQUE (code),
  CONSTRAINT chk_promo_value_positive CHECK (value >= 0),
  CONSTRAINT chk_customer_restriction CHECK (
    NOT (new_customers_only AND existing_customers_only)
  )
);

CREATE INDEX idx_promo_codes_code ON billing_promo_codes(code) WHERE active = TRUE;
```

---

### billing_vendors

Stores marketplace vendor information.

```sql
CREATE TABLE billing_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  commission_rate DECIMAL(5, 4) NOT NULL, -- 0.0000 to 0.9999 (99.99%)
  payment_mode VARCHAR(50) DEFAULT 'automatic', -- automatic, manual
  stripe_account_id VARCHAR(255),
  mp_merchant_id VARCHAR(255),
  onboarding_status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
  can_receive_payments BOOLEAN DEFAULT FALSE,
  pending_balance INTEGER DEFAULT 0,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT uq_vendor_external_id UNIQUE (external_id),
  CONSTRAINT chk_commission_rate CHECK (commission_rate >= 0 AND commission_rate < 1)
);
```

---

## Entitlement & Limit Tables

### billing_entitlements

Defines available entitlements (features) that can be granted to customers.

```sql
CREATE TABLE billing_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entitlements_key ON billing_entitlements(key);
```

---

### billing_customer_entitlements

Tracks which entitlements are granted to which customers.

```sql
CREATE TABLE billing_customer_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  entitlement_key VARCHAR(100) NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  source VARCHAR(50) NOT NULL,    -- subscription, purchase, manual, promotion
  source_id UUID,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_entitlements_customer_id ON billing_customer_entitlements(customer_id);
CREATE INDEX idx_customer_entitlements_key ON billing_customer_entitlements(entitlement_key);
CREATE INDEX idx_customer_entitlements_customer_key ON billing_customer_entitlements(customer_id, entitlement_key);
CREATE INDEX idx_customer_entitlements_expires_at ON billing_customer_entitlements(expires_at);
```

---

### billing_limits

Defines available limits (quotas) that can be assigned to customers.

```sql
CREATE TABLE billing_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(1000),
  default_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_limits_key ON billing_limits(key);
```

---

### billing_customer_limits

Tracks limit allocations and current usage for each customer.

```sql
CREATE TABLE billing_customer_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  limit_key VARCHAR(100) NOT NULL,
  max_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMP WITH TIME ZONE,
  source VARCHAR(50) NOT NULL,    -- subscription, purchase, manual
  source_id UUID,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_limits_customer_id ON billing_customer_limits(customer_id);
CREATE INDEX idx_customer_limits_key ON billing_customer_limits(limit_key);
CREATE INDEX idx_customer_limits_customer_key ON billing_customer_limits(customer_id, limit_key);
CREATE INDEX idx_customer_limits_reset_at ON billing_customer_limits(reset_at);
```

---

## Add-on Tables

### billing_addons

Defines add-on products that can be purchased alongside subscriptions.

```sql
CREATE TABLE billing_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  unit_amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  billing_interval VARCHAR(50) NOT NULL,
  billing_interval_count INTEGER NOT NULL DEFAULT 1,
  compatible_plan_ids TEXT[] NOT NULL DEFAULT '{}',
  allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  max_quantity INTEGER,
  entitlements TEXT[] NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  version UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_addons_active ON billing_addons(active);
CREATE INDEX idx_addons_livemode ON billing_addons(livemode);
CREATE INDEX idx_addons_billing_interval ON billing_addons(billing_interval);
```

---

### billing_subscription_addons

Tracks add-ons attached to subscriptions with quantity and pricing.

```sql
CREATE TABLE billing_subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES billing_addons(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_addons_subscription ON billing_subscription_addons(subscription_id);
CREATE INDEX idx_subscription_addons_addon ON billing_subscription_addons(addon_id);
CREATE INDEX idx_subscription_addons_status ON billing_subscription_addons(status);
CREATE INDEX idx_subscription_addons_composite ON billing_subscription_addons(subscription_id, addon_id);
```

---

## Usage & Tracking Tables

### billing_usage_records

Records metered usage for usage-based billing models.

```sql
CREATE TABLE billing_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL DEFAULT 'increment',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  idempotency_key VARCHAR(255),
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_records_subscription ON billing_usage_records(subscription_id);
CREATE INDEX idx_usage_records_metric ON billing_usage_records(metric_name);
CREATE INDEX idx_usage_records_timestamp ON billing_usage_records(timestamp);
CREATE INDEX idx_usage_records_idempotency ON billing_usage_records(idempotency_key);
```

---

## Support Tables

### billing_payment_methods

```sql
CREATE TABLE billing_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_payment_method_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,     -- card, bank_account, etc.
  last_four VARCHAR(4),
  brand VARCHAR(50),
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

---

### billing_webhook_events

Stores processed webhook events for idempotency.

```sql
CREATE TABLE billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  livemode BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_webhook_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX idx_webhook_events_provider_event ON billing_webhook_events(provider, provider_event_id);
CREATE INDEX idx_webhook_events_type ON billing_webhook_events(event_type);
```

---

### billing_audit_logs

Immutable audit trail for all financial operations.

```sql
CREATE TABLE billing_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_type VARCHAR(50) NOT NULL,  -- user, system, webhook
  actor_id VARCHAR(255),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  livemode BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- No UPDATE or DELETE allowed
```

---

## Table Summary

| Table | Description |
|-------|-------------|
| `billing_customers` | Customer records linked to external IDs |
| `billing_plans` | Subscription plan definitions |
| `billing_prices` | Price configurations for plans |
| `billing_subscriptions` | Active and historical subscriptions |
| `billing_payments` | Payment transactions |
| `billing_invoices` | Invoice records |
| `billing_promo_codes` | Promotional code definitions |
| `billing_vendors` | Marketplace vendor accounts |
| `billing_entitlements` | Feature entitlement definitions |
| `billing_customer_entitlements` | Customer feature grants |
| `billing_limits` | Usage limit definitions |
| `billing_customer_limits` | Customer usage allocations |
| `billing_addons` | Add-on product definitions |
| `billing_subscription_addons` | Subscription add-on attachments |
| `billing_usage_records` | Metered usage records |
| `billing_payment_methods` | Stored payment methods |
| `billing_webhook_events` | Processed webhook events |
| `billing_audit_logs` | Immutable audit trail |

---

## Related Documents

- [Data Model Overview](./OVERVIEW.md)
- [Schema Patterns](./PATTERNS.md)
- [Migrations](./MIGRATIONS.md)
