/**
 * MercadoPago Adapter Resilience Tests
 *
 * Tests for timeout handling, retry logic, and error recovery
 */
import type { MercadoPagoConfig } from 'mercadopago';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoCustomerAdapter } from '../src/adapters/customer.adapter.js';
import { QZPayMercadoPagoPaymentAdapter } from '../src/adapters/payment.adapter.js';
import { QZPayMercadoPagoSubscriptionAdapter } from '../src/adapters/subscription.adapter.js';

// ==================== Mock MercadoPago Errors ====================

class MercadoPagoError extends Error {
    status: number;
    cause: { code: string; description: string }[];

    constructor(message: string, status: number, causes: { code: string; description: string }[] = []) {
        super(message);
        this.name = 'MercadoPagoError';
        this.status = status;
        this.cause = causes;
    }
}

class MPRateLimitError extends MercadoPagoError {
    constructor() {
        super('Too many requests', 429, [{ code: 'rate_limit', description: 'Rate limit exceeded' }]);
    }
}

class MPInternalError extends MercadoPagoError {
    constructor(message = 'Internal server error') {
        super(message, 500, [{ code: 'internal_error', description: message }]);
    }
}

class MPBadRequestError extends MercadoPagoError {
    constructor(message = 'Bad request', code = 'bad_request') {
        super(message, 400, [{ code, description: message }]);
    }
}

class MPNotFoundError extends MercadoPagoError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, [{ code: 'not_found', description: `${resource} not found` }]);
    }
}

class MPPaymentError extends MercadoPagoError {
    constructor(message: string, code: string) {
        super(message, 400, [{ code, description: message }]);
    }
}

// ==================== Mock Setup Helpers ====================

function createMockPaymentApi() {
    return {
        create: vi.fn(),
        get: vi.fn(),
        capture: vi.fn(),
        cancel: vi.fn()
    };
}

function createMockRefundApi() {
    return {
        create: vi.fn()
    };
}

function createMockCustomerApi() {
    return {
        create: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        search: vi.fn()
    };
}

function createMockPreapprovalApi() {
    return {
        create: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        search: vi.fn()
    };
}

// ==================== Payment Adapter Resilience Tests ====================

