/**
 * MercadoPago Subscription Adapter Tests
 */
import type { QZPayProviderCreateSubscriptionInput } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoSubscriptionAdapter } from '../src/adapters/subscription.adapter.js';
import { createMockCustomerApi, createMockMPPreapproval, createMockPreApprovalApi } from './helpers/mercadopago-mocks.js';

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    PreApproval: vi.fn(),
    Customer: vi.fn(),
    CardToken: vi.fn().mockImplementation(() => ({ create: vi.fn() })),
    MercadoPagoConfig: vi.fn()
}));

/**
 * Build a `QZPayProviderCreateSubscriptionInput` factory with sensible defaults
 * and shallow overrides. Tests call this to vary one field at a time.
 */
function buildCreateInput(overrides: Partial<QZPayProviderCreateSubscriptionInput> = {}): QZPayProviderCreateSubscriptionInput {
    return {
        providerCustomerId: 'cus_mp_123',
        providerPriceId: 'price_mp_123',
        input: { customerId: 'cus_local_1', planId: 'plan_local_1' },
        customer: { email: 'test@example.com', firstName: 'Ada', lastName: 'Lovelace' },
        // `price.amount` is in **cents** (smallest currency unit) — see
        // `QZPayProviderCreateSubscriptionInput.price` JSDoc. 199999 cents =
        // $1999.99 ARS — the adapter divides by 100 at the MP boundary.
        price: { amount: 199999, currency: 'ARS', interval: 'month', intervalCount: 1 },
        plan: { name: 'Pro Plan' },
        externalReference: 'sub_local_uuid_1',
        idempotencyKey: 'sub_local_uuid_1',
        backUrl: 'https://app.example.com/billing/return',
        notificationUrl: 'https://app.example.com/webhooks/mp',
        ...overrides
    };
}

