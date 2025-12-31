/**
 * Email adapter interface for QZPay
 * Defines the contract for email notification operations
 *
 * Note: The project/application controls email sending.
 * QZPay only suggests when emails should be sent via events.
 * This adapter is optional and used when the project wants QZPay to handle emails.
 */
import type { QZPayCustomer, QZPayInvoice, QZPayPayment, QZPaySubscription } from '../types/index.js';

export interface QZPayEmailAdapter {
    /**
     * Send a raw email
     */
    send(options: QZPaySendEmailOptions): Promise<QZPayEmailResult>;

    /**
     * Send a templated email
     */
    sendTemplate(options: QZPaySendTemplateOptions): Promise<QZPayEmailResult>;
}

export interface QZPaySendEmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: QZPayEmailAttachment[];
    metadata?: Record<string, string>;
}

export interface QZPaySendTemplateOptions {
    to: string | string[];
    template: QZPayEmailTemplate;
    data: QZPayEmailTemplateData;
    from?: string;
    replyTo?: string;
    metadata?: Record<string, string>;
}

export interface QZPayEmailAttachment {
    filename: string;
    content: string | Buffer;
    contentType?: string;
}

export interface QZPayEmailResult {
    id: string;
    success: boolean;
    error?: string;
}

export type QZPayEmailTemplate =
    | 'subscription_created'
    | 'subscription_canceled'
    | 'subscription_trial_ending'
    | 'subscription_trial_ended'
    | 'subscription_past_due'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'invoice_created'
    | 'invoice_paid'
    | 'invoice_payment_failed'
    | 'refund_processed'
    | 'welcome'
    | 'custom';

export type QZPayEmailTemplateData = QZPaySubscriptionEmailData | QZPayPaymentEmailData | QZPayInvoiceEmailData | QZPayCustomEmailData;

export interface QZPaySubscriptionEmailData {
    type: 'subscription';
    customer: QZPayCustomer;
    subscription: QZPaySubscription;
    planName?: string;
    trialEndDate?: Date;
    nextBillingDate?: Date;
    amount?: number;
    currency?: string;
}

export interface QZPayPaymentEmailData {
    type: 'payment';
    customer: QZPayCustomer;
    payment: QZPayPayment;
    invoiceUrl?: string;
    receiptUrl?: string;
}

export interface QZPayInvoiceEmailData {
    type: 'invoice';
    customer: QZPayCustomer;
    invoice: QZPayInvoice;
    invoiceUrl?: string;
    paymentUrl?: string;
}

export interface QZPayCustomEmailData {
    type: 'custom';
    customer: QZPayCustomer;
    subject: string;
    data: Record<string, unknown>;
}

/**
 * Email suggestion events
 * These are emitted by QZPay to suggest when emails should be sent
 */
export interface QZPayEmailSuggestion {
    template: QZPayEmailTemplate;
    recipient: string;
    data: QZPayEmailTemplateData;
    priority: 'high' | 'normal' | 'low';
    suggestedAt: Date;
}