describe('MercadoPago Payment Adapter Resilience', () => {
    let mockPaymentApi: ReturnType<typeof createMockPaymentApi>;
    let mockRefundApi: ReturnType<typeof createMockRefundApi>;
    let adapter: QZPayMercadoPagoPaymentAdapter;

    const mockPayment = {
        id: 12345,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100.0,
        currency_id: 'ARS',
        metadata: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockPaymentApi = createMockPaymentApi();
        mockRefundApi = createMockRefundApi();

        mockPaymentApi.create.mockResolvedValue(mockPayment);
        mockPaymentApi.get.mockResolvedValue(mockPayment);
        mockPaymentApi.capture.mockResolvedValue(mockPayment);
        mockPaymentApi.cancel.mockResolvedValue(mockPayment);
        mockRefundApi.create.mockResolvedValue({ id: 999, status: 'approved', amount: 100.0 });

        // Create adapter with mocked dependencies
        const mockClient = {} as MercadoPagoConfig;
        adapter = new QZPayMercadoPagoPaymentAdapter(mockClient);

        // Inject mocks
        // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
        (adapter as any).paymentApi = mockPaymentApi;
        // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
        (adapter as any).refundApi = mockRefundApi;
    });

    describe('Rate Limit Handling', () => {
        it('should propagate rate limit errors on create', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPRateLimitError());

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('Too many requests');
        });

        it('should propagate rate limit errors on retrieve', async () => {
            mockPaymentApi.get.mockRejectedValue(new MPRateLimitError());

            await expect(adapter.retrieve('12345')).rejects.toThrow('Too many requests');
        });

        it('should include rate limit status code', async () => {
            const error = new MPRateLimitError();
            mockPaymentApi.create.mockRejectedValue(error);

            try {
                await adapter.create('cus_123', { amount: 10000, currency: 'ARS' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as MercadoPagoError).status).toBe(429);
            }
        });
    });

    describe('API Error Handling', () => {
        it('should propagate internal errors on create', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPInternalError());

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('Internal server error');
        });

        it('should propagate internal errors on capture', async () => {
            mockPaymentApi.capture.mockRejectedValue(new MPInternalError('Service temporarily unavailable'));

            await expect(adapter.capture('12345')).rejects.toThrow('temporarily unavailable');
        });

        it('should propagate internal errors on cancel', async () => {
            mockPaymentApi.cancel.mockRejectedValue(new MPInternalError());

            await expect(adapter.cancel('12345')).rejects.toThrow();
        });

        it('should propagate internal errors on refund', async () => {
            mockRefundApi.create.mockRejectedValue(new MPInternalError());

            await expect(adapter.refund({ amount: 5000 }, '12345')).rejects.toThrow();
        });
    });

    describe('Bad Request Handling', () => {
        it('should handle invalid amount', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPBadRequestError('Invalid transaction_amount', 'invalid_amount'));

            await expect(adapter.create('cus_123', { amount: -100, currency: 'ARS' })).rejects.toThrow('Invalid transaction_amount');
        });

        it('should handle invalid currency', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPBadRequestError('Invalid currency_id', 'invalid_currency'));

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'XYZ' })).rejects.toThrow('Invalid currency');
        });

        it('should handle invalid payment method', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPBadRequestError('Invalid payment_method_id', 'invalid_payment_method'));

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS', paymentMethodId: 'invalid' })).rejects.toThrow(
                'Invalid payment_method'
            );
        });
    });

    describe('Not Found Handling', () => {
        it('should handle payment not found on retrieve', async () => {
            mockPaymentApi.get.mockRejectedValue(new MPNotFoundError('Payment'));

            await expect(adapter.retrieve('99999')).rejects.toThrow('not found');
        });

        it('should handle payment not found on capture', async () => {
            mockPaymentApi.capture.mockRejectedValue(new MPNotFoundError('Payment'));

            await expect(adapter.capture('99999')).rejects.toThrow('not found');
        });

        it('should handle payment not found on cancel', async () => {
            mockPaymentApi.cancel.mockRejectedValue(new MPNotFoundError('Payment'));

            await expect(adapter.cancel('99999')).rejects.toThrow('not found');
        });
    });

    describe('Payment Specific Errors', () => {
        it('should handle rejected by card issuer', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPPaymentError('Payment rejected by card issuer', 'cc_rejected_other_reason'));

            try {
                await adapter.create('cus_123', { amount: 10000, currency: 'ARS', paymentMethodId: 'visa' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as MercadoPagoError).cause[0].code).toBe('cc_rejected_other_reason');
            }
        });

        it('should handle insufficient funds', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPPaymentError('Insufficient funds', 'cc_rejected_insufficient_amount'));

            try {
                await adapter.create('cus_123', { amount: 100000, currency: 'ARS', paymentMethodId: 'visa' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as MercadoPagoError).cause[0].code).toBe('cc_rejected_insufficient_amount');
            }
        });

        it('should handle invalid CVV', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPPaymentError('Invalid security code', 'cc_rejected_bad_filled_security_code'));

            try {
                await adapter.create('cus_123', { amount: 10000, currency: 'ARS', paymentMethodId: 'visa' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as MercadoPagoError).cause[0].code).toBe('cc_rejected_bad_filled_security_code');
            }
        });

        it('should handle expired card', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPPaymentError('Card expired', 'cc_rejected_card_expired'));

            try {
                await adapter.create('cus_123', { amount: 10000, currency: 'ARS', paymentMethodId: 'visa' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as MercadoPagoError).cause[0].code).toBe('cc_rejected_card_expired');
            }
        });

        it('should handle blacklisted card', async () => {
            mockPaymentApi.create.mockRejectedValue(new MPPaymentError('Card is blacklisted', 'cc_rejected_blacklist'));

            try {
                await adapter.create('cus_123', { amount: 10000, currency: 'ARS', paymentMethodId: 'visa' });
                expect.fail('Should have thrown');
            } catch (e) {
                expect((e as MercadoPagoError).cause[0].code).toBe('cc_rejected_blacklist');
            }
        });
    });

    describe('Timeout Handling', () => {
        it('should handle timeout on create', async () => {
            const timeoutError = new Error('Request timeout');
            timeoutError.name = 'TimeoutError';
            mockPaymentApi.create.mockRejectedValue(timeoutError);

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('timeout');
        });

        it('should handle slow responses', async () => {
            mockPaymentApi.get.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockPayment), 100)));

            const startTime = Date.now();
            const result = await adapter.retrieve('12345');
            const duration = Date.now() - startTime;

            expect(result.id).toBe('12345');
            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });

    describe('Concurrent Request Handling', () => {
        it('should handle multiple concurrent creates', async () => {
            let counter = 0;
            mockPaymentApi.create.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                counter++;
                return { ...mockPayment, id: 10000 + counter };
            });

            const promises = Array.from({ length: 5 }, (_, i) => adapter.create('cus_123', { amount: 10000 + i * 100, currency: 'ARS' }));

            const results = await Promise.all(promises);

            expect(results).toHaveLength(5);
            const ids = results.map((r) => r.id);
            expect(new Set(ids).size).toBe(5);
        });

        it('should handle mixed success and failure', async () => {
            let callCount = 0;
            mockPaymentApi.create.mockImplementation(async () => {
                callCount++;
                if (callCount % 2 === 0) {
                    throw new MPInternalError('Temporary error');
                }
                return { ...mockPayment, id: callCount };
            });

            const results = await Promise.allSettled([
                adapter.create('cus_123', { amount: 10000, currency: 'ARS' }),
                adapter.create('cus_123', { amount: 20000, currency: 'ARS' }),
                adapter.create('cus_123', { amount: 30000, currency: 'ARS' }),
                adapter.create('cus_123', { amount: 40000, currency: 'ARS' })
            ]);

            const fulfilled = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter((r) => r.status === 'rejected');

            expect(fulfilled.length).toBe(2);
            expect(rejected.length).toBe(2);
        });
    });
});

