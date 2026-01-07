/**
 * Tests for the Health Check Service
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QZPayPaymentAdapter } from '../../src/adapters/payment.adapter.js';
import type { QZPayStorageAdapter } from '../../src/adapters/storage.adapter.js';
import { QZPayHealthService, createHealthService } from '../../src/services/health.service.js';
import { noopLogger } from '../../src/utils/default-logger.js';

describe('Health Service', () => {
    let mockStorage: QZPayStorageAdapter;
    let mockPaymentAdapter: QZPayPaymentAdapter;

    beforeEach(() => {
        // Create mock storage adapter
        mockStorage = {
            customers: {
                create: vi.fn(),
                findById: vi.fn(),
                findByExternalId: vi.fn(),
                findByEmail: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            },
            subscriptions: {
                create: vi.fn(),
                findById: vi.fn(),
                findByCustomerId: vi.fn(),
                update: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            },
            payments: {
                create: vi.fn(),
                findById: vi.fn(),
                findByCustomerId: vi.fn(),
                update: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            },
            invoices: {
                create: vi.fn(),
                findById: vi.fn(),
                findByCustomerId: vi.fn(),
                update: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            },
            plans: {
                create: vi.fn(),
                findById: vi.fn(),
                update: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            },
            prices: {
                create: vi.fn(),
                findById: vi.fn(),
                findByPlanId: vi.fn(),
                update: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            },
            promoCodes: {
                create: vi.fn(),
                findById: vi.fn(),
                findByCode: vi.fn(),
                update: vi.fn(),
                incrementRedemptions: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            },
            entitlements: {
                check: vi.fn(),
                findByCustomerId: vi.fn(),
                grant: vi.fn(),
                revoke: vi.fn()
            },
            limits: {
                check: vi.fn(),
                findByCustomerId: vi.fn(),
                increment: vi.fn(),
                set: vi.fn(),
                recordUsage: vi.fn()
            },
            addons: {
                create: vi.fn(),
                findById: vi.fn(),
                findByPlanId: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
                addToSubscription: vi.fn(),
                removeFromSubscription: vi.fn(),
                updateSubscriptionAddOn: vi.fn(),
                findBySubscriptionId: vi.fn(),
                findSubscriptionAddOn: vi.fn()
            },
            events: {
                create: vi.fn(),
                findById: vi.fn(),
                list: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false })
            }
        } as unknown as QZPayStorageAdapter;

        // Create mock payment adapter
        // Health check uses customers.retrieve with a probe ID - a "not found" error is expected and means healthy
        mockPaymentAdapter = {
            provider: 'stripe',
            customers: {
                create: vi.fn(),
                retrieve: vi.fn().mockRejectedValue(new Error('No such customer: qzpay_health_probe_123')),
                update: vi.fn(),
                delete: vi.fn()
            },
            subscriptions: {
                create: vi.fn(),
                retrieve: vi.fn(),
                update: vi.fn(),
                cancel: vi.fn(),
                pause: vi.fn(),
                resume: vi.fn()
            },
            payments: {
                create: vi.fn(),
                retrieve: vi.fn(),
                capture: vi.fn(),
                cancel: vi.fn(),
                refund: vi.fn()
            },
            prices: {
                create: vi.fn(),
                retrieve: vi.fn(),
                archive: vi.fn(),
                createProduct: vi.fn()
            },
            checkout: {
                create: vi.fn(),
                retrieve: vi.fn(),
                expire: vi.fn()
            },
            webhooks: {
                constructEvent: vi.fn(),
                verifySignature: vi.fn()
            }
        } as unknown as QZPayPaymentAdapter;
    });

    describe('createHealthService', () => {
        it('should create a health service instance', () => {
            const service = createHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            expect(service).toBeInstanceOf(QZPayHealthService);
        });
    });

    describe('getHealthStatus', () => {
        it('should return healthy status when all components are healthy', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                paymentAdapter: mockPaymentAdapter,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            expect(status.status).toBe('healthy');
            expect(status.components).toHaveLength(2);
            expect(status.components[0]?.name).toBe('storage');
            expect(status.components[0]?.status).toBe('healthy');
            expect(status.components[1]?.name).toBe('payment_adapter');
            expect(status.components[1]?.status).toBe('healthy');
        });

        it('should include timestamp in health report', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            expect(status.timestamp).toBeInstanceOf(Date);
        });

        it('should include total response time', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            expect(status.totalResponseTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('should include version when provided', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger,
                version: '1.0.0'
            });

            const status = await service.getHealthStatus();

            expect(status.version).toBe('1.0.0');
        });

        it('should not include version when not provided', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            expect(status.version).toBeUndefined();
        });
    });

    describe('Storage health check', () => {
        it('should return healthy when storage responds', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const storageComponent = status.components.find((c) => c.name === 'storage');
            expect(storageComponent?.status).toBe('healthy');
        });

        it('should return unhealthy when storage fails', async () => {
            vi.mocked(mockStorage.customers.list).mockRejectedValue(new Error('Database connection failed'));

            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const storageComponent = status.components.find((c) => c.name === 'storage');
            expect(storageComponent?.status).toBe('unhealthy');
            expect(storageComponent?.error).toBe('Database connection failed');
        });

        it('should set overall status to unhealthy when storage fails', async () => {
            vi.mocked(mockStorage.customers.list).mockRejectedValue(new Error('Database error'));

            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            expect(status.status).toBe('unhealthy');
        });

        it('should include response time for storage check', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const storageComponent = status.components.find((c) => c.name === 'storage');
            expect(storageComponent?.responseTimeMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Payment adapter health check', () => {
        it('should check payment adapter when provided', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                paymentAdapter: mockPaymentAdapter,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const paymentComponent = status.components.find((c) => c.name === 'payment_adapter');
            expect(paymentComponent).toBeDefined();
            expect(paymentComponent?.status).toBe('healthy');
        });

        it('should not include payment adapter when not provided', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const paymentComponent = status.components.find((c) => c.name === 'payment_adapter');
            expect(paymentComponent).toBeUndefined();
        });

        it('should return unhealthy when payment adapter fails with connection error', async () => {
            // Connection errors (not "not found") indicate the API is unreachable
            vi.mocked(mockPaymentAdapter.customers.retrieve).mockRejectedValue(new Error('Connection refused'));

            const service = new QZPayHealthService({
                storage: mockStorage,
                paymentAdapter: mockPaymentAdapter,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const paymentComponent = status.components.find((c) => c.name === 'payment_adapter');
            expect(paymentComponent?.status).toBe('unhealthy');
            expect(paymentComponent?.error).toBe('Connection refused');
        });

        it('should include provider name in payment adapter details', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                paymentAdapter: mockPaymentAdapter,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const paymentComponent = status.components.find((c) => c.name === 'payment_adapter');
            expect(paymentComponent?.details?.provider).toBe('stripe');
        });
    });

    describe('isHealthy', () => {
        it('should return true when all components are healthy', async () => {
            const service = new QZPayHealthService({
                storage: mockStorage,
                paymentAdapter: mockPaymentAdapter,
                logger: noopLogger
            });

            const healthy = await service.isHealthy();

            expect(healthy).toBe(true);
        });

        it('should return false when storage fails', async () => {
            vi.mocked(mockStorage.customers.list).mockRejectedValue(new Error('Database error'));

            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const healthy = await service.isHealthy();

            expect(healthy).toBe(false);
        });

        it('should return false when payment adapter fails', async () => {
            // Connection errors indicate the API is unreachable
            vi.mocked(mockPaymentAdapter.customers.retrieve).mockRejectedValue(new Error('API connection error'));

            const service = new QZPayHealthService({
                storage: mockStorage,
                paymentAdapter: mockPaymentAdapter,
                logger: noopLogger
            });

            const healthy = await service.isHealthy();

            expect(healthy).toBe(false);
        });
    });

    describe('Degraded status', () => {
        it('should return degraded when storage is slow', async () => {
            // Simulate slow storage response
            vi.mocked(mockStorage.customers.list).mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve({ data: [], total: 0, hasMore: false }), 2100);
                    })
            );

            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger,
                timeoutMs: 10000 // High timeout to let it complete
            });

            const status = await service.getHealthStatus();

            const storageComponent = status.components.find((c) => c.name === 'storage');
            expect(storageComponent?.status).toBe('degraded');
        });

        it('should set overall status to degraded when a component is degraded', async () => {
            // Mock slow storage
            vi.mocked(mockStorage.customers.list).mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve({ data: [], total: 0, hasMore: false }), 2100);
                    })
            );

            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger,
                timeoutMs: 10000
            });

            const status = await service.getHealthStatus();

            expect(status.status).toBe('degraded');
        });
    });

    describe('Timeout handling', () => {
        it('should timeout slow health checks', async () => {
            // Mock a very slow storage response
            vi.mocked(mockStorage.customers.list).mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve({ data: [], total: 0, hasMore: false }), 10000);
                    })
            );

            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger,
                timeoutMs: 100 // Short timeout
            });

            const status = await service.getHealthStatus();

            const storageComponent = status.components.find((c) => c.name === 'storage');
            expect(storageComponent?.status).toBe('unhealthy');
            expect(storageComponent?.error).toBe('Storage health check timed out');
        });
    });

    describe('Error handling', () => {
        it('should handle non-Error exceptions from storage', async () => {
            vi.mocked(mockStorage.customers.list).mockRejectedValue('string error');

            const service = new QZPayHealthService({
                storage: mockStorage,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const storageComponent = status.components.find((c) => c.name === 'storage');
            expect(storageComponent?.status).toBe('unhealthy');
            expect(storageComponent?.error).toBe('string error');
        });

        it('should handle non-Error exceptions from payment adapter', async () => {
            // Non-Error objects should still be handled gracefully
            vi.mocked(mockPaymentAdapter.customers.retrieve).mockRejectedValue({ code: 'CONNECTION_ERROR' });

            const service = new QZPayHealthService({
                storage: mockStorage,
                paymentAdapter: mockPaymentAdapter,
                logger: noopLogger
            });

            const status = await service.getHealthStatus();

            const paymentComponent = status.components.find((c) => c.name === 'payment_adapter');
            expect(paymentComponent?.status).toBe('unhealthy');
        });
    });
});
