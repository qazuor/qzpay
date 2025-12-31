# Phase 1: Core Foundation

## Overview

| Attribute | Value |
|-----------|-------|
| **Tasks** | 70 |
| **Status** | ✅ COMPLETED |
| **Dependencies** | None |

---

## 1.1 Monorepo Setup

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.1.1 | Initialize pnpm workspace | ✅ | - |
| 1.1.2 | Setup Turborepo | ✅ | 1.1.1 |
| 1.1.3 | Create root package.json | ✅ | 1.1.1 |
| 1.1.4 | Setup TypeScript config | ✅ | 1.1.1 |
| 1.1.5 | Setup Biome config | ✅ | 1.1.1 |
| 1.1.6 | Setup Changesets | ✅ | 1.1.1 |
| 1.1.7 | Create .gitignore | ✅ | 1.1.1 |
| 1.1.8 | Setup Husky hooks | ✅ | 1.1.5 |
| 1.1.9 | Create GitHub Actions CI | ✅ | 1.1.2 |
| 1.1.10 | Create release workflow | ✅ | 1.1.6 |

---

## 1.2 Core Package Structure

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.2.1 | Create packages/core directory | ✅ | 1.1.1 |
| 1.2.2 | Create core package.json | ✅ | 1.2.1 |
| 1.2.3 | Create core tsconfig.json | ✅ | 1.1.4, 1.2.1 |
| 1.2.4 | Setup tsup for bundling | ✅ | 1.2.2 |
| 1.2.5 | Create src/index.ts | ✅ | 1.2.1 |
| 1.2.6 | Create directory structure | ✅ | 1.2.1 |
| 1.2.7 | Setup Vitest for testing | ✅ | 1.2.2 |
| 1.2.8 | Create tests directory | ✅ | 1.2.7 |

---

## 1.3 Exported Constants

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.3.1 | Create constants/subscription-status.ts | ✅ | 1.2.6 |
| 1.3.2 | Create constants/payment-status.ts | ✅ | 1.2.6 |
| 1.3.3 | Create constants/invoice-status.ts | ✅ | 1.2.6 |
| 1.3.4 | Create constants/billing-interval.ts | ✅ | 1.2.6 |
| 1.3.5 | Create constants/discount-type.ts | ✅ | 1.2.6 |
| 1.3.6 | Create constants/discount-stacking-mode.ts | ✅ | 1.2.6 |
| 1.3.7 | Create constants/discount-condition.ts | ✅ | 1.2.6 |
| 1.3.8 | Create constants/day-of-week.ts | ✅ | 1.2.6 |
| 1.3.9 | Create constants/checkout-mode.ts | ✅ | 1.2.6 |
| 1.3.10 | Create constants/payment-provider.ts | ✅ | 1.2.6 |
| 1.3.11 | Create constants/vendor-status.ts | ✅ | 1.2.6 |
| 1.3.12 | Create constants/currency.ts | ✅ | 1.2.6 |
| 1.3.13 | Create constants/proration-behavior.ts | ✅ | 1.2.6 |
| 1.3.14 | Create constants/cancel-at.ts | ✅ | 1.2.6 |
| 1.3.15 | Create constants/billing-event.ts | ✅ | 1.2.6 |
| 1.3.16 | Create constants/index.ts | ✅ | 1.3.1-1.3.15 |
| 1.3.17 | Create TypeScript types from constants | ✅ | 1.3.16 |

---

## 1.4 Core Types Definition

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.4.1 | Create types/customer.types.ts | ✅ | 1.2.6 |
| 1.4.2 | Create types/subscription.types.ts | ✅ | 1.2.6, 1.3.12 |
| 1.4.3 | Create types/payment.types.ts | ✅ | 1.2.6, 1.3.12 |
| 1.4.4 | Create types/invoice.types.ts | ✅ | 1.2.6, 1.3.12 |
| 1.4.5 | Create types/promo-code.types.ts | ✅ | 1.2.6, 1.3.12 |
| 1.4.6 | Create types/vendor.types.ts | ✅ | 1.2.6, 1.3.12 |
| 1.4.7 | Create types/checkout.types.ts | ✅ | 1.2.6, 1.3.12 |
| 1.4.8 | Create types/plan.types.ts | ✅ | 1.2.6 |
| 1.4.9 | Create types/entitlements.types.ts | ✅ | 1.2.6 |
| 1.4.10 | Create types/limits.types.ts | ✅ | 1.2.6 |
| 1.4.11 | Create types/config.types.ts | ✅ | 1.2.6 |
| 1.4.12 | Create types/events.types.ts | ✅ | 1.2.6, 1.3.10 |
| 1.4.13 | Create types/metrics.types.ts | ✅ | 1.2.6 |
| 1.4.14 | Create types/index.ts | ✅ | 1.4.1-1.4.13 |

---

## 1.5 Adapter Interfaces

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.5.1 | Create adapters/storage.adapter.ts | ✅ | 1.4.14 |
| 1.5.2 | Create adapters/payment.adapter.ts | ✅ | 1.4.14 |
| 1.5.3 | Create adapters/email.adapter.ts | ✅ | 1.4.14 |
| 1.5.4 | Create adapters/index.ts | ✅ | 1.5.1-1.5.3 |

---

## 1.6 Utilities

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.6.1 | Create utils/date.utils.ts | ✅ | 1.2.6 |
| 1.6.2 | Create utils/money.utils.ts | ✅ | 1.2.6 |
| 1.6.3 | Create utils/hash.utils.ts | ✅ | 1.2.6 |
| 1.6.4 | Create utils/validation.utils.ts | ✅ | 1.2.6 |
| 1.6.5 | Create utils/index.ts | ✅ | 1.6.1-1.6.4 |

---

## 1.7 Event System

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.7.1 | Create events/event-emitter.ts | ✅ | 1.4.12 |
| 1.7.2 | Create events/event-handler.ts | ✅ | 1.4.12 |
| 1.7.3 | Create events/index.ts | ✅ | 1.7.1-1.7.2 |

---

## 1.8 QZPayBilling Factory

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.8.1 | Create billing.ts factory | ✅ | 1.5.4, 1.7.3 |
| 1.8.2 | Create billing-from-env.ts | ✅ | 1.8.1 |
| 1.8.3 | Export from index.ts | ✅ | 1.8.1-1.8.2 |

---

## 1.9 Testing Infrastructure

| ID | Task | Status | Dependencies |
|----|------|--------|--------------|
| 1.9.1 | Create test utils | ✅ | 1.2.8 |
| 1.9.2 | Create mock adapters | ✅ | 1.5.4 |
| 1.9.3 | Create test fixtures | ✅ | 1.4.14 |

---

## Acceptance Criteria

- [x] Monorepo builds successfully
- [x] All constants are exported with QZPay prefix
- [x] All types are exported
- [x] Adapter interfaces are defined
- [x] Test infrastructure is working
- [x] CI pipeline passes

---

## Related Documents

- [Roadmap](./ROADMAP.md)
- [Phase 2: Storage Layer](./phase-2-storage.md)
