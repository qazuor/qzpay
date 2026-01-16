/**
 * QZPay Playground Backend Server
 *
 * This server handles real payment provider API calls for the playground.
 * It runs alongside the frontend and proxies requests to Stripe/MercadoPago.
 *
 * ## Features Demonstrated
 *
 * ### 1. Saved Cards (Card on File)
 * The playground showcases the SavedCardService for both Stripe and MercadoPago:
 *
 * For Stripe:
 * ```typescript
 * import { createSavedCardService } from '@qazuor/qzpay-stripe';
 *
 * const cardService = createSavedCardService({
 *   provider: 'stripe',
 *   stripeSecretKey: 'sk_xxx',
 *   getProviderCustomerId: async (customerId) => {
 *     // Return Stripe customer ID from your database
 *     return 'cus_xxx';
 *   },
 * });
 *
 * // Save a card (handled automatically by Stripe PaymentMethod API)
 * // List cards
 * const cards = await cardService.listCards('customer-123');
 * // Remove a card
 * await cardService.removeCard('customer-123', 'pm_xxx');
 * ```
 *
 * For MercadoPago:
 * ```typescript
 * import { createSavedCardService } from '@qazuor/qzpay-mercadopago';
 *
 * const cardService = createSavedCardService({
 *   provider: 'mercadopago',
 *   mercadopagoAccessToken: 'APP_USR-xxx',
 *   getProviderCustomerId: async (customerId) => {
 *     // Return MercadoPago customer ID from your database
 *     return '123456789';
 *   },
 * });
 *
 * // Save a card after payment
 * const savedCard = await cardService.saveCard('customer-123', 'card_token_xxx');
 * // List saved cards
 * const cards = await cardService.listCards('customer-123');
 * // Remove a card
 * await cardService.removeCard('customer-123', 'card_id_xxx');
 * ```
 *
 * ### 2. Subscription Lifecycle Automation
 * The SubscriptionLifecycleService automates subscription renewals, retries, and grace periods:
 *
 * ```typescript
 * import { createSubscriptionLifecycle } from '@qazuor/qzpay-core';
 *
 * const lifecycle = createSubscriptionLifecycle(billing, storage, {
 *   gracePeriodDays: 7,
 *   retryIntervals: [1, 3, 5], // Retry failed payments on days 1, 3, and 5
 *   processPayment: async (input) => {
 *     // Your payment processing logic
 *     return await billing.payments.process(input);
 *   },
 *   getDefaultPaymentMethod: async (customerId) => {
 *     // Get the customer's default saved card
 *     const cards = await cardService.listCards(customerId);
 *     return cards.find(c => c.isDefault)?.id;
 *   },
 * });
 *
 * // Run periodic processing (call this from a cron job or scheduled task)
 * const results = await lifecycle.processAll();
 * console.log(`Processed ${results.renewed} renewals, ${results.retried} retries`);
 * ```
 *
 * See the endpoints below for how these services are integrated in the playground.
 */
