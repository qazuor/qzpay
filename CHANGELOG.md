# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v1.1.0
- Redis rate limiting store
- Transaction context propagation
- CLI tools for billing operations
- Additional storage adapters (Prisma, TypeORM)

### Planned for v2.0.0
- MercadoPago split payments (marketplace)
- Multi-tenant support
- Advanced analytics and reporting

## [1.0.0] - 2026-01-09

### Added

#### Core Package (@qazuor/qzpay-core)
- **Billing System**: Complete billing orchestration with provider-agnostic design
- **Customer Management**: Create, update, delete customers with metadata support
- **Subscription Lifecycle**: Full lifecycle management (create, upgrade, downgrade, pause, resume, cancel)
- **Payment Processing**: One-time payments, refunds, and payment method management
- **Entitlements System**: Feature gating based on subscription plans
- **Usage Tracking**: Record and aggregate usage for metered billing
- **Limit Management**: Define and enforce usage limits per plan
- **Invoice Generation**: Automatic invoice creation and management
- **Promo Codes**: Percentage, fixed amount, and free trial discounts
- **Event System**: QZPayEventEmitter for billing events
- **Metrics Service**: MRR, churn rate, revenue calculations
- **Checkout Service**: Checkout session management
- **Notification Service**: Customer notification handling
- **Job Service**: Background job scheduling
- **Type System**: Comprehensive TypeScript types with strict typing

#### Stripe Adapter (@qazuor/qzpay-stripe)
- **Full Stripe Integration**: Complete adapter for Stripe API
- **Customer Adapter**: Customer CRUD with Stripe sync
- **Subscription Adapter**: Subscription management with Stripe Billing
- **Payment Adapter**: Payment processing and refunds
- **Checkout Adapter**: Stripe Checkout integration
- **Price Adapter**: Price management and listing
- **Webhook Adapter**: Webhook handling with signature verification
- **Setup Intent Adapter**: Card saving without charging
- **Vendor Adapter**: Connect accounts for marketplace (prepared for v2)

#### MercadoPago Adapter (@qazuor/qzpay-mercadopago)
- **MercadoPago Integration**: Payment provider for LATAM markets
- **Payment Adapter**: One-time payments with 3D Secure support
- **Customer Adapter**: Customer management
- **Subscription Adapter**: Preapproval-based subscriptions
- **Checkout Adapter**: Preference-based checkout
- **Price Adapter**: Preapproval plan management
- **Webhook Adapter**: IPN handling with HMAC signature verification
- **3D Secure Support**: Full 3DS authentication flow
- **IPN Handler**: Instant Payment Notification processing

#### Drizzle Storage (@qazuor/qzpay-drizzle)
- **PostgreSQL Schema**: Complete billing schema with all tables
- **Customer Repository**: Customer CRUD operations
- **Subscription Repository**: Subscription management
- **Payment Repository**: Payment records
- **Invoice Repository**: Invoice management
- **Plan Repository**: Plan and price management
- **Entitlement Repository**: Feature entitlements
- **Usage Repository**: Usage records and aggregation
- **Limit Repository**: Usage limits
- **Promo Code Repository**: Discount codes
- **Event Repository**: Event logging
- **Transaction Support**: Atomic operations with rollback
- **Migration Helpers**: Database migration utilities

#### Hono Integration (@qazuor/qzpay-hono)
- **Billing Routes**: REST API for billing operations
- **Admin Routes**: Administrative endpoints
- **Webhook Routes**: Provider webhook handlers
- **Rate Limiting Middleware**: In-memory rate limiting
- **Authentication Middleware**: API key authentication
- **Validation Schemas**: Zod schemas for request validation
- **Error Handling**: Consistent error responses

