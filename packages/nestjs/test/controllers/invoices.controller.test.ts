/**
 * Invoices Controller Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayInvoicesController } from '../../src/controllers/invoices.controller.js';
import type { QZPayService } from '../../src/qzpay.service.js';
import { createMockBilling, createMockInvoice } from '../helpers/nestjs-mocks.js';

describe('QZPayInvoicesController', () => {
    let controller: QZPayInvoicesController;
    let mockQZPayService: QZPayService;
    let mockBilling: ReturnType<typeof createMockBilling>;

    beforeEach(() => {
        mockBilling = createMockBilling();
        mockQZPayService = {
            getBilling: vi.fn().mockReturnValue(mockBilling),
            createInvoice: vi.fn(),
            getInvoice: vi.fn(),
            markInvoicePaid: vi.fn()
        } as unknown as QZPayService;

        controller = new QZPayInvoicesController(mockQZPayService);
    });

    describe('create', () => {
        it('should create an invoice with all fields', async () => {
            const mockInvoice = createMockInvoice({
                customerId: 'cus_123',
                subscriptionId: 'sub_123',
                lines: [
                    {
                        description: 'Premium Plan',
                        quantity: 1,
                        unitAmount: 2999,
                        priceId: 'price_123'
                    }
                ],
                dueDate: new Date('2024-02-01'),
                metadata: { orderId: 'order_123' }
            });

            vi.mocked(mockQZPayService.createInvoice).mockResolvedValue(mockInvoice);

            const dto = {
                customerId: 'cus_123',
                subscriptionId: 'sub_123',
                lines: [
                    {
                        description: 'Premium Plan',
                        quantity: 1,
                        unitAmount: 2999,
                        priceId: 'price_123'
                    }
                ],
                dueDate: '2024-02-01',
                metadata: { orderId: 'order_123' }
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockInvoice);
            expect(mockQZPayService.createInvoice).toHaveBeenCalledWith({
                customerId: 'cus_123',
                subscriptionId: 'sub_123',
                lines: [
                    {
                        description: 'Premium Plan',
                        quantity: 1,
                        unitAmount: 2999,
                        priceId: 'price_123'
                    }
                ],
                dueDate: new Date('2024-02-01'),
                metadata: { orderId: 'order_123' }
            });
        });

        it('should create an invoice with required fields only', async () => {
            const mockInvoice = createMockInvoice({
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Service fee',
                        quantity: 1,
                        unitAmount: 1000
                    }
                ]
            });

            vi.mocked(mockQZPayService.createInvoice).mockResolvedValue(mockInvoice);

            const dto = {
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Service fee',
                        quantity: 1,
                        unitAmount: 1000
                    }
                ]
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockInvoice);
            expect(mockQZPayService.createInvoice).toHaveBeenCalledWith({
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Service fee',
                        quantity: 1,
                        unitAmount: 1000
                    }
                ]
            });
        });

        it('should create an invoice with multiple line items', async () => {
            const mockInvoice = createMockInvoice({
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Base subscription',
                        quantity: 1,
                        unitAmount: 2999
                    },
                    {
                        description: 'Extra users',
                        quantity: 5,
                        unitAmount: 500
                    },
                    {
                        description: 'Storage addon',
                        quantity: 2,
                        unitAmount: 1000
                    }
                ]
            });

            vi.mocked(mockQZPayService.createInvoice).mockResolvedValue(mockInvoice);

            const dto = {
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Base subscription',
                        quantity: 1,
                        unitAmount: 2999
                    },
                    {
                        description: 'Extra users',
                        quantity: 5,
                        unitAmount: 500
                    },
                    {
                        description: 'Storage addon',
                        quantity: 2,
                        unitAmount: 1000
                    }
                ]
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockInvoice);
            expect(result.lines).toHaveLength(3);
        });

        it('should create an invoice with subscription', async () => {
            const mockInvoice = createMockInvoice({
                subscriptionId: 'sub_123'
            });
            vi.mocked(mockQZPayService.createInvoice).mockResolvedValue(mockInvoice);

            const dto = {
                customerId: 'cus_123',
                subscriptionId: 'sub_123',
                lines: [
                    {
                        description: 'Monthly charge',
                        quantity: 1,
                        unitAmount: 2999
                    }
                ]
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockInvoice);
            expect(mockQZPayService.createInvoice).toHaveBeenCalledWith({
                customerId: 'cus_123',
                subscriptionId: 'sub_123',
                lines: [
                    {
                        description: 'Monthly charge',
                        quantity: 1,
                        unitAmount: 2999
                    }
                ]
            });
        });

        it('should create an invoice with due date', async () => {
            const dueDate = '2024-03-15';
            const mockInvoice = createMockInvoice({
                dueDate: new Date(dueDate)
            });
            vi.mocked(mockQZPayService.createInvoice).mockResolvedValue(mockInvoice);

            const dto = {
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Invoice item',
                        quantity: 1,
                        unitAmount: 5000
                    }
                ],
                dueDate
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockInvoice);
            expect(mockQZPayService.createInvoice).toHaveBeenCalledWith({
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Invoice item',
                        quantity: 1,
                        unitAmount: 5000
                    }
                ],
                dueDate: new Date(dueDate)
            });
        });

        it('should create an invoice with metadata', async () => {
            const mockInvoice = createMockInvoice({
                metadata: { orderId: 'order_456', project: 'ProjectX' }
            });
            vi.mocked(mockQZPayService.createInvoice).mockResolvedValue(mockInvoice);

            const dto = {
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Service',
                        quantity: 1,
                        unitAmount: 3000
                    }
                ],
                metadata: { orderId: 'order_456', project: 'ProjectX' }
            };

            const result = await controller.create(dto);

            expect(result).toEqual(mockInvoice);
            expect(mockQZPayService.createInvoice).toHaveBeenCalledWith({
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Service',
                        quantity: 1,
                        unitAmount: 3000
                    }
                ],
                metadata: { orderId: 'order_456', project: 'ProjectX' }
            });
        });

        it('should handle empty lines array error', async () => {
            vi.mocked(mockQZPayService.createInvoice).mockRejectedValue(new Error('Invoice must have at least one line item'));

            const dto = {
                customerId: 'cus_123',
                lines: []
            };

            await expect(controller.create(dto)).rejects.toThrow('Invoice must have at least one line item');
        });

        it('should handle customer not found error', async () => {
            vi.mocked(mockQZPayService.createInvoice).mockRejectedValue(new Error('Customer not found'));

            const dto = {
                customerId: 'cus_invalid',
                lines: [
                    {
                        description: 'Test',
                        quantity: 1,
                        unitAmount: 1000
                    }
                ]
            };

            await expect(controller.create(dto)).rejects.toThrow('Customer not found');
        });

        it('should handle invalid subscription error', async () => {
            vi.mocked(mockQZPayService.createInvoice).mockRejectedValue(new Error('Subscription not found'));

            const dto = {
                customerId: 'cus_123',
                subscriptionId: 'sub_invalid',
                lines: [
                    {
                        description: 'Test',
                        quantity: 1,
                        unitAmount: 1000
                    }
                ]
            };

            await expect(controller.create(dto)).rejects.toThrow('Subscription not found');
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.createInvoice).mockRejectedValue(new Error('Invoice creation failed'));

            const dto = {
                customerId: 'cus_123',
                lines: [
                    {
                        description: 'Test',
                        quantity: 1,
                        unitAmount: 1000
                    }
                ]
            };

            await expect(controller.create(dto)).rejects.toThrow('Invoice creation failed');
        });
    });

    describe('findOne', () => {
        it('should get an invoice by ID', async () => {
            const mockInvoice = createMockInvoice();
            vi.mocked(mockQZPayService.getInvoice).mockResolvedValue(mockInvoice);

            const result = await controller.findOne('inv_123');

            expect(result).toEqual(mockInvoice);
            expect(mockQZPayService.getInvoice).toHaveBeenCalledWith('inv_123');
        });

        it('should handle invoice not found', async () => {
            vi.mocked(mockQZPayService.getInvoice).mockResolvedValue(null);

            const result = await controller.findOne('inv_nonexistent');

            expect(result).toBeNull();
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getInvoice).mockRejectedValue(new Error('Database error'));

            await expect(controller.findOne('inv_123')).rejects.toThrow('Database error');
        });
    });

    describe('markPaid', () => {
        it('should mark an invoice as paid', async () => {
            const paidInvoice = createMockInvoice({
                status: 'paid',
                paidAt: new Date(),
                paymentId: 'pay_123'
            });
            vi.mocked(mockQZPayService.markInvoicePaid).mockResolvedValue(paidInvoice);

            const dto = {
                paymentId: 'pay_123'
            };

            const result = await controller.markPaid('inv_123', dto);

            expect(result).toEqual(paidInvoice);
            expect(mockQZPayService.markInvoicePaid).toHaveBeenCalledWith('inv_123', 'pay_123');
        });

        it('should handle invoice not found', async () => {
            vi.mocked(mockQZPayService.markInvoicePaid).mockRejectedValue(new Error('Invoice not found'));

            const dto = {
                paymentId: 'pay_123'
            };

            await expect(controller.markPaid('inv_invalid', dto)).rejects.toThrow('Invoice not found');
        });

        it('should handle payment not found', async () => {
            vi.mocked(mockQZPayService.markInvoicePaid).mockRejectedValue(new Error('Payment not found'));

            const dto = {
                paymentId: 'pay_invalid'
            };

            await expect(controller.markPaid('inv_123', dto)).rejects.toThrow('Payment not found');
        });

        it('should handle already paid invoice', async () => {
            vi.mocked(mockQZPayService.markInvoicePaid).mockRejectedValue(new Error('Invoice already paid'));

            const dto = {
                paymentId: 'pay_123'
            };

            await expect(controller.markPaid('inv_123', dto)).rejects.toThrow('Invoice already paid');
        });

        it('should handle payment amount mismatch', async () => {
            vi.mocked(mockQZPayService.markInvoicePaid).mockRejectedValue(new Error('Payment amount does not match invoice amount'));

            const dto = {
                paymentId: 'pay_123'
            };

            await expect(controller.markPaid('inv_123', dto)).rejects.toThrow('Payment amount does not match invoice amount');
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.markInvoicePaid).mockRejectedValue(new Error('Mark paid operation failed'));

            const dto = {
                paymentId: 'pay_123'
            };

            await expect(controller.markPaid('inv_123', dto)).rejects.toThrow('Mark paid operation failed');
        });
    });
});
