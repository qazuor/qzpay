/**
 * Customers Controller Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayCustomersController } from '../../src/controllers/customers.controller.js';
import type { QZPayService } from '../../src/qzpay.service.js';
import {
    createMockBilling,
    createMockCustomer,
    createMockEntitlement,
    createMockInvoice,
    createMockLimit,
    createMockPayment,
    createMockSubscription
} from '../helpers/nestjs-mocks.js';

describe('QZPayCustomersController', () => {
    let controller: QZPayCustomersController;
    let mockQZPayService: QZPayService;
    let mockBilling: ReturnType<typeof createMockBilling>;

    beforeEach(() => {
        mockBilling = createMockBilling();
        mockQZPayService = {
            getBilling: vi.fn().mockReturnValue(mockBilling),
            createCustomer: vi.fn(),
            getCustomer: vi.fn(),
            getCustomerByExternalId: vi.fn(),
            updateCustomer: vi.fn(),
            deleteCustomer: vi.fn(),
            getSubscriptionsByCustomerId: vi.fn(),
            getActiveSubscription: vi.fn(),
            getPaymentsByCustomerId: vi.fn(),
            getInvoicesByCustomerId: vi.fn(),
            getEntitlements: vi.fn(),
            checkEntitlement: vi.fn(),
            getLimits: vi.fn(),
            checkLimit: vi.fn()
        } as unknown as QZPayService;

        controller = new QZPayCustomersController(mockQZPayService);
    });

    describe('create', () => {
        it('should create a customer with all fields', async () => {
            const mockCustomer = createMockCustomer({
                email: 'test@example.com',
                externalId: 'ext_123',
                name: 'Test User',
                metadata: { source: 'api' }
            });

            vi.mocked(mockQZPayService.createCustomer).mockResolvedValue(mockCustomer);

            const dto = {
                email: 'test@example.com',
                externalId: 'ext_123',
                name: 'Test User',
                metadata: { source: 'api' }
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockCustomer);
            expect(mockQZPayService.createCustomer).toHaveBeenCalledWith({
                email: 'test@example.com',
                externalId: 'ext_123',
                name: 'Test User',
                metadata: { source: 'api' }
            });
        });

        it('should create a customer with required fields only', async () => {
            const mockCustomer = createMockCustomer({
                email: 'test@example.com',
                externalId: 'ext_123'
            });

            vi.mocked(mockQZPayService.createCustomer).mockResolvedValue(mockCustomer);

            const dto = {
                email: 'test@example.com',
                externalId: 'ext_123'
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockCustomer);
            expect(mockQZPayService.createCustomer).toHaveBeenCalledWith({
                email: 'test@example.com',
                externalId: 'ext_123'
            });
        });

        it('should handle empty metadata', async () => {
            const mockCustomer = createMockCustomer();
            vi.mocked(mockQZPayService.createCustomer).mockResolvedValue(mockCustomer);

            const dto = {
                email: 'test@example.com',
                externalId: 'ext_123',
                metadata: {}
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockCustomer);
            expect(mockQZPayService.createCustomer).toHaveBeenCalledWith({
                email: 'test@example.com',
                externalId: 'ext_123',
                metadata: {}
            });
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.createCustomer).mockRejectedValue(new Error('Customer creation failed'));

            const dto = {
                email: 'test@example.com',
                externalId: 'ext_123'
            };

            await expect(controller.create(dto)).rejects.toThrow('Customer creation failed');
        });
    });

    describe('findOne', () => {
        it('should get a customer by ID', async () => {
            const mockCustomer = createMockCustomer();
            vi.mocked(mockQZPayService.getCustomer).mockResolvedValue(mockCustomer);

            const result = await controller.findOne('cus_123');

            expect(result).toEqual(mockCustomer);
            expect(mockQZPayService.getCustomer).toHaveBeenCalledWith('cus_123');
        });

        it('should handle customer not found', async () => {
            vi.mocked(mockQZPayService.getCustomer).mockResolvedValue(null);

            const result = await controller.findOne('cus_nonexistent');

            expect(result).toBeNull();
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getCustomer).mockRejectedValue(new Error('Database error'));

            await expect(controller.findOne('cus_123')).rejects.toThrow('Database error');
        });
    });

    describe('findByExternalId', () => {
        it('should get a customer by external ID', async () => {
            const mockCustomer = createMockCustomer({ externalId: 'ext_123' });
            vi.mocked(mockQZPayService.getCustomerByExternalId).mockResolvedValue(mockCustomer);

            const result = await controller.findByExternalId('ext_123');

            expect(result).toEqual(mockCustomer);
            expect(mockQZPayService.getCustomerByExternalId).toHaveBeenCalledWith('ext_123');
        });

        it('should handle external customer not found', async () => {
            vi.mocked(mockQZPayService.getCustomerByExternalId).mockResolvedValue(null);

            const result = await controller.findByExternalId('ext_nonexistent');

            expect(result).toBeNull();
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getCustomerByExternalId).mockRejectedValue(new Error('External ID lookup failed'));

            await expect(controller.findByExternalId('ext_123')).rejects.toThrow('External ID lookup failed');
        });
    });

    describe('update', () => {
        it('should update customer with all fields', async () => {
            const updatedCustomer = createMockCustomer({
                name: 'Updated Name',
                email: 'updated@example.com',
                metadata: { updated: true }
            });
            vi.mocked(mockQZPayService.updateCustomer).mockResolvedValue(updatedCustomer);

            const dto = {
                name: 'Updated Name',
                email: 'updated@example.com',
                metadata: { updated: true }
            };

            const result = await controller.update('cus_123', dto);

            expect(result).toEqual(updatedCustomer);
            expect(mockQZPayService.updateCustomer).toHaveBeenCalledWith('cus_123', dto);
        });

        it('should update customer with partial fields', async () => {
            const updatedCustomer = createMockCustomer({ name: 'New Name' });
            vi.mocked(mockQZPayService.updateCustomer).mockResolvedValue(updatedCustomer);

            const dto = { name: 'New Name' };

            const result = await controller.update('cus_123', dto);

            expect(result).toEqual(updatedCustomer);
            expect(mockQZPayService.updateCustomer).toHaveBeenCalledWith('cus_123', dto);
        });

        it('should handle empty update', async () => {
            const mockCustomer = createMockCustomer();
            vi.mocked(mockQZPayService.updateCustomer).mockResolvedValue(mockCustomer);

            const result = await controller.update('cus_123', {});

            expect(result).toEqual(mockCustomer);
            expect(mockQZPayService.updateCustomer).toHaveBeenCalledWith('cus_123', {});
        });

        it('should handle update errors', async () => {
            vi.mocked(mockQZPayService.updateCustomer).mockRejectedValue(new Error('Update failed'));

            await expect(controller.update('cus_123', { name: 'New' })).rejects.toThrow('Update failed');
        });
    });

    describe('remove', () => {
        it('should delete a customer', async () => {
            vi.mocked(mockQZPayService.deleteCustomer).mockResolvedValue(undefined);

            await controller.remove('cus_123');

            expect(mockQZPayService.deleteCustomer).toHaveBeenCalledWith('cus_123');
        });

        it('should handle delete errors', async () => {
            vi.mocked(mockQZPayService.deleteCustomer).mockRejectedValue(new Error('Delete failed'));

            await expect(controller.remove('cus_123')).rejects.toThrow('Delete failed');
        });
    });

    describe('getSubscriptions', () => {
        it('should get customer subscriptions', async () => {
            const mockSubscriptions = [createMockSubscription({ id: 'sub_1' }), createMockSubscription({ id: 'sub_2' })];
            vi.mocked(mockQZPayService.getSubscriptionsByCustomerId).mockResolvedValue(mockSubscriptions);

            const result = await controller.getSubscriptions('cus_123');

            expect(result).toEqual(mockSubscriptions);
            expect(mockQZPayService.getSubscriptionsByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should return empty array when no subscriptions', async () => {
            vi.mocked(mockQZPayService.getSubscriptionsByCustomerId).mockResolvedValue([]);

            const result = await controller.getSubscriptions('cus_123');

            expect(result).toEqual([]);
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getSubscriptionsByCustomerId).mockRejectedValue(new Error('Subscriptions fetch failed'));

            await expect(controller.getSubscriptions('cus_123')).rejects.toThrow('Subscriptions fetch failed');
        });
    });

    describe('getActiveSubscription', () => {
        it('should get customer active subscription', async () => {
            const mockSubscription = createMockSubscription({ status: 'active' });
            vi.mocked(mockQZPayService.getActiveSubscription).mockResolvedValue(mockSubscription);

            const result = await controller.getActiveSubscription('cus_123');

            expect(result).toEqual(mockSubscription);
            expect(mockQZPayService.getActiveSubscription).toHaveBeenCalledWith('cus_123');
        });

        it('should handle no active subscription', async () => {
            vi.mocked(mockQZPayService.getActiveSubscription).mockResolvedValue(null);

            const result = await controller.getActiveSubscription('cus_123');

            expect(result).toBeNull();
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getActiveSubscription).mockRejectedValue(new Error('Active subscription lookup failed'));

            await expect(controller.getActiveSubscription('cus_123')).rejects.toThrow('Active subscription lookup failed');
        });
    });

    describe('getPayments', () => {
        it('should get customer payments', async () => {
            const mockPayments = [createMockPayment({ id: 'pay_1' }), createMockPayment({ id: 'pay_2' })];
            vi.mocked(mockQZPayService.getPaymentsByCustomerId).mockResolvedValue(mockPayments);

            const result = await controller.getPayments('cus_123');

            expect(result).toEqual(mockPayments);
            expect(mockQZPayService.getPaymentsByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should return empty array when no payments', async () => {
            vi.mocked(mockQZPayService.getPaymentsByCustomerId).mockResolvedValue([]);

            const result = await controller.getPayments('cus_123');

            expect(result).toEqual([]);
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getPaymentsByCustomerId).mockRejectedValue(new Error('Payments fetch failed'));

            await expect(controller.getPayments('cus_123')).rejects.toThrow('Payments fetch failed');
        });
    });

    describe('getInvoices', () => {
        it('should get customer invoices', async () => {
            const mockInvoices = [createMockInvoice({ id: 'inv_1' }), createMockInvoice({ id: 'inv_2' })];
            vi.mocked(mockQZPayService.getInvoicesByCustomerId).mockResolvedValue(mockInvoices);

            const result = await controller.getInvoices('cus_123');

            expect(result).toEqual(mockInvoices);
            expect(mockQZPayService.getInvoicesByCustomerId).toHaveBeenCalledWith('cus_123');
        });

        it('should return empty array when no invoices', async () => {
            vi.mocked(mockQZPayService.getInvoicesByCustomerId).mockResolvedValue([]);

            const result = await controller.getInvoices('cus_123');

            expect(result).toEqual([]);
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getInvoicesByCustomerId).mockRejectedValue(new Error('Invoices fetch failed'));

            await expect(controller.getInvoices('cus_123')).rejects.toThrow('Invoices fetch failed');
        });
    });

    describe('getEntitlements', () => {
        it('should get customer entitlements', async () => {
            const mockEntitlements = [createMockEntitlement({ featureId: 'feature_1' }), createMockEntitlement({ featureId: 'feature_2' })];
            vi.mocked(mockQZPayService.getEntitlements).mockResolvedValue(mockEntitlements);

            const result = await controller.getEntitlements('cus_123');

            expect(result).toEqual(mockEntitlements);
            expect(mockQZPayService.getEntitlements).toHaveBeenCalledWith('cus_123');
        });

        it('should return empty array when no entitlements', async () => {
            vi.mocked(mockQZPayService.getEntitlements).mockResolvedValue([]);

            const result = await controller.getEntitlements('cus_123');

            expect(result).toEqual([]);
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getEntitlements).mockRejectedValue(new Error('Entitlements fetch failed'));

            await expect(controller.getEntitlements('cus_123')).rejects.toThrow('Entitlements fetch failed');
        });
    });

    describe('checkEntitlement', () => {
        it('should check entitlement and return true', async () => {
            vi.mocked(mockQZPayService.checkEntitlement).mockResolvedValue(true);

            const result = await controller.checkEntitlement('cus_123', 'api_access');

            expect(result).toEqual({ entitled: true });
            expect(mockQZPayService.checkEntitlement).toHaveBeenCalledWith('cus_123', 'api_access');
        });

        it('should check entitlement and return false', async () => {
            vi.mocked(mockQZPayService.checkEntitlement).mockResolvedValue(false);

            const result = await controller.checkEntitlement('cus_123', 'premium_feature');

            expect(result).toEqual({ entitled: false });
            expect(mockQZPayService.checkEntitlement).toHaveBeenCalledWith('cus_123', 'premium_feature');
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.checkEntitlement).mockRejectedValue(new Error('Entitlement check failed'));

            await expect(controller.checkEntitlement('cus_123', 'api_access')).rejects.toThrow('Entitlement check failed');
        });
    });

    describe('getLimits', () => {
        it('should get customer limits', async () => {
            const mockLimits = [createMockLimit({ featureId: 'api_calls' }), createMockLimit({ featureId: 'storage' })];
            vi.mocked(mockQZPayService.getLimits).mockResolvedValue(mockLimits);

            const result = await controller.getLimits('cus_123');

            expect(result).toEqual(mockLimits);
            expect(mockQZPayService.getLimits).toHaveBeenCalledWith('cus_123');
        });

        it('should return empty array when no limits', async () => {
            vi.mocked(mockQZPayService.getLimits).mockResolvedValue([]);

            const result = await controller.getLimits('cus_123');

            expect(result).toEqual([]);
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getLimits).mockRejectedValue(new Error('Limits fetch failed'));

            await expect(controller.getLimits('cus_123')).rejects.toThrow('Limits fetch failed');
        });
    });

    describe('checkLimit', () => {
        it('should check a specific limit', async () => {
            const mockLimit = createMockLimit({
                featureId: 'api_calls',
                currentValue: 500,
                maxValue: 1000
            });
            vi.mocked(mockQZPayService.checkLimit).mockResolvedValue(mockLimit);

            const result = await controller.checkLimit('cus_123', 'api_calls');

            expect(result).toEqual(mockLimit);
            expect(mockQZPayService.checkLimit).toHaveBeenCalledWith('cus_123', 'api_calls');
        });

        it('should handle limit not found', async () => {
            vi.mocked(mockQZPayService.checkLimit).mockResolvedValue(null);

            const result = await controller.checkLimit('cus_123', 'nonexistent');

            expect(result).toBeNull();
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.checkLimit).mockRejectedValue(new Error('Limit check failed'));

            await expect(controller.checkLimit('cus_123', 'api_calls')).rejects.toThrow('Limit check failed');
        });
    });
});
