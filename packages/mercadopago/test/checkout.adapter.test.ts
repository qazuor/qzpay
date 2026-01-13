/**
 * MercadoPago Checkout Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoCheckoutAdapter } from '../src/adapters/checkout.adapter.js';
import {
    createMockMPPreapprovalPlan,
    createMockMPPreference,
    createMockPreApprovalPlanApi,
    createMockPreferenceApi
} from './helpers/mercadopago-mocks.js';

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    Preference: vi.fn(),
    PreApprovalPlan: vi.fn(),
    MercadoPagoConfig: vi.fn()
}));

describe('QZPayMercadoPagoCheckoutAdapter', () => {
    let adapter: QZPayMercadoPagoCheckoutAdapter;
    let mockPreferenceApi: ReturnType<typeof createMockPreferenceApi>;
    let mockPlanApi: ReturnType<typeof createMockPreApprovalPlanApi>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPreferenceApi = createMockPreferenceApi();
        mockPlanApi = createMockPreApprovalPlanApi();

        const { Preference, PreApprovalPlan } = await import('mercadopago');
        vi.mocked(Preference).mockImplementation(() => mockPreferenceApi as never);
        vi.mocked(PreApprovalPlan).mockImplementation(() => mockPlanApi as never);

        // Default mock: plan with price info
        mockPlanApi.get.mockResolvedValue(
            createMockMPPreapprovalPlan({
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months',
                    transaction_amount: 29.99,
                    currency_id: 'USD'
                }
            })
        );

        adapter = new QZPayMercadoPagoCheckoutAdapter({} as never, false);
    });

    describe('create', () => {
        it('should create a checkout session', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference({ id: 'pref_new123' }));

            const result = await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [{ priceId: 'price_1', quantity: 2, description: 'Test Item' }]
                },
                ['price_1']
            );

            expect(result.id).toBe('pref_new123');
            expect(mockPlanApi.get).toHaveBeenCalledWith({ preApprovalPlanId: 'price_1' });
            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    items: [{ id: 'price_1', title: 'Test Item', quantity: 2, unit_price: 29.99, currency_id: 'USD' }],
                    back_urls: {
                        success: 'https://example.com/success',
                        failure: 'https://example.com/cancel',
                        pending: 'https://example.com/success'
                    },
                    auto_return: 'approved'
                })
            });
        });

        it('should use production URL when not sandbox', async () => {
            mockPreferenceApi.create.mockResolvedValue(
                createMockMPPreference({
                    init_point: 'https://www.mercadopago.com/checkout',
                    sandbox_init_point: 'https://sandbox.mercadopago.com/checkout'
                })
            );

            const result = await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: []
                },
                ['price_1']
            );

            expect(result.url).toBe('https://www.mercadopago.com/checkout');
        });

        it('should use sandbox URL when in sandbox mode', async () => {
            // Create adapter with sandbox mode
            adapter = new QZPayMercadoPagoCheckoutAdapter({} as never, true);

            mockPreferenceApi.create.mockResolvedValue(
                createMockMPPreference({
                    init_point: 'https://www.mercadopago.com/checkout',
                    sandbox_init_point: 'https://sandbox.mercadopago.com/checkout'
                })
            );

            const result = await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: []
                },
                ['price_1']
            );

            expect(result.url).toBe('https://sandbox.mercadopago.com/checkout');
        });

        it('should set customer email when provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [],
                    customerEmail: 'test@example.com'
                },
                ['price_1']
            );

            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    payer: { email: 'test@example.com' }
                })
            });
        });

        it('should set external reference when customer ID provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [],
                    customerId: 'cus_123'
                },
                ['price_1']
            );

            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    external_reference: 'cus_123'
                })
            });
        });

        it('should set expiration when expiresInMinutes provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());
            const beforeCreate = new Date();

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [],
                    expiresInMinutes: 30
                },
                ['price_1']
            );

            const call = mockPreferenceApi.create.mock.calls[0]?.[0] as { body: Record<string, unknown> };
            expect(call.body.expires).toBe(true);
            expect(call.body.expiration_date_from).toBeDefined();
            expect(call.body.expiration_date_to).toBeDefined();

            const expirationTo = new Date(call.body.expiration_date_to as string);
            const expectedExpiration = new Date(beforeCreate.getTime() + 30 * 60 * 1000);
            expect(expirationTo.getTime()).toBeGreaterThanOrEqual(expectedExpiration.getTime() - 1000);
        });

        it('should handle multiple line items', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: [
                        { priceId: 'price_1', quantity: 2, description: 'Item 1' },
                        { priceId: 'price_2', quantity: 1, description: 'Item 2' }
                    ]
                },
                ['price_1', 'price_2']
            );

            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    items: [
                        { id: 'price_1', title: 'Item 1', quantity: 2, unit_price: 29.99, currency_id: 'USD' },
                        { id: 'price_2', title: 'Item 2', quantity: 1, unit_price: 29.99, currency_id: 'USD' }
                    ]
                })
            });
        });

        it('should use default description when not provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                {
                    mode: 'payment',
                    successUrl: 'https://example.com/success',
                    cancelUrl: 'https://example.com/cancel',
                    lineItems: []
                },
                ['price_1']
            );

            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    items: [expect.objectContaining({ title: 'Item 1' })]
                })
            });
        });
    });

    describe('retrieve', () => {
        it('should retrieve a checkout session', async () => {
            mockPreferenceApi.get.mockResolvedValue(
                createMockMPPreference({
                    id: 'pref_123',
                    init_point: 'https://checkout.mp.com/pref_123',
                    external_reference: 'cus_456',
                    metadata: { key: 'value' }
                })
            );

            const result = await adapter.retrieve('pref_123');

            expect(mockPreferenceApi.get).toHaveBeenCalledWith({ preferenceId: 'pref_123' });
            expect(result).toEqual({
                id: 'pref_123',
                url: 'https://checkout.mp.com/pref_123',
                status: 'open',
                paymentIntentId: null,
                subscriptionId: null,
                customerId: 'cus_456',
                metadata: { key: 'value' }
            });
        });

        it('should return expired status when expiration date passed', async () => {
            const pastDate = new Date(Date.now() - 86400000).toISOString();
            mockPreferenceApi.get.mockResolvedValue(
                createMockMPPreference({
                    expiration_date_to: pastDate
                })
            );

            const result = await adapter.retrieve('pref_123');

            expect(result.status).toBe('expired');
        });

        it('should handle missing URL', async () => {
            mockPreferenceApi.get.mockResolvedValue(
                createMockMPPreference({
                    init_point: null
                })
            );

            const result = await adapter.retrieve('pref_123');

            expect(result.url).toBe('');
        });

        it('should handle missing external reference', async () => {
            mockPreferenceApi.get.mockResolvedValue(
                createMockMPPreference({
                    external_reference: null
                })
            );

            const result = await adapter.retrieve('pref_123');

            expect(result.customerId).toBeNull();
        });
    });

    describe('expire', () => {
        it('should expire a checkout session', async () => {
            mockPreferenceApi.update.mockResolvedValue({});

            await adapter.expire('pref_123');

            expect(mockPreferenceApi.update).toHaveBeenCalledWith({
                id: 'pref_123',
                updatePreferenceRequest: expect.objectContaining({
                    expires: true
                })
            });
        });
    });
});
