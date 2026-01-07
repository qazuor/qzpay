/**
 * Type definitions for NestJS + MercadoPago example
 */

// Module configuration
export interface BillingModuleConfig {
    accessToken: string;
    webhookSecret?: string;
    timeout?: number;
}

// DTOs
export interface CreateCustomerDto {
    email: string;
    name?: string;
    externalId: string;
}

export interface CreateSubscriptionDto {
    customerId: string;
    priceId: string;
    trialDays?: number;
}

export interface CreatePaymentDto {
    customerId: string;
    amount: number;
    currency: string;
    paymentMethodId?: string;
    description?: string;
}

export interface RefundPaymentDto {
    amount?: number;
    reason?: string;
}

// Response types
export interface CustomerResponse {
    id: string;
    email: string;
    name: string | null;
    providerCustomerId: string;
    createdAt: Date;
}

export interface SubscriptionResponse {
    id: string;
    customerId: string;
    status: string;
    priceId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
}

export interface PaymentResponse {
    id: string;
    status: string;
    amount: number;
    currency: string;
    customerId: string;
    requires3DS?: boolean;
    challengeUrl?: string;
}

// Webhook types
export interface MercadoPagoWebhookPayload {
    action: string;
    api_version: string;
    data: {
        id: string;
    };
    date_created: string;
    id: string;
    live_mode: boolean;
    type: string;
    user_id: string;
}

// Plan configuration for example
export const PLANS = {
    basic: {
        id: 'plan_basic',
        name: 'Basic',
        priceId: 'price_basic_monthly',
        amount: 999, // $9.99
        currency: 'ARS',
        interval: 'month' as const
    },
    professional: {
        id: 'plan_professional',
        name: 'Professional',
        priceId: 'price_professional_monthly',
        amount: 2999, // $29.99
        currency: 'ARS',
        interval: 'month' as const
    },
    enterprise: {
        id: 'plan_enterprise',
        name: 'Enterprise',
        priceId: 'price_enterprise_monthly',
        amount: 9999, // $99.99
        currency: 'ARS',
        interval: 'month' as const
    }
} as const;

export type PlanId = keyof typeof PLANS;
