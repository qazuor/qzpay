# Payment Providers Configuration Guide

This guide explains how to configure payment providers for QZPay, both in the Playground and in production applications.

## Table of Contents

- [Overview](#overview)
- [Mock Provider (Development)](#mock-provider-development)
- [Stripe](#stripe)
- [MercadoPago](#mercadopago)
- [Switching Providers](#switching-providers)

---

## Overview

QZPay supports multiple payment providers through its adapter pattern:

| Provider | Package | Best For |
|----------|---------|----------|
| Mock | Built-in | Development & Testing |
| Stripe | `@qazuor/qzpay-stripe` | Global payments, US/EU focus |
| MercadoPago | `@qazuor/qzpay-mercadopago` | Latin America |

---

## Mock Provider (Development)

The mock provider simulates payment processing without real API calls. Perfect for development and testing.

### Test Cards

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient Funds |
| `4000 0000 0000 3220` | Requires 3DS |

### Playground Configuration

1. In Setup, select **Payment Mode: Mock**
2. Click **Initialize**
3. No API keys required

---

## Stripe

### Step 1: Create a Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Sign up or log in
3. Complete account verification (for live payments)

### Step 2: Get API Keys

1. In Stripe Dashboard, go to **Developers → API Keys**
2. Copy your keys:
   - **Publishable key**: `pk_test_...` (frontend)
   - **Secret key**: `sk_test_...` (backend - keep secure!)

> **Important**: Use test keys (`pk_test_`, `sk_test_`) for development. Live keys (`pk_live_`, `sk_live_`) are for production only.

### Step 3: Configure Webhooks (Production)

1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen:
   - `customer.created`
   - `customer.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Webhook signing secret**: `whsec_...`

### Step 4: Playground Configuration

1. In Setup, select **Payment Mode: Stripe**
2. Enter your **Secret Key** (`sk_test_...`)
3. Click **Initialize**

### Step 5: Code Integration

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';

const stripeAdapter = createQZPayStripeAdapter({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});

const billing = createQZPayBilling({
  storage: yourStorageAdapter,
  paymentAdapter: stripeAdapter,
});
```

### Stripe Test Cards

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient Funds |
| `4000 0000 0000 3220` | Requires 3DS |
| `4000 0000 0000 0069` | Expired Card |
| `4000 0000 0000 0127` | Incorrect CVC |

> Full list: [Stripe Testing Documentation](https://stripe.com/docs/testing)

---

## MercadoPago

### Step 1: Create a MercadoPago Developer Account

1. Go to [MercadoPago Developers](https://www.mercadopago.com/developers)
2. Sign up or log in with your MercadoPago account
3. Create an application

### Step 2: Create an Application

1. Click **Create Application**
2. Fill in:
   - **Application name**: Your app name
   - **Integration type**: Select **Checkout API**
   - **Product to integrate**: Select **API de Pagos** (Payments API)
3. Click **Create**

> **Why Checkout API + API de Pagos?**
> - **Checkout API** gives you full control over the payment flow
> - **API de Pagos** is the direct payments API that QZPay uses
> - Don't choose "Subscriptions" - QZPay manages subscription logic internally

### Step 3: Get Credentials

1. In your application, go to **Test Credentials**
2. Copy the **Access Token**: `TEST-xxxx...`

> **Important**:
> - Use **Test credentials** for development
> - Use **Production credentials** only for live payments
> - Never expose your Access Token in frontend code

### Step 4: Playground Configuration

1. In Setup, select **Payment Mode: MercadoPago**
2. Enter your **Access Token** (`TEST-...`)
3. Click **Initialize**

### Step 5: Code Integration

```typescript
import { createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';

const mercadopagoAdapter = createQZPayMercadoPagoAdapter({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const billing = createQZPayBilling({
  storage: yourStorageAdapter,
  paymentAdapter: mercadopagoAdapter,
});
```

### MercadoPago Test Cards

#### Argentina (ARS)

| Card | Number | CVV | Expiration |
|------|--------|-----|------------|
| Mastercard (Approved) | `5031 7557 3453 0604` | `123` | `11/25` |
| Mastercard (Rejected) | `5031 7557 3453 0604` | `456` | `11/25` |
| Visa (Approved) | `4509 9535 6623 3704` | `123` | `11/25` |

#### Brazil (BRL)

| Card | Number | CVV | Expiration |
|------|--------|-----|------------|
| Mastercard (Approved) | `5031 4332 1540 6351` | `123` | `11/25` |
| Visa (Approved) | `4235 6477 2802 5682` | `123` | `11/25` |

#### Mexico (MXN)

| Card | Number | CVV | Expiration |
|------|--------|-----|------------|
| Mastercard (Approved) | `5474 9254 3267 0366` | `123` | `11/25` |
| Visa (Approved) | `4075 5957 1648 3764` | `123` | `11/25` |

> Full list: [MercadoPago Test Cards](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/cards)

### Test Users (Optional)

For complete testing, MercadoPago recommends creating test users:

1. Go to **Test Credentials → Test Users**
2. Create a **Seller** test user
3. Create a **Buyer** test user
4. Use buyer credentials to simulate purchases

---

## Switching Providers

### In Playground

Simply change the Payment Mode in Setup and re-initialize.

> **Note**: When switching providers, existing customers need to be re-synced with the new provider. The easiest approach is to clear data and reload a template.

### In Production

```typescript
// Environment-based provider selection
function createPaymentAdapter() {
  const provider = process.env.PAYMENT_PROVIDER;

  switch (provider) {
    case 'stripe':
      return createQZPayStripeAdapter({
        secretKey: process.env.STRIPE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      });

    case 'mercadopago':
      return createQZPayMercadoPagoAdapter({
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
      });

    default:
      throw new Error(`Unknown payment provider: ${provider}`);
  }
}
```

---

## Security Best Practices

1. **Never expose secret keys** in frontend code or version control
2. **Use environment variables** for all credentials
3. **Use test credentials** during development
4. **Validate webhooks** using the webhook secret
5. **Implement idempotency** for payment operations
6. **Log payment events** for debugging and auditing

---

## Troubleshooting

### "Customer not linked to provider"

**Cause**: The customer doesn't have a `providerCustomerIds` entry for the current provider.

**Solutions**:
1. Clear localStorage and reload templates (customers will be re-synced)
2. Create new customers through the billing API
3. Manually sync existing customers using `billing.customers.syncUser()`

### "Invalid API Key"

**Cause**: The API key format is incorrect or expired.

**Solutions**:
1. Verify you're using the correct key type (test vs live)
2. Check for extra spaces or characters
3. Regenerate the key in the provider dashboard

### "Payment Failed"

**Cause**: Various reasons depending on card/payment method.

**Solutions**:
1. Check the `failureMessage` in the payment object
2. Use a different test card
3. Verify the card details are correct

---

## Related Documentation

- [Stripe API Reference](https://stripe.com/docs/api)
- [MercadoPago API Reference](https://www.mercadopago.com/developers/en/reference)
- [QZPay Core Documentation](../05-api/README.md)
