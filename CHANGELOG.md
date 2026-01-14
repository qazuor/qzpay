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

## [1.0.1] - 2026-01-13

### Fixed

#### Documentation
- **Adapter Specifications**: Rewrote ADAPTER-SPECIFICATIONS.md with correct modular structure
  - Documented correct `QZPayPaymentAdapter` interface with sub-adapters
  - Documented correct `QZPayStorageAdapter` interface with 12 collections
  - Fixed method signatures to match actual implementation
- **Data Model**: Added 10 missing database tables to TABLES.md
  - Added `billing_plans` and `billing_prices` tables
  - Added `billing_entitlements` and `billing_customer_entitlements` tables
  - Added `billing_limits` and `billing_customer_limits` tables
  - Added `billing_addons` and `billing_subscription_addons` tables
  - Added `billing_usage_records` and `billing_webhook_events` tables
- **Events Reference**: Rewrote EVENTS.md with accurate 29 events
  - Fixed event constant names with `QZPAY_` prefix
  - Added `QZPayEventPayload` structure documentation
- **Constants Reference**: Fixed CONSTANTS.md with correct `QZPAY_` prefix
  - Updated all constants to use uppercase prefix
  - Added missing constants (checkout mode, discount stacking, cancel at)
- **Package READMEs**: Fixed all package READMEs with correct API usage
  - Fixed factory function names (`createQZPayDrizzleAdapter`, etc.)
  - Fixed config property name (`paymentAdapter` instead of `provider`)
  - Fixed `QZPayModuleOptions` interface in NestJS readme
- **Examples**: Fixed all examples with correct imports and parameters
  - Fixed `paymentAdapter` parameter name (was `provider`)
  - Fixed `webhooks` property (was `webhook` singular)
  - Fixed `payments.process` method (was `payments.create`)
- **Main README**: Fixed quick start example with correct API usage

## [1.0.0] - 2026-01-09

### Added

#### Core Package (@qazuor/qzpay-core)
- **Input Validation**: Added comprehensive Zod validation to all create methods
  - `customers.create()` validates email, name, and external ID
  - `payments.process()` validates amount, currency, and customer ID
  - `invoices.create()` validates line items and customer data
  - `addons.create()` validates pricing and plan associations
- **Promo Code Validation**: Enhanced validation system
  - Plan applicability checks (only applies to specified plans)
  - Per-customer usage limits enforcement
  - Date range validation (valid_from, valid_to)
  - Active status verification
  - Max uses limit enforcement
- **Logger Integration**: Replaced all `console.error` calls with proper logger
  - Structured logging with log levels (debug, info, warn, error)
  - Context-aware error messages
  - Consistent error tracking across all services

#### Stripe Package (@qazuor/qzpay-stripe)
- **Error Mapping System**: New comprehensive error handling
  - `QZPayStripeError` class for consistent error types
  - `/utils/error.utils.ts` with Stripe error mapper
  - Maps Stripe errors to QZPay error codes
  - Improved error messages for debugging
- **3D Secure Support**: Enhanced 3DS authentication flow
  - `clientSecret` exposed for frontend integration
  - `nextAction` property for action-required payments
  - Full support for SCA (Strong Customer Authentication)
- **Bug Fix**: Fixed external customer ID handling
  - Properly passes `externalId` to Stripe metadata
  - Ensures customer sync between QZPay and Stripe

#### MercadoPago Package (@qazuor/qzpay-mercadopago)
- **Error Handling**: Comprehensive try/catch in all adapters
  - Customer adapter error handling
  - Payment adapter error handling
  - Subscription adapter error handling
  - Checkout adapter error handling
  - Webhook adapter error handling
- **QZPayMercadoPagoError**: New error class with error codes
  - `/utils/error-mapper.ts` for error normalization
  - Maps MercadoPago status codes to QZPay errors
  - Provides user-friendly error messages
  - Includes original error for debugging
- **Bug Fix**: Fixed `payer_email` in subscriptions
  - Now fetches customer email when creating preapprovals
  - Ensures compliance with MercadoPago requirements
- **Bug Fix**: Fixed checkout unit prices
  - Properly fetches `unit_price` from price object
  - Correctly sets `currency_id` in preferences
  - Fixes checkout session creation

#### React Package (@qazuor/qzpay-react)
- **Accessibility (WCAG 2.1 AA)**: Full accessibility support
  - ARIA labels on all interactive elements
  - ARIA roles for semantic structure
  - ARIA live regions for dynamic content
  - Screen reader support in all components
  - Keyboard navigation support
- **ErrorBoundary Component**: New error handling component
  - Catches errors in React component tree
  - Provides fallback UI with error details
  - Supports custom fallback components
  - Error logging callback support
  - Recovery mechanisms
- **Bug Fix**: Fixed `usePlans` hook
  - Corrected API endpoint call
  - Fixed data fetching logic
  - Proper error handling

#### Dev Package (@qazuor/qzpay-dev)
- **Mock Adapters**: Development and testing utilities
  - Mock payment adapter for testing
  - Mock storage adapter for development
  - No external dependencies required
  - Fast and predictable for testing

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

[Unreleased]: https://github.com/qazuor/qzpay/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/qazuor/qzpay/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/qazuor/qzpay/compare/v0.0.1...v1.0.0
[0.0.1]: https://github.com/qazuor/qzpay/releases/tag/v0.0.1
