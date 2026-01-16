# Subscription Lifecycle Service

The Subscription Lifecycle Service orchestrates the complete lifecycle of subscriptions, including automatic renewals, trial conversions, payment retries, and cancellations. It's designed to run in a background worker or cron job to keep subscriptions in sync with payments.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Event Types](#event-types)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The lifecycle service handles four key operations:

1. **Renewals**: Automatically charge and renew active subscriptions when their period ends
2. **Trial Conversions**: Convert trial subscriptions to paid when the trial ends
3. **Payment Retries**: Retry failed payments according to a configured schedule
4. **Cancellations**: Automatically cancel subscriptions after grace period expires

## Features

- **Automated Renewals**: Handles subscription renewals with configurable grace periods
- **Trial Conversion**: Converts trial subscriptions to paid automatically
- **Smart Retries**: Configurable retry intervals for failed payments
- **Grace Period**: Give customers time to update payment methods before cancellation
- **Event Callbacks**: Hook into lifecycle events for notifications and analytics
- **Type-Safe**: Full TypeScript support with comprehensive types
- **Flexible**: Supports any payment provider through callback functions

## Installation

The service is included in `@qazuor/qzpay-core`:

```bash
pnpm add @qazuor/qzpay-core
```

## Quick Start

```typescript
import { createQZPayBilling, createSubscriptionLifecycle } from '@qazuor/qzpay-core';

// Initialize billing
const billing = createQZPayBilling({
  storage: yourStorageAdapter,
  paymentAdapter: yourPaymentAdapter,
});

// Create lifecycle service
const lifecycle = createSubscriptionLifecycle(billing, storage, {
  gracePeriodDays: 7,
  retryIntervals: [1, 3, 5], // Retry after 1, 3, and 5 days
  trialConversionDays: 0,

  processPayment: async (input) => {
    // Call your payment provider
    const result = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency,
      customer: providerCustomerId,
      payment_method: input.paymentMethodId,
      confirm: true,
    });

    return {
      success: result.status === 'succeeded',
      paymentId: result.id,
    };
  },

  getDefaultPaymentMethod: async (customerId) => {
    const pm = await storage.paymentMethods.findDefaultByCustomerId(customerId);
    return pm ? { id: pm.id, providerPaymentMethodId: pm.stripePaymentMethodId } : null;
  },
});

// In your cron job (run every hour or daily)
const results = await lifecycle.processAll();
console.log('Processed:', results);
```

## Configuration

### SubscriptionLifecycleConfig

| Property | Type | Description |
|----------|------|-------------|
| `gracePeriodDays` | `number` | Days before canceling due to failed payment (e.g., 7) |
| `retryIntervals` | `number[]` | Days between payment retries (e.g., [1, 3, 5]) |
| `trialConversionDays` | `number` | Days before trial end to attempt conversion (0 = immediately when trial ends) |
| `processPayment` | `Function` | Callback to process actual payment with your provider |
| `getDefaultPaymentMethod` | `Function` | Callback to get customer's default payment method |
| `onEvent` | `Function` | Optional callback for lifecycle events |

### ProcessPaymentInput

```typescript
interface ProcessPaymentInput {
  customerId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
  metadata: {
    subscriptionId: string;
    type: 'renewal' | 'trial_conversion' | 'retry';
  };
}
```

### ProcessPaymentResult

```typescript
interface ProcessPaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}
```

## Usage

### Process All Operations

Process renewals, trial conversions, retries, and cancellations in one call:

```typescript
const results = await lifecycle.processAll();

console.log({
  renewals: results.renewals.succeeded,
  trialConversions: results.trialConversions.succeeded,
  retries: results.retries.succeeded,
  cancellations: results.cancellations.processed,
});
```

### Process Individual Operations

Run specific operations independently:

```typescript
// Only process renewals
const renewals = await lifecycle.processRenewals();

// Only process trial conversions
const conversions = await lifecycle.processTrialConversions();

// Only process payment retries
const retries = await lifecycle.processRetries();

// Only process cancellations
const cancellations = await lifecycle.processCancellations();
```

