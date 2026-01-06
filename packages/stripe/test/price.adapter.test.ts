/**
 * Stripe Price Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripePriceAdapter } from '../src/adapters/price.adapter.js';
import { createMockStripeClient, createMockStripePrice, createMockStripeProduct } from './helpers/stripe-mocks.js';

describe('QZPayStripePriceAdapter', () => {
    let adapter: QZPayStripePriceAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripePriceAdapter(mockStripe);
        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should create a one-time price', async () => {
            const mockPrice = createMockStripePrice({ id: 'price_new123' });
            vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

            const result = await adapter.create(
                {
                    unitAmount: 1000,
                    currency: 'USD'
                },
                'prod_123'
            );

            expect(result).toBe('price_new123');
            expect(mockStripe.prices.create).toHaveBeenCalledWith({
                product: 'prod_123',
                unit_amount: 1000,
                currency: 'usd',
                metadata: {}
            });
        });

        it('should create a recurring price with month interval', async () => {
            const mockPrice = createMockStripePrice();
            vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

            await adapter.create(
                {
                    unitAmount: 2999,
                    currency: 'EUR',
                    billingInterval: 'month'
                },
                'prod_123'
            );

            expect(mockStripe.prices.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    recurring: {
                        interval: 'month',
                        interval_count: 1
                    }
                })
            );
        });

        it('should create a recurring price with year interval', async () => {
            const mockPrice = createMockStripePrice();
            vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

            await adapter.create(
                {
                    unitAmount: 29999,
                    currency: 'USD',
                    billingInterval: 'year'
                },
                'prod_123'
            );

            expect(mockStripe.prices.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    recurring: {
                        interval: 'year',
                        interval_count: 1
                    }
                })
            );
        });

        it('should create a recurring price with custom interval count', async () => {
            const mockPrice = createMockStripePrice();
            vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

            await adapter.create(
                {
                    unitAmount: 5999,
                    currency: 'USD',
                    billingInterval: 'month',
                    intervalCount: 3
                },
                'prod_123'
            );

            expect(mockStripe.prices.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    recurring: {
                        interval: 'month',
                        interval_count: 3
                    }
                })
            );
        });

        it('should create a price with nickname', async () => {
            const mockPrice = createMockStripePrice();
            vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

            await adapter.create(
                {
                    unitAmount: 1000,
                    currency: 'USD',
                    nickname: 'Premium Monthly'
                },
                'prod_123'
            );

            expect(mockStripe.prices.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    nickname: 'Premium Monthly'
                })
            );
        });

        it('should create a price with metadata', async () => {
            const mockPrice = createMockStripePrice();
            vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

            await adapter.create(
                {
                    unitAmount: 1000,
                    currency: 'USD',
                    metadata: { tier: 'premium' }
                },
                'prod_123'
            );

            expect(mockStripe.prices.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { tier: 'premium' }
                })
            );
        });

        it('should map unknown interval to month', async () => {
            const mockPrice = createMockStripePrice();
            vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

            await adapter.create(
                {
                    unitAmount: 1000,
                    currency: 'USD',
                    billingInterval: 'unknown_interval'
                },
                'prod_123'
            );

            expect(mockStripe.prices.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    recurring: {
                        interval: 'month',
                        interval_count: 1
                    }
                })
            );
        });

        it('should support all standard intervals', async () => {
            const intervals = ['day', 'week', 'month', 'year'] as const;

            for (const interval of intervals) {
                vi.clearAllMocks();
                const mockPrice = createMockStripePrice();
                vi.mocked(mockStripe.prices.create).mockResolvedValue(mockPrice);

                await adapter.create(
                    {
                        unitAmount: 1000,
                        currency: 'USD',
                        billingInterval: interval
                    },
                    'prod_123'
                );

                expect(mockStripe.prices.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        recurring: {
                            interval,
                            interval_count: 1
                        }
                    })
                );
            }
        });
    });

    describe('archive', () => {
        it('should archive a price', async () => {
            const mockPrice = createMockStripePrice({ active: false });
            vi.mocked(mockStripe.prices.update).mockResolvedValue(mockPrice);

            await adapter.archive('price_123');

            expect(mockStripe.prices.update).toHaveBeenCalledWith('price_123', { active: false });
        });
    });

    describe('retrieve', () => {
        it('should retrieve a one-time price', async () => {
            const mockPrice = createMockStripePrice({
                id: 'price_123',
                active: true,
                unit_amount: 2500,
                currency: 'eur',
                recurring: null
            });
            vi.mocked(mockStripe.prices.retrieve).mockResolvedValue(mockPrice);

            const result = await adapter.retrieve('price_123');

            expect(result).toEqual({
                id: 'price_123',
                active: true,
                unitAmount: 2500,
                currency: 'EUR',
                recurring: null
            });
        });

        it('should retrieve a recurring price', async () => {
            const mockPrice = createMockStripePrice({
                id: 'price_123',
                active: true,
                unit_amount: 4999,
                currency: 'usd',
                recurring: {
                    interval: 'year',
                    interval_count: 1
                }
            } as never);
            vi.mocked(mockStripe.prices.retrieve).mockResolvedValue(mockPrice);

            const result = await adapter.retrieve('price_123');

            expect(result).toEqual({
                id: 'price_123',
                active: true,
                unitAmount: 4999,
                currency: 'USD',
                recurring: {
                    interval: 'year',
                    intervalCount: 1
                }
            });
        });

        it('should handle null unit_amount', async () => {
            const mockPrice = createMockStripePrice({
                unit_amount: null
            });
            vi.mocked(mockStripe.prices.retrieve).mockResolvedValue(mockPrice);

            const result = await adapter.retrieve('price_123');

            expect(result.unitAmount).toBe(0);
        });
    });

    describe('createProduct', () => {
        it('should create a product with name only', async () => {
            const mockProduct = createMockStripeProduct({ id: 'prod_new123' });
            vi.mocked(mockStripe.products.create).mockResolvedValue(mockProduct);

            const result = await adapter.createProduct('My Product');

            expect(result).toBe('prod_new123');
            expect(mockStripe.products.create).toHaveBeenCalledWith({
                name: 'My Product'
            });
        });

        it('should create a product with description', async () => {
            const mockProduct = createMockStripeProduct();
            vi.mocked(mockStripe.products.create).mockResolvedValue(mockProduct);

            await adapter.createProduct('My Product', 'A great product');

            expect(mockStripe.products.create).toHaveBeenCalledWith({
                name: 'My Product',
                description: 'A great product'
            });
        });
    });
});
