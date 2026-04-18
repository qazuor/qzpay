# @qazuor/qzpay-drizzle

## 1.3.0

### Minor Changes

- Add index and `maxUsesPerUser` column to `promoCodes` schema for better query performance and per-user usage limits.

### Patch Changes

- Add `trialEnd` to subscription update types in core, and map missing fields in the drizzle subscription mapper.
- Updated dependencies
  - @qazuor/qzpay-core@1.2.1

## 1.2.0

### Features

- Add composite indexes on `(source, source_id)` columns for entitlements and limits
- Wire `revokeBySource`, `delete`, and `deleteBySource` through storage adapter

### Bug Fixes

- Make limit delete idempotent and use `QZPaySourceType` in repositories
- Fix `sourceId` passthrough in mappers and remove dead code
- Map `currentPeriodStart`, `currentPeriodEnd`, and `trialEnd` fields in subscription update mapper

### Tests

- Migrate all tests to input object pattern
- Add `source`/`sourceId` coverage across entitlement and limit tests

## 1.1.0

### Features

- Initial public release with Drizzle ORM storage adapter
- Full CRUD operations for customers, subscriptions, payments, entitlements, and limits
- PostgreSQL schema definitions and migrations

## 1.0.1

### Bug Fixes

- Minor fixes and improvements

## 1.0.0

- Initial release
