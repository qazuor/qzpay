/**
 * MercadoPago adapter types
 */

import type { RetryConfig } from './utils/retry.utils.js';

/**
 * MercadoPago configuration
 */
export interface QZPayMercadoPagoConfig {
    /**
     * MercadoPago Access Token
     * Format: APP_USR-* or TEST-*
     *
     * @remarks
     * Must start with 'APP_USR-' (production) or 'TEST-' (sandbox).
     * Validated at adapter initialization.
     *
     * @throws {Error} If token does not start with 'APP_USR-' or 'TEST-'
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

    /**
     * Retry configuration for transient errors
     *
     * @remarks
     * Automatically retries operations that fail due to:
     * - Network errors / timeouts
     * - Rate limiting (429)
     * - Server errors (5xx)
     *
     * Does NOT retry:
     * - Validation errors (400)
     * - Authentication errors (401, 403)
     * - Not found errors (404)
     * - Card errors
     * - Duplicate transaction errors
     *
     * @default { enabled: true, maxAttempts: 3, initialDelayMs: 1000 }
     */
    retry?: Partial<RetryConfig>;
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

// ==================== 3D Secure Types ====================

/**
 * 3D Secure mode for card payments
 */
export type QZPayMP3DSMode = 'not_supported' | 'optional' | 'mandatory';

/**
 * 3D Secure configuration for payment creation
 */
export interface QZPayMP3DSConfig {
    /** 3DS mode: not_supported, optional, or mandatory */
    mode: QZPayMP3DSMode;
    /** Challenge preference: indicates desired 3DS challenge behavior */
    challengePreference?: 'no_preference' | 'challenge_requested' | 'challenge_required';
}

/**
 * 3D Secure authentication result
 */
export interface QZPayMP3DSResult {
    /** Authentication status */
    status: 'authenticated' | 'challenge_required' | 'failed' | 'not_required';
    /** 3DS version used */
    version?: string | undefined;
    /** Authentication status from 3DS server */
    authenticationStatus?: string | undefined;
    /** Cardholder Authentication Verification Value */
    cavv?: string | undefined;
    /** Electronic Commerce Indicator */
    eci?: string | undefined;
    /** Transaction ID for 3DS 1.0 */
    xid?: string | undefined;
}

/**
 * Check if a payment requires 3DS authentication
 */
export function isMP3DSRequired(status: string, statusDetail: string): boolean {
    // MercadoPago indicates 3DS required in status_detail
    return status === 'pending' && statusDetail === 'pending_challenge';
}

/**
 * Extract 3DS result from MercadoPago payment response
 */
export function extractMP3DSResult(
    threeDSecureInfo:
        | {
              version?: string;
              authentication_status?: string;
              cavv?: string;
              eci?: string;
              xid?: string;
          }
        | null
        | undefined
): QZPayMP3DSResult | null {
    if (!threeDSecureInfo) {
        return null;
    }

    const authStatus = threeDSecureInfo.authentication_status?.toLowerCase();

    let status: QZPayMP3DSResult['status'];
    if (authStatus === 'y' || authStatus === 'a') {
        status = 'authenticated';
    } else if (authStatus === 'c') {
        status = 'challenge_required';
    } else if (authStatus === 'n' || authStatus === 'r' || authStatus === 'u') {
        status = 'failed';
    } else {
        status = 'not_required';
    }

    return {
        status,
        version: threeDSecureInfo.version,
        authenticationStatus: threeDSecureInfo.authentication_status,
        cavv: threeDSecureInfo.cavv,
        eci: threeDSecureInfo.eci,
        xid: threeDSecureInfo.xid
    };
}

/**
 * Map QZPay 3DS mode to MercadoPago parameter
 */
export function mapQZPayToMP3DSMode(mode: QZPayMP3DSMode): string {
    switch (mode) {
        case 'mandatory':
            return 'mandatory';
        case 'optional':
            return 'optional';
        default:
            return 'not_supported';
    }
}

// ==================== Split Payment Types ====================

/**
 * Split payment disbursement configuration
 */
export interface QZPayMPSplitPaymentDisbursement {
    /**
     * Collector account ID (merchant receiving the split)
     */
    collectorId: string;

    /**
     * Amount to disburse in cents
     */
    amount: number;

    /**
     * External reference for tracking
     */
    externalReference?: string;

    /**
     * Application fee to charge on this split
     */
    applicationFee?: number;

