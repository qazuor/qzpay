# Project Overview

## Vision Statement

**@qazuor/qzpay** (QZPay) is a universal, framework-agnostic billing and payments library for Node.js applications. It provides a complete solution for handling one-time payments, subscriptions, usage-based billing, and marketplace scenarios. The package is designed to be highly configurable, allowing any project to integrate billing functionality without being tied to a specific tech stack.

> **Note**: All exports use the `QZPay` prefix (e.g., `QZPayBilling`, `QZPaySubscriptionStatus`, `QZPayStripeAdapter`) to avoid naming collisions with other packages.

---

## Problem Statement

### The Challenge

Developers building SaaS products, e-commerce platforms, or subscription-based services face a common set of challenges:

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Repetitive Implementation** | Every project requires implementing similar billing logic (subscriptions, trials, upgrades, promo codes, etc.) |
| 2 | **Provider Lock-in** | Code written for Stripe doesn't work with Mercado Pago or other providers |
| 3 | **Framework Coupling** | Billing logic often becomes tightly coupled to specific frameworks (NestJS, Express, etc.) |
| 4 | **Database Dependency** | Most billing solutions assume a specific database or ORM |
| 5 | **Maintenance Burden** | Payment provider APIs change frequently, requiring updates across multiple projects |
| 6 | **Compliance Complexity** | PCI compliance, tax calculation, and multi-currency support add significant complexity |
| 7 | **Marketplace Complexity** | Split payments, vendor onboarding, and commission management are particularly difficult |
| 8 | **Magic Strings** | Comparing statuses with string literals (`status === 'active'`) is error-prone and lacks type safety |
| 9 | **Email Responsibility** | Unclear who sends emails (package or application) leads to duplicate or missing notifications |

---

## Solution Overview

### Core Concept

A modular billing system built on adapter patterns that:

1. **Abstracts payment providers** - Write once, use with Stripe, Mercado Pago, or any future provider
2. **Abstracts storage** - Use with Drizzle, Prisma, or any database through storage adapters
3. **Abstracts frameworks** - Integrate with Hono, NestJS, Express, TanStack Start, or any framework
4. **Provides sensible defaults** - Works out of the box with minimal configuration
5. **Allows deep customization** - Every aspect can be overridden for specific needs
6. **Eliminates magic strings** - All status checks use exported constants with full type safety
7. **Clarifies email responsibility** - Clear system to indicate what package sends vs what project handles

---

## Target Users

| User Type | Description |
|-----------|-------------|
| **Solo developers** | Building multiple SaaS products |
| **Small teams** | Want to focus on product features rather than billing infrastructure |
| **Agencies** | Build projects for clients and need reusable billing solutions |
| **Startups** | Need to move fast but want enterprise-grade billing |

---

## Real-World Scenarios

The package is designed to support these specific use cases:

### GEMFolio (E-commerce Marketplace)

- Product sales with variable pricing
- Bundle discounts
- Volume-based discounts (10% off over $X)
- Shipping cost calculation (future)
- Marketplace model with vendor commissions
- Split payments to vendors

### HOSPEDA (Property Listing Platform)

- Monthly/annual subscriptions for property listings
- One-time service purchases (photo sessions, etc.)
- Subscription add-ons (featured listings, etc.)
- Trial periods (with and without credit card)
- Upgrade/downgrade flows
- Entitlements (custom branding, analytics access)
- Limits (max properties, max photos per property)

### Asist.IA (AI Bot Platform)

- Monthly/annual subscriptions
- Usage-based billing (message counts)
- Additional bot purchases
- Plugin add-ons
- Initial setup service (one-time)
- Entitlements (priority support, API access)
- Limits (max bots, monthly messages)

---

## Success Metrics

### Developer Experience

- [ ] First integration under 30 minutes
- [ ] Clear, comprehensive documentation
- [ ] TypeScript autocompletion for all APIs
- [ ] Zero-config defaults that just work
- [ ] No magic strings in project code

### Reliability

- [ ] 100% test coverage for core billing logic
- [ ] Comprehensive webhook handling
- [ ] Graceful error handling and retries
- [ ] Audit logging for all financial operations

### Performance

- [ ] Minimal bundle size per package
- [ ] No unnecessary dependencies
- [ ] Efficient database queries
- [ ] Lazy loading for UI components

---

## Out of Scope (For Now)

The following features are explicitly out of scope for the initial release but designed to be added later:

1. Fiscal invoicing (AFIP integration, etc.)
2. Shipping calculation
3. Inventory management
4. Tax calculation by jurisdiction
5. Vue/Svelte UI components
6. GraphQL API
7. Admin dashboard application
8. Mobile SDKs

---

## Related Documents

- [User Personas](./PERSONAS.md)
- [Value Propositions](./VALUE-PROPOSITIONS.md)
- [Functional Requirements](../02-requirements/FUNCTIONAL.md)
- [Architecture Overview](../03-architecture/OVERVIEW.md)
