/**
 * Stripe Mock Helpers
 * Provides mock implementations for Stripe SDK
 */
import type Stripe from 'stripe';
import { vi } from 'vitest';

/**
 * Create a mock Stripe client with all methods mocked
 */
export function createMockStripeClient(): Stripe {
    return {
        customers: {
            create: vi.fn(),
            update: vi.fn(),
            del: vi.fn(),
            retrieve: vi.fn()
        },
        subscriptions: {
            create: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn(),
            retrieve: vi.fn()
        },
        paymentIntents: {
            create: vi.fn(),
            capture: vi.fn(),
            cancel: vi.fn(),
            retrieve: vi.fn()
        },
        refunds: {
            create: vi.fn()
        },
        checkout: {
            sessions: {
                create: vi.fn(),
                retrieve: vi.fn(),
                expire: vi.fn()
            }
        },
        prices: {
            create: vi.fn(),
            update: vi.fn(),
            retrieve: vi.fn()
        },
        products: {
            create: vi.fn()
        },
        accounts: {
            create: vi.fn(),
            update: vi.fn(),
            del: vi.fn(),
            retrieve: vi.fn(),
            createLoginLink: vi.fn()
        },
        accountLinks: {
            create: vi.fn()
        },
        payouts: {
            create: vi.fn(),
            retrieve: vi.fn()
        },
        transfers: {
            create: vi.fn()
        },
        webhooks: {
            constructEvent: vi.fn()
        }
    } as unknown as Stripe;
}

/**
 * Create a mock Stripe customer
 */
export function createMockStripeCustomer(overrides: Partial<Stripe.Customer> = {}): Stripe.Customer {
    return {
        id: 'cus_test123',
        object: 'customer',
        email: 'test@example.com',
        name: 'Test Customer',
        metadata: {},
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        ...overrides
    } as Stripe.Customer;
}

/**
 * Create a mock Stripe subscription
 */
export function createMockStripeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
    const now = Math.floor(Date.now() / 1000);
    return {
        id: 'sub_test123',
        object: 'subscription',
        customer: 'cus_test123',
        status: 'active',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
        metadata: {},
        items: {
            object: 'list',
            data: [
                {
                    id: 'si_test123',
                    price: { id: 'price_test123' },
                    quantity: 1
                }
            ]
        },
        ...overrides
    } as unknown as Stripe.Subscription;
}

/**
 * Create a mock Stripe payment intent
 */
export function createMockStripePaymentIntent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
    return {
        id: 'pi_test123',
        object: 'payment_intent',
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
        customer: 'cus_test123',
        metadata: {},
        ...overrides
    } as Stripe.PaymentIntent;
}

/**
 * Create a mock Stripe refund
 */
export function createMockStripeRefund(overrides: Partial<Stripe.Refund> = {}): Stripe.Refund {
    return {
        id: 're_test123',
        object: 'refund',
        amount: 1000,
        status: 'succeeded',
        payment_intent: 'pi_test123',
        ...overrides
    } as Stripe.Refund;
}

/**
 * Create a mock Stripe checkout session
 */
export function createMockStripeCheckoutSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
    return {
        id: 'cs_test123',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/session/cs_test123',
        status: 'open',
        customer: 'cus_test123',
        payment_intent: 'pi_test123',
        subscription: null,
        metadata: {},
        ...overrides
    } as Stripe.Checkout.Session;
}

/**
 * Create a mock Stripe price
 */
export function createMockStripePrice(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
    return {
        id: 'price_test123',
        object: 'price',
        active: true,
        unit_amount: 1000,
        currency: 'usd',
        recurring: {
            interval: 'month',
            interval_count: 1
        },
        ...overrides
    } as Stripe.Price;
}

/**
 * Create a mock Stripe product
 */
export function createMockStripeProduct(overrides: Partial<Stripe.Product> = {}): Stripe.Product {
    return {
        id: 'prod_test123',
        object: 'product',
        name: 'Test Product',
        active: true,
        ...overrides
    } as Stripe.Product;
}

/**
 * Create a mock Stripe Connect account
 */
export function createMockStripeAccount(overrides: Partial<Stripe.Account> = {}): Stripe.Account {
    return {
        id: 'acct_test123',
        object: 'account',
        type: 'express',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        email: 'vendor@example.com',
        metadata: {},
        ...overrides
    } as Stripe.Account;
}

/**
 * Create a mock Stripe payout
 */
export function createMockStripePayout(overrides: Partial<Stripe.Payout> = {}): Stripe.Payout {
    return {
        id: 'po_test123',
        object: 'payout',
        amount: 10000,
        currency: 'usd',
        status: 'paid',
        arrival_date: Math.floor(Date.now() / 1000) + 86400,
        ...overrides
    } as Stripe.Payout;
}

/**
 * Create a mock Stripe transfer
 */
export function createMockStripeTransfer(overrides: Partial<Stripe.Transfer> = {}): Stripe.Transfer {
    return {
        id: 'tr_test123',
        object: 'transfer',
        amount: 5000,
        currency: 'usd',
        destination: 'acct_test123',
        ...overrides
    } as Stripe.Transfer;
}

/**
 * Create a mock Stripe account link
 */
export function createMockStripeAccountLink(overrides: Partial<Stripe.AccountLink> = {}): Stripe.AccountLink {
    return {
        object: 'account_link',
        url: 'https://connect.stripe.com/setup/e/acct_test123',
        created: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        ...overrides
    } as Stripe.AccountLink;
}

/**
 * Create a mock Stripe login link
 */
export function createMockStripeLoginLink(): Stripe.LoginLink {
    return {
        object: 'login_link',
        url: 'https://connect.stripe.com/express/acct_test123',
        created: Math.floor(Date.now() / 1000)
    } as Stripe.LoginLink;
}

/**
 * Create a mock Stripe webhook event
 */
export function createMockStripeEvent(type: string, data: Record<string, unknown> = {}): Stripe.Event {
    return {
        id: 'evt_test123',
        object: 'event',
        type,
        data: {
            object: {
                id: 'obj_test123',
                ...data
            }
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        api_version: '2024-06-20'
    } as unknown as Stripe.Event;
}