    /**
     * Money release date
     */
    moneyReleaseDate?: Date;
}

/**
 * Split payment configuration
 */
export interface QZPayMPSplitPaymentConfig {
    /**
     * Primary payment amount in cents
     */
    primaryAmount: number;

    /**
     * List of disbursements (splits)
     */
    disbursements: QZPayMPSplitPaymentDisbursement[];

    /**
     * Platform fee in cents
     */
    platformFee?: number;

    /**
     * Money release type
     */
    moneyReleaseType?: 'immediately' | 'scheduled';
}

/**
 * Split payment result
 */
export interface QZPayMPSplitPaymentResult {
    paymentId: string;
    status: string;
    primaryPayment: {
        amount: number;
        collectorId: string;
    };
    disbursements: Array<{
        id: string;
        collectorId: string;
        amount: number;
        status: string;
    }>;
    platformFee: number;
    created: Date;
}

// ==================== IPN (Instant Payment Notification) Types ====================

/**
 * IPN notification types
 */
export type QZPayMPIPNType =
    | 'payment'
    | 'plan'
    | 'subscription'
    | 'invoice'
    | 'point_integration_wh'
    | 'delivery'
    | 'topic'
    | 'merchant_order'
    | 'chargebacks'
    | 'test';

/**
 * IPN notification actions
 */
export type QZPayMPIPNAction =
    | 'created'
    | 'updated'
    | 'payment.created'
    | 'payment.updated'
    | 'state_FINISHED'
    | 'state_CANCELED'
    | 'state_ERROR';

/**
 * Full IPN notification payload
 */
export interface QZPayMPIPNNotification {
    id: number;
    liveMode: boolean;
    type: QZPayMPIPNType;
    dateCreated: Date;
    applicationId: string;
    userId: string;
    version: number;
    apiVersion: string;
    action: QZPayMPIPNAction;
    data: {
        id: string;
        [key: string]: unknown;
    };
}

/**
 * IPN payment details (fetched after notification)
 */
export interface QZPayMPIPNPaymentDetails {
    id: string;
    status: string;
    statusDetail: string;
    operationType: string;
    dateCreated: Date;
    dateApproved?: Date;
    dateLastUpdated: Date;
    moneyReleaseDate?: Date;
    paymentMethodId: string;
    paymentTypeId: string;
    transactionAmount: number;
    transactionAmountRefunded: number;
    netReceivedAmount: number;
    currencyId: string;
    externalReference?: string;
    payer: {
        id?: string;
        email?: string;
        identification?: {
            type: string;
            number: string;
        };
    };
    metadata: Record<string, unknown>;
    additionalInfo?: {
        items?: Array<{
            id: string;
            title: string;
            quantity: number;
            unitPrice: number;
        }>;
    };
    threeDSecureInfo?: {
        version?: string;
        authenticationStatus?: string;
        cavv?: string;
        eci?: string;
        xid?: string;
    };
}

// ==================== Payment Method Types ====================

/**
 * Supported MercadoPago payment methods
 */
export type QZPayMPPaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'debit_card' | 'account_money' | 'ticket' | 'bank_transfer';

/**
 * Payment method details
 */
export interface QZPayMPPaymentMethodDetails {
    id: string;
    name: string;
    type: QZPayMPPaymentMethod;
    status: 'active' | 'deferred_capture' | 'not_available';
    secureThumbnail?: string;
    thumbnail?: string;
    processingModes: string[];
    minAllowedAmount?: number;
    maxAllowedAmount?: number;
    accreditationTime?: number;
}

/**
 * Card token for secure payments
 */
export interface QZPayMPCardToken {
    id: string;
    cardId?: string;
    firstSixDigits: string;
    lastFourDigits: string;
    expirationMonth: number;
    expirationYear: number;
    cardholder: {
        name: string;
        identification?: {
            type: string;
            number: string;
        };
    };
    securityCodeLength: number;
    dateCreated: Date;
    dateLastUpdated: Date;
    dateDue: Date;
    liveMode: boolean;
}

// ==================== Advanced Webhook Event Mapping ====================

/**
 * Extended webhook event map with all MercadoPago events
 */
export const MERCADOPAGO_WEBHOOK_EVENTS_EXTENDED = {
    // Payment events
    'payment.created': 'payment.created',
    'payment.updated': 'payment.updated',
    payment: 'payment.updated',

    // Subscription/Preapproval events
    'subscription_preapproval.created': 'subscription.created',
    'subscription_preapproval.updated': 'subscription.updated',
    'subscription_preapproval_plan.created': 'plan.created',
    'subscription_preapproval_plan.updated': 'plan.updated',
    'subscription_authorized_payment.created': 'invoice.paid',
    'subscription_authorized_payment.updated': 'invoice.updated',

    // Plan events
    'plan.created': 'plan.created',
    'plan.updated': 'plan.updated',

    // Invoice events (authorized payments)
    'invoice.created': 'invoice.created',
    'invoice.updated': 'invoice.updated',

    // Merchant order events
    'merchant_order.created': 'order.created',
    'merchant_order.updated': 'order.updated',

    // Chargeback events
    'chargebacks.created': 'dispute.created',
    'chargebacks.updated': 'dispute.updated',
    chargebacks: 'dispute.updated',

    // Point integration events
    point_integration_wh: 'point.integration',
    'point_integration_wh.state_FINISHED': 'point.finished',
    'point_integration_wh.state_CANCELED': 'point.canceled',
    'point_integration_wh.state_ERROR': 'point.error',

    // Delivery events (shipping)
    'delivery.created': 'delivery.created',
    'delivery.updated': 'delivery.updated',

    // Topic-based events (legacy IPN)
    topic: 'topic.notification'
} as const;

// ==================== Webhook Utilities ====================

/**
 * Check if event is a chargeback (dispute) event
 */
export function isMPChargebackEvent(eventType: string): boolean {
    return eventType.toLowerCase().includes('chargeback');
}

/**
 * Check if event requires immediate action
 */
export function mpEventRequiresAction(eventType: string): boolean {
    const urgentEvents = ['chargebacks.created', 'chargebacks', 'payment.updated'];
    return urgentEvents.some((e) => eventType.includes(e));
}

/**
 * Extract payment status from MercadoPago status
 */
export function mapMPPaymentStatus(mpStatus: string): string {
    const statusMap: Record<string, string> = MERCADOPAGO_PAYMENT_STATUS;
    return statusMap[mpStatus] ?? mpStatus;
}

/**
 * Payment status detail mapping
 */
export const MERCADOPAGO_STATUS_DETAIL = {
    // Approved
    accredited: 'Payment accredited',

    // Pending
    pending_contingency: 'Payment pending - contingency',
    pending_review_manual: 'Payment pending - manual review',
    pending_waiting_payment: 'Waiting for payment',
    pending_waiting_transfer: 'Waiting for transfer',

    // Rejected
    cc_rejected_bad_filled_card_number: 'Invalid card number',
    cc_rejected_bad_filled_date: 'Invalid expiration date',
    cc_rejected_bad_filled_other: 'Invalid card data',
    cc_rejected_bad_filled_security_code: 'Invalid security code',
    cc_rejected_blacklist: 'Card blacklisted',
    cc_rejected_call_for_authorize: 'Call for authorization required',
    cc_rejected_card_disabled: 'Card disabled',
    cc_rejected_card_error: 'Card error',
    cc_rejected_duplicated_payment: 'Duplicated payment',
    cc_rejected_high_risk: 'High risk - rejected',
    cc_rejected_insufficient_amount: 'Insufficient funds',
    cc_rejected_invalid_installments: 'Invalid installments',
    cc_rejected_max_attempts: 'Max attempts exceeded',
    cc_rejected_other_reason: 'Rejected - other reason'
} as const;

/**
 * Get human-readable status detail message
 */
export function getMPStatusDetailMessage(statusDetail: string): string {
    const messages: Record<string, string> = MERCADOPAGO_STATUS_DETAIL;
    return messages[statusDetail] ?? statusDetail;
}

// ==================== IPN Handler Types ====================

/**
 * IPN handler function type
 */
export type QZPayMPIPNHandler = (notification: QZPayMPIPNNotification) => Promise<void>;

/**
 * IPN handler registry
 */
export type QZPayMPIPNHandlerMap = Partial<Record<QZPayMPIPNType, QZPayMPIPNHandler>>;

/**
 * IPN processing result
 */
export interface QZPayMPIPNResult {
    processed: boolean;
    eventType: QZPayMPIPNType;
    action: QZPayMPIPNAction;
    resourceId: string;
    error?: string;
}