import { serve } from '@hono/node-server';
import { type QZPayBilling, type QZPayPaymentAdapter, createQZPayBilling } from '@qazuor/qzpay-core';
import { QZPayMercadoPagoCustomerAdapter, createQZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { MercadoPagoConfig as MPConfig } from 'mercadopago';
import Stripe from 'stripe';
import { createMemoryStorage } from './memory-storage';

const app = new Hono();

// MercadoPago: In production mode, we use a generic payer email
// This is only used when testing with production credentials
const MERCADOPAGO_PAYER_EMAIL = 'buyer@qzpay-test.com';

// CORS Configuration
// Parse allowed origins from environment variable or use default
// Note: Vite dev server runs on port 3001 (see vite.config.ts)
const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:3001';
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [DEFAULT_ALLOWED_ORIGIN];

console.log('CORS Configuration:');
console.log('  Allowed origins:', allowedOrigins.join(', '));

// Middleware
app.use('*', logger());
app.use(
    '*',
    cors({
        origin: (origin) => {
            // If no origin (same-origin request), allow it
            if (!origin) return DEFAULT_ALLOWED_ORIGIN;

            // Check if origin is in allowed list
            if (allowedOrigins.includes(origin)) {
                return origin;
            }

            // Reject other origins
            console.warn(`CORS: Rejected origin: ${origin}`);
            return null;
        },
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['Content-Length'],
        maxAge: 600,
        credentials: true
    })
);

// Store session data
interface SessionData {
    billing: QZPayBilling;
    paymentAdapter: QZPayPaymentAdapter;
    mode: 'stripe' | 'mercadopago';
    mercadopagoAccessToken?: string;
    stripeSecretKey?: string;
}
const sessionStore = new Map<string, SessionData>();

// Backward compatibility
const billingInstances = new Map<string, QZPayBilling>();

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Initialize billing for a specific mode
app.post('/api/init', async (c) => {
    try {
        const body = await c.req.json();
        const { mode, stripeSecretKey, mercadopagoAccessToken, sessionId } = body;

        if (!sessionId) {
            return c.json({ error: 'sessionId is required' }, 400);
        }

        // Create storage (in-memory for server, synced from frontend)
        const storage = createMemoryStorage();

        // Create payment adapter based on mode
        let paymentAdapter: QZPayPaymentAdapter;
        let accessToken: string | undefined;

        switch (mode) {
            case 'stripe': {
                if (!stripeSecretKey) {
                    return c.json({ error: 'Stripe secret key is required' }, 400);
                }
                paymentAdapter = createQZPayStripeAdapter({
                    secretKey: stripeSecretKey,
                    webhookSecret: 'whsec_playground_dummy'
                });
                break;
            }

            case 'mercadopago': {
                if (!mercadopagoAccessToken) {
                    return c.json({ error: 'MercadoPago access token is required' }, 400);
                }
                accessToken = mercadopagoAccessToken;
                paymentAdapter = createQZPayMercadoPagoAdapter({
                    accessToken: mercadopagoAccessToken
                });
                break;
            }

            default:
                return c.json({ error: 'Invalid mode. Use stripe or mercadopago for real API testing.' }, 400);
        }

        // Create billing instance
        const billing = createQZPayBilling({
            storage,
            paymentAdapter,
            livemode: false,
            defaultCurrency: 'USD'
        });

        // Store session data
        sessionStore.set(sessionId, {
            billing,
            paymentAdapter,
            mode,
            mercadopagoAccessToken: accessToken,
            stripeSecretKey: mode === 'stripe' ? stripeSecretKey : undefined
        });

        // Backward compatibility
        billingInstances.set(sessionId, billing);

        return c.json({
            success: true,
            mode,
            provider: paymentAdapter.provider
        });
    } catch (error) {
        console.error('Init error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Failed to initialize'
            },
            500
        );
    }
});

// Sync customer data from frontend
app.post('/api/customers/sync', async (c) => {
    try {
        const body = await c.req.json();
        const { sessionId, customer } = body;

        const billing = billingInstances.get(sessionId);
        if (!billing) {
            return c.json({ error: 'Session not initialized. Call /api/init first.' }, 400);
        }

        // Create or update customer in provider
        const result = await billing.customers.syncUser({
            externalId: customer.externalId,
            email: customer.email,
            name: customer.name,
            phone: customer.phone,
            metadata: customer.metadata
        });

        return c.json({
            success: true,
            customer: result
        });
    } catch (error) {
        console.error('Customer sync error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Failed to sync customer'
            },
            500
        );
    }
});

