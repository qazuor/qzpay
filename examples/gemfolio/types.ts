/**
 * GemFolio - Type Definitions
 *
 * Multi-tenant e-commerce platform where each vendor sells their own products
 */

// Vendor (your client who sells)
export interface GemFolioVendor {
    id: string;
    email: string;
    businessName: string;
    slug: string; // URL slug: gemfolio.com/tienda/{slug}
    stripeAccountId: string; // Stripe Connect account
    webhookSecret: string;
    currency: string;
    active: boolean;
    createdAt: Date;
    settings: GemFolioVendorSettings;
}

export interface GemFolioVendorSettings {
    storeName: string;
    storeDescription?: string;
    logo?: string;
    primaryColor?: string;
    contactEmail: string;
    shippingEnabled: boolean;
    taxRate?: number; // e.g., 0.21 for 21% IVA
}

// Product in vendor's catalog
export interface GemFolioProduct {
    id: string;
    vendorId: string;
    name: string;
    description: string;
    images: string[];
    active: boolean;
    metadata?: Record<string, string>;
    createdAt: Date;
    // Prices are stored separately
}

// Product price
export interface GemFolioPrice {
    id: string;
    productId: string;
    vendorId: string;
    amount: number; // In cents
    currency: string;
    name?: string; // e.g., "Small", "Large"
    active: boolean;
}

// Customer (buyer) - belongs to a vendor
export interface GemFolioCustomer {
    id: string;
    vendorId: string;
    email: string;
    name: string;
    phone?: string;
    address?: GemFolioAddress;
    stripeCustomerId?: string; // Customer ID in vendor's Stripe account
    createdAt: Date;
}

export interface GemFolioAddress {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
}

// Order
export interface GemFolioOrder {
    id: string;
    vendorId: string;
    customerId: string;
    items: GemFolioOrderItem[];
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    currency: string;
    status: GemFolioOrderStatus;
    paymentId?: string;
    shippingAddress?: GemFolioAddress;
    createdAt: Date;
    paidAt?: Date;
    fulfilledAt?: Date;
}

export interface GemFolioOrderItem {
    productId: string;
    priceId: string;
    productName: string;
    quantity: number;
    unitAmount: number;
    total: number;
}

export type GemFolioOrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'canceled' | 'refunded';

// Cart (temporary, before checkout)
export interface GemFolioCart {
    vendorId: string;
    items: GemFolioCartItem[];
    currency: string;
}

export interface GemFolioCartItem {
    productId: string;
    priceId: string;
    quantity: number;
}

// Checkout session
export interface GemFolioCheckoutSession {
    id: string;
    vendorId: string;
    cart: GemFolioCart;
    customerEmail?: string;
    shippingAddress?: GemFolioAddress;
    stripeSessionId?: string;
    status: 'pending' | 'completed' | 'expired';
    createdAt: Date;
    expiresAt: Date;
}
