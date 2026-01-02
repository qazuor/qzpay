/**
 * MercadoPago adapter types
 */

/**
 * MercadoPago configuration
 */
export interface QZPayMercadoPagoConfig {
    /**
     * MercadoPago Access Token
     * Format: APP_USR-*
     */
    accessToken: string;

    /**
     * Webhook secret for signature verification
     */
    webhookSecret?: string | undefined;

    /**
     * Request timeout in milliseconds
     * @default 5000
     */
    timeout?: number | undefined;

    /**
     * Platform ID for marketplace operations
     */
    platformId?: string | undefined;

    /**
     * Integrator ID for tracking
     */
    integratorId?: string | undefined;
}

/**
 * MercadoPago marketplace/split payment configuration
 */
export interface QZPayMercadoPagoMarketplaceConfig {
    /**
     * Application fee percentage (0-100)
     */
    applicationFeePercent?: number | undefined;

    /**
     * Fixed application fee in cents
     */
    applicationFeeAmount?: number | undefined;
}

/**
 * MercadoPago subscription status mapping
 */
export const MERCADOPAGO_SUBSCRIPTION_STATUS = {
    pending: 'pending',
    authorized: 'active',
    paused: 'paused',
    cancelled: 'canceled'
} as const;

/**
 * MercadoPago payment status mapping
 */
export const MERCADOPAGO_PAYMENT_STATUS = {
    pending: 'pending',
    approved: 'succeeded',
    authorized: 'requires_capture',
    in_process: 'processing',
    in_mediation: 'disputed',
    rejected: 'failed',
    cancelled: 'canceled',
    refunded: 'refunded',
    charged_back: 'disputed'
} as const;

/**
 * MercadoPago webhook event types
 */
export const MERCADOPAGO_WEBHOOK_EVENTS = {
    'payment.created': 'payment.created',
    'payment.updated': 'payment.updated',
    'plan.created': 'plan.created',
    'plan.updated': 'plan.updated',
    'subscription_preapproval.created': 'subscription.created',
    'subscription_preapproval.updated': 'subscription.updated',
    'subscription_authorized_payment.created': 'invoice.paid',
    point_integration_wh: 'point.integration'
} as const;

/**
 * MercadoPago billing interval mapping
 */
export const MERCADOPAGO_BILLING_INTERVAL = {
    day: 'days',
    week: 'days', // MercadoPago uses days, we multiply by 7
    month: 'months',
    year: 'months' // MercadoPago uses months, we multiply by 12
} as const;

/**
 * Helper to convert QZPay interval to MercadoPago format
 */
export function toMercadoPagoInterval(interval: string, count: number): { frequency: number; frequencyType: string } {
    switch (interval) {
        case 'day':
            return { frequency: count, frequencyType: 'days' };
        case 'week':
            return { frequency: count * 7, frequencyType: 'days' };
        case 'month':
            return { frequency: count, frequencyType: 'months' };
        case 'year':
            return { frequency: count * 12, frequencyType: 'months' };
        default:
            return { frequency: count, frequencyType: 'months' };
    }
}

/**
 * Helper to convert MercadoPago interval to QZPay format
 */
export function fromMercadoPagoInterval(frequency: number, frequencyType: string): { interval: string; intervalCount: number } {
    if (frequencyType === 'days') {
        if (frequency % 7 === 0) {
            return { interval: 'week', intervalCount: frequency / 7 };
        }
        return { interval: 'day', intervalCount: frequency };
    }
    if (frequencyType === 'months') {
        if (frequency % 12 === 0) {
            return { interval: 'year', intervalCount: frequency / 12 };
        }
        return { interval: 'month', intervalCount: frequency };
    }
    return { interval: 'month', intervalCount: frequency };
}

/**
 * MercadoPago API response types (simplified)
 */
export interface MercadoPagoCustomer {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    metadata: Record<string, unknown>;
}

export interface MercadoPagoPayment {
    id: number;
    status: string;
    status_detail: string;
    transaction_amount: number;
    currency_id: string;
    payer: {
        id: string | null;
        email: string | null;
    };
    metadata: Record<string, unknown>;
    date_created: string;
    date_approved: string | null;
}

export interface MercadoPagoPreapproval {
    id: string;
    payer_id: number;
    status: string;
    reason: string;
    auto_recurring: {
        frequency: number;
        frequency_type: string;
        transaction_amount: number;
        currency_id: string;
        start_date: string;
        end_date: string | null;
    };
    next_payment_date: string | null;
    date_created: string;
    last_modified: string;
    metadata: Record<string, unknown>;
}

export interface MercadoPagoPreapprovalPlan {
    id: string;
    status: string;
    reason: string;
    auto_recurring: {
        frequency: number;
        frequency_type: string;
        transaction_amount: number;
        currency_id: string;
        billing_day: number | null;
        free_trial: {
            frequency: number;
            frequency_type: string;
        } | null;
    };
    date_created: string;
    last_modified: string;
}

export interface MercadoPagoPreference {
    id: string;
    init_point: string;
    sandbox_init_point: string;
    items: Array<{
        id: string;
        title: string;
        quantity: number;
        unit_price: number;
        currency_id: string;
    }>;
    payer: {
        email: string | null;
    } | null;
    external_reference: string | null;
    metadata: Record<string, unknown>;
    date_created: string;
}

export interface MercadoPagoRefund {
    id: number;
    payment_id: number;
    amount: number;
    status: string;
    date_created: string;
}

export interface MercadoPagoWebhookPayload {
    id: number;
    live_mode: boolean;
    type: string;
    date_created: string;
    user_id: string;
    api_version: string;
    action: string;
    data: {
        id: string;
    };
}
