# @qazuor/qzpay-core

## 1.2.0

### Features

- Add `QZPaySourceType` enum (`manual`, `addon`, `system`) for tracking entitlement and limit origins
- Extend entitlement and limit input types with `source` and `sourceId` fields
- Add `trialEnd` field to `QZPayUpdateSubscriptionInput`

### Bug Fixes

- Change `grant`/`set` methods to use input object pattern (RO-RO) instead of positional arguments
- Add `remove` and `revokeBySource` methods to entitlement and limit storage adapters

### Tests

- Migrate all tests to input object pattern
- Add `source`/`sourceId` coverage across entitlement and limit tests

### Docs

- Update API docs for input object pattern and addon source type

## 1.1.0

### Features

- Initial public release with full billing, subscription, and payment management
- Entitlement and limit management system
- Memory storage adapter for development
- Comprehensive type system with Zod validation

## 1.0.1

### Bug Fixes

- Minor fixes and improvements

## 1.0.0

- Initial release