#### NestJS Integration (@qazuor/qzpay-nestjs)
- **QZPayModule**: NestJS module with forRoot/forRootAsync
- **QZPayService**: Injectable billing service
- **Webhook Service**: Webhook processing service
- **Controllers**: Billing, subscription, payment, webhook controllers
- **Guards**: Authentication and entitlement guards
- **Decorators**: @RequireEntitlement, @RequireSubscription, @RateLimit
- **Interceptors**: Logging and transformation

#### React Components (@qazuor/qzpay-react)
- **QZPayProvider**: Context provider for billing state
- **Hooks**: useCustomer, useSubscription, usePayment, useEntitlements, useLimits, usePlans, useInvoices
- **PricingTable**: Plan selection component
- **SubscriptionStatus**: Subscription display component
- **PaymentForm**: Payment input component
- **CheckoutButton**: One-click checkout
- **EntitlementGate**: Feature gating component
- **LimitGate**: Usage limit component
- **InvoiceList**: Invoice history component
- **PaymentMethodManager**: Card management component
- **Theme System**: Customizable theming with dark mode support

### Security
- **Webhook Signature Verification**: Stripe and MercadoPago
- **HMAC Validation**: Timing-safe signature comparison
- **Replay Attack Prevention**: Timestamp validation
- **Input Validation**: Comprehensive Zod schemas
- **Rate Limiting**: Per-IP and per-customer limits
- **Authentication Guards**: API key and subscription validation

### Testing
- **2,300+ Tests**: Comprehensive test suite
- **90%+ Coverage**: High code coverage across all packages
- **Security Tests**: Webhook signature, tampering, replay attacks
- **E2E Tests**: End-to-end billing flows
- **Load Tests**: K6 performance testing scripts

### Documentation
- Architecture overview
- Data model documentation
- API reference
- Package-specific READMEs
- Error catalog
- Migration guide

### Technical Notes
- Minimum Node.js version: 22
- Minimum pnpm version: 9
- TypeScript strict mode enabled
- ESM modules only
- PostgreSQL required for Drizzle storage

## [0.0.1] - 2025-01-06

### Added

- **@qazuor/qzpay-core**: Initial core billing types, constants, and utilities
  - Comprehensive type system for customers, subscriptions, payments, invoices
  - Event system with QZPayEventEmitter
  - Metrics service for MRR, churn, revenue calculations
  - Discount and proration helpers
  - Checkout and marketplace services
  - Notification and job services

- **@qazuor/qzpay-stripe**: Initial Stripe payment provider adapter
  - Customer, subscription, payment, checkout adapters
  - Webhook handling with signature verification
  - Setup intents for card saving
  - Price and vendor adapters
  - Prepared for v2 marketplace features

- **@qazuor/qzpay-mercadopago**: Initial MercadoPago payment adapter
  - Payment and customer adapters
  - 3D Secure support
  - Webhook handling
  - Prepared for v2 split payments

- **@qazuor/qzpay-drizzle**: Initial Drizzle ORM storage adapter
  - PostgreSQL schema with all billing tables
  - Repositories for all entities
  - Transaction support
  - Migration helpers

- **@qazuor/qzpay-hono**: Initial Hono middleware and routes
  - Billing API routes (REST)
  - Admin routes
  - Webhook routes
  - Rate limiting middleware (memory store)
  - Zod validation schemas

- **@qazuor/qzpay-react**: Initial React hooks and components
  - Provider context
  - Hooks for customers, subscriptions, payments
  - Theme system
  - Billing components

- **@qazuor/qzpay-nestjs**: Initial NestJS integration
  - Module configuration
  - Decorators and guards
  - Service injection

### Technical Notes (0.0.1)

- Transaction context propagation is limited in v0.x (documented for v2)
- Rate limiting uses in-memory store (Redis interface prepared for v2)
- Optimistic locking documented but not enforced in all operations

[Unreleased]: https://github.com/qazuor/qzpay/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/qazuor/qzpay/compare/v0.0.1...v1.0.0
[0.0.1]: https://github.com/qazuor/qzpay/releases/tag/v0.0.1
