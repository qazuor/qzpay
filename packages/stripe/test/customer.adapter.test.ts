/**
 * Stripe Customer Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeCustomerAdapter } from '../src/adapters/customer.adapter.js';
import { createMockStripeClient, createMockStripeCustomer } from './helpers/stripe-mocks.js';

describe('QZPayStripeCustomerAdapter', () => {
    let adapter: QZPayStripeCustomerAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripeCustomerAdapter(mockStripe);
        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should create a customer with email and external ID', async () => {
            const mockCustomer = createMockStripeCustomer({ id: 'cus_new123' });
            vi.mocked(mockStripe.customers.create).mockResolvedValue(mockCustomer);

            const result = await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123'
            });

            expect(result).toBe('cus_new123');
            expect(mockStripe.customers.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                metadata: {
                    qzpay_external_id: 'ext_123'
                }
            });
        });

        it('should create a customer with name', async () => {
            const mockCustomer = createMockStripeCustomer();
            vi.mocked(mockStripe.customers.create).mockResolvedValue(mockCustomer);

            await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123',
                name: 'John Doe'
            });

            expect(mockStripe.customers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'John Doe'
                })
            );
        });

        it('should create a customer with custom metadata', async () => {
            const mockCustomer = createMockStripeCustomer();
            vi.mocked(mockStripe.customers.create).mockResolvedValue(mockCustomer);

            await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123',
                metadata: {
                    company: 'Acme Inc',
                    tier: 'premium'
                }
            });

            expect(mockStripe.customers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        qzpay_external_id: 'ext_123',
                        company: 'Acme Inc',
                        tier: 'premium'
                    })
                })
            );
        });

        it('should handle metadata with null/undefined values', async () => {
            const mockCustomer = createMockStripeCustomer();
            vi.mocked(mockStripe.customers.create).mockResolvedValue(mockCustomer);

            await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123',
                metadata: {
                    valid: 'value',
                    nullValue: null,
                    undefinedValue: undefined
                } as Record<string, unknown>
            });

            expect(mockStripe.customers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        valid: 'value'
                    })
                })
            );
        });
    });

    describe('update', () => {
        it('should update customer email', async () => {
            vi.mocked(mockStripe.customers.update).mockResolvedValue(createMockStripeCustomer());

            await adapter.update('cus_123', { email: 'new@example.com' });

            expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_123', {
                email: 'new@example.com'
            });
        });

        it('should update customer name', async () => {
            vi.mocked(mockStripe.customers.update).mockResolvedValue(createMockStripeCustomer());

            await adapter.update('cus_123', { name: 'Jane Doe' });

            expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_123', {
                name: 'Jane Doe'
            });
        });

        it('should update customer metadata', async () => {
            vi.mocked(mockStripe.customers.update).mockResolvedValue(createMockStripeCustomer());

            await adapter.update('cus_123', {
                metadata: { newKey: 'newValue' }
            });

            expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_123', {
                metadata: { newKey: 'newValue' }
            });
        });

        it('should handle partial updates', async () => {
            vi.mocked(mockStripe.customers.update).mockResolvedValue(createMockStripeCustomer());

            await adapter.update('cus_123', {});

            expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_123', {});
        });
    });

    describe('delete', () => {
        it('should delete a customer', async () => {
            vi.mocked(mockStripe.customers.del).mockResolvedValue({ id: 'cus_123', deleted: true } as never);

            await adapter.delete('cus_123');

            expect(mockStripe.customers.del).toHaveBeenCalledWith('cus_123');
        });
    });

    describe('retrieve', () => {
        it('should retrieve a customer', async () => {
            const mockCustomer = createMockStripeCustomer({
                id: 'cus_123',
                email: 'test@example.com',
                name: 'Test User',
                metadata: { key: 'value' }
            });
            vi.mocked(mockStripe.customers.retrieve).mockResolvedValue(mockCustomer);

            const result = await adapter.retrieve('cus_123');

            expect(result).toEqual({
                id: 'cus_123',
                email: 'test@example.com',
                name: 'Test User',
                metadata: { key: 'value' }
            });
        });

        it('should throw error for deleted customer', async () => {
            const deletedCustomer = { id: 'cus_123', deleted: true } as unknown as Awaited<
                ReturnType<typeof mockStripe.customers.retrieve>
            >;
            vi.mocked(mockStripe.customers.retrieve).mockResolvedValue(deletedCustomer);

            await expect(adapter.retrieve('cus_123')).rejects.toThrow('Customer cus_123 has been deleted');
        });

        it('should handle customer without name', async () => {
            const mockCustomer = createMockStripeCustomer({
                id: 'cus_123',
                email: 'test@example.com',
                name: null
            });
            vi.mocked(mockStripe.customers.retrieve).mockResolvedValue(mockCustomer);

            const result = await adapter.retrieve('cus_123');

            expect(result.name).toBeNull();
        });

        it('should handle customer without email', async () => {
            const mockCustomer = createMockStripeCustomer({
                id: 'cus_123',
                email: null
            });
            vi.mocked(mockStripe.customers.retrieve).mockResolvedValue(mockCustomer);

            const result = await adapter.retrieve('cus_123');

            expect(result.email).toBe('');
        });
    });
});