### With Custom Timestamp

Useful for testing or running operations for a specific time:

```typescript
const customTime = new Date('2024-01-15T12:00:00Z');
const results = await lifecycle.processAll(customTime);
```

## Event Types

The `onEvent` callback receives events for all lifecycle operations:

### Renewal Events

- `subscription.renewed`: Subscription successfully renewed
- `subscription.renewal_failed`: Renewal payment failed
- `subscription.entered_grace_period`: Subscription entered grace period after failed payment

### Trial Conversion Events

- `subscription.trial_converted`: Trial successfully converted to paid
- `subscription.trial_conversion_failed`: Trial conversion payment failed

### Retry Events

- `subscription.retry_scheduled`: Payment retry scheduled
- `subscription.retry_succeeded`: Retry payment succeeded
- `subscription.retry_failed`: Retry payment failed

### Cancellation Events

- `subscription.canceled_nonpayment`: Subscription canceled due to non-payment

### Event Structure

```typescript
interface LifecycleEvent {
  type: string; // Event type (see above)
  subscriptionId: string;
  customerId: string;
  data: Record<string, unknown>; // Event-specific data
  timestamp: Date;
}
```

## Best Practices

### 1. Schedule Regular Processing

Run the lifecycle service on a regular schedule (hourly or daily):

```typescript
// With node-cron
import cron from 'node-cron';

cron.schedule('0 * * * *', async () => {
  await lifecycle.processAll();
});
```

### 2. Configure Appropriate Grace Periods

- **Standard**: 7 days for most businesses
- **Generous**: 14-30 days for enterprise customers
- **Strict**: 3-5 days for high-risk accounts

### 3. Set Smart Retry Intervals

- **Aggressive**: `[1, 2, 3, 5, 7]` - 5 retries over 18 days
- **Balanced**: `[1, 3, 5]` - 3 retries over 9 days
- **Lenient**: `[3, 7, 14]` - 3 retries over 24 days

### 4. Monitor Event Callbacks

Use `onEvent` to:
- Send customer notifications
- Log to analytics
- Update external systems
- Trigger webhooks

### 5. Handle Payment Provider Errors

Always handle payment provider errors gracefully:

```typescript
processPayment: async (input) => {
  try {
    const result = await provider.createPayment(input);
    return { success: true, paymentId: result.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### 6. Test Thoroughly

Test lifecycle operations with different scenarios:
- Successful renewals
- Failed payments
- Missing payment methods
- Grace period expiration
- Trial conversions

## Examples

### Example 1: Basic Setup with Stripe

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const lifecycle = createSubscriptionLifecycle(billing, storage, {
  gracePeriodDays: 7,
  retryIntervals: [1, 3, 5],
  trialConversionDays: 0,

  processPayment: async (input) => {
    try {
      // Get Stripe customer ID
      const customer = await storage.customers.findById(input.customerId);
      const stripeCustomerId = customer?.providerCustomerIds.stripe;

      if (!stripeCustomerId) {
        throw new Error('Customer not found in Stripe');
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency,
        customer: stripeCustomerId,
        payment_method: input.paymentMethodId,
        confirm: true,
        metadata: {
          subscription_id: input.metadata.subscriptionId,
          type: input.metadata.type,
        },
      });

      return {
        success: paymentIntent.status === 'succeeded',
        paymentId: paymentIntent.id,
        error: paymentIntent.status !== 'succeeded'
          ? `Payment ${paymentIntent.status}`
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  },

  getDefaultPaymentMethod: async (customerId) => {
    const pm = await storage.paymentMethods.findDefaultByCustomerId(customerId);
    return pm ? {
      id: pm.id,
      providerPaymentMethodId: pm.stripePaymentMethodId,
    } : null;
  },

  onEvent: async (event) => {
    console.log(`[Lifecycle] ${event.type}`, event);

    // Send email notifications
    if (event.type === 'subscription.renewal_failed') {
      await sendEmail({
        to: customerEmail,
        subject: 'Payment Failed',
        template: 'payment-failed',
        data: event.data,
      });
    }
  },
});
```

