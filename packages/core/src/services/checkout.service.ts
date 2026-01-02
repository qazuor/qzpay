/**
 * Checkout service helpers for QZPay
 *
 * Provides utilities for checkout session management, validation,
 * and URL generation.
 */
import type { QZPayCheckoutMode, QZPayCurrency } from '../constants/index.js';
import type {
    QZPayCheckoutLineItem,
    QZPayCheckoutResult,
    QZPayCheckoutSession,
    QZPayCreateCheckoutInput,
    QZPayPrice
} from '../types/index.js';
import { qzpayGenerateId } from '../utils/hash.utils.js';

// ==================== Types ====================

/**
 * Checkout session status
 */
export type QZPayCheckoutStatus = 'open' | 'complete' | 'expired';

/**
 * Checkout validation result
 */
export interface QZPayCheckoutValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Checkout totals
 */
export interface QZPayCheckoutTotals {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    currency: QZPayCurrency;
}

/**
 * Options for creating checkout session
 */
export interface QZPayCheckoutOptions {
    defaultExpirationMinutes?: number;
    requireCustomer?: boolean;
    allowedModes?: QZPayCheckoutMode[];
}

// ==================== Session Helpers ====================

/**
 * Create a new checkout session
 */
export function qzpayCreateCheckoutSession(
    input: QZPayCreateCheckoutInput,
    livemode: boolean,
    currency: QZPayCurrency = 'USD'
): QZPayCheckoutSession {
    const now = new Date();
    const expirationMinutes = input.expiresInMinutes ?? 30;
    const expiresAt = new Date(now.getTime() + expirationMinutes * 60 * 1000);

    return {
        id: qzpayGenerateId('cs'),
        customerId: input.customerId ?? null,
        customerEmail: input.customerEmail ?? null,
        mode: input.mode,
        status: 'open',
        currency,
        lineItems: input.lineItems,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        expiresAt,
        paymentId: null,
        subscriptionId: null,
        providerSessionIds: {},
        metadata: input.metadata ?? {},
        livemode,
        createdAt: now,
        completedAt: null
    };
}

/**
 * Check if a checkout session is expired
 */
export function qzpayCheckoutIsExpired(session: QZPayCheckoutSession): boolean {
    return new Date() > session.expiresAt;
}

/**
 * Check if a checkout session is open
 */
export function qzpayCheckoutIsOpen(session: QZPayCheckoutSession): boolean {
    return session.status === 'open' && !qzpayCheckoutIsExpired(session);
}

/**
 * Check if a checkout session is complete
 */
export function qzpayCheckoutIsComplete(session: QZPayCheckoutSession): boolean {
    return session.status === 'complete';
}

/**
 * Get time remaining until expiration
 */
export function qzpayGetCheckoutTimeRemaining(session: QZPayCheckoutSession): number {
    const remaining = session.expiresAt.getTime() - Date.now();
    return Math.max(0, remaining);
}

/**
 * Get time remaining in minutes
 */
export function qzpayGetCheckoutMinutesRemaining(session: QZPayCheckoutSession): number {
    return Math.ceil(qzpayGetCheckoutTimeRemaining(session) / (60 * 1000));
}

// ==================== Validation Helpers ====================

/**
 * Validate checkout input
 */
