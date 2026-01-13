/**
 * QZPay Playground Backend Server
 *
 * This server handles real payment provider API calls for the playground.
 * It runs alongside the frontend and proxies requests to Stripe/MercadoPago.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createQZPayBilling, type QZPayBilling, type QZPayPaymentAdapter } from '@qazuor/qzpay-core';
import { createQZPayStripeAdapter } from '@qazuor/qzpay-stripe';
import { createQZPayMercadoPagoAdapter, QZPayMercadoPagoCustomerAdapter, type MercadoPagoConfig } from '@qazuor/qzpay-mercadopago';
import { MercadoPagoConfig as MPConfig } from 'mercadopago';
import { createMemoryStorage } from './memory-storage';

const app = new Hono();

// MercadoPago: In production mode, we use a generic payer email
// This is only used when testing with production credentials
const MERCADOPAGO_PAYER_EMAIL = 'buyer@qzpay-test.com';

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin || '*', // Allow any origin dynamically
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Store session data
interface SessionData {
  billing: QZPayBilling;
  paymentAdapter: QZPayPaymentAdapter;
  mode: 'stripe' | 'mercadopago';
  mercadopagoAccessToken?: string;
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
          webhookSecret: 'whsec_playground_dummy',
        });
        break;
      }

      case 'mercadopago': {
        if (!mercadopagoAccessToken) {
          return c.json({ error: 'MercadoPago access token is required' }, 400);
        }
        accessToken = mercadopagoAccessToken;
        paymentAdapter = createQZPayMercadoPagoAdapter({
          accessToken: mercadopagoAccessToken,
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
      defaultCurrency: 'USD',
    });

    // Store session data
    sessionStore.set(sessionId, {
      billing,
      paymentAdapter,
      mode,
      mercadopagoAccessToken: accessToken,
    });

    // Backward compatibility
    billingInstances.set(sessionId, billing);

    return c.json({
      success: true,
      mode,
      provider: paymentAdapter.provider,
    });
  } catch (error) {
    console.error('Init error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to initialize',
    }, 500);
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
      metadata: customer.metadata,
    });

    return c.json({
      success: true,
      customer: result,
    });
  } catch (error) {
    console.error('Customer sync error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to sync customer',
    }, 500);
  }
});

// Process payment
app.post('/api/payments/process', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, customerId, amount, currency, paymentMethodId, token, cardId, installments, metadata, customer, saveCard, payerIdentification } = body;

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
          metadata: customer.metadata,
        });
        // Use the ID from synced customer (which has the providerCustomerId)
        actualCustomerId = syncedCustomer.id;
        // Get provider customer ID for card operations
        const providerIds = syncedCustomer.providerCustomerIds || {};
        providerCustomerId = providerIds[session?.mode || 'mercadopago'];
        console.log(`Customer synced: ${customer.email} -> ${actualCustomerId} (provider: ${providerCustomerId})`);
      } catch (syncError) {
        console.error('Customer sync error:', syncError);
        return c.json({
          error: `Failed to sync customer: ${syncError instanceof Error ? syncError.message : 'Unknown error'}`,
          success: false,
        }, 400);
      }
    }

    // Process payment with the provider
    try {
      // For MercadoPago, use a payer email (required for card payments)
      const payerEmail = session?.mode === 'mercadopago' ? MERCADOPAGO_PAYER_EMAIL : customer?.email;

      const payment = await billing.payments.process({
        customerId: actualCustomerId,
        amount,
        currency,
        paymentMethodId,
        token,
        cardId,
        installments,
        payerIdentification,
        payerEmail, // Use customer email for MercadoPago
        metadata: {
          ...metadata,
          source: 'playground',
        },
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
          failureMessage: payment.failureMessage,
        },
        savedCard,
      });
    } catch (paymentError) {
      // Log full error details for debugging
      console.error('Payment processing error:', paymentError);
      if (paymentError && typeof paymentError === 'object' && 'cause' in paymentError) {
        console.error('Payment error cause:', (paymentError as { cause: unknown }).cause);
      }

      const errorMessage = paymentError instanceof Error ? paymentError.message : 'Payment processing failed';
      return c.json({
        error: errorMessage,
        success: false,
      }, 500);
    }
  } catch (error) {
    console.error('Payment endpoint error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Payment failed',
      success: false,
    }, 500);
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
      metadata,
    });

    return c.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to create customer',
    }, 500);
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
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to list cards',
    }, 500);
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
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to delete card',
    }, 500);
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
    mode: session?.mode,
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
const port = parseInt(process.env.PORT || '3010', 10);

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
  port,
});
