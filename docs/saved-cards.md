# Saved Cards Service

The Saved Cards Service provides a unified interface for managing saved payment cards across different payment providers (Stripe, MercadoPago, etc.).

## Overview

The service allows you to:
- Save payment methods (cards) to customers
- List all saved cards for a customer
- Remove saved cards
- Set a card as the default payment method (provider-dependent)

## Installation

```bash
# For Stripe
pnpm add @qazuor/qzpay-stripe

# For MercadoPago
pnpm add @qazuor/qzpay-mercadopago

# Core types (usually already installed)
pnpm add @qazuor/qzpay-core
```

## Usage

### Stripe

```typescript
import { createSavedCardService } from '@qazuor/qzpay-stripe';

const cardService = createSavedCardService({
  provider: 'stripe',
  stripeSecretKey: 'sk_test_xxx',
  getProviderCustomerId: async (customerId) => {
    // Resolve your local customer ID to Stripe customer ID
    const customer = await db.customers.findById(customerId);
    return customer.stripeCustomerId;
  },
});

// Save a card
const card = await cardService.save({
  customerId: 'local_cus_123',
  paymentMethodId: 'pm_xxx', // From Stripe.js
  setAsDefault: true,
});

// List all cards
const cards = await cardService.list('local_cus_123');

// Set as default
await cardService.setDefault('local_cus_123', 'pm_xxx');

// Remove a card
await cardService.remove('local_cus_123', 'pm_xxx');
```

### MercadoPago

```typescript
import { createSavedCardService } from '@qazuor/qzpay-mercadopago';

const cardService = createSavedCardService({
  provider: 'mercadopago',
  mercadopagoAccessToken: 'APP_USR-xxx',
  getProviderCustomerId: async (customerId) => {
    // Resolve your local customer ID to MercadoPago customer ID
    const customer = await db.customers.findById(customerId);
    return customer.mercadopagoCustomerId;
  },
});

// Save a card
const card = await cardService.save({
  customerId: 'local_cus_123',
  token: 'card_token_xxx', // From MercadoPago.js
  setAsDefault: true, // Note: App must track default separately
});

// List all cards
const cards = await cardService.list('local_cus_123');

// Remove a card
await cardService.remove('local_cus_123', 'card_id_xxx');

// Note: setDefault() throws an error for MercadoPago
// Track default card in your application database
```

## API Reference

### `createSavedCardService(config)`

Creates a saved card service instance.

#### Parameters

**For Stripe:**

```typescript
{
  provider: 'stripe',
  stripeSecretKey: string,
  getProviderCustomerId: (customerId: string) => Promise<string>
}
```

**For MercadoPago:**

```typescript
{
  provider: 'mercadopago',
  mercadopagoAccessToken: string,
  getProviderCustomerId: (customerId: string) => Promise<string>
}
```

#### Returns

A `SavedCardService` instance.

---

### `save(input)`

Saves a payment method (card) to a customer.

#### Parameters

```typescript
{
  customerId: string;
  paymentMethodId?: string;  // For Stripe
  token?: string;            // For MercadoPago
  setAsDefault?: boolean;
  metadata?: Record<string, unknown>;
}
```

#### Returns

```typescript
Promise<SavedCard>
```

---

### `list(customerId)`

Lists all saved cards for a customer.

#### Parameters

- `customerId` (string): Local customer ID

#### Returns

```typescript
Promise<SavedCard[]>
```

---

### `remove(customerId, cardId)`

Removes a saved card from a customer.

#### Parameters

- `customerId` (string): Local customer ID
- `cardId` (string): Card ID (PaymentMethod ID or Card ID)

#### Returns

```typescript
Promise<void>
```

---

### `setDefault(customerId, cardId)`

Sets a card as the default payment method.

#### Parameters

- `customerId` (string): Local customer ID
- `cardId` (string): Card ID (PaymentMethod ID or Card ID)

#### Returns

```typescript
Promise<void>
```

**Note:** This method is not supported for MercadoPago and will throw an error.

## Types

### `SavedCard`

```typescript
interface SavedCard {
  id: string;
  customerId: string;
  providerCustomerId: string;
  provider: 'stripe' | 'mercadopago';
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  cardholderName?: string;
  firstSixDigits?: string;  // MercadoPago only
  createdAt: Date;
}
```

### `SaveCardInput`

```typescript
interface SaveCardInput {
  customerId: string;
  paymentMethodId?: string;  // For Stripe
  token?: string;            // For MercadoPago
  setAsDefault?: boolean;
  metadata?: Record<string, unknown>;
}
```

