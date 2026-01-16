/**
 * Example: Using the unified SavedCardService
 *
 * This example demonstrates how to use the SavedCardService
 * to save, list, and manage payment cards across different providers.
 */

import type { SavedCard } from '@qazuor/qzpay-core';
import { createSavedCardService as createMercadoPagoService } from '@qazuor/qzpay-mercadopago';
import { createSavedCardService as createStripeService } from '@qazuor/qzpay-stripe';

// Mock database to simulate customer ID resolution
const mockDatabase = {
    customers: {
        local_cus_123: {
            id: 'local_cus_123',
            email: 'customer@example.com',
            stripeCustomerId: 'cus_stripe_xxx',
            mercadopagoCustomerId: '123456789'
        }
    }
};

// ====================
// Stripe Example
// ====================

async function stripeExample() {
    console.log('\n=== Stripe Example ===\n');

    // Create the Stripe service
    const stripeCardService = createStripeService({
        provider: 'stripe',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
        getProviderCustomerId: async (customerId) => {
            // In a real app, this would query your database
            const customer = mockDatabase.customers[customerId as keyof typeof mockDatabase.customers];
            if (!customer) {
                throw new Error(`Customer ${customerId} not found`);
            }
            return customer.stripeCustomerId;
        }
    });

    // 1. Save a card
    console.log('1. Saving a card...');
    const savedCard = await stripeCardService.save({
        customerId: 'local_cus_123',
        paymentMethodId: 'pm_xxx', // This comes from Stripe.js on the frontend
        setAsDefault: true,
        metadata: {
            source: 'web-app',
            savedAt: new Date().toISOString()
        }
    });
    console.log('Card saved:', savedCard);

    // 2. List all cards
    console.log('\n2. Listing all cards...');
    const cards = await stripeCardService.list('local_cus_123');
    console.log(`Found ${cards.length} card(s):`);
    cards.forEach((card) => {
        console.log(`  - ${card.brand} ending in ${card.last4} (${card.isDefault ? 'default' : 'not default'})`);
    });

    // 3. Set a different card as default
    if (cards.length > 1) {
        console.log('\n3. Setting a different card as default...');
        const secondCard = cards[1];
        await stripeCardService.setDefault('local_cus_123', secondCard.id);
        console.log(`Card ${secondCard.id} is now the default`);
    }

    // 4. Remove a card
    console.log('\n4. Removing a card...');
    const cardToRemove = cards.find((c) => !c.isDefault);
    if (cardToRemove) {
        await stripeCardService.remove('local_cus_123', cardToRemove.id);
        console.log(`Card ${cardToRemove.id} removed`);
    }
}

// ====================
// MercadoPago Example
// ====================

async function mercadopagoExample() {
    console.log('\n=== MercadoPago Example ===\n');

    // Create the MercadoPago service
    const mpCardService = createMercadoPagoService({
        provider: 'mercadopago',
        mercadopagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
        getProviderCustomerId: async (customerId) => {
            // In a real app, this would query your database
            const customer = mockDatabase.customers[customerId as keyof typeof mockDatabase.customers];
            if (!customer) {
                throw new Error(`Customer ${customerId} not found`);
            }
            return customer.mercadopagoCustomerId;
        }
    });

    // 1. Save a card
    console.log('1. Saving a card...');
    const savedCard = await mpCardService.save({
        customerId: 'local_cus_123',
        token: 'card_token_xxx', // This comes from MercadoPago.js on the frontend
        setAsDefault: true // Note: App must track default separately for MercadoPago
    });
    console.log('Card saved:', savedCard);

    // 2. List all cards
    console.log('\n2. Listing all cards...');
    const cards = await mpCardService.list('local_cus_123');
    console.log(`Found ${cards.length} card(s):`);
    cards.forEach((card) => {
        console.log(`  - ${card.brand} ending in ${card.last4} (first 6: ${card.firstSixDigits || 'N/A'})`);
    });

    // 3. Remove a card
    console.log('\n3. Removing a card...');
    if (cards.length > 0) {
        const cardToRemove = cards[0];
        await mpCardService.remove('local_cus_123', cardToRemove.id);
        console.log(`Card ${cardToRemove.id} removed`);
    }

    // Note: setDefault() is not supported for MercadoPago
    // The app should track the default card in its own database
}

// ====================
// Unified Card Display
// ====================

function displayCard(card: SavedCard) {
    console.log(`
Card Details:
  ID: ${card.id}
  Provider: ${card.provider}
  Brand: ${card.brand.toUpperCase()}
  Last 4: •••• ${card.last4}
  Expires: ${card.expMonth}/${card.expYear}
  Default: ${card.isDefault ? 'Yes' : 'No'}
  ${card.cardholderName ? `Cardholder: ${card.cardholderName}` : ''}
  ${card.firstSixDigits ? `First 6: ${card.firstSixDigits}` : ''}
  Created: ${card.createdAt.toLocaleDateString()}
  `);
}

// ====================
// Provider-Agnostic Helper
// ====================

/**
 * Example of a provider-agnostic helper that works with any provider
 */
async function getDefaultCard(
    service: ReturnType<typeof createStripeService> | ReturnType<typeof createMercadoPagoService>,
    customerId: string
): Promise<SavedCard | null> {
    const cards = await service.list(customerId);
    return cards.find((card) => card.isDefault) ?? null;
}

// ====================
// Run Examples
// ====================

async function main() {
    try {
        // Uncomment to run examples
        // await stripeExample();
        // await mercadopagoExample();

        // Example of unified interface
        const stripeService = createStripeService({
            provider: 'stripe',
            stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
            getProviderCustomerId: async (customerId) => {
                const customer = mockDatabase.customers[customerId as keyof typeof mockDatabase.customers];
                return customer.stripeCustomerId;
            }
        });

        const defaultCard = await getDefaultCard(stripeService, 'local_cus_123');
        if (defaultCard) {
            displayCard(defaultCard);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

export { stripeExample, mercadopagoExample, displayCard, getDefaultCard };