// Process payment
app.post('/api/payments/process', async (c) => {
    try {
        const body = await c.req.json();
        const {
            sessionId,
            customerId,
            amount,
            currency,
            paymentMethodId,
            token,
            cardId,
            installments,
            metadata,
            customer,
            saveCard,
            payerIdentification
        } = body;

        const session = sessionStore.get(sessionId);
        const billing = session?.billing || billingInstances.get(sessionId);
        if (!billing) {
            return c.json({ error: 'Session not initialized. Call /api/init first.' }, 400);
        }

        // Sync customer first to ensure it exists in backend with provider ID
        let actualCustomerId = customerId;
        let providerCustomerId: string | undefined;
        if (customer) {
            try {
                const syncedCustomer = await billing.customers.syncUser({
                    externalId: customer.externalId || customerId,
                    email: customer.email,
                    name: customer.name,
                    phone: customer.phone,
                    metadata: customer.metadata
                });
                // Use the ID from synced customer (which has the providerCustomerId)
                actualCustomerId = syncedCustomer.id;
                // Get provider customer ID for card operations
                const providerIds = syncedCustomer.providerCustomerIds || {};
                providerCustomerId = providerIds[session?.mode || 'mercadopago'];
                console.log(`Customer synced: ${customer.email} -> ${actualCustomerId} (provider: ${providerCustomerId})`);
            } catch (syncError) {
                console.error('Customer sync error:', syncError);
                return c.json(
                    {
                        error: `Failed to sync customer: ${syncError instanceof Error ? syncError.message : 'Unknown error'}`,
                        success: false
                    },
                    400
                );
            }
        }

        // Process payment with the provider
        try {
            // For MercadoPago, use a payer email (required for card payments)
            const payerEmail = session?.mode === 'mercadopago' ? MERCADOPAGO_PAYER_EMAIL : customer?.email;

            // For Stripe, use the adapter directly to get clientSecret for 3DS
            if (session?.mode === 'stripe' && providerCustomerId && paymentMethodId) {
                let actualPaymentMethodId = paymentMethodId;

                // Create Stripe instance for direct API calls
                const stripe = new Stripe(session.stripeSecretKey!);

                // Handle test card format: "test_card:4242424242424242"
                if (paymentMethodId.startsWith('test_card:')) {
                    const cardNumber = paymentMethodId.replace('test_card:', '');
                    console.log(`[Stripe] Creating PaymentMethod from test card: ****${cardNumber.slice(-4)}`);

                    // Create PaymentMethod with test card data
                    const pm = await stripe.paymentMethods.create({
                        type: 'card',
                        card: {
                            number: cardNumber,
                            exp_month: 12,
                            exp_year: 2034,
                            cvc: '123'
                        }
                    });
                    actualPaymentMethodId = pm.id;
                    console.log(`[Stripe] Created PaymentMethod: ${pm.id}`);
                }

                // Attach PaymentMethod to Customer if not already attached
                // This allows the PaymentMethod to be reused for future payments
                try {
                    const pm = await stripe.paymentMethods.retrieve(actualPaymentMethodId);
                    if (!pm.customer) {
                        console.log(`[Stripe] Attaching PaymentMethod ${actualPaymentMethodId} to Customer ${providerCustomerId}`);
                        await stripe.paymentMethods.attach(actualPaymentMethodId, {
                            customer: providerCustomerId
                        });
                    } else {
                        console.log(`[Stripe] PaymentMethod already attached to customer: ${pm.customer}`);
                    }
                } catch (attachError) {
                    console.warn('[Stripe] Could not attach PaymentMethod:', attachError);
                    // Continue anyway - the payment might still work
                }

                const stripeResult = await session.paymentAdapter.payments.create(providerCustomerId, {
                    customerId: actualCustomerId,
                    amount,
                    currency,
                    paymentMethodId: actualPaymentMethodId,
                    metadata: {
                        ...metadata,
                        source: 'playground'
                    }
                });

                // Check if payment requires 3DS authentication
                const requiresAction = stripeResult.status === 'requires_action' || stripeResult.status === 'requires_confirmation';

                return c.json({
                    success: stripeResult.status === 'succeeded',
                    payment: {
                        id: stripeResult.id,
                        status: stripeResult.status,
                        amount: stripeResult.amount,
                        currency: stripeResult.currency,
                        // Include clientSecret for 3DS authentication
                        clientSecret: requiresAction ? stripeResult.clientSecret : undefined,
                        nextAction: requiresAction ? stripeResult.nextAction : undefined
                    }
                });
            }

            // For MercadoPago or other providers, use billing.payments.process
            const payment = await billing.payments.process({
                customerId: actualCustomerId,
                amount,
                currency,
                paymentMethodId,
                token,
                cardId,
                installments,
                payerIdentification,
                payerEmail,
                metadata: {
                    ...metadata,
                    source: 'playground'
                }
            });

            // If payment succeeded and saveCard is requested (for Card on File flow)
            let savedCard = null;
            if (payment.status === 'succeeded' && saveCard && token && session?.mode === 'mercadopago' && providerCustomerId) {
                try {
                    // Create MercadoPago customer adapter to save the card
                    const mpConfig = new MPConfig({ accessToken: session.mercadopagoAccessToken! });
                    const customerAdapter = new QZPayMercadoPagoCustomerAdapter(mpConfig);

                    savedCard = await customerAdapter.saveCard(providerCustomerId, token);
                    console.log(`Card saved for customer ${providerCustomerId}: ${savedCard.id} (****${savedCard.lastFourDigits})`);
                } catch (cardError) {
                    // Log but don't fail the payment - card save is optional
                    console.error('Failed to save card:', cardError);
                }
            }

            return c.json({
                success: payment.status === 'succeeded',
                payment: {
                    id: payment.id,
                    status: payment.status,
                    amount: payment.amount,
                    currency: payment.currency,
                    failureMessage: payment.failureMessage
                },
                savedCard
            });
        } catch (paymentError) {
            // Log full error details for debugging
            console.error('Payment processing error:', paymentError);
            if (paymentError && typeof paymentError === 'object' && 'cause' in paymentError) {
                console.error('Payment error cause:', (paymentError as { cause: unknown }).cause);
            }

            const errorMessage = paymentError instanceof Error ? paymentError.message : 'Payment processing failed';
            return c.json(
                {
                    error: errorMessage,
                    success: false
                },
                500
            );
        }
    } catch (error) {
        console.error('Payment endpoint error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Payment failed',
                success: false
            },
            500
        );
    }
});

