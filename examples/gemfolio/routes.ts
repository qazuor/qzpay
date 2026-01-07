/**
 * GemFolio - API Routes (Hono)
 */
import { createRateLimitMiddleware } from '@qazuor/qzpay-hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import {
    calculateCartTotals,
    createCheckoutSession,
    getOrder,
    handleCheckoutComplete,
    listVendorOrders,
    refundOrder,
    updateOrderStatus
} from './checkout.js';
import { platformStripe } from './config.js';
import { createPrice, createProduct, getStoreCatalog, listVendorProducts, updateProduct } from './products.js';
import {
    checkVendorStatus,
    createVendor,
    getDashboardLink,
    getOnboardingLink,
    getVendor,
    getVendorBySlug,
    updateVendorSettings
} from './store.js';
import type { GemFolioCart, GemFolioOrderStatus, GemFolioVendorSettings } from './types.js';

const app = new Hono();

// ==================== Middleware ====================

app.use('*', logger());
app.use('*', cors());

app.use(
    '/api/*',
    createRateLimitMiddleware({
        windowMs: 60 * 1000,
        limit: 100
    })
);

// JWT for vendor dashboard routes
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

// ==================== Health ====================

app.get('/health', (c) => c.json({ status: 'ok', service: 'gemfolio' }));

// ==================== Public Store Routes ====================
// These are for buyers browsing vendor stores

// Get store info
app.get('/store/:slug', async (c) => {
    const vendor = getVendorBySlug(c.req.param('slug'));
    if (!vendor || !vendor.active) {
        return c.json({ success: false, error: 'Store not found' }, 404);
    }

    return c.json({
        success: true,
        data: {
            name: vendor.settings.storeName,
            description: vendor.settings.storeDescription,
            logo: vendor.settings.logo,
            primaryColor: vendor.settings.primaryColor,
            currency: vendor.currency,
            shippingEnabled: vendor.settings.shippingEnabled
        }
    });
});

// Get store catalog
app.get('/store/:slug/products', async (c) => {
    const vendor = getVendorBySlug(c.req.param('slug'));
    if (!vendor || !vendor.active) {
        return c.json({ success: false, error: 'Store not found' }, 404);
    }

    const catalog = getStoreCatalog(vendor.id);
    return c.json({ success: true, data: catalog });
});

