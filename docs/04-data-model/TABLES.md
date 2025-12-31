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

### billing_subscriptions

Stores subscription records with complete lifecycle data.

```sql
CREATE TABLE billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE RESTRICT,
  plan_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,           -- active, trialing, past_due, canceled, etc.
  billing_interval VARCHAR(50) NOT NULL, -- week, month, quarter, year
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
    status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete', 'expired')
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
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),
  base_amount INTEGER,           -- Amount in base currency
  base_currency VARCHAR(3) REFERENCES billing_currencies(code),
  exchange_rate DECIMAL(18, 8),
  status VARCHAR(50) NOT NULL,   -- pending, processing, succeeded, failed, refunded
  provider VARCHAR(50) NOT NULL, -- stripe, mercadopago, bank_transfer
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
  currency VARCHAR(3) NOT NULL REFERENCES billing_currencies(code),
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
  type VARCHAR(50) NOT NULL,     -- percentage, fixed_amount, free_period, trial_extension
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

## Related Documents

- [Data Model Overview](./OVERVIEW.md)
- [Schema Patterns](./PATTERNS.md)
- [Migrations](./MIGRATIONS.md)
