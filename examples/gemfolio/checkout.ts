/**
 * GemFolio - Checkout Process
 *
 * Handles the checkout flow where buyers purchase from vendors
 */
import { getVendorStripe } from './config.js';
import { getPrice, getProduct } from './products.js';
import { getVendor } from './store.js';
import type {
    GemFolioAddress,
    GemFolioCart,
    GemFolioCheckoutSession,
    GemFolioCustomer,
    GemFolioOrder,
    GemFolioOrderStatus
} from './types.js';

// In-memory stores (use database in production)
const customers = new Map<string, GemFolioCustomer>();
const orders = new Map<string, GemFolioOrder>();
const checkoutSessions = new Map<string, GemFolioCheckoutSession>();

/**
 * Create or get a customer for a vendor
 */
export async function getOrCreateCustomer(
    vendorId: string,
    data: {
        email: string;
        name: string;
        phone?: string;
    }
): Promise<GemFolioCustomer> {
    // Check if customer exists for this vendor
    const existing = Array.from(customers.values()).find((c) => c.vendorId === vendorId && c.email === data.email);

    if (existing) {
        return existing;
    }

    const vendor = getVendor(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    // Create customer in vendor's Stripe account
    const stripe = getVendorStripe(vendor);
    const stripeCustomer = await stripe.customers.create({
        email: data.email,
        name: data.name,
        phone: data.phone,
        metadata: {
            gemfolio_vendor: vendorId
        }
    });

    const customer: GemFolioCustomer = {
        id: `cus_${Date.now()}`,
        vendorId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        stripeCustomerId: stripeCustomer.id,
        createdAt: new Date()
    };

    customers.set(customer.id, customer);

    return customer;
}

/**
 * Calculate cart totals
 */
export function calculateCartTotals(cart: GemFolioCart): {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    items: Array<{
        productId: string;
        priceId: string;
        productName: string;
        quantity: number;
        unitAmount: number;
        total: number;
    }>;
} {
    const vendor = getVendor(cart.vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const items = cart.items.map((item) => {
        const product = getProduct(item.productId);
        const price = getPrice(item.priceId);

        if (!product || !price) {
            throw new Error(`Product or price not found: ${item.productId}`);
        }

        return {
            productId: item.productId,
            priceId: item.priceId,
            productName: product.name,
            quantity: item.quantity,
            unitAmount: price.amount,
            total: price.amount * item.quantity
        };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = vendor.settings.taxRate ? Math.round(subtotal * vendor.settings.taxRate) : 0;
    const shipping = vendor.settings.shippingEnabled ? 500 : 0; // Flat $5 shipping for example

    return {
        subtotal,
        tax,
        shipping,
        total: subtotal + tax + shipping,
        items
    };
}

/**
 * Create a checkout session
 */
export async function createCheckoutSession(
    vendorId: string,
    cart: GemFolioCart,
    options: {
        successUrl: string;
        cancelUrl: string;
        customerEmail?: string;
        shippingAddress?: GemFolioAddress;
    }
): Promise<{ sessionId: string; checkoutUrl: string }> {
    const vendor = getVendor(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    if (!vendor.active) {
        throw new Error('Vendor is not active');
    }

    const totals = calculateCartTotals(cart);
    const stripe = getVendorStripe(vendor);

    // Build line items for Stripe Checkout
    const lineItems = totals.items.map((item) => ({
        price_data: {
            currency: cart.currency || vendor.currency,
            product_data: {
                name: item.productName
            },
            unit_amount: item.unitAmount
        },
        quantity: item.quantity
    }));

    // Add tax line if applicable
    if (totals.tax > 0) {
        lineItems.push({
            price_data: {
                currency: cart.currency || vendor.currency,
                product_data: {
                    name: 'Tax'
                },
                unit_amount: totals.tax
            },
            quantity: 1
        });
    }

    // Add shipping if applicable
    if (totals.shipping > 0) {
        lineItems.push({
            price_data: {
                currency: cart.currency || vendor.currency,
                product_data: {
                    name: 'Shipping'
                },
                unit_amount: totals.shipping
            },
            quantity: 1
        });
    }

    // Create Stripe Checkout Session
    const stripeSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        customer_email: options.customerEmail,
        metadata: {
            gemfolio_vendor: vendorId,
            gemfolio_cart: JSON.stringify(cart.items)
        },
        shipping_address_collection: vendor.settings.shippingEnabled ? { allowed_countries: ['US', 'AR', 'MX', 'ES', 'BR'] } : undefined
    });

    // Store checkout session
    const session: GemFolioCheckoutSession = {
        id: `checkout_${Date.now()}`,
        vendorId,
        cart,
        customerEmail: options.customerEmail,
        shippingAddress: options.shippingAddress,
        stripeSessionId: stripeSession.id,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    };

    checkoutSessions.set(session.id, session);

    return {
        sessionId: session.id,
        checkoutUrl: stripeSession.url!
    };
}

/**
 * Handle successful checkout (called from webhook)
 */
export async function handleCheckoutComplete(
    vendorId: string,
    stripeSessionId: string,
    stripeSession: {
        customer_email?: string | null;
        customer_details?: { name?: string | null; phone?: string | null } | null;
        payment_intent?: string | null;
        metadata?: Record<string, string> | null;
        shipping_details?: { address?: Record<string, string | null> | null } | null;
    }
): Promise<GemFolioOrder> {
    // Find our checkout session
    const session = Array.from(checkoutSessions.values()).find((s) => s.stripeSessionId === stripeSessionId && s.vendorId === vendorId);

    if (!session) {
        throw new Error('Checkout session not found');
    }

    // Get or create customer
    const customer = await getOrCreateCustomer(vendorId, {
        email: stripeSession.customer_email || session.customerEmail || 'unknown@email.com',
        name: stripeSession.customer_details?.name || 'Customer',
        phone: stripeSession.customer_details?.phone || undefined
    });

    // Calculate totals
    const totals = calculateCartTotals(session.cart);

    // Create order
    const order: GemFolioOrder = {
        id: `order_${Date.now()}`,
        vendorId,
        customerId: customer.id,
        items: totals.items,
        subtotal: totals.subtotal,
        tax: totals.tax,
        shipping: totals.shipping,
        total: totals.total,
        currency: session.cart.currency,
        status: 'paid',
        paymentId: stripeSession.payment_intent || undefined,
        shippingAddress: session.shippingAddress || parseShippingAddress(stripeSession.shipping_details?.address),
        createdAt: session.createdAt,
        paidAt: new Date()
    };

    orders.set(order.id, order);

    // Update checkout session status
    session.status = 'completed';
    checkoutSessions.set(session.id, session);

    console.log(`[GemFolio] Order created: ${order.id} for vendor ${vendorId}`);

    return order;
}

/**
 * Get order by ID
 */
export function getOrder(orderId: string): GemFolioOrder | undefined {
    return orders.get(orderId);
}

/**
 * List orders for a vendor
 */
export function listVendorOrders(vendorId: string): GemFolioOrder[] {
    return Array.from(orders.values())
        .filter((o) => o.vendorId === vendorId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Update order status
 */
export function updateOrderStatus(orderId: string, status: GemFolioOrderStatus): GemFolioOrder {
    const order = orders.get(orderId);
    if (!order) {
        throw new Error('Order not found');
    }

    order.status = status;
    if (status === 'shipped' || status === 'delivered') {
        order.fulfilledAt = new Date();
    }

    orders.set(orderId, order);

    return order;
}

/**
 * Process refund
 */
export async function refundOrder(vendorId: string, orderId: string, amount?: number): Promise<void> {
    const vendor = getVendor(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const order = orders.get(orderId);
    if (!order || order.vendorId !== vendorId) {
        throw new Error('Order not found');
    }

    if (!order.paymentId) {
        throw new Error('No payment to refund');
    }

    const stripe = getVendorStripe(vendor);

    await stripe.refunds.create({
        payment_intent: order.paymentId,
        amount: amount // undefined = full refund
    });

    order.status = 'refunded';
    orders.set(orderId, order);
}

// Helper
function parseShippingAddress(address?: Record<string, string | null> | null): GemFolioAddress | undefined {
    if (!address) return undefined;

    return {
        line1: address.line1 || '',
        line2: address.line2 || undefined,
        city: address.city || '',
        state: address.state || undefined,
        postalCode: address.postal_code || '',
        country: address.country || ''
    };
}
