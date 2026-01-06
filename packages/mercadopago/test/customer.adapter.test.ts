/**
 * MercadoPago Customer Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoCustomerAdapter } from '../src/adapters/customer.adapter.js';
import { createMockCustomerApi, createMockMPCustomer } from './helpers/mercadopago-mocks.js';

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    Customer: vi.fn().mockImplementation(() => createMockCustomerApi()),
    MercadoPagoConfig: vi.fn()
}));

describe('QZPayMercadoPagoCustomerAdapter', () => {
    let adapter: QZPayMercadoPagoCustomerAdapter;
    let mockCustomerApi: ReturnType<typeof createMockCustomerApi>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockCustomerApi = createMockCustomerApi();
        const { Customer } = await import('mercadopago');
        vi.mocked(Customer).mockImplementation(() => mockCustomerApi as never);

        adapter = new QZPayMercadoPagoCustomerAdapter({} as never);
    });

    describe('create', () => {
        it('should create a customer with email only', async () => {
            mockCustomerApi.create.mockResolvedValue(createMockMPCustomer({ id: 'cus_new123' }));

            const result = await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123'
            });

            expect(result).toBe('cus_new123');
            expect(mockCustomerApi.create).toHaveBeenCalledWith({
                body: {
                    email: 'test@example.com'
                }
            });
        });

        it('should create a customer with full name', async () => {
            mockCustomerApi.create.mockResolvedValue(createMockMPCustomer());

            await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123',
                name: 'John Doe'
            });

            expect(mockCustomerApi.create).toHaveBeenCalledWith({
                body: {
                    email: 'test@example.com',
                    first_name: 'John',
                    last_name: 'Doe'
                }
            });
        });

        it('should handle multi-word last name', async () => {
            mockCustomerApi.create.mockResolvedValue(createMockMPCustomer());

            await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123',
                name: 'John Van Der Berg'
            });

            expect(mockCustomerApi.create).toHaveBeenCalledWith({
                body: {
                    email: 'test@example.com',
                    first_name: 'John',
                    last_name: 'Van Der Berg'
                }
            });
        });

        it('should handle single name (first name only)', async () => {
            mockCustomerApi.create.mockResolvedValue(createMockMPCustomer());

            await adapter.create({
                email: 'test@example.com',
                externalId: 'ext_123',
                name: 'John'
            });

            expect(mockCustomerApi.create).toHaveBeenCalledWith({
                body: {
                    email: 'test@example.com',
                    first_name: 'John'
                }
            });
        });

        it('should throw error when customer creation fails', async () => {
            mockCustomerApi.create.mockResolvedValue({});

            await expect(
                adapter.create({
                    email: 'test@example.com',
                    externalId: 'ext_123'
                })
            ).rejects.toThrow('Failed to create MercadoPago customer');
        });
    });

    describe('update', () => {
        it('should update customer email', async () => {
            mockCustomerApi.update.mockResolvedValue(createMockMPCustomer());

            await adapter.update('cus_123', { email: 'new@example.com' });

            expect(mockCustomerApi.update).toHaveBeenCalledWith({
                customerId: 'cus_123',
                body: { email: 'new@example.com' }
            });
        });

        it('should update customer name', async () => {
            mockCustomerApi.update.mockResolvedValue(createMockMPCustomer());

            await adapter.update('cus_123', { name: 'Jane Smith' });

            expect(mockCustomerApi.update).toHaveBeenCalledWith({
                customerId: 'cus_123',
                body: {
                    first_name: 'Jane',
                    last_name: 'Smith'
                }
            });
        });

        it('should handle empty update', async () => {
            mockCustomerApi.update.mockResolvedValue(createMockMPCustomer());

            await adapter.update('cus_123', {});

            expect(mockCustomerApi.update).toHaveBeenCalledWith({
                customerId: 'cus_123',
                body: {}
            });
        });
    });

    describe('delete', () => {
        it('should delete a customer', async () => {
            mockCustomerApi.remove.mockResolvedValue({});

            await adapter.delete('cus_123');

            expect(mockCustomerApi.remove).toHaveBeenCalledWith({
                customerId: 'cus_123'
            });
        });
    });

    describe('retrieve', () => {
        it('should retrieve a customer', async () => {
            mockCustomerApi.get.mockResolvedValue(
                createMockMPCustomer({
                    id: 'cus_123',
                    email: 'test@example.com',
                    first_name: 'John',
                    last_name: 'Doe'
                })
            );

            const result = await adapter.retrieve('cus_123');

            expect(result).toEqual({
                id: 'cus_123',
                email: 'test@example.com',
                name: 'John Doe',
                metadata: {}
            });
        });

        it('should handle customer with first name only', async () => {
            mockCustomerApi.get.mockResolvedValue(
                createMockMPCustomer({
                    first_name: 'John',
                    last_name: null
                })
            );

            const result = await adapter.retrieve('cus_123');

            expect(result.name).toBe('John');
        });

        it('should handle customer with no name', async () => {
            mockCustomerApi.get.mockResolvedValue(
                createMockMPCustomer({
                    first_name: null,
                    last_name: null
                })
            );

            const result = await adapter.retrieve('cus_123');

            expect(result.name).toBeNull();
        });

        it('should handle missing email', async () => {
            mockCustomerApi.get.mockResolvedValue(
                createMockMPCustomer({
                    email: null
                })
            );

            const result = await adapter.retrieve('cus_123');

            expect(result.email).toBe('');
        });

        it('should use provided ID when response ID is missing', async () => {
            mockCustomerApi.get.mockResolvedValue(
                createMockMPCustomer({
                    id: null
                })
            );

            const result = await adapter.retrieve('cus_123');

            expect(result.id).toBe('cus_123');
        });
    });
});