// Create customer in provider
app.post('/api/customers/create', async (c) => {
    try {
        const body = await c.req.json();
        const { sessionId, email, name, metadata } = body;

        const billing = billingInstances.get(sessionId);
        if (!billing) {
            return c.json({ error: 'Session not initialized. Call /api/init first.' }, 400);
        }

        const customer = await billing.customers.create({
            externalId: `ext_${Date.now()}`,
            email,
            name,
            metadata
        });

        return c.json({
            success: true,
            customer
        });
    } catch (error) {
        console.error('Create customer error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Failed to create customer'
            },
            500
        );
    }
});

// Get saved cards for a customer
app.get('/api/customers/:customerId/cards', async (c) => {
    try {
        const sessionId = c.req.query('sessionId');
        const customerId = c.req.param('customerId');

        if (!sessionId) {
            return c.json({ error: 'sessionId query parameter is required' }, 400);
        }

        const session = sessionStore.get(sessionId);
        if (!session) {
            return c.json({ error: 'Session not initialized' }, 400);
        }

        if (session.mode !== 'mercadopago') {
            return c.json({ cards: [] }); // Only MercadoPago supports card listing currently
        }

        // Get customer to find provider customer ID
        const customer = await session.billing.customers.get(customerId);
        if (!customer) {
            // Customer not yet synced to backend - return empty cards (first payment scenario)
            return c.json({ cards: [] });
        }

        const providerCustomerId = customer.providerCustomerIds?.[session.mode];
        if (!providerCustomerId) {
            return c.json({ cards: [] }); // Customer not linked to provider
        }

        // List cards from provider
        try {
            const mpConfig = new MPConfig({ accessToken: session.mercadopagoAccessToken! });
            const customerAdapter = new QZPayMercadoPagoCustomerAdapter(mpConfig);
            const cards = await customerAdapter.listCards(providerCustomerId);
            return c.json({ cards });
        } catch (cardError) {
            // If listing cards fails (e.g., customer doesn't exist in MercadoPago yet), return empty
            console.warn('Could not list cards:', cardError);
            return c.json({ cards: [] });
        }
    } catch (error) {
        console.error('List cards error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Failed to list cards'
            },
            500
        );
    }
});

// Delete a saved card
app.delete('/api/customers/:customerId/cards/:cardId', async (c) => {
    try {
        const sessionId = c.req.query('sessionId');
        const customerId = c.req.param('customerId');
        const cardId = c.req.param('cardId');

        if (!sessionId) {
            return c.json({ error: 'sessionId query parameter is required' }, 400);
        }

        const session = sessionStore.get(sessionId);
        if (!session) {
            return c.json({ error: 'Session not initialized' }, 400);
        }

        if (session.mode !== 'mercadopago') {
            return c.json({ error: 'Card deletion only supported for MercadoPago' }, 400);
        }

        // Get customer to find provider customer ID
        const customer = await session.billing.customers.get(customerId);
        if (!customer) {
            return c.json({ error: 'Customer not found' }, 404);
        }

        const providerCustomerId = customer.providerCustomerIds?.[session.mode];
        if (!providerCustomerId) {
            return c.json({ error: 'Customer not linked to provider' }, 400);
        }

        // Remove card from provider
        const mpConfig = new MPConfig({ accessToken: session.mercadopagoAccessToken! });
        const customerAdapter = new QZPayMercadoPagoCustomerAdapter(mpConfig);
        await customerAdapter.removeCard(providerCustomerId, cardId);

        return c.json({ success: true });
    } catch (error) {
        console.error('Delete card error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Failed to delete card'
            },
            500
        );
    }
});

// Get session info
app.get('/api/session/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId');
    const session = sessionStore.get(sessionId);
    const billing = session?.billing || billingInstances.get(sessionId);

    if (!billing) {
        return c.json({ initialized: false });
    }

    return c.json({
        initialized: true,
        mode: session?.mode
    });
});

// Cleanup session
app.delete('/api/session/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId');
    sessionStore.delete(sessionId);
    billingInstances.delete(sessionId);
    return c.json({ success: true });
});

// Start server
const port = Number.parseInt(process.env.PORT || '3010', 10);

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 QZPay Playground Backend Server                         ║
║                                                              ║
║   Running on: http://localhost:${port}                        ║
║                                                              ║
║   Endpoints:                                                 ║
║   - POST /api/init          Initialize billing session       ║
║   - POST /api/customers/sync   Sync customer to provider     ║
║   - POST /api/customers/create Create customer               ║
║   - POST /api/payments/process Process payment               ║
║   - GET  /api/session/:id   Get session info                 ║
║   - DELETE /api/session/:id Cleanup session                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

serve({
    fetch: app.fetch,
    port
});
