# User Stories

## Overview

This document contains comprehensive user stories organized by domain and priority. Each story includes acceptance criteria and Given/When/Then scenarios to ensure complete understanding of expected behavior.

**Target Audience**: Developers, QA Engineers, Product Managers, Stakeholders

---

## Table of Contents

1. [Customer Management](#1-customer-management-stories)
2. [Subscription Lifecycle](#2-subscription-lifecycle-stories)
3. [Trial Management](#3-trial-management-stories)
4. [Plan Changes](#4-plan-change-stories)
5. [Payment Processing](#5-payment-processing-stories)
6. [Payment Failure & Recovery](#6-payment-failure--recovery-stories)
7. [Payment Methods](#7-payment-method-stories)
8. [Invoices](#8-invoice-stories)
9. [Promo Codes & Discounts](#9-promo-code--discount-stories)
10. [Add-ons](#10-add-on-stories)
11. [Usage-Based Billing](#11-usage-based-billing-stories)
12. [Webhooks](#12-webhook-stories)
13. [Admin Operations](#13-admin-operation-stories)
14. [Marketplace](#14-marketplace-stories)
15. [Multi-Provider](#15-multi-provider-stories)
16. [Security & Compliance](#16-security--compliance-stories)
17. [Developer Experience](#17-developer-experience-stories)

---

## 1. Customer Management Stories

### US-CUST-001: Register Customer for Billing

**As a** developer
**I want to** register a user as a billing customer
**So that** they can make purchases and subscribe to plans

**Priority**: Critical

**Acceptance Criteria**:
- [ ] Can create customer with external ID and email
- [ ] Customer ID returned for future operations
- [ ] Duplicate external ID rejected with clear error
- [ ] Customer created but not charged until first payment
- [ ] Optional name and phone stored

```gherkin
Scenario: Successfully register a new customer
  Given a user with ID "user_123" and email "user@example.com"
  When I call billing.customers.create with externalId and email
  Then a new customer record is created
  And the customer ID is returned
  And no charge is made to the customer

Scenario: Reject duplicate external ID
  Given a customer with externalId "user_123" already exists
  When I try to create another customer with externalId "user_123"
  Then error CUSTOMER_ALREADY_EXISTS is returned
  And no new customer is created

Scenario: Validate email format
  Given an invalid email "not-an-email"
  When I try to create a customer with this email
  Then error INVALID_EMAIL_FORMAT is returned

Scenario: Create customer with full details
  Given user data with email, name, phone, and metadata
  When I create a customer with all fields
  Then all data is stored correctly
  And metadata is preserved as JSON
```

### US-CUST-002: Link Customer to Payment Provider

**As a** developer
**I want to** have customer automatically created in payment provider on first payment
**So that** I don't have to manage provider customer IDs

**Priority**: High

**Acceptance Criteria**:
- [ ] Provider customer created on first checkout
- [ ] Provider customer ID stored internally
- [ ] Same customer used for future payments
- [ ] Multiple providers can be linked

```gherkin
Scenario: Create provider customer on first checkout
  Given a customer "cust_123" without a Stripe customer ID
  When the customer initiates their first checkout
  Then a Stripe customer is created with matching email
  And the Stripe customer ID is stored in providerCustomerIds
  And the checkout proceeds normally

Scenario: Reuse existing provider customer
  Given a customer "cust_123" with Stripe customer ID "cus_stripe_abc"
  When the customer initiates a new checkout
  Then the existing Stripe customer "cus_stripe_abc" is used
  And no new Stripe customer is created

Scenario: Link multiple providers
  Given a customer with Stripe ID but no MercadoPago ID
  When the customer makes a MercadoPago payment
  Then a MercadoPago customer is created
  And both provider IDs are stored
```

### US-CUST-003: Sync Customer Data

**As a** developer
**I want to** sync user data changes to billing customer
**So that** billing records stay current

**Priority**: High

**Acceptance Criteria**:
- [ ] Can call syncUser to create or update customer
- [ ] Email changes synced to payment providers
- [ ] Metadata merged correctly
- [ ] Non-destructive update (preserves existing fields)

```gherkin
Scenario: Sync creates customer if not exists
  Given no billing customer for externalId "user_456"
  When I call billing.customers.syncUser with user data
  Then a new customer is created
  And the customer data matches the provided values

Scenario: Sync updates existing customer
  Given a customer exists with email "old@example.com"
  When I call syncUser with email "new@example.com"
  Then the customer email is updated locally
  And the email is updated in connected payment providers

Scenario: Sync merges metadata
  Given a customer with metadata { "source": "web" }
  When I sync with metadata { "tier": "premium" }
  Then the resulting metadata is { "source": "web", "tier": "premium" }
```

### US-CUST-004: Retrieve Customer Details

**As a** developer
**I want to** retrieve customer details by external ID
**So that** I can display billing information

**Priority**: High

```gherkin
Scenario: Get customer by external ID
  Given a customer with externalId "user_123"
  When I call billing.customers.getByExternalId("user_123")
  Then I receive the full customer object
  And it includes all stored fields

Scenario: Get customer by QZPay ID
  Given a customer with ID "qzp_cust_abc123"
  When I call billing.customers.get("qzp_cust_abc123")
  Then I receive the customer object

Scenario: Handle non-existent customer
  Given no customer with externalId "unknown_user"
  When I call billing.customers.getByExternalId("unknown_user")
  Then null is returned (or CustomerNotFoundError if strict mode)
```

### US-CUST-005: Soft Delete Customer

**As a** developer
**I want to** soft delete a customer
**So that** they can't make new purchases but history is preserved

**Priority**: Medium

```gherkin
Scenario: Soft delete customer
  Given an existing customer "cust_123"
  When I call billing.customers.delete("cust_123")
  Then the customer's deletedAt is set to current timestamp
  And the customer doesn't appear in normal queries
  And historical records are preserved

Scenario: Cannot create subscription for deleted customer
  Given a soft-deleted customer "cust_123"
  When I try to create a subscription for "cust_123"
  Then error CUSTOMER_DELETED is returned
```

---

## 2. Subscription Lifecycle Stories

### US-SUB-001: Subscribe to a Plan

**As a** customer
**I want to** subscribe to a monthly plan
**So that** I can access premium features

**Priority**: Critical

**Acceptance Criteria**:
- [ ] Can select a plan and billing cycle
- [ ] See clear pricing before confirming
- [ ] Enter payment method through secure form
- [ ] Receive confirmation email after subscribing
- [ ] Access granted immediately after payment

```gherkin
Scenario: Successfully subscribe to a plan
  Given I am a registered customer
  And I have selected the "Pro" plan with monthly billing
  When I complete payment with a valid credit card
  Then my subscription is created with status "active"
  And I receive a confirmation email
  And subscription.hasAccess() returns true

Scenario: Subscribe with annual billing
  Given I am selecting the "Pro" plan
  When I choose annual billing cycle
  Then I see the annual price with discount
  And my subscription is set to renew yearly

Scenario: Handle payment failure during subscription
  Given I am subscribing to a plan
  When my payment method is declined
  Then my subscription is created with status "incomplete"
  And I see a clear error message
  And I can retry with a different payment method

Scenario: Subscribe to plan with setup fee
  Given the "Enterprise" plan has a $500 setup fee
  When I subscribe to Enterprise plan
  Then my first charge includes base price + setup fee
  And subsequent renewals don't include setup fee
```

### US-SUB-002: Check Subscription Access

**As a** developer
**I want to** easily check if a user has access
**So that** I can gate features appropriately

**Priority**: Critical

**Acceptance Criteria**:
- [ ] Can use `subscription.hasAccess()` for simple check
- [ ] hasAccess returns true for active, trialing, and grace period
- [ ] Can use `subscription.getEntitlements()` for feature checks
- [ ] Can use `subscription.getLimits()` for usage checks
- [ ] All methods are type-safe

```gherkin
Scenario: Check access for active subscription
  Given a subscription with status "active"
  When I call subscription.hasAccess()
  Then it returns true

Scenario: Check access during trial
  Given a subscription with status "trialing"
  When I call subscription.hasAccess()
  Then it returns true
  And subscription.isTrial() returns true

Scenario: Check access during grace period
  Given a subscription with status "past_due"
  And the subscription is within the 7-day grace period
  When I call subscription.hasAccess()
  Then it returns true
  And subscription.isInGracePeriod() returns true

Scenario: Deny access for expired subscription
  Given a subscription with status "canceled"
  When I call subscription.hasAccess()
  Then it returns false

Scenario: Check specific feature access
  Given a "Pro" subscription with entitlement "advanced_analytics"
  When I call subscription.hasFeature("advanced_analytics")
  Then it returns true
  When I call subscription.hasFeature("enterprise_sso")
  Then it returns false
```

### US-SUB-003: Subscription Auto-Renewal

**As a** customer
**I want** my subscription to renew automatically
**So that** I don't lose access to the service

**Priority**: Critical

```gherkin
Scenario: Successful auto-renewal
  Given my subscription ends tomorrow
  And I have a valid payment method on file
  When the renewal job runs
  Then my payment method is charged for the next period
  And my subscription period is extended
  And I receive a renewal confirmation email

Scenario: Auto-renewal with failed payment
  Given my subscription ends tomorrow
  And my payment method will decline
  When the renewal job runs
  Then my subscription status changes to "past_due"
  And grace period begins
  And I receive a payment failed email
  And retry is scheduled according to retry policy

Scenario: Auto-renewal with updated price
  Given my plan price increased from $30 to $35
  And I was notified 30 days ago
  When renewal occurs
  Then I am charged $35
  And the subscription reflects the new price
```

### US-SUB-004: Cancel Subscription

**As a** customer
**I want to** cancel my subscription
**So that** I stop being charged

**Priority**: Critical

```gherkin
Scenario: Cancel at period end
  Given I have an active subscription
  When I cancel with immediate=false
  Then my subscription continues until period end
  And cancelAtPeriodEnd is set to true
  And I receive a cancellation confirmation email
  And no refund is issued

Scenario: Cancel immediately with refund
  Given I have an active subscription
  And I'm 10 days into a 30-day period
  When I cancel with immediate=true and refund=prorated
  Then my subscription ends immediately
  And I receive a prorated refund for remaining 20 days
  And hasAccess() returns false

Scenario: Cancel immediately without refund
  Given I have an active subscription
  When I cancel with immediate=true and refund=none
  Then my subscription ends immediately
  And no refund is issued

Scenario: Re-subscribe after cancellation
  Given I canceled my subscription last month
  When I subscribe to a new plan
  Then a new subscription is created
  And my previous subscription history is preserved
```

### US-SUB-005: Pause Subscription

**As a** customer
**I want to** pause my subscription temporarily
**So that** I'm not charged while I'm away

**Priority**: Medium

```gherkin
Scenario: Pause subscription for set duration
  Given my plan allows pausing
  And I request to pause for 30 days
  When the pause is processed
  Then my subscription status is "paused"
  And I retain limited access per plan rules
  And auto-resume is scheduled in 30 days
  And I'm not charged during pause

Scenario: Resume paused subscription early
  Given my subscription is paused
  When I choose to resume early
  Then my subscription status returns to "active"
  And billing resumes from today
  And my billing cycle is adjusted

Scenario: Pause not allowed on plan
  Given my plan doesn't allow pausing
  When I try to pause
  Then error PAUSE_NOT_ALLOWED is returned
```

### US-SUB-006: Reactivate Expired Subscription

**As a** customer
**I want to** reactivate my expired subscription
**So that** I can regain access quickly

**Priority**: Medium

```gherkin
Scenario: Reactivate recently expired subscription
  Given my subscription expired 5 days ago
  When I reactivate with a valid payment method
  Then my subscription status is "active"
  And I'm charged for the new period
  And my plan and settings are preserved

Scenario: Reactivate with same plan
  Given my Pro subscription expired
  When I reactivate
  Then I'm back on the Pro plan
  And my previous settings are restored

Scenario: Cannot reactivate after long expiration
  Given my subscription expired 90 days ago
  And the reactivation window is 30 days
  When I try to reactivate
  Then error REACTIVATION_WINDOW_EXPIRED is returned
  And I'm directed to create a new subscription
```

---

## 3. Trial Management Stories

### US-TRIAL-001: Start Free Trial Without Card

**As a** customer
**I want to** start a free trial without entering a credit card
**So that** I can try the service risk-free

**Priority**: High

**Acceptance Criteria**:
- [ ] Can start trial without payment method when plan allows
- [ ] See clearly when trial ends
- [ ] Receive reminder emails before trial ends
- [ ] Prompted to add payment method before trial ends
- [ ] Subscription expires if no payment method after trial

```gherkin
Scenario: Start trial without card when allowed
  Given the plan allows trials without payment method
  And trialRequiresPaymentMethod is false
  When I start the trial
  Then my subscription is created with status "trialing"
  And subscription.hasPaymentMethod is false
  And subscription.daysUntilTrialEnd() returns trial days

Scenario: Trial expires without payment method
  Given I am on trial without a payment method
  And trial ends today
  When the trial expiration job runs
  Then my subscription status changes to "expired"
  And subscription.hasAccess() returns false
  And event TRIAL_EXPIRED_NO_PAYMENT_METHOD is emitted
  And I receive an email prompting to subscribe

Scenario: Add payment method during trial
  Given I am on trial without payment method
  When I add a valid payment method
  Then subscription.hasPaymentMethod becomes true
  And I will be charged automatically at trial end
  And I receive confirmation of upcoming charge

Scenario: Cannot start trial without card when required
  Given the plan requires payment method for trial
  When I try to start trial without payment info
  Then error PAYMENT_METHOD_REQUIRED is returned
```

### US-TRIAL-002: Start Trial With Card

**As a** customer
**I want to** start a trial with card on file
**So that** my subscription continues automatically

**Priority**: High

```gherkin
Scenario: Start trial with card on file
  Given I enter a valid payment method
  And I start a 14-day trial
  When the trial is created
  Then my subscription status is "trialing"
  And subscription.hasPaymentMethod is true
  And no charge is made to my card

Scenario: Automatic conversion after trial
  Given I am on trial with a payment method
  When my trial period ends
  Then my card is charged for the first billing period
  And my subscription status changes to "active"
  And I receive a payment confirmation email

Scenario: Trial reminder emails
  Given I am on a 14-day trial
  When 11 days have passed (3 days remaining)
  Then I receive a reminder email
  When 13 days have passed (1 day remaining)
  Then I receive a final reminder email
```

### US-TRIAL-003: Cancel Trial

**As a** customer
**I want to** cancel my trial before it ends
**So that** I'm not charged

**Priority**: High

```gherkin
Scenario: Cancel trial without payment method
  Given I am on a 14-day trial without payment method
  And 5 days have passed
  When I cancel my trial
  Then my subscription status changes to "canceled"
  And subscription.hasAccess() returns false immediately

Scenario: Cancel trial with payment method
  Given I am on trial with a payment method
  When I cancel my trial
  Then my subscription status changes to "canceled"
  And I'm not charged
  And my payment method is retained for future use

Scenario: Cancel trial keeps account for re-subscription
  Given I canceled my trial
  When I want to subscribe later
  Then my customer record still exists
  And I can subscribe to any plan
```

### US-TRIAL-004: Extend Trial

**As a** support agent
**I want to** extend a customer's trial
**So that** they have more time to evaluate

**Priority**: Low

```gherkin
Scenario: Extend trial via admin
  Given a customer on a 14-day trial
  And 10 days have passed
  When I extend their trial by 7 days
  Then trial end date is pushed back 7 days
  And customer is notified of extension
  And audit log records the extension

Scenario: Trial extension limit
  Given a customer already extended twice
  And maxTrialExtensions is 2
  When I try to extend again
  Then error MAX_TRIAL_EXTENSIONS_REACHED is returned
```

---

## 4. Plan Change Stories

### US-CHANGE-001: Upgrade Plan

**As a** customer
**I want to** upgrade to a higher plan
**So that** I can access more features

**Priority**: High

**Acceptance Criteria**:
- [ ] See price difference clearly
- [ ] Proration calculated automatically
- [ ] New features available immediately
- [ ] Receive upgrade confirmation

```gherkin
Scenario: Upgrade mid-cycle with proration
  Given I am on the "Basic" plan at $30/month
  And I am on day 15 of my 30-day billing cycle
  When I upgrade to "Pro" at $50/month
  Then I am charged the prorated difference (~$10)
  And my plan changes to "Pro" immediately
  And my next renewal is the full Pro price

Scenario: Upgrade during trial
  Given I am on a trial of the "Basic" plan
  When I upgrade to "Pro"
  Then my trial continues on the "Pro" plan
  And no charge is made during trial
  And first charge at trial end is for "Pro" plan

Scenario: Upgrade with annual commitment
  Given I am on monthly Basic ($30/mo)
  When I upgrade to annual Pro ($480/year, $40/mo equivalent)
  Then I'm charged the full annual price
  And prorated credit applied from Basic
  And my billing cycle becomes annual
```

### US-CHANGE-002: Downgrade Plan

**As a** customer
**I want to** downgrade to a lower plan
**So that** I can reduce my costs

**Priority**: High

```gherkin
Scenario: Downgrade at period end
  Given I am on the "Pro" plan at $50/month
  When I downgrade to "Basic" at $30/month
  Then my plan remains "Pro" until period end
  And downgrade is scheduled for next period
  And I'm notified of features I'll lose

Scenario: Downgrade immediate with credit
  Given I am on "Pro" plan
  And I'm 10 days into the billing cycle
  When I downgrade immediately with credit
  Then my plan changes to "Basic" immediately
  And I receive credit for unused Pro time
  And credit applies to next invoice

Scenario: Downgrade blocked by usage
  Given I am on "Pro" with 50 projects
  And "Basic" allows only 10 projects
  When I try to downgrade to Basic
  Then error USAGE_EXCEEDS_PLAN_LIMITS is returned
  And I'm told to reduce projects to 10 first
```

### US-CHANGE-003: Change Billing Interval

**As a** customer
**I want to** switch from monthly to annual billing
**So that** I can save money

**Priority**: Medium

```gherkin
Scenario: Switch monthly to annual
  Given I am on monthly Pro at $50/month
  And annual Pro is $480/year (20% discount)
  When I switch to annual billing
  Then I'm charged $480 minus credit for remaining monthly time
  And my billing interval changes to yearly
  And I see savings confirmation

Scenario: Switch annual to monthly
  Given I am on annual Pro (10 months remaining)
  When I switch to monthly billing at period end
  Then I keep annual benefits until period end
  And next charge is monthly rate
```

### US-CHANGE-004: Preview Plan Change

**As a** customer
**I want to** see the cost of a plan change before committing
**So that** I can make an informed decision

**Priority**: Medium

```gherkin
Scenario: Preview upgrade cost
  Given I am on Basic plan ($30/mo) on day 15
  When I preview upgrade to Pro ($50/mo)
  Then I see prorated charge of ~$10
  And I see next renewal amount of $50
  And I see list of new features

Scenario: Preview downgrade impact
  Given I am on Pro plan with 25 projects
  When I preview downgrade to Basic (10 project limit)
  Then I see features I'll lose
  And I see warning about 15 excess projects
  And I see effective date
```

---

## 5. Payment Processing Stories

### US-PAY-001: Make One-Time Purchase

**As a** customer
**I want to** make a one-time purchase
**So that** I can buy a product or service

**Priority**: Critical

**Acceptance Criteria**:
- [ ] See clear pricing before checkout
- [ ] Enter payment method securely
- [ ] Receive confirmation and invoice
- [ ] Can view purchase history

```gherkin
Scenario: Successful one-time payment
  Given I am purchasing a $99 product
  When I complete checkout with valid payment
  Then payment status is "succeeded"
  And I receive an invoice by email
  And the purchase appears in my history

Scenario: One-time payment with saved card
  Given I have a saved payment method
  When I make a one-time purchase
  Then my saved card is charged
  And I don't need to enter payment details again

Scenario: One-time payment with new card
  Given I have no saved payment method
  When I complete checkout with a new card
  Then the payment is processed
  And I'm asked if I want to save the card
```

### US-PAY-002: Pay with Multiple Currencies

**As a** customer
**I want to** pay in my local currency
**So that** I avoid conversion fees

**Priority**: Medium

```gherkin
Scenario: Pay in supported local currency
  Given I am in Brazil
  And BRL is a supported currency
  When I checkout
  Then I see prices in BRL
  And I'm charged in BRL

Scenario: Currency not supported
  Given my currency (XYZ) is not supported
  When I checkout
  Then I see prices in default currency (USD)
  And I'm charged in USD
```

### US-PAY-003: Pay with Different Methods

**As a** customer
**I want to** choose my preferred payment method
**So that** I can pay conveniently

**Priority**: High

```gherkin
Scenario: Pay with credit card via Stripe
  Given I choose to pay with credit card
  When I complete checkout
  Then Stripe processes the payment
  And my card is charged

Scenario: Pay with PIX via MercadoPago (Brazil)
  Given I am in Brazil
  And I choose PIX as payment method
  When I initiate checkout
  Then I receive a PIX QR code
  And payment completes when I scan and pay

Scenario: Pay with boleto (Brazil)
  Given I choose boleto payment
  When I checkout
  Then I receive boleto details
  And payment is pending until boleto is paid
  And I have 3 days to complete payment
```

---

## 6. Payment Failure & Recovery Stories

### US-FAIL-001: Handle Failed Subscription Payment

**As a** customer
**I want to** be notified when my payment fails
**So that** I can update my payment method

**Priority**: Critical

```gherkin
Scenario: Payment fails with insufficient funds
  Given my payment method has insufficient funds
  When a subscription renewal is attempted
  Then payment status is "failed"
  And subscription enters "past_due" status
  And I receive an email explaining the failure
  And email includes link to update payment method

Scenario: Payment fails with expired card
  Given my card expired last month
  When renewal is attempted
  Then payment fails with "card_expired" reason
  And I receive email prompting to update card
  And subscription enters grace period
```

### US-FAIL-002: Automatic Payment Retry

**As a** billing system
**I want to** automatically retry failed payments
**So that** we recover revenue without manual intervention

**Priority**: Critical

```gherkin
Scenario: Retry succeeds on second attempt
  Given a payment failed yesterday
  And retry is scheduled for today (day 1 of retry policy)
  When the retry job runs
  Then payment is attempted again
  And if successful, subscription returns to "active"
  And customer receives success notification

Scenario: Multiple retries before giving up
  Given retry policy is [1, 3, 5, 7] days
  And all retries fail
  When the final retry fails on day 7
  Then no more automatic retries
  And subscription remains past_due
  And grace period continues until day 7 + grace period ends

Scenario: Customer updates card mid-retry
  Given payment failed and retry scheduled for tomorrow
  When customer updates payment method today
  Then immediate retry is attempted
  And if successful, pending retry is canceled
```

### US-FAIL-003: Grace Period Access

**As a** customer with payment issues
**I want to** maintain access during grace period
**So that** I have time to fix my payment method

**Priority**: High

```gherkin
Scenario: Access during grace period
  Given my payment failed
  And I'm within the 7-day grace period
  When I access the service
  Then I still have full access
  And I see a banner warning about payment issue

Scenario: Access revoked after grace period
  Given my payment failed 8 days ago
  And grace period is 7 days
  When I try to access premium features
  Then access is denied
  And I'm redirected to update payment method

Scenario: Grace period with limited access
  Given config allows limited access during grace
  And my payment failed
  When I access the service
  Then I have read-only access
  And I cannot create new content
```

### US-FAIL-004: Dunning Emails

**As a** customer with payment issues
**I want to** receive helpful reminder emails
**So that** I'm aware of my account status

**Priority**: High

```gherkin
Scenario: Dunning email sequence
  Given my payment failed today
  Then I receive "Payment Failed" email immediately
  When 2 days pass (grace ends in 5 days)
  Then I receive "Action Required" reminder
  When 5 days pass (grace ends in 2 days)
  Then I receive "Final Warning" email
  When grace period expires
  Then I receive "Subscription Suspended" email

Scenario: Dunning stops on successful payment
  Given I received first dunning email
  When I update my card and payment succeeds
  Then no more dunning emails are sent
  And I receive "Payment Successful" confirmation
```

---

## 7. Payment Method Stories

### US-PM-001: Add Payment Method

**As a** customer
**I want to** add a payment method
**So that** I can make purchases and subscriptions

**Priority**: Critical

```gherkin
Scenario: Add credit card
  Given I am on the payment methods page
  When I enter valid card details
  Then the card is tokenized securely
  And the card is saved to my account
  And I see the last 4 digits and expiry

Scenario: Add card via Stripe Elements
  Given I'm using Stripe Elements form
  When I enter card and submit
  Then card is validated client-side
  And payment method is created in Stripe
  And stored reference is saved in QZPay

Scenario: Reject invalid card
  Given I enter an invalid card number
  When I try to save
  Then validation error is shown
  And card is not saved
```

### US-PM-002: Set Default Payment Method

**As a** customer
**I want to** set my default payment method
**So that** it's used for automatic charges

**Priority**: High

```gherkin
Scenario: Set new default payment method
  Given I have 2 saved payment methods
  When I set card ending 4242 as default
  Then that card is marked as default
  And future subscriptions use this card
  And the other card remains saved but not default

Scenario: First card becomes default
  Given I have no payment methods
  When I add my first card
  Then it automatically becomes the default
```

### US-PM-003: Remove Payment Method

**As a** customer
**I want to** remove a saved payment method
**So that** it's no longer stored

**Priority**: Medium

```gherkin
Scenario: Remove non-default payment method
  Given I have 2 cards saved
  And card A is default, card B is not
  When I remove card B
  Then card B is deleted
  And card A remains as default

Scenario: Cannot remove only payment method with active subscription
  Given I have one saved card
  And I have an active subscription
  When I try to remove the card
  Then error PAYMENT_METHOD_REQUIRED is returned
  And the card is not removed

Scenario: Remove default with other cards available
  Given I have cards A (default) and B
  When I remove card A
  Then card A is deleted
  And card B becomes the new default
```

### US-PM-004: Handle Expiring Card

**As a** customer
**I want to** be notified before my card expires
**So that** I can update it and avoid payment failures

**Priority**: High

```gherkin
Scenario: Card expiring soon notification
  Given my card expires in 30 days
  When the nightly job runs
  Then I receive "Card Expiring Soon" email
  And email includes link to update card

Scenario: Card expiring notification sequence
  Given my card expires next month
  Then I receive notification 30 days before
  And again 7 days before
  And again 1 day before
```

---

## 8. Invoice Stories

### US-INV-001: View Invoice

**As a** customer
**I want to** view my invoices
**So that** I can see what I was charged for

**Priority**: High

```gherkin
Scenario: View invoice details
  Given I have a paid invoice
  When I view the invoice
  Then I see invoice number, date, and status
  And I see line items with descriptions
  And I see subtotal, tax, and total
  And I see payment method used

Scenario: View invoice history
  Given I have 5 past invoices
  When I view my invoice history
  Then I see all invoices sorted by date
  And I can filter by status (paid, open, void)
  And I can search by invoice number
```

### US-INV-002: Download Invoice PDF

**As a** customer
**I want to** download my invoice as PDF
**So that** I can save it for my records

**Priority**: High

```gherkin
Scenario: Download invoice PDF
  Given I have a paid invoice
  When I click "Download PDF"
  Then a PDF file is downloaded
  And the PDF contains all invoice details
  And the PDF includes company branding

Scenario: PDF includes tax information
  Given I'm in a region with VAT
  And my invoice includes VAT
  When I download the PDF
  Then VAT is itemized separately
  And VAT number is displayed
```

### US-INV-003: Receive Invoice by Email

**As a** customer
**I want to** receive invoices by email
**So that** I have them without logging in

**Priority**: High

```gherkin
Scenario: Invoice email on subscription renewal
  Given my subscription renews today
  When renewal payment succeeds
  Then I receive an email with invoice attached
  And email summarizes the charge

Scenario: Invoice email for one-time purchase
  Given I make a one-time purchase
  When payment succeeds
  Then I receive invoice email within minutes
```

### US-INV-004: Pay Open Invoice

**As a** customer
**I want to** pay an open invoice
**So that** I can settle my balance

**Priority**: High

```gherkin
Scenario: Pay invoice with default payment method
  Given I have an open invoice for $100
  When I click "Pay Now"
  Then my default payment method is charged $100
  And invoice status changes to "paid"
  And I receive payment confirmation

Scenario: Pay invoice with different payment method
  Given I have an open invoice
  And I have multiple payment methods
  When I choose a non-default card to pay
  Then that card is charged
  And invoice is marked paid
```

### US-INV-005: Apply Credit to Invoice

**As a** customer
**I want** my account credit applied to invoices
**So that** I pay less out of pocket

**Priority**: Medium

```gherkin
Scenario: Credit fully covers invoice
  Given I have $50 account credit
  And my invoice is $30
  When invoice is finalized
  Then credit is automatically applied
  And invoice shows $0 due
  And remaining credit is $20

Scenario: Credit partially covers invoice
  Given I have $20 account credit
  And my invoice is $50
  When invoice is finalized
  Then $20 credit is applied
  And I owe $30
  And my credit balance is $0
```

---

## 9. Promo Code & Discount Stories

### US-PROMO-001: Apply Promo Code at Checkout

**As a** customer
**I want to** apply a promo code during checkout
**So that** I can get a discount

**Priority**: High

**Acceptance Criteria**:
- [ ] Can enter promo code in checkout
- [ ] See discount applied immediately
- [ ] Invalid codes show clear error
- [ ] Final price reflects discount

```gherkin
Scenario: Apply valid percentage discount
  Given I have promo code "SAVE20" for 20% off
  And my cart total is $100
  When I apply the promo code
  Then I see "$20.00 discount applied"
  And my new total is $80

Scenario: Apply valid fixed amount discount
  Given I have promo code "FLAT10" for $10 off
  And my cart total is $50
  When I apply the promo code
  Then I see "$10.00 discount applied"
  And my new total is $40

Scenario: Apply invalid promo code
  Given I enter promo code "EXPIRED123"
  When I try to apply it
  Then I see error "This promo code has expired"
  And no discount is applied

Scenario: Promo code not applicable to plan
  Given promo "STARTER50" is only for Starter plan
  When I try to apply it to Pro plan
  Then I see error "This code is not valid for this plan"
```

### US-PROMO-002: Promo Code Restrictions

**As a** billing system
**I want to** enforce promo code restrictions
**So that** promotions are used as intended

**Priority**: High

```gherkin
Scenario: Promo code max redemptions reached
  Given promo "LAUNCH100" has max 100 uses
  And it has been used 100 times
  When I try to apply it
  Then I see error "This promo code has reached its limit"

Scenario: Promo code already used by customer
  Given I used promo "WELCOME10" last month
  And it's limited to once per customer
  When I try to use it again
  Then I see error "You've already used this code"

Scenario: Promo code minimum purchase not met
  Given promo "BIG20" requires $100 minimum
  And my cart is $75
  When I try to apply it
  Then I see error "Minimum purchase of $100 required"

Scenario: First-time customer promo
  Given promo "NEWFRIEND" is for first-time customers only
  And I have previous purchases
  When I try to apply it
  Then I see error "This code is for new customers only"
```

### US-PROMO-003: Recurring Discount

**As a** customer
**I want** my promo discount to apply to multiple months
**So that** I save more over time

**Priority**: Medium

```gherkin
Scenario: Discount applies for 3 months
  Given promo "SUMMER25" is 25% off for 3 months
  When I subscribe with this promo
  Then month 1 invoice is discounted 25%
  And month 2 invoice is discounted 25%
  And month 3 invoice is discounted 25%
  And month 4 invoice is full price

Scenario: Forever discount
  Given promo "PARTNER50" is 50% off forever
  When I subscribe with this promo
  Then all my invoices are discounted 50%
  Until I cancel or change plans
```

### US-PROMO-004: Automatic Discounts

**As a** customer
**I want** eligible discounts applied automatically
**So that** I don't miss savings

**Priority**: Low

```gherkin
Scenario: Annual billing discount auto-applied
  Given annual billing has 20% automatic discount
  When I choose annual billing
  Then 20% discount is applied automatically
  And I don't need a promo code

Scenario: Loyalty discount after 12 months
  Given loyalty discount kicks in after 12 months
  And I've been subscribed for 13 months
  When my invoice is generated
  Then 10% loyalty discount is applied
```

---

## 10. Add-on Stories

### US-ADDON-001: Add Extra Storage

**As a** customer on the Basic plan
**I want to** purchase additional storage
**So that** I can store more files

**Priority**: Medium

```gherkin
Scenario: Purchase storage add-on mid-cycle
  Given I have an active Basic subscription
  And Basic includes 10GB storage
  And "Extra Storage" add-on provides 50GB for $5/month
  And I'm 15 days into my billing cycle
  When I add the "Extra Storage" add-on
  Then I'm charged $2.50 (prorated for remaining 15 days)
  And my storage limit increases to 60GB immediately
  And my next invoice includes $5 for the add-on
```

### US-ADDON-002: Add Team Seats

**As a** team administrator
**I want to** add seats for new team members
**So that** they can access our account

**Priority**: Medium

```gherkin
Scenario: Add additional seats
  Given my team plan includes 5 seats
  And I have 5 team members assigned
  When I try to invite a 6th member
  Then I'm prompted to purchase an additional seat
  And I see the per-seat price and proration
  When I confirm the purchase
  Then the seat is added immediately
  And I can invite the new team member

Scenario: Reduce seats at period end
  Given I have 3 additional seats purchased
  And only 1 is being used
  When I reduce to 1 additional seat
  Then change is scheduled for period end
  And I keep 3 seats until then
```

### US-ADDON-003: Purchase Feature Pack

**As a** customer
**I want to** unlock advanced features
**So that** I get functionality not in my plan

**Priority**: Medium

```gherkin
Scenario: Purchase feature unlock add-on
  Given my plan doesn't include advanced reporting
  And "Advanced Reports" add-on costs $10/month
  When I purchase the "Advanced Reports" add-on
  Then I gain access to advanced reporting features immediately
  And I see "Advanced Reports" in my active add-ons
  And my next invoice includes the add-on charge
```

### US-ADDON-004: Remove Add-on

**As a** customer
**I want to** remove an add-on I no longer need
**So that** I stop paying for it

**Priority**: Medium

```gherkin
Scenario: Remove add-on at period end
  Given I have the "Extra Storage" add-on active
  And I'm 10 days into my billing cycle
  When I remove the add-on with "at period end" option
  Then the add-on is marked for removal
  And I keep the extra storage until period end
  And my next invoice won't include the add-on

Scenario: Remove add-on immediately with credit
  Given I have "Extra Storage" add-on
  And I'm 10 days into a 30-day cycle
  When I remove immediately with credit option
  Then add-on is removed immediately
  And I receive credit for remaining 20 days
```

### US-ADDON-005: Purchase Add-on Bundle

**As a** customer
**I want to** purchase a bundle of add-ons
**So that** I save money vs buying individually

**Priority**: Low

```gherkin
Scenario: Purchase "Power User Bundle"
  Given "Power User Bundle" includes Storage + Reports + Priority Support
  And individual total would be $25/month
  And bundle price is $20/month (20% savings)
  When I purchase the bundle
  Then all three features are activated
  And I'm charged $20 (prorated if mid-cycle)
  And I see the bundle in my subscription

Scenario: Cannot add individual add-on from bundle
  Given I have "Power User Bundle" which includes Storage
  When I try to add "Extra Storage" separately
  Then I see error "Storage is already included in your bundle"
```

---

## 11. Usage-Based Billing Stories

### US-USAGE-001: Track API Usage

**As a** developer
**I want to** track API calls made by my customers
**So that** they can be billed accurately

**Priority**: High

```gherkin
Scenario: Record API usage
  Given a customer on usage-based API plan
  When they make 1000 API calls
  Then usage is recorded with timestamp
  And running total is updated
  And usage is attributed to current billing period

Scenario: View current usage
  Given a customer has made 5000 API calls this month
  When they check their usage dashboard
  Then they see 5000 calls made
  And they see estimated charge for current usage
  And they see days remaining in period
```

### US-USAGE-002: Usage Alerts

**As a** customer
**I want to** be alerted when approaching usage limits
**So that** I can manage my costs

**Priority**: Medium

```gherkin
Scenario: Alert at 80% of usage limit
  Given my plan includes 10,000 API calls
  And I've configured alert at 80%
  When I hit 8,000 calls
  Then I receive an email alert
  And alert shows current usage and limit
  And alert suggests upgrading if needed

Scenario: Alert at 100% (soft limit)
  Given my plan has soft limit of 10,000 calls
  When I hit 10,000 calls
  Then I receive notification
  And service continues (overage charges apply)
  And overage rate is shown
```

### US-USAGE-003: Usage Invoice Line Items

**As a** customer
**I want to** see usage breakdown on my invoice
**So that** I understand what I'm paying for

**Priority**: Medium

```gherkin
Scenario: Invoice shows tiered usage
  Given tiered pricing: 0-1000 @ $0.01, 1001-5000 @ $0.008, 5001+ @ $0.005
  And I used 7000 API calls
  When I view my invoice
  Then I see: "API Calls (0-1000): $10.00"
  And I see: "API Calls (1001-5000): $32.00"
  And I see: "API Calls (5001-7000): $10.00"
  And total usage charge is $52.00
```

### US-USAGE-004: Metered Add-on Usage

**As a** customer with metered add-on
**I want** usage tracked and billed correctly
**So that** I only pay for what I use

**Priority**: Medium

```gherkin
Scenario: SMS add-on usage billing
  Given I have "SMS Notifications" metered add-on
  And pricing is $0.05 per SMS
  When 200 SMS are sent during the month
  Then invoice includes "SMS Notifications: 200 × $0.05 = $10.00"
```

---

## 12. Webhook Stories

### US-HOOK-001: Receive Payment Webhooks

**As a** developer
**I want to** receive webhooks for payment events
**So that** I can update my system in real-time

**Priority**: Critical

```gherkin
Scenario: Receive successful payment webhook
  Given I've registered webhook endpoint
  When a payment succeeds
  Then my endpoint receives POST with payment details
  And webhook includes payment ID, amount, customer ID
  And I respond with 200 OK

Scenario: Receive failed payment webhook
  Given a subscription payment fails
  When webhook is sent
  Then payload includes failure reason
  And includes subscription ID
  And includes next retry date if applicable
```

### US-HOOK-002: Webhook Signature Verification

**As a** developer
**I want to** verify webhook signatures
**So that** I know webhooks are authentic

**Priority**: Critical

```gherkin
Scenario: Verify valid webhook signature
  Given I receive a webhook with signature header
  When I verify using my webhook secret
  Then verification succeeds
  And I process the webhook

Scenario: Reject invalid webhook signature
  Given I receive a webhook with invalid signature
  When I verify the signature
  Then verification fails
  And I reject the webhook with 401
  And I log the security event
```

### US-HOOK-003: Webhook Retry on Failure

**As a** developer
**I want** failed webhooks to be retried
**So that** I don't miss events due to temporary issues

**Priority**: High

```gherkin
Scenario: Webhook retried after failure
  Given my endpoint returned 500
  When retry schedule triggers (1h, 6h, 24h)
  Then webhook is resent
  And each attempt is logged

Scenario: Webhook moved to dead letter queue
  Given webhook failed after all retries
  Then webhook is moved to dead letter queue
  And admin is notified
  And webhook can be manually retried
```

### US-HOOK-004: Idempotent Webhook Processing

**As a** developer
**I want** to handle duplicate webhooks safely
**So that** I don't process the same event twice

**Priority**: High

```gherkin
Scenario: Ignore duplicate webhook
  Given I received and processed webhook "evt_123"
  When I receive the same webhook again (retry)
  Then I recognize it's a duplicate
  And I return 200 OK without reprocessing
  And no duplicate actions occur
```

---

## 13. Admin Operation Stories

### US-ADMIN-001: View Customer Details

**As a** support agent
**I want to** see complete customer information
**So that** I can assist with billing inquiries

**Priority**: High

```gherkin
Scenario: View customer with full history
  Given I have admin:read access
  And customer "cust_123" has 3 subscriptions and 10 payments
  When I call admin.customers.getDetailed("cust_123")
  Then I see customer profile with all provider data
  And I see statistics including total spent
  And I see all subscriptions and recent payments
  And I see internal notes
```

### US-ADMIN-002: Process Refund

**As a** senior support agent
**I want to** process a refund
**So that** I can resolve a customer complaint

**Priority**: High

```gherkin
Scenario: Process full refund
  Given I have admin:write access
  And payment "pay_123" was for $100
  When I call admin.payments.refund("pay_123", null, "customer_request", true)
  Then $100 is refunded to the customer
  And the customer receives a refund notification email
  And the action is recorded in audit log

Scenario: Process partial refund
  Given payment "pay_123" was for $100
  When I refund $30
  Then $30 is refunded
  And payment shows $70 remaining (not fully refunded)
```

### US-ADMIN-003: Extend Subscription

**As a** support agent
**I want to** extend a customer's subscription
**So that** I can provide goodwill compensation

**Priority**: Medium

```gherkin
Scenario: Extend subscription by 7 days
  Given customer's subscription ends on Jan 15
  When I extend by 7 days with reason "service outage compensation"
  Then subscription now ends on Jan 22
  And customer is notified of extension
  And audit log records the extension
```

### US-ADMIN-004: Apply Credit

**As a** support agent
**I want to** add credit to a customer's account
**So that** I can compensate them

**Priority**: Medium

```gherkin
Scenario: Add promotional credit
  Given customer complained about service issue
  When I add $20 credit with type "goodwill"
  Then customer's credit balance increases by $20
  And credit will auto-apply to next invoice
  And customer is notified of credit
```

### US-ADMIN-005: Generate Reports

**As a** finance manager
**I want to** generate revenue reports
**So that** I can track business performance

**Priority**: Medium

```gherkin
Scenario: Generate monthly revenue report
  Given I have admin:read access
  When I request revenue report for January 2025
  Then I receive gross and net revenue totals
  And I see breakdown by plan and source
  And I see refund totals
  And I can export to CSV
```

---

## 14. Marketplace Stories

### US-MKT-001: Vendor Receives Split Payment

**As a** marketplace vendor
**I want to** receive my share of sales automatically
**So that** I don't have to chase payments

**Priority**: High (for marketplace use cases)

```gherkin
Scenario: Customer purchases from vendor
  Given a product priced at $100
  And platform commission is 15%
  When the customer completes purchase
  Then $85 is allocated to vendor
  And $15 is allocated to platform
  And vendor sees sale in their dashboard

Scenario: Vendor payout on schedule
  Given vendor has $500 in accumulated earnings
  And payout schedule is weekly
  When weekly payout runs
  Then $500 is transferred to vendor's bank
  And payout record is created
```

### US-MKT-002: Vendor Onboarding

**As a** vendor
**I want to** set up my payment account
**So that** I can receive payouts

**Priority**: High (for marketplace use cases)

```gherkin
Scenario: Vendor connects Stripe account
  Given I am a new vendor
  When I go through Stripe Connect onboarding
  Then my connected account is created
  And my account is linked to the marketplace
  And I can start receiving payments
```

---

## 15. Multi-Provider Stories

### US-MULTI-001: Automatic Provider Selection

**As a** developer
**I want** the system to select the best payment provider
**So that** payments succeed more often

**Priority**: Medium

```gherkin
Scenario: Route Brazilian customer to MercadoPago
  Given customer is in Brazil
  And MercadoPago is configured for Brazil
  When customer checks out
  Then MercadoPago is automatically selected
  And customer sees local payment methods (PIX, boleto)

Scenario: Fallback to secondary provider
  Given primary provider (Stripe) returns error
  When customer payment fails
  Then system attempts with secondary provider
  And if successful, payment completes
```

### US-MULTI-002: Provider Sync

**As a** developer
**I want** data synchronized between providers and QZPay
**So that** records are always consistent

**Priority**: High

```gherkin
Scenario: Sync subscription from Stripe webhook
  Given subscription was updated directly in Stripe
  When Stripe webhook is received
  Then local subscription record is updated
  And changes are logged

Scenario: Daily reconciliation
  Given it's 2 AM and reconciliation job runs
  Then all subscriptions are compared with providers
  And discrepancies are logged
  And alerts sent if significant mismatches found
```

---

## 16. Security & Compliance Stories

### US-SEC-001: PCI Compliance

**As a** developer
**I want to** handle payments PCI-compliantly
**So that** we don't store sensitive card data

**Priority**: Critical

```gherkin
Scenario: Card data never touches our servers
  Given customer enters card in Stripe Elements
  When card is tokenized
  Then only token reaches our server
  And full card number never logged
  And we remain PCI-DSS compliant
```

### US-SEC-002: API Key Security

**As a** developer
**I want** API keys managed securely
**So that** unauthorized access is prevented

**Priority**: Critical

```gherkin
Scenario: Invalid API key rejected
  Given a request with invalid API key
  When the request is processed
  Then error 401 UNAUTHORIZED is returned
  And the attempt is logged
  And no data is exposed

Scenario: API key with wrong permissions
  Given API key has only read permissions
  When I try to create a subscription
  Then error 403 FORBIDDEN is returned
```

### US-SEC-003: GDPR Data Handling

**As a** customer in EU
**I want** my data handled per GDPR
**So that** my privacy is protected

**Priority**: High

```gherkin
Scenario: Request data export
  Given I am an EU customer
  When I request my data export
  Then I receive all my billing data
  And export includes all stored PII
  And export delivered within 30 days

Scenario: Request data deletion
  Given I want to delete my account
  When I request deletion
  Then my PII is removed
  And only anonymized transaction records remain
  And payment providers are notified
```

### US-SEC-004: Audit Logging

**As a** compliance officer
**I want** all actions logged
**So that** we have audit trail

**Priority**: High

```gherkin
Scenario: Admin action is logged
  Given admin processes a refund
  Then audit log records:
    | actor | action | target | timestamp | details |
    | admin@company.com | refund | pay_123 | 2025-01-15 10:30:00 | amount: $50, reason: customer_request |
```

---

## 17. Developer Experience Stories

### US-DX-001: Type-Safe SDK

**As a** developer
**I want** a fully typed TypeScript SDK
**So that** I catch errors at compile time

**Priority**: High

```gherkin
Scenario: TypeScript catches invalid parameter
  Given I'm using the TypeScript SDK
  When I call billing.subscriptions.create with wrong type
  Then TypeScript compiler shows error
  And I fix it before runtime

Scenario: IntelliSense shows available methods
  Given I'm in my IDE
  When I type "billing.customers."
  Then I see all available methods with types
  And I see parameter types and return types
```

### US-DX-002: Helpful Error Messages

**As a** developer
**I want** clear error messages
**So that** I can debug issues quickly

**Priority**: High

```gherkin
Scenario: Error includes actionable information
  Given I call API with missing required field
  When error is returned
  Then error message explains what's missing
  And error includes documentation link
  And error includes request ID for support

Scenario: Error categorization
  Given various errors can occur
  Then I can distinguish:
    | category | example |
    | validation | INVALID_EMAIL_FORMAT |
    | authorization | INSUFFICIENT_PERMISSIONS |
    | not_found | CUSTOMER_NOT_FOUND |
    | conflict | SUBSCRIPTION_ALREADY_EXISTS |
    | provider | STRIPE_CARD_DECLINED |
```

### US-DX-003: Testing Utilities

**As a** developer
**I want** testing utilities provided
**So that** I can write tests easily

**Priority**: Medium

```gherkin
Scenario: Use test fixtures
  Given I'm writing a unit test
  When I use createTestCustomer()
  Then I get a valid customer object with fake data
  And I can override specific fields

Scenario: Use mock provider
  Given I want to test without hitting real APIs
  When I configure mock Stripe adapter
  Then all Stripe calls are mocked
  And I can simulate various responses
```

### US-DX-004: Comprehensive Documentation

**As a** developer
**I want** complete documentation
**So that** I can implement features correctly

**Priority**: High

```gherkin
Scenario: Find API reference
  Given I need to implement subscription creation
  When I check the documentation
  Then I find complete API reference
  And I see code examples
  And I see error handling examples
```

---

## Story Status Summary

| Category | Total | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Customer Management | 5 | 1 | 3 | 1 | 0 |
| Subscription Lifecycle | 6 | 3 | 1 | 2 | 0 |
| Trial Management | 4 | 0 | 3 | 0 | 1 |
| Plan Changes | 4 | 0 | 2 | 2 | 0 |
| Payment Processing | 3 | 1 | 1 | 1 | 0 |
| Payment Failure | 4 | 1 | 2 | 1 | 0 |
| Payment Methods | 4 | 1 | 2 | 1 | 0 |
| Invoices | 5 | 0 | 3 | 2 | 0 |
| Promo Codes | 4 | 0 | 2 | 1 | 1 |
| Add-ons | 5 | 0 | 0 | 4 | 1 |
| Usage-Based | 4 | 0 | 1 | 3 | 0 |
| Webhooks | 4 | 2 | 2 | 0 | 0 |
| Admin Operations | 5 | 0 | 2 | 3 | 0 |
| Marketplace | 2 | 0 | 2 | 0 | 0 |
| Multi-Provider | 2 | 0 | 1 | 1 | 0 |
| Security | 4 | 2 | 2 | 0 | 0 |
| Developer Experience | 4 | 0 | 2 | 1 | 1 |
| **Total** | **69** | **11** | **31** | **23** | **4** |

---

## Traceability Matrix

| User Story | Related Requirements | Test Priority |
|------------|---------------------|---------------|
| US-CUST-001 | FR-CUST-001 | Critical |
| US-CUST-002 | FR-CUST-002, FR-ADAPTER-001 | High |
| US-SUB-001 | FR-SUB-001, FR-PAY-001 | Critical |
| US-SUB-002 | FR-SUB-004 | Critical |
| US-TRIAL-001 | FR-SUB-003, ADR-006 | High |
| US-FAIL-001 | FR-PAY-002 | Critical |
| US-FAIL-002 | FR-JOBS-002 | Critical |
| US-PM-001 | FR-PAYMETH-001 | Critical |
| US-INV-001 | FR-INVOICE-001 | High |
| US-PROMO-001 | FR-PROMO-001 | High |
| US-ADDON-001 | FR-ADDONS-001, FR-ADDONS-002 | Medium |
| US-USAGE-001 | FR-USAGE-001, FR-USAGE-002 | High |
| US-HOOK-001 | FR-WEBHOOK-001 | Critical |
| US-ADMIN-001 | FR-ADMIN-002 | High |
| US-SEC-001 | NFR-SEC-001 | Critical |

---

## Related Documents

- [Functional Requirements](./FUNCTIONAL.md)
- [Non-Functional Requirements](./NON-FUNCTIONAL.md)
- [User Personas](../01-vision/PERSONAS.md)
- [API Specifications](../05-api/PUBLIC-API.md)
- [Testing Requirements](./TESTING-REQUIREMENTS.md)