// ==================== Customer Adapter Resilience Tests ====================

describe('MercadoPago Customer Adapter Resilience', () => {
    let mockCustomerApi: ReturnType<typeof createMockCustomerApi>;
    let adapter: QZPayMercadoPagoCustomerAdapter;

    const mockCustomer = {
        id: 'cust_123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockCustomerApi = createMockCustomerApi();

        mockCustomerApi.create.mockResolvedValue(mockCustomer);
        mockCustomerApi.get.mockResolvedValue(mockCustomer);
        mockCustomerApi.update.mockResolvedValue(mockCustomer);
        mockCustomerApi.remove.mockResolvedValue({});
        mockCustomerApi.search.mockResolvedValue({ results: [mockCustomer], paging: { total: 1 } });

        const mockClient = {} as MercadoPagoConfig;
        adapter = new QZPayMercadoPagoCustomerAdapter(mockClient);

        // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
        (adapter as any).customerApi = mockCustomerApi;
    });

    describe('Customer Not Found', () => {
        it('should handle customer not found on retrieve', async () => {
            mockCustomerApi.get.mockRejectedValue(new MPNotFoundError('Customer'));

            await expect(adapter.retrieve('invalid_id')).rejects.toThrow('not found');
        });

        it('should handle customer not found on update', async () => {
            mockCustomerApi.update.mockRejectedValue(new MPNotFoundError('Customer'));

            await expect(adapter.update('invalid_id', { name: 'New Name' })).rejects.toThrow('not found');
        });

        it('should handle customer not found on delete', async () => {
            mockCustomerApi.remove.mockRejectedValue(new MPNotFoundError('Customer'));

            await expect(adapter.delete('invalid_id')).rejects.toThrow('not found');
        });
    });

    describe('Duplicate Email Handling', () => {
        it('should handle duplicate email error', async () => {
            mockCustomerApi.create.mockRejectedValue(new MPBadRequestError('Email already exists', 'duplicate_email'));

            await expect(adapter.create({ email: 'existing@example.com' })).rejects.toThrow('already exists');
        });
    });

    describe('Rate Limit on Customer Operations', () => {
        it('should propagate rate limits on retrieve', async () => {
            mockCustomerApi.get.mockRejectedValue(new MPRateLimitError());

            await expect(adapter.retrieve('cust_123')).rejects.toThrow('Too many requests');
        });
    });
});

// ==================== Subscription Adapter Resilience Tests ====================

