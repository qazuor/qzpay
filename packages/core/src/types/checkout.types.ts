/**
 * Checkout types for QZPay
 */
import type { QZPayCheckoutMode, QZPayCurrency } from '../constants/index.js';
import type { QZPayMetadata } from './common.types.js';

export interface QZPayCheckoutSession {
    id: string;
    customerId: string | null;
    customerEmail: string | null;
    mode: QZPayCheckoutMode;
    status: 'open' | 'complete' | 'expired';
    currency: QZPayCurrency;
    lineItems: QZPayCheckoutLineItem[];
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
    paymentId: string | null;
    subscriptionId: string | null;
    providerSessionIds: Record<string, string>;
    metadata: QZPayMetadata;
    livemode: boolean;
    createdAt: Date;
    completedAt: Date | null;
}

export interface QZPayCheckoutLineItem {
    priceId: string;
    quantity: number;
    description?: string;
}

export interface QZPayCreateCheckoutInput {
    mode: QZPayCheckoutMode;
    lineItems: QZPayCheckoutLineItem[];
    successUrl: string;
    cancelUrl: string;
    customerId?: string;
    customerEmail?: string;
    promoCodeId?: string;
    allowPromoCodes?: boolean;
    metadata?: QZPayMetadata;
    expiresInMinutes?: number;
    notificationUrl?: string;
}

export interface QZPayCheckoutResult {
    session: QZPayCheckoutSession;
    url: string;
}
