/**
 * Stripe Vendor/Connect Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeVendorAdapter } from '../src/adapters/vendor.adapter.js';
import {
    createMockStripeAccount,
    createMockStripeAccountLink,
    createMockStripeClient,
    createMockStripeLoginLink,
    createMockStripePayout,
    createMockStripeTransfer
} from './helpers/stripe-mocks.js';

describe('QZPayStripeVendorAdapter', () => {
    let adapter: QZPayStripeVendorAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripeVendorAdapter(mockStripe);
        vi.clearAllMocks();
    });

    describe('createAccount', () => {
        it('should create an express account', async () => {
            const mockAccount = createMockStripeAccount({ id: 'acct_new123' });
            vi.mocked(mockStripe.accounts.create).mockResolvedValue(mockAccount);

            const result = await adapter.createAccount({
                id: 'vendor_123',
                email: 'vendor@example.com',
                name: 'Vendor Name',
                metadata: {}
            });

            expect(result).toBe('acct_new123');
            expect(mockStripe.accounts.create).toHaveBeenCalledWith({
                type: 'express',
                email: 'vendor@example.com',
                metadata: {
                    qzpay_vendor_id: 'vendor_123'
                },
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                },
                business_profile: {
                    name: 'Vendor Name'
                }
            });
        });

        it('should create account without name', async () => {
            const mockAccount = createMockStripeAccount();
            vi.mocked(mockStripe.accounts.create).mockResolvedValue(mockAccount);

            await adapter.createAccount({
                id: 'vendor_123',
                email: 'vendor@example.com',
                metadata: {}
            });

            expect(mockStripe.accounts.create).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    business_profile: expect.anything()
                })
            );
        });

        it('should include custom metadata', async () => {
            const mockAccount = createMockStripeAccount();
            vi.mocked(mockStripe.accounts.create).mockResolvedValue(mockAccount);

            await adapter.createAccount({
                id: 'vendor_123',
                email: 'vendor@example.com',
                metadata: { category: 'food', region: 'us-west' }
            });

            expect(mockStripe.accounts.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        qzpay_vendor_id: 'vendor_123',
                        category: 'food',
                        region: 'us-west'
                    })
                })
            );
        });
    });

    describe('updateAccount', () => {
        it('should update account email', async () => {
            const mockAccount = createMockStripeAccount();
            vi.mocked(mockStripe.accounts.update).mockResolvedValue(mockAccount);

            await adapter.updateAccount('acct_123', { email: 'new@example.com' });

            expect(mockStripe.accounts.update).toHaveBeenCalledWith('acct_123', {
                email: 'new@example.com'
            });
        });

        it('should update account name', async () => {
            const mockAccount = createMockStripeAccount();
            vi.mocked(mockStripe.accounts.update).mockResolvedValue(mockAccount);

            await adapter.updateAccount('acct_123', { name: 'New Vendor Name' });

            expect(mockStripe.accounts.update).toHaveBeenCalledWith('acct_123', {
                business_profile: {
                    name: 'New Vendor Name'
                }
            });
        });

        it('should update account metadata', async () => {
            const mockAccount = createMockStripeAccount();
            vi.mocked(mockStripe.accounts.update).mockResolvedValue(mockAccount);

            await adapter.updateAccount('acct_123', { metadata: { tier: 'premium' } });

            expect(mockStripe.accounts.update).toHaveBeenCalledWith('acct_123', {
                metadata: { tier: 'premium' }
            });
        });

        it('should handle partial updates', async () => {
            const mockAccount = createMockStripeAccount();
            vi.mocked(mockStripe.accounts.update).mockResolvedValue(mockAccount);

            await adapter.updateAccount('acct_123', {});

            expect(mockStripe.accounts.update).toHaveBeenCalledWith('acct_123', {});
        });
    });

    describe('deleteAccount', () => {
        it('should delete an account', async () => {
            vi.mocked(mockStripe.accounts.del).mockResolvedValue({ id: 'acct_123', deleted: true } as never);

            await adapter.deleteAccount('acct_123');

            expect(mockStripe.accounts.del).toHaveBeenCalledWith('acct_123');
        });
    });

    describe('createPayout', () => {
        it('should create a payout', async () => {
            const mockPayout = createMockStripePayout({ id: 'po_new123' });
            vi.mocked(mockStripe.payouts.create).mockResolvedValue(mockPayout);

            const result = await adapter.createPayout('acct_123', 10000, 'USD');

            expect(result).toBe('po_new123');
            expect(mockStripe.payouts.create).toHaveBeenCalledWith({ amount: 10000, currency: 'usd' }, { stripeAccount: 'acct_123' });
        });
    });

    describe('retrievePayout', () => {
        it('should retrieve a payout', async () => {
            const arrivalDate = Math.floor(Date.now() / 1000) + 86400;
            const mockPayout = createMockStripePayout({
                id: 'po_123',
                status: 'paid',
                amount: 5000,
                currency: 'eur',
                arrival_date: arrivalDate
            });
            vi.mocked(mockStripe.payouts.retrieve).mockResolvedValue(mockPayout);

            const result = await adapter.retrievePayout('po_123');

            expect(result).toEqual({
                id: 'po_123',
                status: 'paid',
                amount: 5000,
                currency: 'EUR',
                arrivalDate: new Date(arrivalDate * 1000)
            });
        });
    });

    describe('createTransfer', () => {
        it('should create a transfer', async () => {
            const mockTransfer = createMockStripeTransfer({ id: 'tr_new123' });
            vi.mocked(mockStripe.transfers.create).mockResolvedValue(mockTransfer);

            const result = await adapter.createTransfer('acct_123', 5000, 'USD', 'ch_payment123');

            expect(result).toBe('tr_new123');
            expect(mockStripe.transfers.create).toHaveBeenCalledWith({
                amount: 5000,
                currency: 'usd',
                destination: 'acct_123',
                source_transaction: 'ch_payment123'
            });
        });
    });

    describe('createAccountLink', () => {
        it('should create an account onboarding link', async () => {
            const mockLink = createMockStripeAccountLink({
                url: 'https://connect.stripe.com/setup/acct_123'
            });
            vi.mocked(mockStripe.accountLinks.create).mockResolvedValue(mockLink);

            const result = await adapter.createAccountLink('acct_123', 'https://example.com/refresh', 'https://example.com/return');

            expect(result).toBe('https://connect.stripe.com/setup/acct_123');
            expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
                account: 'acct_123',
                refresh_url: 'https://example.com/refresh',
                return_url: 'https://example.com/return',
                type: 'account_onboarding'
            });
        });

        it('should create an account update link', async () => {
            const mockLink = createMockStripeAccountLink();
            vi.mocked(mockStripe.accountLinks.create).mockResolvedValue(mockLink);

            await adapter.createAccountLink('acct_123', 'https://example.com/refresh', 'https://example.com/return', 'account_update');

            expect(mockStripe.accountLinks.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'account_update'
                })
            );
        });
    });

    describe('createLoginLink', () => {
        it('should create a login link', async () => {
            const mockLink = createMockStripeLoginLink();
            vi.mocked(mockStripe.accounts.createLoginLink).mockResolvedValue(mockLink);

            const result = await adapter.createLoginLink('acct_123');

            expect(result).toBe('https://connect.stripe.com/express/acct_test123');
            expect(mockStripe.accounts.createLoginLink).toHaveBeenCalledWith('acct_123');
        });
    });

    describe('retrieveAccount', () => {
        it('should retrieve account details', async () => {
            const mockAccount = createMockStripeAccount({
                id: 'acct_123',
                charges_enabled: true,
                payouts_enabled: true,
                details_submitted: true
            });
            vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue(mockAccount);

            const result = await adapter.retrieveAccount('acct_123');

            expect(result).toEqual({
                id: 'acct_123',
                chargesEnabled: true,
                payoutsEnabled: true,
                detailsSubmitted: true
            });
        });

        it('should handle account with missing capabilities', async () => {
            const mockAccount = createMockStripeAccount({
                id: 'acct_123',
                charges_enabled: undefined,
                payouts_enabled: undefined,
                details_submitted: undefined
            } as never);
            vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue(mockAccount);

            const result = await adapter.retrieveAccount('acct_123');

            expect(result).toEqual({
                id: 'acct_123',
                chargesEnabled: false,
                payoutsEnabled: false,
                detailsSubmitted: false
            });
        });
    });
});
