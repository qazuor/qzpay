# Phase 2: Storage Layer

## Overview

| Attribute | Value |
|-----------|-------|
| **Tasks** | 60 |
| **Status** | Planning |
| **Dependencies** | Phase 1 Complete |

---

## 2.1 Drizzle Package Setup

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 2.1.1 | Create packages/drizzle directory | ⬜ | 1.9.3 |
| 2.1.2 | Create drizzle package.json | ⬜ | 2.1.1 |
| 2.1.3 | Create drizzle tsconfig.json | ⬜ | 2.1.1 |
| 2.1.4 | Setup tsup for bundling | ⬜ | 2.1.2 |
| 2.1.5 | Create src/index.ts | ⬜ | 2.1.1 |
| 2.1.6 | Setup Vitest for testing | ⬜ | 2.1.2 |

---

## 2.2 Database Schema Definitions

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 2.2.1 | Create schema/customers.schema.ts | ⬜ | 2.1.5 |
| 2.2.2 | Create schema/subscriptions.schema.ts | ⬜ | 2.1.5 |
| 2.2.3 | Create schema/payments.schema.ts | ⬜ | 2.1.5 |
| 2.2.4 | Create schema/invoices.schema.ts | ⬜ | 2.1.5 |
| 2.2.5 | Create schema/invoice-lines.schema.ts | ⬜ | 2.2.4 |
| 2.2.6 | Create schema/payment-methods.schema.ts | ⬜ | 2.1.5 |
| 2.2.7 | Create schema/promo-codes.schema.ts | ⬜ | 2.1.5 |
| 2.2.8 | Create schema/promo-code-usage.schema.ts | ⬜ | 2.2.7 |
| 2.2.9 | Create schema/vendors.schema.ts | ⬜ | 2.1.5 |
| 2.2.10 | Create schema/vendor-payouts.schema.ts | ⬜ | 2.2.9 |
| 2.2.11 | Create schema/usage-records.schema.ts | ⬜ | 2.1.5 |
| 2.2.12 | Create schema/webhook-events.schema.ts | ⬜ | 2.1.5 |
| 2.2.13 | Create schema/audit-logs.schema.ts | ⬜ | 2.1.5 |
| 2.2.14 | Create schema/idempotency-keys.schema.ts | ⬜ | 2.1.5 |
| 2.2.15 | Create schema/currencies.schema.ts | ⬜ | 2.1.5 |
| 2.2.16 | Create schema/relations.ts | ⬜ | 2.2.1-2.2.15 |
| 2.2.17 | Create schema/index.ts | ⬜ | 2.2.16 |

---

## 2.3 Repository Implementations

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 2.3.1 | Create repositories/base.repository.ts | ⬜ | 2.2.17 |
| 2.3.2 | Create repositories/customers.repository.ts | ⬜ | 2.3.1 |
| 2.3.3 | Create repositories/subscriptions.repository.ts | ⬜ | 2.3.1 |
| 2.3.4 | Create repositories/payments.repository.ts | ⬜ | 2.3.1 |
| 2.3.5 | Create repositories/invoices.repository.ts | ⬜ | 2.3.1 |
| 2.3.6 | Create repositories/payment-methods.repository.ts | ⬜ | 2.3.1 |
| 2.3.7 | Create repositories/promo-codes.repository.ts | ⬜ | 2.3.1 |
| 2.3.8 | Create repositories/vendors.repository.ts | ⬜ | 2.3.1 |
| 2.3.9 | Create repositories/usage-records.repository.ts | ⬜ | 2.3.1 |
| 2.3.10 | Create repositories/webhook-events.repository.ts | ⬜ | 2.3.1 |
| 2.3.11 | Create repositories/audit-logs.repository.ts | ⬜ | 2.3.1 |
| 2.3.12 | Create repositories/index.ts | ⬜ | 2.3.2-2.3.11 |

---

## 2.4 Storage Adapter Implementation

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 2.4.1 | Create adapter/drizzle-storage.adapter.ts | ⬜ | 2.3.12 |
| 2.4.2 | Implement customer collection | ⬜ | 2.4.1 |
| 2.4.3 | Implement subscription collection | ⬜ | 2.4.1 |
| 2.4.4 | Implement payment collection | ⬜ | 2.4.1 |
| 2.4.5 | Implement invoice collection | ⬜ | 2.4.1 |
| 2.4.6 | Implement payment method collection | ⬜ | 2.4.1 |
| 2.4.7 | Implement promo code collection | ⬜ | 2.4.1 |
| 2.4.8 | Implement vendor collection | ⬜ | 2.4.1 |
| 2.4.9 | Implement usage record collection | ⬜ | 2.4.1 |
| 2.4.10 | Implement webhook event collection | ⬜ | 2.4.1 |
| 2.4.11 | Implement audit log collection | ⬜ | 2.4.1 |
| 2.4.12 | Implement transaction support | ⬜ | 2.4.1 |
| 2.4.13 | Create adapter/index.ts | ⬜ | 2.4.12 |

---

## 2.5 Migration Infrastructure

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 2.5.1 | Create drizzle.config.ts | ⬜ | 2.2.17 |
| 2.5.2 | Create migrations/0000_initial.sql | ⬜ | 2.5.1 |
| 2.5.3 | Create migrate utility function | ⬜ | 2.5.2 |
| 2.5.4 | Add migration scripts to package.json | ⬜ | 2.5.3 |

---

## 2.6 Utilities and Helpers

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 2.6.1 | Create utils/connection.ts | ⬜ | 2.1.5 |
| 2.6.2 | Create utils/pagination.ts | ⬜ | 2.1.5 |
| 2.6.3 | Create utils/soft-delete.ts | ⬜ | 2.1.5 |
| 2.6.4 | Create utils/optimistic-locking.ts | ⬜ | 2.1.5 |
| 2.6.5 | Create utils/index.ts | ⬜ | 2.6.1-2.6.4 |

---

## 2.7 Testing

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 2.7.1 | Create test/setup.ts | ⬜ | 2.1.6 |
| 2.7.2 | Create test/helpers/db-helpers.ts | ⬜ | 2.7.1 |
| 2.7.3 | Create test/schema.test.ts | ⬜ | 2.2.17 |
| 2.7.4 | Create test/customers.repository.test.ts | ⬜ | 2.3.2 |
| 2.7.5 | Create test/subscriptions.repository.test.ts | ⬜ | 2.3.3 |
| 2.7.6 | Create test/payments.repository.test.ts | ⬜ | 2.3.4 |
| 2.7.7 | Create test/storage-adapter.test.ts | ⬜ | 2.4.13 |

---

## Acceptance Criteria

- [ ] Drizzle package builds successfully
- [ ] All schemas match data model documentation
- [ ] All repository methods implemented
- [ ] Storage adapter implements QZPayStorageAdapter interface
- [ ] Migrations run successfully
- [ ] Transaction support working
- [ ] Tests pass with 90%+ coverage
- [ ] Optimistic locking prevents concurrent update conflicts

---

## Related Documents

- [Data Model Overview](../04-data-model/OVERVIEW.md)
- [Table Definitions](../04-data-model/TABLES.md)
- [Adapter Specifications](../05-api/ADAPTER-SPECIFICATIONS.md)
- [Phase 1: Foundation](./phase-1-foundation.md)
- [Phase 3A: Core Services](./phase-3a-core-services.md)
