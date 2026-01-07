/**
 * GemFolio - Product Management
 *
 * Vendors manage their own products and prices
 */
import { getVendorBilling, getVendorStripe } from './config.js';
import { getVendor } from './store.js';
import type { GemFolioPrice, GemFolioProduct } from './types.js';

// In-memory store (use database in production)
const products = new Map<string, GemFolioProduct>();
const prices = new Map<string, GemFolioPrice>();
const productsByVendor = new Map<string, Set<string>>();

/**
 * Create a product for a vendor
 */
export async function createProduct(
    vendorId: string,
    data: {
        name: string;
        description: string;
        images?: string[];
        metadata?: Record<string, string>;
    }
): Promise<GemFolioProduct> {
    const vendor = getVendor(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const billing = getVendorBilling(vendor);

    // Create plan in QZPay (which creates product in vendor's Stripe)
    const plan = await billing.plans.create({
        name: data.name,
        description: data.description,
        active: true,
        metadata: {
            vendorId,
            ...data.metadata
        }
    });

    // Also create product directly in Stripe for images
    const stripe = getVendorStripe(vendor);
    if (data.images && data.images.length > 0) {
        await stripe.products.update(plan.id, {
            images: data.images
        });
    }

    const product: GemFolioProduct = {
        id: plan.id,
        vendorId,
        name: data.name,
        description: data.description,
        images: data.images || [],
        active: true,
        metadata: data.metadata,
        createdAt: new Date()
    };

    products.set(product.id, product);

    // Track by vendor
    if (!productsByVendor.has(vendorId)) {
        productsByVendor.set(vendorId, new Set());
    }
    productsByVendor.get(vendorId)?.add(product.id);

    return product;
}

/**
 * Create a price for a product
 */
export async function createPrice(
    vendorId: string,
    productId: string,
    data: {
        amount: number;
        currency?: string;
        name?: string;
    }
): Promise<GemFolioPrice> {
    const vendor = getVendor(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const product = products.get(productId);
    if (!product || product.vendorId !== vendorId) {
        throw new Error('Product not found');
    }

    const billing = getVendorBilling(vendor);

    // Create price in QZPay
    const qzpayPrice = await billing.prices.create({
        planId: productId,
        amount: data.amount,
        currency: data.currency || vendor.currency,
        metadata: {
            vendorId,
            priceName: data.name || ''
        }
    });

    const price: GemFolioPrice = {
        id: qzpayPrice.id,
        productId,
        vendorId,
        amount: data.amount,
        currency: data.currency || vendor.currency,
        name: data.name,
        active: true
    };

    prices.set(price.id, price);

    return price;
}

/**
 * Get product by ID
 */
export function getProduct(productId: string): GemFolioProduct | undefined {
    return products.get(productId);
}

/**
 * Get price by ID
 */
export function getPrice(priceId: string): GemFolioPrice | undefined {
    return prices.get(priceId);
}

/**
 * List products for a vendor
 */
export function listVendorProducts(vendorId: string): GemFolioProduct[] {
    const productIds = productsByVendor.get(vendorId);
    if (!productIds) return [];

    return Array.from(productIds)
        .map((id) => products.get(id))
        .filter((p): p is GemFolioProduct => p?.active);
}

/**
 * List prices for a product
 */
export function listProductPrices(productId: string): GemFolioPrice[] {
    return Array.from(prices.values()).filter((p) => p.productId === productId && p.active);
}

/**
 * Update product
 */
export async function updateProduct(
    vendorId: string,
    productId: string,
    data: Partial<Pick<GemFolioProduct, 'name' | 'description' | 'images' | 'active'>>
): Promise<GemFolioProduct> {
    const vendor = getVendor(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found');
    }

    const product = products.get(productId);
    if (!product || product.vendorId !== vendorId) {
        throw new Error('Product not found');
    }

    // Update in Stripe
    const stripe = getVendorStripe(vendor);
    await stripe.products.update(productId, {
        name: data.name,
        description: data.description,
        images: data.images,
        active: data.active
    });

    // Update local
    Object.assign(product, data);
    products.set(productId, product);

    return product;
}

/**
 * Deactivate product
 */
export async function deactivateProduct(vendorId: string, productId: string): Promise<void> {
    await updateProduct(vendorId, productId, { active: false });
}

/**
 * Get full catalog for a vendor's store
 */
export function getStoreCatalog(vendorId: string): Array<GemFolioProduct & { prices: GemFolioPrice[] }> {
    const vendorProducts = listVendorProducts(vendorId);

    return vendorProducts.map((product) => ({
        ...product,
        prices: listProductPrices(product.id)
    }));
}
