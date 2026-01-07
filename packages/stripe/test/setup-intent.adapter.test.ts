import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeSetupIntentAdapter } from '../src/adapters/setup-intent.adapter.js';

// ==================== Mock Setup ====================

const mockSetupIntent = {
    id: 'seti_123',
    object: 'setup_intent',
    client_secret: 'seti_123_secret_abc',
    customer: 'cus_123',
    status: 'requires_payment_method',
    payment_method: null,
    usage: 'off_session',
    metadata: {},
    created: 1234567890
};

const mockStripeClient = {
    setupIntents: {
        create: vi.fn().mockResolvedValue(mockSetupIntent),
        retrieve: vi.fn().mockResolvedValue(mockSetupIntent),
        confirm: vi.fn().mockResolvedValue({
            ...mockSetupIntent,
            status: 'succeeded',
            payment_method: 'pm_123'
        }),
        cancel: vi.fn().mockResolvedValue({
            ...mockSetupIntent,
            status: 'canceled'
        }),
        update: vi.fn().mockResolvedValue({
            ...mockSetupIntent,
            metadata: { key: 'value' }
        })
    }
};

// ==================== Tests ====================

describe('QZPayStripeSetupIntentAdapter', () => {
    let adapter: QZPayStripeSetupIntentAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        // biome-ignore lint/suspicious/noExplicitAny: Mock for testing
        adapter = new QZPayStripeSetupIntentAdapter(mockStripeClient as any);
    });

    describe('create', () => {
        it('should create a setup intent', async () => {
            const result = await adapter.create({
                customerId: 'cus_123'
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith({
                customer: 'cus_123',
                usage: 'off_session',
                metadata: {},
                payment_method_types: ['card']
            });

            expect(result.id).toBe('seti_123');
            expect(result.clientSecret).toBe('seti_123_secret_abc');
            expect(result.status).toBe('requires_payment_method');
        });

        it('should create a setup intent with custom payment method types', async () => {
            await adapter.create({
                customerId: 'cus_123',
                paymentMethodTypes: ['card', 'sepa_debit']
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment_method_types: ['card', 'sepa_debit']
                })
            );
        });

        it('should create a setup intent with on_session usage', async () => {
            await adapter.create({
                customerId: 'cus_123',
                usage: 'on_session'
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    usage: 'on_session'
                })
            );
        });

        it('should pass description when provided', async () => {
            await adapter.create({
                customerId: 'cus_123',
                description: 'Save card for subscription'
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: 'Save card for subscription'
                })
            );
        });

        it('should pass metadata when provided', async () => {
            await adapter.create({
                customerId: 'cus_123',
                metadata: { key: 'value' }
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { key: 'value' }
                })
            );
        });
    });

    describe('retrieve', () => {
        it('should retrieve a setup intent', async () => {
            const result = await adapter.retrieve('seti_123');

            expect(mockStripeClient.setupIntents.retrieve).toHaveBeenCalledWith('seti_123');
            expect(result.id).toBe('seti_123');
        });
    });

    describe('confirm', () => {
        it('should confirm a setup intent', async () => {
            const result = await adapter.confirm({
                setupIntentId: 'seti_123'
            });

            expect(mockStripeClient.setupIntents.confirm).toHaveBeenCalledWith('seti_123', {});
            expect(result.status).toBe('succeeded');
            expect(result.paymentMethodId).toBe('pm_123');
        });

        it('should confirm with payment method', async () => {
            await adapter.confirm({
                setupIntentId: 'seti_123',
                paymentMethodId: 'pm_456'
            });

            expect(mockStripeClient.setupIntents.confirm).toHaveBeenCalledWith('seti_123', {
                payment_method: 'pm_456'
            });
        });

        it('should confirm with return URL', async () => {
            await adapter.confirm({
                setupIntentId: 'seti_123',
                returnUrl: 'https://example.com/return'
            });

            expect(mockStripeClient.setupIntents.confirm).toHaveBeenCalledWith('seti_123', {
                return_url: 'https://example.com/return'
            });
        });
    });

    describe('cancel', () => {
        it('should cancel a setup intent', async () => {
            await adapter.cancel('seti_123');

            expect(mockStripeClient.setupIntents.cancel).toHaveBeenCalledWith('seti_123');
        });
    });

    describe('update', () => {
        it('should update metadata', async () => {
            const result = await adapter.update('seti_123', {
                metadata: { key: 'value' }
            });

            expect(mockStripeClient.setupIntents.update).toHaveBeenCalledWith('seti_123', {
                metadata: { key: 'value' }
            });

            expect(result.id).toBe('seti_123');
        });

        it('should update description', async () => {
            await adapter.update('seti_123', {
                description: 'Updated description'
            });

            expect(mockStripeClient.setupIntents.update).toHaveBeenCalledWith('seti_123', {
                description: 'Updated description'
            });
        });
    });

    describe('mapSetupIntent', () => {
        it('should handle setup intent with string payment method', async () => {
            mockStripeClient.setupIntents.retrieve.mockResolvedValueOnce({
                ...mockSetupIntent,
                payment_method: 'pm_123'
            });

            const result = await adapter.retrieve('seti_123');

            expect(result.paymentMethodId).toBe('pm_123');
        });

        it('should handle setup intent with object payment method', async () => {
            mockStripeClient.setupIntents.retrieve.mockResolvedValueOnce({
                ...mockSetupIntent,
                payment_method: { id: 'pm_456', object: 'payment_method' }
            });

            const result = await adapter.retrieve('seti_123');

            expect(result.paymentMethodId).toBe('pm_456');
        });

        it('should handle setup intent without client secret', async () => {
            mockStripeClient.setupIntents.retrieve.mockResolvedValueOnce({
                ...mockSetupIntent,
                client_secret: null
            });

            const result = await adapter.retrieve('seti_123');

            expect(result.clientSecret).toBe('');
        });
    });

    // ==================== Error Scenarios ====================

    describe('Error Handling', () => {
        it('should propagate error when setup intent not found', async () => {
            const error = new Error('No such setup_intent: seti_invalid');
            mockStripeClient.setupIntents.retrieve.mockRejectedValue(error);

            await expect(adapter.retrieve('seti_invalid')).rejects.toThrow('No such setup_intent');
        });

        it('should propagate error when confirm fails due to card issue', async () => {
            const error = new Error('Your card was declined');
            mockStripeClient.setupIntents.confirm.mockRejectedValue(error);

            await expect(adapter.confirm({ setupIntentId: 'seti_123', paymentMethodId: 'pm_declined' })).rejects.toThrow(
                'card was declined'
            );
        });

        it('should propagate error when setup intent already succeeded', async () => {
            const error = new Error('This SetupIntent has already succeeded');
            mockStripeClient.setupIntents.confirm.mockRejectedValue(error);

            await expect(adapter.confirm({ setupIntentId: 'seti_123' })).rejects.toThrow('already succeeded');
        });

        it('should propagate error when setup intent already canceled', async () => {
            const error = new Error('This SetupIntent was canceled');
            mockStripeClient.setupIntents.confirm.mockRejectedValue(error);

            await expect(adapter.confirm({ setupIntentId: 'seti_123' })).rejects.toThrow('was canceled');
        });

        it('should propagate error when canceling already canceled setup intent', async () => {
            const error = new Error('This SetupIntent was already canceled');
            mockStripeClient.setupIntents.cancel.mockRejectedValue(error);

            await expect(adapter.cancel('seti_123')).rejects.toThrow('already canceled');
        });

        it('should propagate error when updating succeeded setup intent', async () => {
            const error = new Error('Cannot update a SetupIntent in status succeeded');
            mockStripeClient.setupIntents.update.mockRejectedValue(error);

            await expect(adapter.update('seti_123', { metadata: { key: 'value' } })).rejects.toThrow('Cannot update');
        });
    });

    // ==================== Status Flow Tests ====================

    describe('Status Flows', () => {
        it('should handle requires_action status', async () => {
            mockStripeClient.setupIntents.confirm.mockResolvedValueOnce({
                ...mockSetupIntent,
                status: 'requires_action',
                next_action: {
                    type: 'redirect_to_url',
                    redirect_to_url: { url: 'https://auth.stripe.com/3ds' }
                }
            });

            const result = await adapter.confirm({ setupIntentId: 'seti_123' });

            expect(result.status).toBe('requires_action');
        });

        it('should handle processing status', async () => {
            mockStripeClient.setupIntents.retrieve.mockResolvedValueOnce({
                ...mockSetupIntent,
                status: 'processing'
            });

            const result = await adapter.retrieve('seti_123');

            expect(result.status).toBe('processing');
        });

        it('should handle requires_confirmation status', async () => {
            mockStripeClient.setupIntents.create.mockResolvedValueOnce({
                ...mockSetupIntent,
                status: 'requires_confirmation',
                payment_method: 'pm_123'
            });

            const result = await adapter.create({
                customerId: 'cus_123',
                paymentMethodTypes: ['card']
            });

            expect(result.status).toBe('requires_confirmation');
        });

        it('should handle canceled status after cancel', async () => {
            const canceledIntent = {
                ...mockSetupIntent,
                status: 'canceled',
                cancellation_reason: 'requested_by_customer'
            };
            mockStripeClient.setupIntents.cancel.mockResolvedValueOnce(canceledIntent);
            mockStripeClient.setupIntents.retrieve.mockResolvedValueOnce(canceledIntent);

            await adapter.cancel('seti_123');

            const result = await adapter.retrieve('seti_123');
            expect(result.status).toBe('canceled');
        });
    });

    // ==================== Payment Method Type Tests ====================

    describe('Payment Method Types', () => {
        it('should create setup intent with us_bank_account', async () => {
            await adapter.create({
                customerId: 'cus_123',
                paymentMethodTypes: ['us_bank_account']
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment_method_types: ['us_bank_account']
                })
            );
        });

        it('should create setup intent with multiple payment methods', async () => {
            await adapter.create({
                customerId: 'cus_123',
                paymentMethodTypes: ['card', 'sepa_debit', 'us_bank_account']
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment_method_types: ['card', 'sepa_debit', 'us_bank_account']
                })
            );
        });

        it('should default to card when no payment method types specified', async () => {
            await adapter.create({
                customerId: 'cus_123'
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment_method_types: ['card']
                })
            );
        });
    });

    // ==================== Usage Mode Tests ====================

    describe('Usage Modes', () => {
        it('should default to off_session usage', async () => {
            await adapter.create({
                customerId: 'cus_123'
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    usage: 'off_session'
                })
            );
        });

        it('should create setup intent for on_session usage', async () => {
            await adapter.create({
                customerId: 'cus_123',
                usage: 'on_session'
            });

            expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    usage: 'on_session'
                })
            );
        });
    });

    // ==================== 3D Secure Tests ====================

    describe('3D Secure Handling', () => {
        it('should return requires_action when 3DS is required', async () => {
            mockStripeClient.setupIntents.confirm.mockResolvedValueOnce({
                ...mockSetupIntent,
                status: 'requires_action',
                next_action: {
                    type: 'use_stripe_sdk',
                    use_stripe_sdk: {}
                }
            });

            const result = await adapter.confirm({
                setupIntentId: 'seti_123',
                paymentMethodId: 'pm_123'
            });

            expect(result.status).toBe('requires_action');
        });

        it('should succeed after 3DS authentication', async () => {
            mockStripeClient.setupIntents.retrieve.mockResolvedValueOnce({
                ...mockSetupIntent,
                status: 'succeeded',
                payment_method: 'pm_3ds_success'
            });

            const result = await adapter.retrieve('seti_123');

            expect(result.status).toBe('succeeded');
            expect(result.paymentMethodId).toBe('pm_3ds_success');
        });
    });

    // ==================== Factory Function Test ====================

    describe('createStripeSetupIntentAdapter', () => {
        it('should create an adapter instance', async () => {
            const { createStripeSetupIntentAdapter } = await import('../src/adapters/setup-intent.adapter.js');

            // biome-ignore lint/suspicious/noExplicitAny: Mock for testing
            const stripeAdapter = createStripeSetupIntentAdapter(mockStripeClient as any);

            expect(stripeAdapter).toBeInstanceOf(QZPayStripeSetupIntentAdapter);
        });
    });
});
