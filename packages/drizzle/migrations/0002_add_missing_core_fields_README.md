# Migration 0002: Add Missing Core Fields

**Created:** 2026-01-15
**Status:** Ready to apply

## Overview

This migration adds fields to Drizzle schemas that exist in Core types but were previously missing. This ensures full alignment between the database schema and the Core domain types.

## Changes

### 1. Customers (`billing_customers`)

**Added:**
- `phone` (VARCHAR(20), nullable) - Customer phone number

**Reason:** Core type `QZPayCustomer` has a `phone` field that was not reflected in the database schema.

### 2. Subscriptions (`billing_subscriptions`)

**Added:**
- `cancel_at_period_end` (BOOLEAN, default: false) - Flag indicating whether subscription should cancel at period end

**Reason:** Core type `QZPaySubscription` has this field which is critical for subscription cancellation behavior.

### 3. Vendors (`billing_vendors`)

**Added:**
- `payout_schedule` (JSONB, nullable) - Payout schedule configuration

**Structure:**
```json
{
  "interval": "daily" | "weekly" | "monthly",
  "dayOfWeek": 0-6,      // Optional, for weekly
  "dayOfMonth": 1-31     // Optional, for monthly
}
```

**Reason:** Core type `QZPayVendor` includes payout scheduling that needs to be persisted.

### 4. Payment Methods (`billing_payment_methods`)

**Added:**
- `status` (VARCHAR(50), NOT NULL, default: 'active') - Payment method status

**Valid values:** 'active', 'expired', 'invalid'

**Reason:** Core type `QZPayPaymentMethod` has a status field for tracking payment method validity.

### 5. Payments (`billing_payments`)

**Changed:**
- `provider_payment_id` (VARCHAR(255)) → `provider_payment_ids` (JSONB)

**Migration strategy:**
1. Add new `provider_payment_ids` JSONB column
2. Migrate existing data: `{ [provider]: provider_payment_id }`
3. Drop old `provider_payment_id` column and index

**Reason:** Core type `QZPayPayment` uses a Record<string, string> to support multiple provider IDs per payment.

## Applying the Migration

### Using SQL

```bash
# Apply migration
psql -d your_database -f 0002_add_missing_core_fields.sql

# Rollback if needed
psql -d your_database -f 0002_add_missing_core_fields_rollback.sql
```

### Using Drizzle Kit

```bash
# Push changes to database
pnpm drizzle-kit push

# Or generate and run migration
pnpm drizzle-kit migrate
```

## Impact Assessment

### Breaking Changes
- **Payments table structure change**: Code reading `provider_payment_id` must be updated to use `provider_payment_ids`
- **Payment methods require status**: New records must include a status field

### Data Migration
- Existing payment records will have their `provider_payment_id` migrated to `provider_payment_ids` automatically
- All new fields are nullable or have defaults, so no data loss occurs

### Backwards Compatibility
- Old code reading `provider_payment_id` will fail after migration
- Mappers have been updated to handle the new structure

## Affected Components

### Updated Files
1. `/packages/drizzle/src/schema/customers.schema.ts`
2. `/packages/drizzle/src/schema/subscriptions.schema.ts`
3. `/packages/drizzle/src/schema/vendors.schema.ts`
4. `/packages/drizzle/src/schema/payment-methods.schema.ts`
5. `/packages/drizzle/src/schema/payments.schema.ts`
6. `/packages/drizzle/src/mappers/customer.mapper.ts`
7. `/packages/drizzle/src/mappers/subscription.mapper.ts`
8. `/packages/drizzle/src/mappers/vendor.mapper.ts`
9. `/packages/drizzle/src/mappers/payment-method.mapper.ts`
10. `/packages/drizzle/src/mappers/payment.mapper.ts`

## Testing Checklist

Before applying in production:

- [ ] Test customer creation with phone number
- [ ] Test subscription cancellation with `cancelAtPeriodEnd`
- [ ] Test vendor creation with payout schedule
- [ ] Test payment method status tracking
- [ ] Test payment creation with multiple provider IDs
- [ ] Verify data migration from `provider_payment_id` to `provider_payment_ids`
- [ ] Test rollback migration in staging environment
- [ ] Verify all mapper functions handle new fields correctly

## Rollback Plan

If issues occur:

1. Run rollback SQL: `0002_add_missing_core_fields_rollback.sql`
2. Revert code changes to mappers
3. Redeploy previous version

**Note:** Rollback will migrate `provider_payment_ids` back to `provider_payment_id` using the first provider in the object.

## Related Issues

- Aligns Drizzle schemas with Core types
- Fixes missing fields preventing full feature implementation
- Enables proper tracking of payment method status
- Supports vendor payout scheduling
- Allows multiple payment provider IDs per transaction
