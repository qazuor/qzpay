/**
 * Stripe Invoice Adapter
 *
 * Provides operations for managing Stripe invoices
 */
import type Stripe from 'stripe';

/**
 * Provider invoice representation
 */
export interface QZPayProviderInvoice {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    status: string;
    currency: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    dueDate: Date | null;
    paidAt: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
    metadata: Record<string, string>;
}

/**
 * List invoices options
 */
export interface QZPayListInvoicesOptions {
    limit?: number;
    startingAfter?: string;
    endingBefore?: string;
}

/**
 * Stripe Invoice Adapter
 */
export class QZPayStripeInvoiceAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * List invoices for a customer
     */
    async list(providerCustomerId: string, options?: QZPayListInvoicesOptions): Promise<QZPayProviderInvoice[]> {
        const params: Stripe.InvoiceListParams = {
            customer: providerCustomerId
        };

        if (options?.limit) {
            params.limit = options.limit;
        }

        if (options?.startingAfter) {
            params.starting_after = options.startingAfter;
        }

        if (options?.endingBefore) {
            params.ending_before = options.endingBefore;
        }

        const invoices = await this.stripe.invoices.list(params);

        return invoices.data.map((invoice) => this.mapInvoice(invoice));
    }

    /**
     * Retrieve a single invoice by ID
     */
    async retrieve(providerInvoiceId: string): Promise<QZPayProviderInvoice> {
        const invoice = await this.stripe.invoices.retrieve(providerInvoiceId);

        return this.mapInvoice(invoice);
    }

    /**
     * Mark an invoice as paid outside of Stripe
     */
    async markPaid(providerInvoiceId: string): Promise<QZPayProviderInvoice> {
        const invoice = await this.stripe.invoices.pay(providerInvoiceId, {
            paid_out_of_band: true
        });

        return this.mapInvoice(invoice);
    }

    /**
     * Finalize a draft invoice
     */
    async finalize(providerInvoiceId: string): Promise<QZPayProviderInvoice> {
        const invoice = await this.stripe.invoices.finalizeInvoice(providerInvoiceId);

        return this.mapInvoice(invoice);
    }

    /**
     * Void an invoice
     */
    async void(providerInvoiceId: string): Promise<QZPayProviderInvoice> {
        const invoice = await this.stripe.invoices.voidInvoice(providerInvoiceId);

        return this.mapInvoice(invoice);
    }

    /**
     * Send an invoice to the customer
     */
    async send(providerInvoiceId: string): Promise<QZPayProviderInvoice> {
        const invoice = await this.stripe.invoices.sendInvoice(providerInvoiceId);

        return this.mapInvoice(invoice);
    }

    /**
     * Map Stripe Invoice to provider invoice format
     */
    private mapInvoice(invoice: Stripe.Invoice): QZPayProviderInvoice {
        return {
            id: invoice.id,
            customerId: this.extractCustomerId(invoice.customer),
            subscriptionId: this.extractSubscriptionId(invoice.subscription),
            status: this.mapInvoiceStatus(invoice.status),
            currency: invoice.currency.toUpperCase(),
            subtotal: invoice.subtotal ?? 0,
            tax: invoice.tax ?? 0,
            discount: this.calculateTotalDiscount(invoice.total_discount_amounts),
            total: invoice.total ?? 0,
            amountPaid: invoice.amount_paid ?? 0,
            amountDue: invoice.amount_due ?? 0,
            dueDate: this.toDateOrNull(invoice.due_date),
            paidAt: this.toDateOrNull(invoice.status_transitions?.paid_at),
            periodStart: this.toDateOrNull(invoice.period_start),
            periodEnd: this.toDateOrNull(invoice.period_end),
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            invoicePdf: invoice.invoice_pdf ?? null,
            metadata: (invoice.metadata as Record<string, string>) ?? {}
        };
    }

    /**
     * Extract customer ID from invoice customer field
     */
    private extractCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string {
        if (!customer) {
            return '';
        }
        return typeof customer === 'string' ? customer : (customer.id ?? '');
    }

    /**
     * Extract subscription ID from invoice subscription field
     */
    private extractSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
        if (!subscription) {
            return null;
        }
        return typeof subscription === 'string' ? subscription : (subscription.id ?? null);
    }

    /**
     * Calculate total discount from discount amounts
     */
    private calculateTotalDiscount(
        discounts?: Array<{ amount: number; discount: string | Stripe.Discount | Stripe.DeletedDiscount }> | null
    ): number {
        if (!discounts) {
            return 0;
        }
        return discounts.reduce((sum, d) => sum + d.amount, 0);
    }

    /**
     * Convert Unix timestamp to Date or null
     */
    private toDateOrNull(timestamp: number | null | undefined): Date | null {
        return timestamp ? new Date(timestamp * 1000) : null;
    }

    /**
     * Map Stripe invoice status to normalized status
     */
    private mapInvoiceStatus(status: Stripe.Invoice.Status | null): string {
        if (!status) {
            return 'draft';
        }

        const statusMap: Record<Stripe.Invoice.Status, string> = {
            draft: 'draft',
            open: 'open',
            paid: 'paid',
            void: 'void',
            uncollectible: 'uncollectible'
        };

        return statusMap[status] ?? status;
    }
}