export function qzpayValidateCheckoutInput(
    input: QZPayCreateCheckoutInput,
    options: QZPayCheckoutOptions = {}
): QZPayCheckoutValidationResult {
    const errors: string[] = [];

    // Check mode
    if (options.allowedModes && !options.allowedModes.includes(input.mode)) {
        errors.push(`Checkout mode '${input.mode}' is not allowed`);
    }

    // Check customer requirement
    if (options.requireCustomer && !input.customerId && !input.customerEmail) {
        errors.push('Customer ID or email is required');
    }

    // Check line items
    if (!input.lineItems || input.lineItems.length === 0) {
        errors.push('At least one line item is required');
    }

    for (let i = 0; i < input.lineItems.length; i++) {
        const item = input.lineItems[i];
        if (!item) continue;
        if (!item.priceId) {
            errors.push(`Line item ${i + 1}: Price ID is required`);
        }
        if (!item.quantity || item.quantity < 1) {
            errors.push(`Line item ${i + 1}: Quantity must be at least 1`);
        }
    }

    // Check URLs
    if (!input.successUrl) {
        errors.push('Success URL is required');
    } else if (!isValidUrl(input.successUrl)) {
        errors.push('Success URL is not a valid URL');
    }

    if (!input.cancelUrl) {
        errors.push('Cancel URL is required');
    } else if (!isValidUrl(input.cancelUrl)) {
        errors.push('Cancel URL is not a valid URL');
    }

    // Check subscription mode requirements
    if (input.mode === 'subscription') {
        if (input.lineItems.length !== 1) {
            errors.push('Subscription mode requires exactly one line item');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate URL
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate checkout session can be completed
 */
export function qzpayCanCompleteCheckout(session: QZPayCheckoutSession): QZPayCheckoutValidationResult {
    const errors: string[] = [];

    if (session.status !== 'open') {
        errors.push(`Cannot complete checkout: session is ${session.status}`);
    }

    if (qzpayCheckoutIsExpired(session)) {
        errors.push('Cannot complete checkout: session has expired');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// ==================== Totals Calculation ====================

/**
 * Calculate checkout totals from line items and prices
 */
export function qzpayCalculateCheckoutTotals(
    lineItems: QZPayCheckoutLineItem[],
    prices: Map<string, QZPayPrice>,
    discountAmount = 0,
    taxRate = 0
): QZPayCheckoutTotals {
    let subtotal = 0;
    let currency: QZPayCurrency = 'USD';

    for (const item of lineItems) {
        const price = prices.get(item.priceId);
        if (price) {
            subtotal += price.unitAmount * item.quantity;
            currency = price.currency;
        }
    }

    const discount = Math.min(subtotal, discountAmount);
    const taxableAmount = subtotal - discount;
    const tax = Math.round(taxableAmount * taxRate);
    const total = taxableAmount + tax;

    return {
        subtotal,
        discount,
        tax,
        total,
        currency
    };
}

/**
 * Calculate simple checkout total without price lookup
 */
export function qzpayCalculateSimpleTotal(amounts: number[], discountAmount = 0): number {
    const subtotal = amounts.reduce((sum, amount) => sum + amount, 0);
    return Math.max(0, subtotal - discountAmount);
}

// ==================== URL Helpers ====================

/**
 * Build success URL with session ID
 */
export function qzpayBuildSuccessUrl(baseUrl: string, sessionId: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set('session_id', sessionId);
    return url.toString();
}

/**
 * Build cancel URL with session ID
 */
export function qzpayBuildCancelUrl(baseUrl: string, sessionId: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set('session_id', sessionId);
    url.searchParams.set('canceled', 'true');
    return url.toString();
}

/**
 * Extract session ID from URL
 */
export function qzpayExtractSessionIdFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.searchParams.get('session_id');
    } catch {
        return null;
    }
}

// ==================== State Transitions ====================

/**
 * Mark checkout as complete
 */
export function qzpayCompleteCheckout(session: QZPayCheckoutSession, paymentId?: string, subscriptionId?: string): QZPayCheckoutSession {
    return {
        ...session,
        status: 'complete',
        paymentId: paymentId ?? session.paymentId,
        subscriptionId: subscriptionId ?? session.subscriptionId,
        completedAt: new Date()
    };
}

/**
 * Mark checkout as expired
 */
export function qzpayExpireCheckout(session: QZPayCheckoutSession): QZPayCheckoutSession {
    return {
        ...session,
        status: 'expired'
    };
}

/**
 * Add provider session ID
 */
export function qzpayAddProviderSession(session: QZPayCheckoutSession, provider: string, providerSessionId: string): QZPayCheckoutSession {
    return {
        ...session,
        providerSessionIds: {
            ...session.providerSessionIds,
            [provider]: providerSessionId
        }
    };
}

// ==================== Line Item Helpers ====================

/**
 * Add line item to checkout
 */
export function qzpayAddLineItem(session: QZPayCheckoutSession, lineItem: QZPayCheckoutLineItem): QZPayCheckoutSession {
    // Check if price already exists
    const existingIndex = session.lineItems.findIndex((item) => item.priceId === lineItem.priceId);

    if (existingIndex >= 0) {
        // Update quantity
        const updatedItems = [...session.lineItems];
        const existingItem = updatedItems[existingIndex];
        if (existingItem) {
            updatedItems[existingIndex] = {
                ...existingItem,
                quantity: existingItem.quantity + lineItem.quantity
            };
        }
        return { ...session, lineItems: updatedItems };
    }

    return {
        ...session,
        lineItems: [...session.lineItems, lineItem]
    };
}

/**
 * Remove line item from checkout
 */
export function qzpayRemoveLineItem(session: QZPayCheckoutSession, priceId: string): QZPayCheckoutSession {
    return {
        ...session,
        lineItems: session.lineItems.filter((item) => item.priceId !== priceId)
    };
}

/**
 * Update line item quantity
 */
export function qzpayUpdateLineItemQuantity(session: QZPayCheckoutSession, priceId: string, quantity: number): QZPayCheckoutSession {
    if (quantity < 1) {
        return qzpayRemoveLineItem(session, priceId);
    }

    return {
        ...session,
        lineItems: session.lineItems.map((item) => (item.priceId === priceId ? { ...item, quantity } : item))
    };
}

/**
 * Get total quantity of items
 */
export function qzpayGetTotalQuantity(session: QZPayCheckoutSession): number {
    return session.lineItems.reduce((sum, item) => sum + item.quantity, 0);
}

// ==================== Customer Helpers ====================

/**
 * Associate customer with checkout
 */
export function qzpaySetCheckoutCustomer(session: QZPayCheckoutSession, customerId: string, customerEmail?: string): QZPayCheckoutSession {
    return {
        ...session,
        customerId,
        customerEmail: customerEmail ?? session.customerEmail
    };
}

/**
 * Check if checkout has customer
 */
export function qzpayCheckoutHasCustomer(session: QZPayCheckoutSession): boolean {
    return session.customerId !== null;
}

// ==================== Result Helpers ====================

/**
 * Create checkout result with URL
 */
export function qzpayCreateCheckoutResult(session: QZPayCheckoutSession, checkoutUrl: string): QZPayCheckoutResult {
    return {
        session,
        url: checkoutUrl
    };
}

/**
 * Determine if checkout result was successful
 */
export function qzpayCheckoutResultIsSuccess(result: QZPayCheckoutResult): boolean {
    return result.session.status === 'complete';
}