describe('MercadoPago Subscription Adapter Resilience', () => {
    let mockPreapprovalApi: ReturnType<typeof createMockPreapprovalApi>;
    let adapter: QZPayMercadoPagoSubscriptionAdapter;

    const mockPreapproval = {
        id: 'preapproval_123',
        status: 'authorized',
        payer_email: 'test@example.com',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 99.99,
            currency_id: 'ARS'
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockPreapprovalApi = createMockPreapprovalApi();

        mockPreapprovalApi.create.mockResolvedValue(mockPreapproval);
        mockPreapprovalApi.get.mockResolvedValue(mockPreapproval);
        mockPreapprovalApi.update.mockResolvedValue(mockPreapproval);
        mockPreapprovalApi.search.mockResolvedValue({ results: [mockPreapproval], paging: { total: 1 } });

        const mockClient = {} as MercadoPagoConfig;
        adapter = new QZPayMercadoPagoSubscriptionAdapter(mockClient);

        // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
        (adapter as any).preapprovalApi = mockPreapprovalApi;
    });

    describe('Subscription State Errors', () => {
        it('should handle canceling already canceled subscription', async () => {
            mockPreapprovalApi.update.mockRejectedValue(
                new MPBadRequestError('Cannot cancel subscription in status cancelled', 'invalid_status')
            );

            await expect(adapter.cancel('preapproval_123')).rejects.toThrow('Cannot cancel');
        });

        it('should handle updating paused subscription', async () => {
            mockPreapprovalApi.update.mockRejectedValue(new MPBadRequestError('Cannot update paused subscription', 'invalid_status'));

            await expect(adapter.update('preapproval_123', { priceId: 'new_price' })).rejects.toThrow('Cannot update');
        });
    });

    describe('Subscription Not Found', () => {
        it('should handle subscription not found on retrieve', async () => {
            mockPreapprovalApi.get.mockRejectedValue(new MPNotFoundError('Preapproval'));

            await expect(adapter.retrieve('invalid_id')).rejects.toThrow('not found');
        });
    });

    describe('Validation Errors', () => {
        it('should handle invalid amount', async () => {
            mockPreapprovalApi.create.mockRejectedValue(new MPBadRequestError('Invalid transaction_amount', 'invalid_amount'));

            await expect(adapter.create('cust_123', { priceId: 'price_123' })).rejects.toThrow('Invalid');
        });
    });
});

// ==================== Error Recovery Scenarios ====================

describe('Error Recovery Scenarios', () => {
    describe('Transient Error Recovery', () => {
        it('should succeed after transient failures (simulated retry)', async () => {
            let attempts = 0;
            const mockPaymentApi = createMockPaymentApi();

            mockPaymentApi.create.mockImplementation(async () => {
                attempts++;
                if (attempts < 3) {
                    throw new MPInternalError('Temporary error');
                }
                return { id: 12345, status: 'approved', transaction_amount: 100.0, currency_id: 'ARS', metadata: {} };
            });

            const mockClient = {} as MercadoPagoConfig;
            const adapter = new QZPayMercadoPagoPaymentAdapter(mockClient);
            // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
            (adapter as any).paymentApi = mockPaymentApi;

            let result: { id: string; status: string; amount: number; currency: string; metadata: Record<string, string> } | undefined;
            for (let i = 0; i < 5; i++) {
                try {
                    result = await adapter.create('cus_123', { amount: 10000, currency: 'ARS' });
                    break;
                } catch {
                    if (i === 4) throw new Error('Max retries exceeded');
                }
            }

            expect(result?.id).toBe('12345');
            expect(attempts).toBe(3);
        });
    });

    describe('Idempotency Support', () => {
        it('should support idempotency through external_reference', async () => {
            const mockPaymentApi = createMockPaymentApi();

            mockPaymentApi.create.mockResolvedValue({
                id: 12345,
                status: 'approved',
                transaction_amount: 100.0,
                currency_id: 'ARS',
                external_reference: 'order_123',
                metadata: { idempotencyKey: 'idem_123' }
            });

            const mockClient = {} as MercadoPagoConfig;
            const adapter = new QZPayMercadoPagoPaymentAdapter(mockClient);
            // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
            (adapter as any).paymentApi = mockPaymentApi;

            const result = await adapter.create('cus_123', {
                amount: 10000,
                currency: 'ARS',
                metadata: { idempotencyKey: 'idem_123' }
            });

            expect(result.metadata.idempotencyKey).toBe('idem_123');
        });
    });

    describe('Partial Failure Handling', () => {
        it('should handle partial refund when full refund fails', async () => {
            const mockPaymentApi = createMockPaymentApi();
            const mockRefundApi = createMockRefundApi();

            mockPaymentApi.get.mockResolvedValue({
                id: 12345,
                status: 'approved',
                transaction_amount: 100.0,
                currency_id: 'ARS',
                metadata: {}
            });

            mockRefundApi.create
                .mockRejectedValueOnce(new MPBadRequestError('Amount exceeds available balance', 'invalid_amount'))
                .mockResolvedValueOnce({ id: 999, status: 'approved', amount: 50.0 });

            const mockClient = {} as MercadoPagoConfig;
            const adapter = new QZPayMercadoPagoPaymentAdapter(mockClient);
            // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
            (adapter as any).paymentApi = mockPaymentApi;
            // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
            (adapter as any).refundApi = mockRefundApi;

            // First try full refund
            await expect(adapter.refund({ amount: 10000 }, '12345')).rejects.toThrow('exceeds available');

            // Then partial refund succeeds
            const result = await adapter.refund({ amount: 5000 }, '12345');
            expect(result.amount).toBe(5000);
        });
    });
});