## Frontend Integration

### Stripe

```javascript
// 1. Create PaymentMethod on the frontend using Stripe.js
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement,
  billing_details: {
    name: 'John Doe',
  },
});

// 2. Send PaymentMethod ID to your backend
const response = await fetch('/api/cards/save', {
  method: 'POST',
  body: JSON.stringify({
    customerId: 'local_cus_123',
    paymentMethodId: paymentMethod.id,
    setAsDefault: true,
  }),
});
```

### MercadoPago

```javascript
// 1. Create card token on the frontend using MercadoPago.js
const token = await window.MercadoPago.createCardToken({
  cardNumber: '4111111111111111',
  cardholderName: 'John Doe',
  cardExpirationMonth: '12',
  cardExpirationYear: '2025',
  securityCode: '123',
  identificationType: 'DNI',
  identificationNumber: '12345678',
});

// 2. Send token to your backend
const response = await fetch('/api/cards/save', {
  method: 'POST',
  body: JSON.stringify({
    customerId: 'local_cus_123',
    token: token.id,
    setAsDefault: true,
  }),
});
```

## Provider Differences

| Feature | Stripe | MercadoPago |
|---------|--------|-------------|
| Save card | ✅ `paymentMethodId` | ✅ `token` |
| List cards | ✅ | ✅ |
| Remove card | ✅ | ✅ |
| Set default | ✅ Native support | ❌ Track in app DB |
| First 6 digits | ❌ | ✅ |
| Cardholder name | ✅ | ✅ |

### Default Payment Method

**Stripe:** Natively supports default payment methods. Use `setDefault()` to change the default.

**MercadoPago:** Does not have a native concept of default payment method. Your application should:

1. Track the default card ID in your database
2. When creating a payment, specify the card ID explicitly
3. Don't rely on `isDefault` field for MercadoPago cards

Example:

```typescript
// Your database schema
interface Customer {
  id: string;
  stripeCustomerId: string;
  mercadopagoCustomerId: string;
  defaultStripeCardId?: string;      // Not needed, Stripe tracks it
  defaultMercadoPagoCardId?: string; // You must track this
}

// When creating a payment with MercadoPago
const customer = await db.customers.findById(customerId);
const payment = await mpPaymentAdapter.create({
  customerId: customer.mercadopagoCustomerId,
  cardId: customer.defaultMercadoPagoCardId, // Specify explicitly
  amount: 1000,
  currency: 'ARS',
});
```

## Error Handling

```typescript
try {
  const card = await cardService.save({
    customerId: 'local_cus_123',
    paymentMethodId: 'pm_invalid',
  });
} catch (error) {
  if (error.message.includes('paymentMethodId is required')) {
    // Missing paymentMethodId for Stripe
  } else if (error.message.includes('does not belong to customer')) {
    // Trying to operate on a card that doesn't belong to the customer
  } else if (error.message.includes('has been deleted')) {
    // Customer has been deleted
  } else {
    // Other errors
  }
}
```

## Complete Example

See [`examples/saved-cards-usage.ts`](../examples/saved-cards-usage.ts) for a complete working example.

## Best Practices

1. **Always validate customer ownership**: The service automatically validates that cards belong to the specified customer.

2. **Handle provider differences**: Be aware that MercadoPago doesn't support default payment methods natively.

3. **Store provider customer IDs**: Your application should store both the local customer ID and the provider-specific customer IDs (Stripe customer ID, MercadoPago customer ID).

4. **Frontend token generation**: Always create payment method tokens/PaymentMethods on the frontend using the provider's JavaScript SDK to avoid PCI compliance issues.

5. **Metadata**: Use metadata to track additional information (e.g., when the card was saved, from which device, etc.).

6. **Error handling**: Always wrap service calls in try-catch blocks and handle errors appropriately.

## Security Considerations

- **Never** send raw card details to your backend
- **Always** use the provider's JavaScript SDK to tokenize cards on the frontend
- **Only** send the token/PaymentMethod ID to your backend
- **Validate** customer ownership before performing any card operations
- **Use HTTPS** for all API calls
- **Implement** rate limiting on card save endpoints

## See Also

- [Stripe PaymentMethods API](https://stripe.com/docs/api/payment_methods)
- [MercadoPago Card on File](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/integration-configuration/card-on-file)
- [PCI Compliance](https://www.pcisecuritystandards.org/)
