/**
 * Payments Controller Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayPaymentsController } from '../../src/controllers/payments.controller.js';
import type { QZPayService } from '../../src/qzpay.service.js';
import { createMockBilling, createMockPayment } from '../helpers/nestjs-mocks.js';

describe('QZPayPaymentsController', () => {
    let controller: QZPayPaymentsController;
    let mockQZPayService: QZPayService;
    let mockBilling: ReturnType<typeof createMockBilling>;

    beforeEach(() => {
        mockBilling = createMockBilling();
        mockQZPayService = {
            getBilling: vi.fn().mockReturnValue(mockBilling),
            processPayment: vi.fn(),
            getPayment: vi.fn(),
            refundPayment: vi.fn()
        } as unknown as QZPayService;

        controller = new QZPayPaymentsController(mockQZPayService);
    });

    describe('process', () => {
        it('should process a payment with all fields', async () => {
            const mockPayment = createMockPayment({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd',
                status: 'succeeded',
                invoiceId: 'inv_123',
                subscriptionId: 'sub_123',
                paymentMethodId: 'pm_123',
                metadata: { orderId: 'order_123' }
            });

            vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

            const dto = {
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd' as const,
                invoiceId: 'inv_123',
                subscriptionId: 'sub_123',
                paymentMethodId: 'pm_123',
                metadata: { orderId: 'order_123' }
            };

            const result = await controller.process(dto);

            expect(result).toEqual(mockPayment);
            expect(mockQZPayService.processPayment).toHaveBeenCalledWith({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd',
                invoiceId: 'inv_123',
                subscriptionId: 'sub_123',
                paymentMethodId: 'pm_123',
                metadata: { orderId: 'order_123' }
            });
        });

        it('should process a payment with required fields only', async () => {
            const mockPayment = createMockPayment({
                customerId: 'cus_123',
                amount: 1500,
                currency: 'usd',
                status: 'succeeded'
            });

            vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

            const dto = {
                customerId: 'cus_123',
                amount: 1500,
                currency: 'usd' as const
            };

            const result = await controller.process(dto);

            expect(result).toEqual(mockPayment);
            expect(mockQZPayService.processPayment).toHaveBeenCalledWith({
                customerId: 'cus_123',
                amount: 1500,
                currency: 'usd'
            });
        });

        it('should handle different currencies', async () => {
            const currencies = ['usd', 'eur', 'gbp', 'jpy', 'brl'] as const;

            for (const currency of currencies) {
                const mockPayment = createMockPayment({ currency });
                vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

                const dto = {
                    customerId: 'cus_123',
                    amount: 1000,
                    currency
                };

                const result = await controller.process(dto);

                expect(result.currency).toBe(currency);
            }
        });

        it('should handle zero amount', async () => {
            const mockPayment = createMockPayment({ amount: 0 });
            vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

            const dto = {
                customerId: 'cus_123',
                amount: 0,
                currency: 'usd' as const
            };

            const result = await controller.process(dto);

            expect(result.amount).toBe(0);
        });

        it('should handle large amounts', async () => {
            const mockPayment = createMockPayment({ amount: 9999999 });
            vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

            const dto = {
                customerId: 'cus_123',
                amount: 9999999,
                currency: 'usd' as const
            };

            const result = await controller.process(dto);

            expect(result.amount).toBe(9999999);
        });

        it('should handle payment with invoice', async () => {
            const mockPayment = createMockPayment({
                invoiceId: 'inv_123'
            });
            vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

            const dto = {
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd' as const,
                invoiceId: 'inv_123'
            };

            const result = await controller.process(dto);

            expect(result).toEqual(mockPayment);
            expect(mockQZPayService.processPayment).toHaveBeenCalledWith({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd',
                invoiceId: 'inv_123'
            });
        });

        it('should handle payment with subscription', async () => {
            const mockPayment = createMockPayment({
                subscriptionId: 'sub_123'
            });
            vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

            const dto = {
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd' as const,
                subscriptionId: 'sub_123'
            };

            const result = await controller.process(dto);

            expect(result).toEqual(mockPayment);
            expect(mockQZPayService.processPayment).toHaveBeenCalledWith({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd',
                subscriptionId: 'sub_123'
            });
        });

        it('should handle payment with specific payment method', async () => {
            const mockPayment = createMockPayment({
                paymentMethodId: 'pm_card_123'
            });
            vi.mocked(mockQZPayService.processPayment).mockResolvedValue(mockPayment);

            const dto = {
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd' as const,
                paymentMethodId: 'pm_card_123'
            };

            const result = await controller.process(dto);

            expect(result).toEqual(mockPayment);
            expect(mockQZPayService.processPayment).toHaveBeenCalledWith({
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd',
                paymentMethodId: 'pm_card_123'
            });
        });

        it('should handle payment processing errors', async () => {
            vi.mocked(mockQZPayService.processPayment).mockRejectedValue(new Error('Payment processing failed'));

            const dto = {
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd' as const
            };

            await expect(controller.process(dto)).rejects.toThrow('Payment processing failed');
        });

        it('should handle insufficient funds error', async () => {
            vi.mocked(mockQZPayService.processPayment).mockRejectedValue(new Error('Insufficient funds'));

            const dto = {
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd' as const
            };

            await expect(controller.process(dto)).rejects.toThrow('Insufficient funds');
        });

        it('should handle invalid payment method error', async () => {
            vi.mocked(mockQZPayService.processPayment).mockRejectedValue(new Error('Invalid payment method'));

            const dto = {
                customerId: 'cus_123',
                amount: 2999,
                currency: 'usd' as const,
                paymentMethodId: 'pm_invalid'
            };

            await expect(controller.process(dto)).rejects.toThrow('Invalid payment method');
        });

        it('should handle customer not found error', async () => {
            vi.mocked(mockQZPayService.processPayment).mockRejectedValue(new Error('Customer not found'));

            const dto = {
                customerId: 'cus_invalid',
                amount: 2999,
                currency: 'usd' as const
            };

            await expect(controller.process(dto)).rejects.toThrow('Customer not found');
        });
    });

    describe('findOne', () => {
        it('should get a payment by ID', async () => {
            const mockPayment = createMockPayment();
            vi.mocked(mockQZPayService.getPayment).mockResolvedValue(mockPayment);

            const result = await controller.findOne('pay_123');

            expect(result).toEqual(mockPayment);
            expect(mockQZPayService.getPayment).toHaveBeenCalledWith('pay_123');
        });

        it('should handle payment not found', async () => {
            vi.mocked(mockQZPayService.getPayment).mockResolvedValue(null);

            const result = await controller.findOne('pay_nonexistent');

            expect(result).toBeNull();
        });

        it('should handle service errors', async () => {
            vi.mocked(mockQZPayService.getPayment).mockRejectedValue(new Error('Database error'));

            await expect(controller.findOne('pay_123')).rejects.toThrow('Database error');
        });
    });

    describe('refund', () => {
        it('should refund full payment amount', async () => {
            const refundedPayment = createMockPayment({
                status: 'refunded',
                refundedAmount: 2999
            });
            vi.mocked(mockQZPayService.refundPayment).mockResolvedValue(refundedPayment);

            const dto = {};

            const result = await controller.refund('pay_123', dto);

            expect(result).toEqual(refundedPayment);
            expect(mockQZPayService.refundPayment).toHaveBeenCalledWith({
                paymentId: 'pay_123'
            });
        });

        it('should refund partial payment amount', async () => {
            const refundedPayment = createMockPayment({
                status: 'partially_refunded',
                refundedAmount: 1000
            });
            vi.mocked(mockQZPayService.refundPayment).mockResolvedValue(refundedPayment);

            const dto = {
                amount: 1000
            };

            const result = await controller.refund('pay_123', dto);

            expect(result).toEqual(refundedPayment);
            expect(mockQZPayService.refundPayment).toHaveBeenCalledWith({
                paymentId: 'pay_123',
                amount: 1000
            });
        });

        it('should refund with reason', async () => {
            const refundedPayment = createMockPayment({
                status: 'refunded',
                refundReason: 'Customer request'
            });
            vi.mocked(mockQZPayService.refundPayment).mockResolvedValue(refundedPayment);

            const dto = {
                reason: 'Customer request'
            };

            const result = await controller.refund('pay_123', dto);

            expect(result).toEqual(refundedPayment);
            expect(mockQZPayService.refundPayment).toHaveBeenCalledWith({
                paymentId: 'pay_123',
                reason: 'Customer request'
            });
        });

        it('should refund with amount and reason', async () => {
            const refundedPayment = createMockPayment({
                status: 'partially_refunded',
                refundedAmount: 1500,
                refundReason: 'Defective product'
            });
            vi.mocked(mockQZPayService.refundPayment).mockResolvedValue(refundedPayment);

            const dto = {
                amount: 1500,
                reason: 'Defective product'
            };

            const result = await controller.refund('pay_123', dto);

            expect(result).toEqual(refundedPayment);
            expect(mockQZPayService.refundPayment).toHaveBeenCalledWith({
                paymentId: 'pay_123',
                amount: 1500,
                reason: 'Defective product'
            });
        });

        it('should handle refund errors', async () => {
            vi.mocked(mockQZPayService.refundPayment).mockRejectedValue(new Error('Refund failed'));

            await expect(controller.refund('pay_123', {})).rejects.toThrow('Refund failed');
        });

        it('should handle already refunded payment', async () => {
            vi.mocked(mockQZPayService.refundPayment).mockRejectedValue(new Error('Payment already refunded'));

            await expect(controller.refund('pay_123', {})).rejects.toThrow('Payment already refunded');
        });

        it('should handle refund amount exceeds payment amount', async () => {
            vi.mocked(mockQZPayService.refundPayment).mockRejectedValue(new Error('Refund amount exceeds payment amount'));

            const dto = { amount: 5000 };

            await expect(controller.refund('pay_123', dto)).rejects.toThrow('Refund amount exceeds payment amount');
        });

        it('should handle payment not found', async () => {
            vi.mocked(mockQZPayService.refundPayment).mockRejectedValue(new Error('Payment not found'));

            await expect(controller.refund('pay_invalid', {})).rejects.toThrow('Payment not found');
        });
    });
});
