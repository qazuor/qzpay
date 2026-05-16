/**
 * MercadoPago Checkout Adapter Tests
 */
import type { QZPayCreateCheckoutInput, QZPayProviderCreateCheckoutInput } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoCheckoutAdapter } from '../src/adapters/checkout.adapter.js';
import {
    createMockMPPreapprovalPlan,
    createMockMPPreference,
    createMockPreApprovalPlanApi,
    createMockPreferenceApi
} from './helpers/mercadopago-mocks.js';

/**
 * Build the RO-RO shape expected by `QZPayMercadoPagoCheckoutAdapter.create`.
 * Tests pass the same `QZPayCreateCheckoutInput` they used before the RO-RO
 * refactor and a parallel `providerPriceIds[]` list — the helper assembles
 * the resolved line items from those two arrays.
 *
 * `externalReference` defaults to `input.customerId ?? ''` so existing
 * assertions checking `body.external_reference === customerId` still pass.
 */
function asRoro(input: QZPayCreateCheckoutInput, providerPriceIds: string[] = []): QZPayProviderCreateCheckoutInput {
    return {
        input,
        resolvedLineItems: providerPriceIds.map((id) => ({ providerPriceId: id, unitAmount: 0, currency: 'USD', title: '' })),
        externalReference: input.customerId ?? '',
        idempotencyKey: input.idempotencyKey ?? ''
    };
}

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    Preference: vi.fn(),
    PreApprovalPlan: vi.fn(),
    CardToken: vi.fn().mockImplementation(() => ({ create: vi.fn() })),
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
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: [{ priceId: 'price_1', quantity: 2, description: 'Test Item' }]
                    },
                    ['price_1']
                )
            );

            expect(result.id).toBe('pref_new123');
            expect(mockPlanApi.get).toHaveBeenCalledWith({ preApprovalPlanId: 'price_1' });
            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    items: [
                        // SPEC-125: category_id is now emitted on every item (default 'services').
                        { id: 'price_1', title: 'Test Item', category_id: 'services', quantity: 2, unit_price: 29.99, currency_id: 'USD' }
                    ],
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
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: []
                    },
                    ['price_1']
                )
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
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: []
                    },
                    ['price_1']
                )
            );

            expect(result.url).toBe('https://sandbox.mercadopago.com/checkout');
        });

        it('should set customer email when provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: [],
                        customerEmail: 'test@example.com'
                    },
                    ['price_1']
                )
            );

            // SPEC-125: payer now includes first_name/last_name (derived
            // from email local-part when no name is supplied).
            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    payer: { email: 'test@example.com', first_name: 'test', last_name: ' ' }
                })
            });
        });

        it('should set external reference when customer ID provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: [],
                        customerId: 'cus_123'
                    },
                    ['price_1']
                )
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
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: [],
                        expiresInMinutes: 30
                    },
                    ['price_1']
                )
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
                asRoro(
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
                )
            );

            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    items: [
                        // SPEC-125: category_id default 'services' on every item.
                        { id: 'price_1', title: 'Item 1', category_id: 'services', quantity: 2, unit_price: 29.99, currency_id: 'USD' },
                        { id: 'price_2', title: 'Item 2', category_id: 'services', quantity: 1, unit_price: 29.99, currency_id: 'USD' }
                    ]
                })
            });
        });

        it('should use default description when not provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: []
                    },
                    ['price_1']
                )
            );

            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    items: [expect.objectContaining({ title: 'Item 1' })]
                })
            });
        });

        it('should set notification_url when provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: [],
                        notificationUrl: 'https://example.com/webhooks/mercadopago'
                    },
                    ['price_1']
                )
            );

            expect(mockPreferenceApi.create).toHaveBeenCalledWith({
                body: expect.objectContaining({
                    notification_url: 'https://example.com/webhooks/mercadopago'
                })
            });
        });

        it('should not set notification_url when not provided', async () => {
            mockPreferenceApi.create.mockResolvedValue(createMockMPPreference());

            await adapter.create(
                asRoro(
                    {
                        mode: 'payment',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel',
                        lineItems: []
                    },
                    ['price_1']
                )
            );

            const call = mockPreferenceApi.create.mock.calls[0]?.[0] as { body: Record<string, unknown> };
            expect(call.body.notification_url).toBeUndefined();
        });

        // SPEC-125: parity with the Hospeda direct-SDK path. The adapter
        // now populates `payer` with first/last name, sets `category_id`
        // on every item, forwards a caller-supplied idempotency key, and
        // validates the statement_descriptor format.
        describe('quality fields (SPEC-125)', () => {
            beforeEach(() => {
                mockPreferenceApi.create.mockResolvedValue(createMockMPPreference({ id: 'pref_q1' }));
            });

            function readBody(): Record<string, unknown> {
                const call = mockPreferenceApi.create.mock.calls[0]?.[0] as {
                    body: Record<string, unknown>;
                };
                return call.body;
            }

            it("defaults items[].category_id to 'services'", async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }]
                        },
                        ['p1']
                    )
                );

                const items = readBody().items as Array<{ category_id: string }>;
                expect(items[0]?.category_id).toBe('services');
            });

            it('honors per-line-item categoryId override', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1, categoryId: 'digital_goods' }]
                        },
                        ['p1']
                    )
                );

                const items = readBody().items as Array<{ category_id: string }>;
                expect(items[0]?.category_id).toBe('digital_goods');
            });

            it('splits customerName into payer.first_name / payer.last_name', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }],
                            customerEmail: 'juan@example.com',
                            customerName: 'Juan Perez'
                        },
                        ['p1']
                    )
                );

                const payer = readBody().payer as { email: string; first_name: string; last_name: string };
                expect(payer.email).toBe('juan@example.com');
                expect(payer.first_name).toBe('Juan');
                expect(payer.last_name).toBe('Perez');
            });

            it('keeps multi-word surname intact when splitting customerName', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }],
                            customerEmail: 'maria@example.com',
                            customerName: 'Maria de los Angeles Gonzalez'
                        },
                        ['p1']
                    )
                );

                const payer = readBody().payer as { first_name: string; last_name: string };
                expect(payer.first_name).toBe('Maria');
                expect(payer.last_name).toBe('de los Angeles Gonzalez');
            });

            it('honors explicit payerFirstName / payerLastName over customerName', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }],
                            customerEmail: 'pepe@example.com',
                            customerName: 'should-be-ignored',
                            payerFirstName: 'Jose',
                            payerLastName: 'Lopez'
                        },
                        ['p1']
                    )
                );

                const payer = readBody().payer as { first_name: string; last_name: string };
                expect(payer.first_name).toBe('Jose');
                expect(payer.last_name).toBe('Lopez');
            });

            it('falls back to email local-part when customerName is missing', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }],
                            customerEmail: 'anon.user@example.com'
                        },
                        ['p1']
                    )
                );

                const payer = readBody().payer as { first_name: string; last_name: string };
                expect(payer.first_name).toBe('anon.user');
                expect(payer.last_name).toBe(' ');
            });

            it('omits payer entirely when no customerEmail is supplied (backwards-compat)', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }]
                        },
                        ['p1']
                    )
                );

                expect(readBody().payer).toBeUndefined();
            });

            it('forwards idempotencyKey via requestOptions when provided', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }],
                            idempotencyKey: 'my-local-order-uuid'
                        },
                        ['p1']
                    )
                );

                const arg = mockPreferenceApi.create.mock.calls[0]?.[0] as {
                    requestOptions?: { idempotencyKey?: string };
                };
                expect(arg.requestOptions?.idempotencyKey).toBe('my-local-order-uuid');
            });

            it('omits requestOptions entirely when no idempotencyKey is supplied', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }]
                        },
                        ['p1']
                    )
                );

                const arg = mockPreferenceApi.create.mock.calls[0]?.[0] as {
                    requestOptions?: { idempotencyKey?: string };
                };
                expect(arg.requestOptions).toBeUndefined();
            });

            it('forwards a valid statement_descriptor', async () => {
                await adapter.create(
                    asRoro(
                        {
                            mode: 'payment',
                            successUrl: 'https://example.com/success',
                            cancelUrl: 'https://example.com/cancel',
                            lineItems: [{ priceId: 'p1', quantity: 1 }],
                            statementDescriptor: 'HOSPEDA AR'
                        },
                        ['p1']
                    )
                );

                expect(readBody().statement_descriptor).toBe('HOSPEDA AR');
            });

            it('rejects invalid statement_descriptor (lowercase)', async () => {
                await expect(
                    adapter.create(
                        asRoro(
                            {
                                mode: 'payment',
                                successUrl: 'https://example.com/success',
                                cancelUrl: 'https://example.com/cancel',
                                lineItems: [{ priceId: 'p1', quantity: 1 }],
                                statementDescriptor: 'hospeda'
                            },
                            ['p1']
                        )
                    )
                ).rejects.toThrow(/statement_descriptor/);
            });

            it('rejects statement_descriptor longer than 11 characters', async () => {
                await expect(
                    adapter.create(
                        asRoro(
                            {
                                mode: 'payment',
                                successUrl: 'https://example.com/success',
                                cancelUrl: 'https://example.com/cancel',
                                lineItems: [{ priceId: 'p1', quantity: 1 }],
                                statementDescriptor: 'HOSPEDAPLATFORM'
                            },
                            ['p1']
                        )
                    )
                ).rejects.toThrow(/statement_descriptor/);
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
