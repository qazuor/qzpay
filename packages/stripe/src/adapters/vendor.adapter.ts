import type { QZPayPaymentVendorAdapter, QZPayProviderPayout, QZPayVendor } from '@qazuor/qzpay-core';
/**
 * Stripe Vendor/Connect Adapter
 *
 * Implements QZPayPaymentVendorAdapter for Stripe Connect
 */
import type Stripe from 'stripe';

export class QZPayStripeVendorAdapter implements QZPayPaymentVendorAdapter {
    constructor(private readonly stripe: Stripe) {}

    /**
     * Create a Connect account in Stripe
     */
    async createAccount(vendor: QZPayVendor): Promise<string> {
        const params: Stripe.AccountCreateParams = {
            type: 'express',
            email: vendor.email,
            metadata: {
                qzpay_vendor_id: vendor.id,
                ...this.toStripeMetadata(vendor.metadata)
            },
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true }
            }
        };

        // Set business profile if available
        if (vendor.name) {
            params.business_profile = {
                name: vendor.name
            };
        }

        const account = await this.stripe.accounts.create(params);

        return account.id;
    }

    /**
     * Update a Connect account in Stripe
     */
    async updateAccount(providerAccountId: string, vendor: Partial<QZPayVendor>): Promise<void> {
        const params: Stripe.AccountUpdateParams = {};

        if (vendor.email !== undefined) {
            params.email = vendor.email;
        }

        if (vendor.name !== undefined) {
            params.business_profile = {
                name: vendor.name
            };
        }

        if (vendor.metadata !== undefined) {
            params.metadata = this.toStripeMetadata(vendor.metadata);
        }

        await this.stripe.accounts.update(providerAccountId, params);
    }

    /**
     * Delete a Connect account in Stripe
     */
    async deleteAccount(providerAccountId: string): Promise<void> {
        await this.stripe.accounts.del(providerAccountId);
    }

    /**
     * Create a payout to a Connect account
     */
    async createPayout(providerAccountId: string, amount: number, currency: string): Promise<string> {
        const payout = await this.stripe.payouts.create(
            {
                amount,
                currency: currency.toLowerCase()
            },
            {
                stripeAccount: providerAccountId
            }
        );

        return payout.id;
    }

    /**
     * Retrieve a payout from Stripe
     */
    async retrievePayout(providerPayoutId: string): Promise<QZPayProviderPayout> {
        const payout = await this.stripe.payouts.retrieve(providerPayoutId);

        return {
            id: payout.id,
            status: payout.status,
            amount: payout.amount,
            currency: payout.currency.toUpperCase(),
            arrivalDate: new Date(payout.arrival_date * 1000)
        };
    }

    /**
     * Create a transfer to a Connect account
     */
    async createTransfer(providerAccountId: string, amount: number, currency: string, paymentId: string): Promise<string> {
        const transfer = await this.stripe.transfers.create({
            amount,
            currency: currency.toLowerCase(),
            destination: providerAccountId,
            source_transaction: paymentId
        });

        return transfer.id;
    }

    /**
     * Create an account link for onboarding
     */
    async createAccountLink(
        providerAccountId: string,
        refreshUrl: string,
        returnUrl: string,
        type: 'account_onboarding' | 'account_update' = 'account_onboarding'
    ): Promise<string> {
        const accountLink = await this.stripe.accountLinks.create({
            account: providerAccountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type
        });

        return accountLink.url;
    }

    /**
     * Create a login link for an Express account
     */
    async createLoginLink(providerAccountId: string): Promise<string> {
        const loginLink = await this.stripe.accounts.createLoginLink(providerAccountId);

        return loginLink.url;
    }

    /**
     * Retrieve account details
     */
    async retrieveAccount(providerAccountId: string): Promise<{
        id: string;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
    }> {
        const account = await this.stripe.accounts.retrieve(providerAccountId);

        return {
            id: account.id,
            chargesEnabled: account.charges_enabled ?? false,
            payoutsEnabled: account.payouts_enabled ?? false,
            detailsSubmitted: account.details_submitted ?? false
        };
    }

    /**
     * Convert metadata to Stripe-compatible format
     */
    private toStripeMetadata(metadata: Record<string, unknown>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined && value !== null) {
                result[key] = String(value);
            }
        }
        return result;
    }
}