### Example 2: Setup with MercadoPago

```typescript
import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const payment = new Payment(client);

const lifecycle = createSubscriptionLifecycle(billing, storage, {
  gracePeriodDays: 7,
  retryIntervals: [1, 3, 5],
  trialConversionDays: 0,

  processPayment: async (input) => {
    try {
      const customer = await storage.customers.findById(input.customerId);

      const result = await payment.create({
        body: {
          transaction_amount: input.amount / 100, // Convert cents to decimal
          description: `Subscription ${input.metadata.type}`,
          payment_method_id: input.paymentMethodId,
          payer: {
            email: customer?.email ?? '',
          },
          metadata: {
            subscription_id: input.metadata.subscriptionId,
            type: input.metadata.type,
          },
        },
      });

      return {
        success: result.status === 'approved',
        paymentId: result.id?.toString(),
        error: result.status !== 'approved'
          ? `Payment ${result.status}: ${result.status_detail}`
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  },

  getDefaultPaymentMethod: async (customerId) => {
    const pm = await storage.paymentMethods.findDefaultByCustomerId(customerId);
    return pm ? {
      id: pm.id,
      providerPaymentMethodId: pm.mercadopagoCardId,
    } : null;
  },
});
```

### Example 3: Scheduling with BullMQ

```typescript
import { Queue, Worker } from 'bullmq';

const connection = { host: 'localhost', port: 6379 };

// Create queue
const lifecycleQueue = new Queue('subscription-lifecycle', { connection });

// Schedule to run every hour
await lifecycleQueue.add(
  'process-all',
  {},
  {
    repeat: {
      pattern: '0 * * * *', // Every hour
    },
  }
);

// Create worker
const worker = new Worker(
  'subscription-lifecycle',
  async (job) => {
    const results = await lifecycle.processAll();

    // Log results
    console.log('Lifecycle processing completed:', {
      renewals: results.renewals.succeeded,
      conversions: results.trialConversions.succeeded,
      retries: results.retries.succeeded,
      cancellations: results.cancellations.processed,
    });

    return results;
  },
  { connection }
);

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});
```

### Example 4: Custom Retry Strategy

```typescript
// Aggressive strategy for high-value customers
const aggressiveLifecycle = createSubscriptionLifecycle(billing, storage, {
  gracePeriodDays: 14,
  retryIntervals: [1, 2, 3, 5, 7, 10], // 6 retries over 28 days
  trialConversionDays: 0,
  processPayment,
  getDefaultPaymentMethod,
});

// Lenient strategy for enterprise customers
const lenientLifecycle = createSubscriptionLifecycle(billing, storage, {
  gracePeriodDays: 30,
  retryIntervals: [3, 7, 14, 21], // 4 retries over 45 days
  trialConversionDays: 0,
  processPayment,
  getDefaultPaymentMethod,
});
```

## Troubleshooting

### Renewals Not Processing

- Verify subscriptions have `status: 'active'`
- Check `currentPeriodEnd` has passed
- Ensure `cancelAtPeriodEnd` is false
- Verify payment method exists for customer

### Trial Conversions Not Working

- Verify subscriptions have `status: 'trialing'`
- Check `trialEnd` has passed
- Ensure payment method exists for customer
- Review `trialConversionDays` configuration

### Retries Not Running

- Check subscription has `status: 'past_due'`
- Verify `gracePeriodStartedAt` metadata exists
- Ensure retry interval has elapsed
- Check `retryCount` hasn't exceeded available intervals

### Cancellations Not Happening

- Verify grace period has fully elapsed
- Check all retry attempts have been exhausted
- Ensure subscription is still in `past_due` status

## API Reference

See the [TypeScript definitions](../src/services/subscription-lifecycle.service.ts) for complete API documentation.

## Related Documentation

- [Subscription Helpers](../src/helpers/subscription.helper.ts)
- [Billing Service](../src/billing.ts)
- [Storage Adapter](../src/adapters/storage.adapter.ts)

## License

MIT