// Calculate cart totals
app.post('/store/:slug/cart/calculate', async (c) => {
    const vendor = getVendorBySlug(c.req.param('slug'));
    if (!vendor || !vendor.active) {
        return c.json({ success: false, error: 'Store not found' }, 404);
    }

    try {
        const body = await c.req.json<{ items: GemFolioCart['items'] }>();
        const cart: GemFolioCart = {
            vendorId: vendor.id,
            items: body.items,
            currency: vendor.currency
        };

        const totals = calculateCartTotals(cart);
        return c.json({ success: true, data: totals });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Create checkout session
app.post('/store/:slug/checkout', async (c) => {
    const vendor = getVendorBySlug(c.req.param('slug'));
    if (!vendor || !vendor.active) {
        return c.json({ success: false, error: 'Store not found' }, 404);
    }

    try {
        const body = await c.req.json<{
            items: GemFolioCart['items'];
            customerEmail?: string;
            successUrl: string;
            cancelUrl: string;
        }>();

        const cart: GemFolioCart = {
            vendorId: vendor.id,
            items: body.items,
            currency: vendor.currency
        };

        const result = await createCheckoutSession(vendor.id, cart, {
            successUrl: body.successUrl,
            cancelUrl: body.cancelUrl,
            customerEmail: body.customerEmail
        });

        return c.json({ success: true, data: result });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Vendor Dashboard Routes ====================
// These require vendor authentication

app.use('/api/vendor/*', jwt({ secret: jwtSecret }));

// Create new vendor (registration)
app.post('/api/vendors', async (c) => {
    try {
        const body = await c.req.json<{
            email: string;
            businessName: string;
            slug: string;
            country: string;
            settings?: Partial<GemFolioVendorSettings>;
        }>();

        const vendor = await createVendor({
            email: body.email,
            businessName: body.businessName,
            slug: body.slug,
            country: body.country,
            settings: body.settings || {}
        });

        return c.json({ success: true, data: { vendorId: vendor.id } }, 201);
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Get onboarding link
app.get('/api/vendor/:id/onboarding', async (c) => {
    try {
        const returnUrl = c.req.query('returnUrl') || 'https://gemfolio.com/vendor/dashboard';
        const refreshUrl = c.req.query('refreshUrl') || 'https://gemfolio.com/vendor/onboarding';

        const url = await getOnboardingLink(c.req.param('id'), returnUrl, refreshUrl);
        return c.json({ success: true, data: { url } });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Get vendor status
app.get('/api/vendor/:id/status', async (c) => {
    try {
        const status = await checkVendorStatus(c.req.param('id'));
        return c.json({ success: true, data: status });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Get vendor details
app.get('/api/vendor/:id', async (c) => {
    const vendor = getVendor(c.req.param('id'));
    if (!vendor) {
        return c.json({ success: false, error: 'Not found' }, 404);
    }
    return c.json({ success: true, data: vendor });
});

// Update vendor settings
app.patch('/api/vendor/:id/settings', async (c) => {
    try {
        const body = await c.req.json<Partial<GemFolioVendorSettings>>();
        const vendor = updateVendorSettings(c.req.param('id'), body);
        return c.json({ success: true, data: vendor });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Get Stripe dashboard link
app.get('/api/vendor/:id/dashboard-link', async (c) => {
    try {
        const url = await getDashboardLink(c.req.param('id'));
        return c.json({ success: true, data: { url } });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Vendor Product Management ====================

// List products
app.get('/api/vendor/:id/products', async (c) => {
    const products = listVendorProducts(c.req.param('id'));
    return c.json({ success: true, data: products });
});

// Create product
app.post('/api/vendor/:id/products', async (c) => {
    try {
        const body = await c.req.json<{
            name: string;
            description: string;
            images?: string[];
        }>();

        const product = await createProduct(c.req.param('id'), body);
        return c.json({ success: true, data: product }, 201);
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Update product
app.patch('/api/vendor/:id/products/:productId', async (c) => {
    try {
        const body = await c.req.json<{
            name?: string;
            description?: string;
            images?: string[];
            active?: boolean;
        }>();

        const product = await updateProduct(c.req.param('id'), c.req.param('productId'), body);
        return c.json({ success: true, data: product });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Create price for product
app.post('/api/vendor/:id/products/:productId/prices', async (c) => {
    try {
        const body = await c.req.json<{
            amount: number;
            currency?: string;
            name?: string;
        }>();

        const price = await createPrice(c.req.param('id'), c.req.param('productId'), body);
        return c.json({ success: true, data: price }, 201);
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Vendor Order Management ====================

// List orders
app.get('/api/vendor/:id/orders', async (c) => {
    const vendorOrders = listVendorOrders(c.req.param('id'));
    return c.json({ success: true, data: vendorOrders });
});

// Get order
app.get('/api/vendor/:id/orders/:orderId', async (c) => {
    const order = getOrder(c.req.param('orderId'));
    if (!order || order.vendorId !== c.req.param('id')) {
        return c.json({ success: false, error: 'Not found' }, 404);
    }
    return c.json({ success: true, data: order });
});

// Update order status
app.patch('/api/vendor/:id/orders/:orderId', async (c) => {
    try {
        const body = await c.req.json<{ status: GemFolioOrderStatus }>();
        const order = updateOrderStatus(c.req.param('orderId'), body.status);
        return c.json({ success: true, data: order });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// Refund order
app.post('/api/vendor/:id/orders/:orderId/refund', async (c) => {
    try {
        const body = await c.req.json<{ amount?: number }>();
        await refundOrder(c.req.param('id'), c.req.param('orderId'), body.amount);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 400);
    }
});

// ==================== Webhooks ====================
// Handle Stripe webhooks for all vendors

app.post('/webhooks/stripe', async (c) => {
    const signature = c.req.header('stripe-signature');
    if (!signature) {
        return c.json({ error: 'Missing signature' }, 400);
    }

    try {
        const body = await c.req.text();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

        const event = platformStripe.webhooks.constructEvent(body, signature, webhookSecret);

        // Handle checkout completion
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const vendorId = session.metadata?.gemfolio_vendor;

            if (vendorId) {
                await handleCheckoutComplete(vendorId, session.id, session);
            }
        }

        return c.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return c.json({ error: 'Webhook failed' }, 400);
    }
});

export default app;
export const port = Number(process.env.PORT) || 3002;
