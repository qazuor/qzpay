import type { QZPayPaymentWebhookAdapter, QZPayWebhookEvent } from '@qazuor/qzpay-core';
/**
 * Stripe Webhook Adapter
 *
 * Implements QZPayPaymentWebhookAdapter for Stripe webhooks
 */
import type Stripe from 'stripe';

export class QZPayStripeWebhookAdapter implements QZPayPaymentWebhookAdapter {
    constructor(
        private readonly stripe: Stripe,
        private readonly webhookSecret: string
    ) {}

    /**
     * Construct and verify a webhook event from Stripe
     */
    constructEvent(payload: string | Buffer, signature: string): QZPayWebhookEvent {
        const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);

        return {
            id: event.id,
            type: event.type,
            data: event.data.object,
            created: new Date(event.created * 1000)
        };
    }

    /**
     * Verify webhook signature
     */
    verifySignature(payload: string | Buffer, signature: string): boolean {
        try {
            this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Map Stripe webhook event type to QZPay billing event
 */
export function mapStripeEventToQZPayEvent(stripeEventType: string): string | null {
    const eventMap: Record<string, string> = {
        // Customer events
        'customer.created': 'customer.created',
        'customer.updated': 'customer.updated',
        'customer.deleted': 'customer.deleted',

        // Subscription events
        'customer.subscription.created': 'subscription.created',
        'customer.subscription.updated': 'subscription.updated',
        'customer.subscription.deleted': 'subscription.canceled',
        'customer.subscription.paused': 'subscription.paused',
        'customer.subscription.resumed': 'subscription.resumed',
        'customer.subscription.trial_will_end': 'subscription.trial_ending',
        'customer.subscription.pending_update_applied': 'subscription.pending_update_applied',
        'customer.subscription.pending_update_expired': 'subscription.pending_update_expired',

        // Invoice events
        'invoice.created': 'invoice.created',
        'invoice.finalized': 'invoice.finalized',
        'invoice.paid': 'invoice.paid',
        'invoice.payment_failed': 'invoice.payment_failed',
        'invoice.payment_action_required': 'invoice.payment_action_required',
        'invoice.voided': 'invoice.voided',
        'invoice.marked_uncollectible': 'invoice.marked_uncollectible',
        'invoice.upcoming': 'invoice.upcoming',

        // Payment Intent events (including 3DS/SCA)
        'payment_intent.created': 'payment.created',
        'payment_intent.succeeded': 'payment.succeeded',
        'payment_intent.payment_failed': 'payment.failed',
        'payment_intent.canceled': 'payment.canceled',
        'payment_intent.requires_action': 'payment.requires_action',
        'payment_intent.processing': 'payment.processing',
        'payment_intent.amount_capturable_updated': 'payment.amount_capturable_updated',
        'payment_intent.partially_funded': 'payment.partially_funded',

        // Setup Intent events (3DS for payment method setup)
        'setup_intent.created': 'setup_intent.created',
        'setup_intent.requires_action': 'setup_intent.requires_action',
        'setup_intent.succeeded': 'setup_intent.succeeded',
        'setup_intent.setup_failed': 'setup_intent.failed',
        'setup_intent.canceled': 'setup_intent.canceled',

        // Charge events
        'charge.succeeded': 'charge.succeeded',
        'charge.failed': 'charge.failed',
        'charge.pending': 'charge.pending',
        'charge.captured': 'charge.captured',
        'charge.expired': 'charge.expired',
        'charge.updated': 'charge.updated',

        // Refund events
        'charge.refunded': 'refund.created',
        'charge.refund.updated': 'refund.updated',
        'refund.created': 'refund.created',
        'refund.updated': 'refund.updated',
        'refund.failed': 'refund.failed',

        // Dispute events
        'charge.dispute.created': 'dispute.created',
        'charge.dispute.updated': 'dispute.updated',
        'charge.dispute.closed': 'dispute.closed',
        'charge.dispute.funds_reinstated': 'dispute.funds_reinstated',
        'charge.dispute.funds_withdrawn': 'dispute.funds_withdrawn',

        // Checkout events
        'checkout.session.completed': 'checkout.completed',
        'checkout.session.expired': 'checkout.expired',
        'checkout.session.async_payment_succeeded': 'checkout.async_payment_succeeded',
        'checkout.session.async_payment_failed': 'checkout.async_payment_failed',

        // Payment method events
        'payment_method.attached': 'payment_method.attached',
        'payment_method.detached': 'payment_method.detached',
        'payment_method.updated': 'payment_method.updated',
        'payment_method.automatically_updated': 'payment_method.automatically_updated',

        // Mandate events (for SEPA, ACH, etc.)
        'mandate.updated': 'mandate.updated',

        // Radar (fraud) events
        'radar.early_fraud_warning.created': 'fraud_warning.created',
        'radar.early_fraud_warning.updated': 'fraud_warning.updated',

        // Connect/Marketplace events
        'account.updated': 'vendor.updated',
        'account.application.authorized': 'vendor.application_authorized',
        'account.application.deauthorized': 'vendor.application_deauthorized',
        'payout.paid': 'payout.paid',
        'payout.failed': 'payout.failed',
        'payout.canceled': 'payout.canceled',
        'payout.created': 'payout.created',
        'payout.updated': 'payout.updated',
        'transfer.created': 'transfer.created',
        'transfer.updated': 'transfer.updated',
        'transfer.reversed': 'transfer.reversed',

        // Billing portal events
        'billing_portal.session.created': 'billing_portal.session_created',
        'billing_portal.configuration.created': 'billing_portal.configuration_created',
        'billing_portal.configuration.updated': 'billing_portal.configuration_updated',

        // Customer balance events
        'customer.balance.updated': 'customer.balance_updated',

        // Tax ID events
        'customer.tax_id.created': 'customer.tax_id_created',
        'customer.tax_id.deleted': 'customer.tax_id_deleted',
        'customer.tax_id.updated': 'customer.tax_id_updated',

        // Source events (legacy)
        'source.chargeable': 'source.chargeable',
        'source.failed': 'source.failed',
        'source.canceled': 'source.canceled'
    };

    return eventMap[stripeEventType] ?? null;
}

/**
 * Extract relevant data from Stripe webhook event
 */
export function extractStripeEventData(event: QZPayWebhookEvent): {
    entityType: string;
    entityId: string;
    customerId?: string;
    subscriptionId?: string;
    invoiceId?: string;
    paymentIntentId?: string;
} {
    const data = event.data as Record<string, unknown>;
    const eventType = event.type;

    // Determine entity type from event
    const entityType = eventType.split('.')[0] ?? 'unknown';
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const entityId = (data['id'] as string) ?? '';

    const result: {
        entityType: string;
        entityId: string;
        customerId?: string;
        subscriptionId?: string;
        invoiceId?: string;
        paymentIntentId?: string;
    } = {
        entityType,
        entityId
    };

    // Extract customer ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const customer = data['customer'];
    if (customer) {
        result.customerId = typeof customer === 'string' ? customer : (customer as { id: string })?.id;
    }

    // Extract subscription ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const subscription = data['subscription'];
    if (subscription) {
        result.subscriptionId = typeof subscription === 'string' ? subscription : (subscription as { id: string })?.id;
    }

    // Extract invoice ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const invoice = data['invoice'];
    if (invoice) {
        result.invoiceId = typeof invoice === 'string' ? invoice : (invoice as { id: string })?.id;
    }

    // Extract payment intent ID
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const paymentIntent = data['payment_intent'];
    if (paymentIntent) {
        result.paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : (paymentIntent as { id: string })?.id;
    }

    return result;
}

// ==================== 3DS/SCA Event Utilities ====================

/**
 * 3DS authentication status
 */
export type QZPayStripe3DSStatus = 'not_required' | 'required' | 'succeeded' | 'failed' | 'processing' | 'unknown';

/**
 * 3DS authentication result
 */
export interface QZPayStripe3DSResult {
    status: QZPayStripe3DSStatus;
    paymentIntentId: string;
    clientSecret?: string;
    nextActionUrl?: string;
    nextActionType?: string;
    authenticationFlow?: string;
    outcome?: {
        networkStatus?: string;
        riskLevel?: string;
        riskScore?: number;
        sellerMessage?: string;
    };
}

/**
 * Check if a payment intent requires 3DS authentication
 */
export function isPaymentRequires3DS(event: QZPayWebhookEvent): boolean {
    if (!event.type.includes('payment_intent') && !event.type.includes('setup_intent')) {
        return false;
    }
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const status = data['status'] as string | undefined;
    return status === 'requires_action' || status === 'requires_confirmation';
}

/**
 * Extract 3DS authentication details from payment intent event
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 3DS event extraction requires parsing multiple nested webhook data fields
export function extract3DSDetails(event: QZPayWebhookEvent): QZPayStripe3DSResult {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const id = (data['id'] as string) ?? '';
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const status = data['status'] as string | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const clientSecret = data['client_secret'] as string | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const nextAction = data['next_action'] as Record<string, unknown> | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const charges = data['charges'] as { data?: Array<Record<string, unknown>> } | undefined;

    const result: QZPayStripe3DSResult = {
        status: map3DSStatus(status),
        paymentIntentId: id
    };

    if (clientSecret) {
        result.clientSecret = clientSecret;
    }

    if (nextAction) {
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        const nextActionType = nextAction['type'] as string | undefined;
        if (nextActionType) {
            result.nextActionType = nextActionType;
        }
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        const redirectToUrl = nextAction['redirect_to_url'] as { url?: string } | undefined;
        if (redirectToUrl?.url) {
            result.nextActionUrl = redirectToUrl.url;
        }
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        const useStripeSdk = nextAction['use_stripe_sdk'] as Record<string, unknown> | undefined;
        if (useStripeSdk) {
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            const authFlow = useStripeSdk['type'] as string | undefined;
            if (authFlow) {
                result.authenticationFlow = authFlow;
            }
        }
    }

    // Extract outcome from the charge if available
    if (charges?.data?.[0]) {
        const charge = charges.data[0];
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        const outcome = charge['outcome'] as Record<string, unknown> | undefined;
        if (outcome) {
            const outcomeResult: QZPayStripe3DSResult['outcome'] = {};
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            const networkStatus = outcome['network_status'] as string | undefined;
            if (networkStatus) {
                outcomeResult.networkStatus = networkStatus;
            }
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            const riskLevel = outcome['risk_level'] as string | undefined;
            if (riskLevel) {
                outcomeResult.riskLevel = riskLevel;
            }
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            const riskScore = outcome['risk_score'] as number | undefined;
            if (riskScore !== undefined) {
                outcomeResult.riskScore = riskScore;
            }
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            const sellerMessage = outcome['seller_message'] as string | undefined;
            if (sellerMessage) {
                outcomeResult.sellerMessage = sellerMessage;
            }
            result.outcome = outcomeResult;
        }
    }

    return result;
}

function map3DSStatus(stripeStatus: string | undefined): QZPayStripe3DSStatus {
    switch (stripeStatus) {
        case 'requires_action':
        case 'requires_confirmation':
            return 'required';
        case 'succeeded':
            return 'succeeded';
        case 'canceled':
        case 'requires_payment_method':
            return 'failed';
        case 'processing':
            return 'processing';
        default:
            return 'unknown';
    }
}

// ==================== Dispute Event Utilities ====================

/**
 * Dispute status
 */
export type QZPayStripeDisputeStatus =
    | 'warning_needs_response'
    | 'warning_under_review'
    | 'warning_closed'
    | 'needs_response'
    | 'under_review'
    | 'charge_refunded'
    | 'won'
    | 'lost';

/**
 * Dispute reason categories
 */
export type QZPayStripeDisputeReason =
    | 'bank_cannot_process'
    | 'check_returned'
    | 'credit_not_processed'
    | 'customer_initiated'
    | 'debit_not_authorized'
    | 'duplicate'
    | 'fraudulent'
    | 'general'
    | 'incorrect_account_details'
    | 'insufficient_funds'
    | 'product_not_received'
    | 'product_unacceptable'
    | 'subscription_canceled'
    | 'unrecognized';

/**
 * Dispute details extracted from webhook event
 */
export interface QZPayStripeDisputeDetails {
    disputeId: string;
    chargeId: string;
    paymentIntentId?: string;
    amount: number;
    currency: string;
    status: QZPayStripeDisputeStatus;
    reason: QZPayStripeDisputeReason;
    isChargeRefundable: boolean;
    hasEvidence: boolean;
    evidenceDueBy?: Date;
    created: Date;
    metadata?: Record<string, string>;
}

/**
 * Check if event is a dispute event
 */
export function isDisputeEvent(event: QZPayWebhookEvent): boolean {
    return event.type.includes('dispute');
}

/**
 * Extract dispute details from webhook event
 */
export function extractDisputeDetails(event: QZPayWebhookEvent): QZPayStripeDisputeDetails {
    const data = event.data as Record<string, unknown>;

    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const charge = data['charge'] as string | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const paymentIntent = data['payment_intent'] as string | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const evidenceDetails = data['evidence_details'] as Record<string, unknown> | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const metadata = data['metadata'] as Record<string, string> | undefined;

    const result: QZPayStripeDisputeDetails = {
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        disputeId: (data['id'] as string) ?? '',
        chargeId: charge ?? '',
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        amount: (data['amount'] as number) ?? 0,
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        currency: (data['currency'] as string) ?? 'usd',
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        status: (data['status'] as QZPayStripeDisputeStatus) ?? 'needs_response',
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        reason: (data['reason'] as QZPayStripeDisputeReason) ?? 'general',
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        isChargeRefundable: (data['is_charge_refundable'] as boolean) ?? false,
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        hasEvidence: (data['has_evidence'] as boolean) ?? false,
        created: event.created
    };

    if (paymentIntent) {
        result.paymentIntentId = paymentIntent;
    }
    if (evidenceDetails) {
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        const dueBy = evidenceDetails['due_by'] as number | undefined;
        if (dueBy) {
            result.evidenceDueBy = new Date(dueBy * 1000);
        }
    }
    if (metadata) {
        result.metadata = metadata;
    }

    return result;
}

// ==================== Subscription Pending Update Utilities ====================

/**
 * Pending update details
 */
export interface QZPayStripePendingUpdate {
    subscriptionId: string;
    expiresAt?: Date;
    subscriptionItems?: Array<{
        id: string;
        priceId: string;
        quantity: number;
    }>;
    billingCycleAnchor?: Date;
    prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
    trialEnd?: Date;
}

/**
 * Check if event is a pending update event
 */
export function isPendingUpdateEvent(event: QZPayWebhookEvent): boolean {
    return event.type.includes('pending_update');
}

/**
 * Extract pending update details from subscription event
 */
export function extractPendingUpdateDetails(event: QZPayWebhookEvent): QZPayStripePendingUpdate | null {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const pendingUpdate = data['pending_update'] as Record<string, unknown> | undefined;

    if (!pendingUpdate) {
        return null;
    }

    const result: QZPayStripePendingUpdate = {
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        subscriptionId: (data['id'] as string) ?? ''
    };

    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const expiresAt = pendingUpdate['expires_at'] as number | undefined;
    if (expiresAt) {
        result.expiresAt = new Date(expiresAt * 1000);
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const items = pendingUpdate['subscription_items'] as Array<Record<string, unknown>> | undefined;
    if (items) {
        result.subscriptionItems = items.map((item) => ({
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            id: (item['id'] as string) ?? '',
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            priceId: (item['price'] as string) ?? '',
            // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
            quantity: (item['quantity'] as number) ?? 1
        }));
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const billingCycleAnchor = pendingUpdate['billing_cycle_anchor'] as number | undefined;
    if (billingCycleAnchor) {
        result.billingCycleAnchor = new Date(billingCycleAnchor * 1000);
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const prorationBehavior = pendingUpdate['proration_behavior'] as QZPayStripePendingUpdate['prorationBehavior'] | undefined;
    if (prorationBehavior) {
        result.prorationBehavior = prorationBehavior;
    }

    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const trialEnd = pendingUpdate['trial_end'] as number | undefined;
    if (trialEnd) {
        result.trialEnd = new Date(trialEnd * 1000);
    }

    return result;
}

// ==================== Fraud Warning Utilities ====================

/**
 * Early fraud warning details
 */
export interface QZPayStripeFraudWarning {
    warningId: string;
    chargeId: string;
    paymentIntentId?: string;
    fraudType: string;
    actionable: boolean;
    created: Date;
}

/**
 * Check if event is a fraud warning event
 */
export function isFraudWarningEvent(event: QZPayWebhookEvent): boolean {
    return event.type.includes('radar') || event.type.includes('fraud_warning');
}

/**
 * Extract fraud warning details
 */
export function extractFraudWarningDetails(event: QZPayWebhookEvent): QZPayStripeFraudWarning {
    const data = event.data as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const charge = data['charge'] as string | Record<string, unknown> | undefined;
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    const paymentIntent = data['payment_intent'] as string | undefined;

    const result: QZPayStripeFraudWarning = {
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        warningId: (data['id'] as string) ?? '',
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        chargeId: typeof charge === 'string' ? charge : ((charge?.['id'] as string) ?? ''),
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        fraudType: (data['fraud_type'] as string) ?? 'unknown',
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        actionable: (data['actionable'] as boolean) ?? true,
        created: event.created
    };

    if (paymentIntent) {
        result.paymentIntentId = paymentIntent;
    }

    return result;
}

// ==================== Webhook Event Classification ====================

/**
 * Event categories for routing
 */
export type QZPayStripeEventCategory =
    | 'customer'
    | 'subscription'
    | 'payment'
    | 'invoice'
    | 'checkout'
    | 'dispute'
    | 'refund'
    | 'vendor'
    | 'fraud'
    | 'billing_portal'
    | 'other';

/**
 * Classify a webhook event into a category
 */
export function classifyStripeEvent(eventType: string): QZPayStripeEventCategory {
    if (eventType.startsWith('customer.subscription')) return 'subscription';
    if (eventType.startsWith('customer.')) return 'customer';
    if (eventType.startsWith('invoice.')) return 'invoice';
    if (
        eventType.startsWith('payment_intent.') ||
        (eventType.startsWith('charge.') && !eventType.includes('dispute') && !eventType.includes('refund'))
    )
        return 'payment';
    if (eventType.includes('dispute')) return 'dispute';
    if (eventType.includes('refund')) return 'refund';
    if (eventType.startsWith('checkout.')) return 'checkout';
    if (eventType.startsWith('account.') || eventType.startsWith('payout.') || eventType.startsWith('transfer.')) return 'vendor';
    if (eventType.startsWith('radar.')) return 'fraud';
    if (eventType.startsWith('billing_portal.')) return 'billing_portal';
    return 'other';
}

/**
 * Check if event requires immediate action
 */
export function requiresImmediateAction(event: QZPayWebhookEvent): boolean {
    const urgentEvents = [
        'payment_intent.requires_action',
        'setup_intent.requires_action',
        'invoice.payment_action_required',
        'charge.dispute.created',
        'radar.early_fraud_warning.created',
        'invoice.payment_failed'
    ];
    return urgentEvents.includes(event.type);
}
