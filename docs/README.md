# @qazuor/qzpay Documentation

> Universal billing and payments library for Node.js applications

## Quick Navigation

| Section | Description | Key Documents |
|---------|-------------|---------------|
| [Vision](./01-vision/) | Project purpose, target users, value proposition | [Overview](./01-vision/OVERVIEW.md) |
| [Requirements](./02-requirements/) | Functional and non-functional requirements | [User Stories](./02-requirements/USER-STORIES.md) |
| [Architecture](./03-architecture/) | Technical design, patterns, security | [Overview](./03-architecture/OVERVIEW.md) |
| [Data Model](./04-data-model/) | Database schema, tables, migrations | [Tables](./04-data-model/TABLES.md) |
| [API](./05-api/) | Public API, events, constants | [Public API](./05-api/PUBLIC-API.md) |
| [Implementation](./06-implementation/) | Roadmap, phases, task tracking | [Roadmap](./06-implementation/ROADMAP.md) |
| [ADRs](./07-adr/) | Architecture Decision Records | [Index](./07-adr/README.md) |
| [Examples](./examples/) | Real-world implementation examples | [GEMFolio](./examples/GEMFOLIO-EXAMPLE.md) |

---

## Project Roadmap

```
Phase 1: Foundation     ████████████████████ 100%  [PLANNING]
Phase 2: Storage        ░░░░░░░░░░░░░░░░░░░░   0%  [NOT STARTED]
Phase 3: Business Logic ░░░░░░░░░░░░░░░░░░░░   0%  [NOT STARTED]
Phase 4: Providers      ░░░░░░░░░░░░░░░░░░░░   0%  [NOT STARTED]
Phase 5: Framework      ░░░░░░░░░░░░░░░░░░░░   0%  [NOT STARTED]
Phase 6: React          ░░░░░░░░░░░░░░░░░░░░   0%  [NOT STARTED]
Phase 7: CLI            ░░░░░░░░░░░░░░░░░░░░   0%  [NOT STARTED]
Phase 8: Documentation  ░░░░░░░░░░░░░░░░░░░░   0%  [NOT STARTED]
```

### Phase Overview

| Phase | Name | Tasks | Status |
|-------|------|-------|--------|
| 1 | [Core Foundation](./06-implementation/phase-1-foundation.md) | 70 | Planning |
| 2 | [Storage Layer](./06-implementation/phase-2-storage.md) | 60 | Not Started |
| 3A | [Core Services](./06-implementation/phase-3a-core-services.md) | 45 | Not Started |
| 3B | [Payment & Invoice](./06-implementation/phase-3b-payment-invoice.md) | 35 | Not Started |
| 3C | [Discounts](./06-implementation/phase-3c-discounts.md) | 55 | Not Started |
| 3D | [Checkout & Marketplace](./06-implementation/phase-3d-checkout-marketplace.md) | 40 | Not Started |
| 3E | [Notifications & Jobs](./06-implementation/phase-3e-notifications-jobs.md) | 35 | Not Started |
| 3F | [Security & Resilience](./06-implementation/phase-3f-security-resilience.md) | 40 | Not Started |
| 3G | [Advanced Features (P2)](./06-implementation/phase-3g-advanced-p2.md) | 49 | Not Started |
| 4 | [Payment Providers](./06-implementation/phase-4-providers.md) | 80 | Not Started |
| 5 | [Framework Integration](./06-implementation/phase-5-framework.md) | 35 | Not Started |
| 6 | [React Components](./06-implementation/phase-6-react.md) | 60 | Not Started |
| 7 | [CLI Tools](./06-implementation/phase-7-cli.md) | 20 | Not Started |
| 8 | [Documentation](./06-implementation/phase-8-docs.md) | 30 | Not Started |

**Total Tasks: ~654**

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                          │
│  (NestJS, Hono, Express, TanStack Start, etc.)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     @qazuor/qzpay-core                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ Customers   │ │Subscriptions│ │  Payments   │ │ Invoices  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ Promo Codes │ │ Marketplace │ │  Checkout   │ │  Metrics  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Payment Adapter │ │ Storage Adapter │ │ Framework Adapter│
│  - Stripe       │ │  - Drizzle      │ │  - Hono         │
│  - MercadoPago  │ │  - Prisma       │ │  - NestJS       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Package Structure

```
@qazuor/qzpay (monorepo)
├── packages/
│   ├── core/           # @qazuor/qzpay-core - Business logic
│   ├── stripe/         # @qazuor/qzpay-stripe - Stripe adapter
│   ├── mercadopago/    # @qazuor/qzpay-mercadopago - MP adapter
│   ├── drizzle/        # @qazuor/qzpay-drizzle - Storage adapter
│   ├── react/          # @qazuor/qzpay-react - UI components
│   ├── hono/           # @qazuor/qzpay-hono - Hono middleware
│   └── nestjs/         # @qazuor/qzpay-nestjs - NestJS module
├── docs/               # This documentation
└── examples/           # Example implementations
```

---

## Key Design Principles

1. **No Magic Strings** - All comparisons use exported constants with `QZPay` prefix
2. **Type Everything** - Full TypeScript support with strict types
3. **Explicit Over Implicit** - Configuration is always explicit
4. **Rich Objects** - Subscriptions include helper methods
5. **Framework Agnostic** - Core has zero framework dependencies
6. **Project Controls Emails** - Suppress system + `emailSentByPackage` indicator

---

## Getting Started

1. Read the [Vision Overview](./01-vision/OVERVIEW.md) to understand the project
2. Review [User Stories](./02-requirements/USER-STORIES.md) for use cases
3. Study the [Architecture Overview](./03-architecture/OVERVIEW.md)
4. Check the [Implementation Roadmap](./06-implementation/ROADMAP.md)

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Vision | Complete | 2024-12-28 |
| Requirements | Complete | 2024-12-28 |
| Architecture | Complete | 2024-12-28 |
| Data Model | Complete | 2024-12-28 |
| API Specification | Complete | 2024-12-28 |
| Implementation Plan | Complete | 2024-12-28 |
| ADRs | In Progress | 2024-12-28 |

---

*Documentation reorganized for clarity. Original files archived in [archive/](./archive/)*