// ==================== Network Specific Errors ====================

describe('Network Specific Errors', () => {
    let adapter: QZPayMercadoPagoPaymentAdapter;
    let mockPaymentApi: ReturnType<typeof createMockPaymentApi>;

    beforeEach(() => {
        mockPaymentApi = createMockPaymentApi();
        const mockClient = {} as MercadoPagoConfig;
        adapter = new QZPayMercadoPagoPaymentAdapter(mockClient);
        // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
        (adapter as any).paymentApi = mockPaymentApi;
    });

    describe('Connection Errors', () => {
        it('should handle ECONNREFUSED', async () => {
            const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
            (error as NodeJS.ErrnoException).code = 'ECONNREFUSED';
            mockPaymentApi.create.mockRejectedValue(error);

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('ECONNREFUSED');
        });

        it('should handle ENOTFOUND', async () => {
            const error = new Error('getaddrinfo ENOTFOUND api.mercadopago.com');
            (error as NodeJS.ErrnoException).code = 'ENOTFOUND';
            mockPaymentApi.create.mockRejectedValue(error);

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('ENOTFOUND');
        });

        it('should handle ETIMEDOUT', async () => {
            const error = new Error('connect ETIMEDOUT');
            (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
            mockPaymentApi.create.mockRejectedValue(error);

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('ETIMEDOUT');
        });

        it('should handle socket hang up', async () => {
            const error = new Error('socket hang up');
            (error as NodeJS.ErrnoException).code = 'ECONNRESET';
            mockPaymentApi.create.mockRejectedValue(error);

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('socket hang up');
        });
    });

    describe('SSL/TLS Errors', () => {
        it('should handle certificate errors', async () => {
            const error = new Error('unable to verify the first certificate');
            error.name = 'Error';
            mockPaymentApi.create.mockRejectedValue(error);

            await expect(adapter.create('cus_123', { amount: 10000, currency: 'ARS' })).rejects.toThrow('certificate');
        });
    });
});

// ==================== Status Transition Tests ====================

describe('Payment Status Transition Handling', () => {
    let adapter: QZPayMercadoPagoPaymentAdapter;
    let mockPaymentApi: ReturnType<typeof createMockPaymentApi>;

    beforeEach(() => {
        mockPaymentApi = createMockPaymentApi();
        const mockClient = {} as MercadoPagoConfig;
        adapter = new QZPayMercadoPagoPaymentAdapter(mockClient);
        // biome-ignore lint/suspicious/noExplicitAny: Test mock injection
        (adapter as any).paymentApi = mockPaymentApi;
    });

    it('should handle pending to approved transition (mapped to succeeded)', async () => {
        mockPaymentApi.get
            .mockResolvedValueOnce({ id: 12345, status: 'pending', transaction_amount: 100.0, currency_id: 'ARS' })
            .mockResolvedValueOnce({ id: 12345, status: 'approved', transaction_amount: 100.0, currency_id: 'ARS' });

        const pending = await adapter.retrieve('12345');
        expect(pending.status).toBe('pending');

        const approved = await adapter.retrieve('12345');
        // 'approved' is mapped to 'succeeded' by MERCADOPAGO_PAYMENT_STATUS
        expect(approved.status).toBe('succeeded');
    });

    it('should handle pending to rejected transition (mapped to failed)', async () => {
        mockPaymentApi.get
            .mockResolvedValueOnce({ id: 12345, status: 'pending', transaction_amount: 100.0, currency_id: 'ARS' })
            .mockResolvedValueOnce({ id: 12345, status: 'rejected', transaction_amount: 100.0, currency_id: 'ARS' });

        const pending = await adapter.retrieve('12345');
        expect(pending.status).toBe('pending');

        const rejected = await adapter.retrieve('12345');
        // 'rejected' is mapped to 'failed' by MERCADOPAGO_PAYMENT_STATUS
        expect(rejected.status).toBe('failed');
    });

    it('should handle in_process status (3DS) mapped to processing', async () => {
        mockPaymentApi.get.mockResolvedValue({
            id: 12345,
            status: 'in_process',
            status_detail: 'pending_challenge',
            transaction_amount: 100.0,
            currency_id: 'ARS'
        });

        const result = await adapter.retrieve('12345');
        // 'in_process' is mapped to 'processing' by MERCADOPAGO_PAYMENT_STATUS
        expect(result.status).toBe('processing');
    });
});