describe('QZPayMercadoPagoSubscriptionAdapter', () => {
    let adapter: QZPayMercadoPagoSubscriptionAdapter;
    let mockPreApprovalApi: ReturnType<typeof createMockPreApprovalApi>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPreApprovalApi = createMockPreApprovalApi();
        const mockCustomerApi = createMockCustomerApi();

        const { PreApproval, Customer } = await import('mercadopago');
        vi.mocked(PreApproval).mockImplementation(() => mockPreApprovalApi as never);
        vi.mocked(Customer).mockImplementation(() => mockCustomerApi as never);

        adapter = new QZPayMercadoPagoSubscriptionAdapter({} as never);
    });

    describe('create', () => {
        it('sends full preapproval body (payer, auto_recurring, external_reference, urls)', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval({ id: 'preapproval_new' }));

            const result = await adapter.create(buildCreateInput());

            expect(result.id).toBe('preapproval_new');
            expect(mockPreApprovalApi.create).toHaveBeenCalledTimes(1);
            const call = mockPreApprovalApi.create.mock.calls[0]?.[0];
            expect(call?.requestOptions).toEqual({ idempotencyKey: 'sub_local_uuid_1' });
            expect(call?.body).toEqual({
                payer_email: 'test@example.com',
                payer: { email: 'test@example.com', first_name: 'Ada', last_name: 'Lovelace' },
                external_reference: 'sub_local_uuid_1',
                reason: 'Pro Plan - Mensual',
                back_url: 'https://app.example.com/billing/return',
                notification_url: 'https://app.example.com/webhooks/mp',
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months',
                    transaction_amount: 1999.99,
                    currency_id: 'ARS'
                }
            });
        });

        it('appends free_trial to auto_recurring when freeTrialDays is provided', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());
            const providerInput = buildCreateInput({
                input: { customerId: 'cus_local_1', planId: 'plan_local_1', freeTrialDays: 14 }
            });

            await adapter.create(providerInput);

            const body = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(body?.auto_recurring).toMatchObject({
                free_trial: { frequency: 14, frequency_type: 'days' }
            });
        });

        it('omits free_trial when freeTrialDays is zero or undefined', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());

            await adapter.create(buildCreateInput({ input: { customerId: 'c', planId: 'p', freeTrialDays: 0 } }));
            const bodyZero = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(bodyZero?.auto_recurring.free_trial).toBeUndefined();

            mockPreApprovalApi.create.mockClear();
            await adapter.create(buildCreateInput());
            const bodyNone = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(bodyNone?.auto_recurring.free_trial).toBeUndefined();
        });

        it('uses email local-part as first name when firstName is missing', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());
            const providerInput = buildCreateInput({
                customer: { email: 'jdoe@example.com', firstName: undefined, lastName: undefined }
            });

            await adapter.create(providerInput);

            const body = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(body?.payer).toEqual({ email: 'jdoe@example.com', first_name: 'jdoe', last_name: ' ' });
        });

        it('builds reason from plan name + Anual label when billingInterval=annual', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());
            const providerInput = buildCreateInput({
                plan: { name: 'Premium' },
                input: { customerId: 'c', planId: 'p', billingInterval: 'annual' }
            });

            await adapter.create(providerInput);

            const body = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(body?.reason).toBe('Premium - Anual');
        });

        it('REGRESSION: converts price.amount from cents to MP decimal (divide by 100)', async () => {
            // Smoke session 2026-05-21 discovered that the adapter was forwarding
            // `providerInput.price.amount` verbatim to MercadoPago, which expects
            // decimal currency units (e.g. 100.00 ARS) and NOT cents. With a
            // realistic plan price (1500000 cents = $15000 ARS) MP returned HTTP 500
            // because it interpreted the value as $1.5 million pesos and tripped
            // an internal limit / fraud check. The other MP adapters (`payment`,
            // `price`, `checkout`) already follow the convention "core passes
            // cents, adapter divides by 100 at the provider boundary"; this test
            // pins that convention for the subscription adapter too.
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());

            // 1500000 cents = $15000.00 ARS — the staging plan price at the time.
            await adapter.create(
                buildCreateInput({
                    price: { amount: 1500000, currency: 'ARS', interval: 'month', intervalCount: 1 }
                })
            );

            const body = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(body?.auto_recurring.transaction_amount).toBe(15000);
            expect(typeof body?.auto_recurring.transaction_amount).toBe('number');
        });

        it('converts price interval=week to days (count * 7)', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());
            const providerInput = buildCreateInput({
                // 10000 cents = $100 ARS. This test asserts cadence conversion;
                // the amount itself is incidental but kept in canonical cents.
                price: { amount: 10000, currency: 'ARS', interval: 'week', intervalCount: 2 }
            });

            await adapter.create(providerInput);

            const body = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(body?.auto_recurring).toMatchObject({ frequency: 14, frequency_type: 'days' });
        });

        it('converts price interval=year to months (count * 12)', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());
            const providerInput = buildCreateInput({
                // 10000 cents = $100 ARS — same convention as the week test above.
                price: { amount: 10000, currency: 'ARS', interval: 'year', intervalCount: 1 }
            });

            await adapter.create(providerInput);

            const body = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(body?.auto_recurring).toMatchObject({ frequency: 12, frequency_type: 'months' });
        });

        it('omits back_url and notification_url when not provided', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval());

            await adapter.create(buildCreateInput({ backUrl: undefined, notificationUrl: undefined }));

            const body = mockPreApprovalApi.create.mock.calls[0]?.[0]?.body;
            expect(body?.back_url).toBeUndefined();
            expect(body?.notification_url).toBeUndefined();
        });

        it('returns initPoint and sandboxInitPoint when MP includes them', async () => {
            mockPreApprovalApi.create.mockResolvedValue(
                createMockMPPreapproval({
                    init_point: 'https://www.mercadopago.com/preapproval?id=abc',
                    sandbox_init_point: 'https://sandbox.mercadopago.com/preapproval?id=abc'
                })
            );

            const result = await adapter.create(buildCreateInput());

            expect(result.initPoint).toBe('https://www.mercadopago.com/preapproval?id=abc');
            expect(result.sandboxInitPoint).toBe('https://sandbox.mercadopago.com/preapproval?id=abc');
        });

        it('maps authorized status to active', async () => {
            mockPreApprovalApi.create.mockResolvedValue(createMockMPPreapproval({ status: 'authorized' }));

            const result = await adapter.create(buildCreateInput());

            expect(result.status).toBe('active');
        });
    });

    describe('update', () => {
        it('updates transaction_amount via auto_recurring', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval());

            await adapter.update('preapproval_123', { transactionAmount: 2999.99 });

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'preapproval_123',
                body: { auto_recurring: { transaction_amount: 2999.99 } }
            });
        });

        it('updates with plan ID', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval());

            await adapter.update('preapproval_123', { planId: 'new_plan_123' });

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'preapproval_123',
                body: { reason: 'Plan updated to: new_plan_123' }
            });
        });

        it('updates with cancelAt → sets status cancelled', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval());

            await adapter.update('preapproval_123', { cancelAt: new Date('2026-12-31') });

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'preapproval_123',
                body: { status: 'cancelled' }
            });
        });

        it('retrieves the updated subscription', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ id: 'preapproval_123' }));

            const result = await adapter.update('preapproval_123', { transactionAmount: 100 });

            expect(mockPreApprovalApi.get).toHaveBeenCalledWith({ id: 'preapproval_123' });
            expect(result.id).toBe('preapproval_123');
        });
    });

    describe('cancel', () => {
        it('cancel(id, false) hard-cancels: PUT status cancelled', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.cancel('preapproval_123', false);

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'preapproval_123',
                body: { status: 'cancelled' }
            });
        });

        it('cancel(id, true) soft-cancels: PUT status paused (preapproval stays alive, resumable)', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.cancel('preapproval_123', true);

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'preapproval_123',
                body: { status: 'paused' }
            });
        });
    });

    describe('pause', () => {
        it('pauses a subscription', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.pause('preapproval_123');

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'preapproval_123',
                body: { status: 'paused' }
            });
        });
    });

    describe('resume', () => {
        it('resumes a subscription', async () => {
            mockPreApprovalApi.update.mockResolvedValue({});

            await adapter.resume('preapproval_123');

            expect(mockPreApprovalApi.update).toHaveBeenCalledWith({
                id: 'preapproval_123',
                body: { status: 'authorized' }
            });
        });
    });

    describe('retrieve', () => {
        it('retrieves a subscription', async () => {
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ id: 'preapproval_123', status: 'authorized' }));

            const result = await adapter.retrieve('preapproval_123');

            expect(mockPreApprovalApi.get).toHaveBeenCalledWith({ id: 'preapproval_123' });
            expect(result.id).toBe('preapproval_123');
            expect(result.status).toBe('active');
        });

        it('handles cancelled status with canceledAt timestamp', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ status: 'cancelled', last_modified: now.toISOString() }));

            const result = await adapter.retrieve('preapproval_123');

            expect(result.status).toBe('canceled');
            expect(result.canceledAt).toBeInstanceOf(Date);
        });

        it('handles pending status', async () => {
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ status: 'pending' }));

            const result = await adapter.retrieve('preapproval_123');

            expect(result.status).toBe('pending');
        });

        it('handles paused status', async () => {
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ status: 'paused' }));

            const result = await adapter.retrieve('preapproval_123');

            expect(result.status).toBe('paused');
        });

        it('calculates period end for monthly cadence', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    date_created: now.toISOString(),
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months',
                        transaction_amount: 29.99,
                        currency_id: 'ARS',
                        start_date: now.toISOString(),
                        end_date: null
                    }
                })
            );

            const result = await adapter.retrieve('preapproval_123');
            const expectedEnd = new Date(now);
            expectedEnd.setMonth(expectedEnd.getMonth() + 1);
            expect(result.currentPeriodEnd.getMonth()).toBe(expectedEnd.getMonth());
        });

        it('calculates period end for weekly cadence (7 days)', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    date_created: now.toISOString(),
                    auto_recurring: {
                        frequency: 7,
                        frequency_type: 'days',
                        transaction_amount: 9.99,
                        currency_id: 'ARS',
                        start_date: now.toISOString(),
                        end_date: null
                    }
                })
            );

            const result = await adapter.retrieve('preapproval_123');
            const expectedEnd = new Date(now);
            expectedEnd.setDate(expectedEnd.getDate() + 7);
            expect(result.currentPeriodEnd.getDate()).toBe(expectedEnd.getDate());
        });

        it('calculates period end for yearly cadence (12 months)', async () => {
            const now = new Date();
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    date_created: now.toISOString(),
                    auto_recurring: {
                        frequency: 12,
                        frequency_type: 'months',
                        transaction_amount: 99.99,
                        currency_id: 'ARS',
                        start_date: now.toISOString(),
                        end_date: null
                    }
                })
            );

            const result = await adapter.retrieve('preapproval_123');
            const expectedEnd = new Date(now);
            expectedEnd.setFullYear(expectedEnd.getFullYear() + 1);
            expect(result.currentPeriodEnd.getFullYear()).toBe(expectedEnd.getFullYear());
        });

        it('handles missing auto_recurring', async () => {
            mockPreApprovalApi.get.mockResolvedValue(createMockMPPreapproval({ auto_recurring: undefined }));

            const result = await adapter.retrieve('preapproval_123');

            expect(result.currentPeriodEnd).toBeInstanceOf(Date);
        });

        it('exposes initPoint and sandboxInitPoint when MP returns them', async () => {
            mockPreApprovalApi.get.mockResolvedValue(
                createMockMPPreapproval({
                    init_point: 'https://www.mercadopago.com/preapproval?id=xyz',
                    sandbox_init_point: 'https://sandbox.mercadopago.com/preapproval?id=xyz'
                })
            );

            const result = await adapter.retrieve('preapproval_123');

            expect(result.initPoint).toBe('https://www.mercadopago.com/preapproval?id=xyz');
            expect(result.sandboxInitPoint).toBe('https://sandbox.mercadopago.com/preapproval?id=xyz');
        });
    });
});
