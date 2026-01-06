/**
 * Query Performance Benchmarks
 *
 * Measures the performance of common database queries in the Drizzle adapter.
 * These benchmarks use real PostgreSQL via Testcontainers.
 *
 * Run with: pnpm --filter @qazuor/qzpay-drizzle test -- --run benchmark
 */
import { type QZPayBilling, createQZPayBilling } from '@qazuor/qzpay-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type QZPayDrizzleStorageAdapter, createQZPayDrizzleAdapter } from '../../src/adapter/index.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

interface BenchmarkResult {
    operation: string;
    iterations: number;
    totalMs: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    opsPerSecond: number;
}

function formatBenchmark(result: BenchmarkResult): string {
    return [
        `  ${result.operation}:`,
        `    Iterations: ${result.iterations}`,
        `    Total: ${result.totalMs.toFixed(2)}ms`,
        `    Avg: ${result.avgMs.toFixed(2)}ms`,
        `    Min: ${result.minMs.toFixed(2)}ms`,
        `    Max: ${result.maxMs.toFixed(2)}ms`,
        `    Ops/sec: ${result.opsPerSecond.toFixed(2)}`
    ].join('\n');
}

async function benchmark(name: string, fn: () => Promise<void>, iterations = 100): Promise<BenchmarkResult> {
    const times: number[] = [];

    // Warmup
    for (let i = 0; i < 5; i++) {
        await fn();
    }

    // Benchmark
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
    }

    const totalMs = times.reduce((a, b) => a + b, 0);
    const avgMs = totalMs / iterations;
    const minMs = Math.min(...times);
    const maxMs = Math.max(...times);
    const opsPerSecond = 1000 / avgMs;

    return {
        operation: name,
        iterations,
        totalMs,
        avgMs,
        minMs,
        maxMs,
        opsPerSecond
    };
}

describe('Query Performance Benchmarks', () => {
    let billing: QZPayBilling;
    let storageAdapter: QZPayDrizzleStorageAdapter;
    const results: BenchmarkResult[] = [];

    beforeAll(async () => {
        const { db } = await startTestDatabase();
        storageAdapter = createQZPayDrizzleAdapter(db, { livemode: false });
        billing = createQZPayBilling({
            storage: storageAdapter,
            livemode: false,
            defaultCurrency: 'usd'
        });
    }, 60000);

    afterAll(async () => {
        // Print all benchmark results
        console.log(`\n${'='.repeat(60)}`);
        console.log('BENCHMARK RESULTS');
        console.log('='.repeat(60));
        for (const result of results) {
            console.log(formatBenchmark(result));
        }
        console.log(`${'='.repeat(60)}\n`);

        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('Customer Operations', () => {
        it('should benchmark customer creation', async () => {
            let counter = 0;

            const result = await benchmark(
                'Customer Create',
                async () => {
                    await billing.customers.create({
                        externalId: `bench-create-${counter++}`,
                        email: `bench${counter}@test.com`,
                        name: 'Benchmark Customer'
                    });
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(50); // Should be under 50ms on average
        });

        it('should benchmark customer retrieval by ID', async () => {
            // Create customers first
            const customerIds: string[] = [];
            for (let i = 0; i < 20; i++) {
                const customer = await billing.customers.create({
                    externalId: `bench-get-${i}`,
                    email: `bench-get-${i}@test.com`,
                    name: `Customer ${i}`
                });
                customerIds.push(customer.id);
            }

            let index = 0;
            const result = await benchmark(
                'Customer Get by ID',
                async () => {
                    await billing.customers.get(customerIds[index % customerIds.length]);
                    index++;
                },
                100
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(20); // Should be under 20ms on average
        });

        it('should benchmark customer retrieval by external ID', async () => {
            // Create customers first
            const externalIds: string[] = [];
            for (let i = 0; i < 20; i++) {
                await billing.customers.create({
                    externalId: `bench-ext-${i}`,
                    email: `bench-ext-${i}@test.com`,
                    name: `Customer ${i}`
                });
                externalIds.push(`bench-ext-${i}`);
            }

            let index = 0;
            const result = await benchmark(
                'Customer Get by External ID',
                async () => {
                    await billing.customers.getByExternalId(externalIds[index % externalIds.length]);
                    index++;
                },
                100
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(20); // Should be under 20ms on average
        });

        it('should benchmark customer update', async () => {
            const customer = await billing.customers.create({
                externalId: 'bench-update',
                email: 'bench-update@test.com',
                name: 'Update Customer'
            });

            let counter = 0;
            const result = await benchmark(
                'Customer Update',
                async () => {
                    await billing.customers.update(customer.id, {
                        name: `Updated Name ${counter++}`
                    });
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(30); // Should be under 30ms on average
        });
    });

    describe('Subscription Operations', () => {
        let customerId: string;
        let planId: string;

        beforeEach(async () => {
            await clearTestData();

            const customer = await billing.customers.create({
                externalId: 'bench-sub-customer',
                email: 'bench-sub@test.com',
                name: 'Subscription Customer'
            });
            customerId = customer.id;

            const plan = await storageAdapter.plans.create({
                name: 'Benchmark Plan',
                active: true,
                livemode: false
            });
            planId = plan.id;
        });

        it('should benchmark subscription creation', async () => {
            let counter = 0;
            const result = await benchmark(
                'Subscription Create',
                async () => {
                    // Create new customer for each to avoid conflicts
                    const customer = await billing.customers.create({
                        externalId: `bench-sub-create-${counter++}`,
                        email: `bench-sub-${counter}@test.com`,
                        name: 'Sub Customer'
                    });
                    await billing.subscriptions.create({
                        customerId: customer.id,
                        planId
                    });
                },
                30
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(100); // Should be under 100ms on average
        });

        it('should benchmark subscription retrieval', async () => {
            // Create subscriptions first
            const subscriptionIds: string[] = [];
            for (let i = 0; i < 10; i++) {
                const customer = await billing.customers.create({
                    externalId: `bench-sub-get-${i}`,
                    email: `bench-sub-get-${i}@test.com`,
                    name: `Sub Customer ${i}`
                });
                const subscription = await billing.subscriptions.create({
                    customerId: customer.id,
                    planId
                });
                subscriptionIds.push(subscription.id);
            }

            let index = 0;
            const result = await benchmark(
                'Subscription Get by ID',
                async () => {
                    await billing.subscriptions.get(subscriptionIds[index % subscriptionIds.length]);
                    index++;
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(20); // Should be under 20ms on average
        });

        it('should benchmark subscription status change', async () => {
            const subscription = await billing.subscriptions.create({
                customerId,
                planId
            });

            let isPaused = false;
            const result = await benchmark(
                'Subscription Status Toggle',
                async () => {
                    if (isPaused) {
                        await billing.subscriptions.resume(subscription.id);
                    } else {
                        await billing.subscriptions.pause(subscription.id);
                    }
                    isPaused = !isPaused;
                },
                30
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(50); // Should be under 50ms on average
        });
    });

    describe('Payment Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            await clearTestData();

            const customer = await billing.customers.create({
                externalId: 'bench-payment-customer',
                email: 'bench-payment@test.com',
                name: 'Payment Customer'
            });
            customerId = customer.id;
        });

        it('should benchmark payment processing', async () => {
            const result = await benchmark(
                'Payment Process',
                async () => {
                    await billing.payments.process({
                        customerId,
                        amount: 5000,
                        currency: 'usd'
                    });
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(50); // Should be under 50ms on average
        });

        it('should benchmark payment retrieval', async () => {
            // Create payments first
            const paymentIds: string[] = [];
            for (let i = 0; i < 20; i++) {
                const payment = await billing.payments.process({
                    customerId,
                    amount: 1000 * (i + 1),
                    currency: 'usd'
                });
                paymentIds.push(payment.id);
            }

            let index = 0;
            const result = await benchmark(
                'Payment Get by ID',
                async () => {
                    await billing.payments.get(paymentIds[index % paymentIds.length]);
                    index++;
                },
                100
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(20); // Should be under 20ms on average
        });

        it('should benchmark payments by customer query', async () => {
            // Create multiple payments
            for (let i = 0; i < 20; i++) {
                await billing.payments.process({
                    customerId,
                    amount: 1000 * (i + 1),
                    currency: 'usd'
                });
            }

            const result = await benchmark(
                'Payments Get by Customer',
                async () => {
                    await billing.payments.getByCustomerId(customerId);
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(30); // Should be under 30ms on average
        });
    });

    describe('Invoice Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            await clearTestData();

            const customer = await billing.customers.create({
                externalId: 'bench-invoice-customer',
                email: 'bench-invoice@test.com',
                name: 'Invoice Customer'
            });
            customerId = customer.id;
        });

        it('should benchmark invoice creation', async () => {
            const result = await benchmark(
                'Invoice Create',
                async () => {
                    await billing.invoices.create({
                        customerId,
                        lines: [
                            { description: 'Item 1', quantity: 1, unitAmount: 1000 },
                            { description: 'Item 2', quantity: 2, unitAmount: 500 }
                        ]
                    });
                },
                30
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(100); // Should be under 100ms on average
        });

        it('should benchmark invoice retrieval', async () => {
            // Create invoices first
            const invoiceIds: string[] = [];
            for (let i = 0; i < 10; i++) {
                const invoice = await billing.invoices.create({
                    customerId,
                    lines: [{ description: `Item ${i}`, quantity: 1, unitAmount: 1000 }]
                });
                invoiceIds.push(invoice.id);
            }

            let index = 0;
            const result = await benchmark(
                'Invoice Get by ID',
                async () => {
                    await billing.invoices.get(invoiceIds[index % invoiceIds.length]);
                    index++;
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(20); // Should be under 20ms on average
        });
    });

    describe('Entitlement Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            await clearTestData();

            const customer = await billing.customers.create({
                externalId: 'bench-entitlement-customer',
                email: 'bench-ent@test.com',
                name: 'Entitlement Customer'
            });
            customerId = customer.id;
        });

        it('should benchmark entitlement check', async () => {
            // Grant some entitlements first
            await billing.entitlements.grant(customerId, 'feature_a');
            await billing.entitlements.grant(customerId, 'feature_b');
            await billing.entitlements.grant(customerId, 'feature_c');

            const features = ['feature_a', 'feature_b', 'feature_c', 'feature_d'];
            let index = 0;

            const result = await benchmark(
                'Entitlement Check',
                async () => {
                    await billing.entitlements.check(customerId, features[index % features.length]);
                    index++;
                },
                100
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(15); // Should be very fast
        });

        it('should benchmark entitlement grant', async () => {
            let counter = 0;
            const result = await benchmark(
                'Entitlement Grant',
                async () => {
                    await billing.entitlements.grant(customerId, `feature_${counter++}`);
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(30); // Should be under 30ms on average
        });
    });

    describe('Limit Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            await clearTestData();

            const customer = await billing.customers.create({
                externalId: 'bench-limit-customer',
                email: 'bench-limit@test.com',
                name: 'Limit Customer'
            });
            customerId = customer.id;
        });

        it('should benchmark limit check', async () => {
            // Set up limits
            await billing.limits.set(customerId, 'api_calls', 1000);
            await billing.limits.set(customerId, 'storage', 5000);
            await billing.limits.set(customerId, 'users', 10);

            const limits = ['api_calls', 'storage', 'users', 'undefined_limit'];
            let index = 0;

            const result = await benchmark(
                'Limit Check',
                async () => {
                    await billing.limits.check(customerId, limits[index % limits.length]);
                    index++;
                },
                100
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(15); // Should be very fast
        });

        it('should benchmark limit increment', async () => {
            await billing.limits.set(customerId, 'counter', 10000);

            const result = await benchmark(
                'Limit Increment',
                async () => {
                    await billing.limits.increment(customerId, 'counter', 1);
                },
                100
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(30); // Should be under 30ms on average
        });
    });

    describe('Complex Query Patterns', () => {
        beforeEach(async () => {
            await clearTestData();
        });

        it('should benchmark full customer lifecycle', async () => {
            const result = await benchmark(
                'Full Customer Lifecycle',
                async () => {
                    const timestamp = Date.now();

                    // Create customer
                    const customer = await billing.customers.create({
                        externalId: `lifecycle-${timestamp}`,
                        email: `lifecycle-${timestamp}@test.com`,
                        name: 'Lifecycle Customer'
                    });

                    // Create plan
                    const plan = await storageAdapter.plans.create({
                        name: `Plan ${timestamp}`,
                        active: true,
                        livemode: false
                    });

                    // Create subscription
                    await billing.subscriptions.create({
                        customerId: customer.id,
                        planId: plan.id
                    });

                    // Process payment
                    await billing.payments.process({
                        customerId: customer.id,
                        amount: 9900,
                        currency: 'usd'
                    });

                    // Grant entitlement
                    await billing.entitlements.grant(customer.id, 'premium');

                    // Set limit
                    await billing.limits.set(customer.id, 'api_calls', 10000);

                    // Check entitlement
                    await billing.entitlements.check(customer.id, 'premium');

                    // Check limit
                    await billing.limits.check(customer.id, 'api_calls');
                },
                20
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(500); // Full lifecycle under 500ms
        });

        it('should benchmark concurrent reads', async () => {
            // Create test data
            const customers: string[] = [];
            for (let i = 0; i < 10; i++) {
                const customer = await billing.customers.create({
                    externalId: `concurrent-${i}`,
                    email: `concurrent-${i}@test.com`,
                    name: `Concurrent Customer ${i}`
                });
                customers.push(customer.id);
            }

            const result = await benchmark(
                'Concurrent Customer Reads (10)',
                async () => {
                    await Promise.all(customers.map((id) => billing.customers.get(id)));
                },
                50
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(100); // 10 concurrent reads under 100ms
        });

        it('should benchmark batch operations', async () => {
            const result = await benchmark(
                'Batch Customer Create (5)',
                async () => {
                    const timestamp = Date.now();
                    await Promise.all(
                        Array.from({ length: 5 }, (_, i) =>
                            billing.customers.create({
                                externalId: `batch-${timestamp}-${i}`,
                                email: `batch-${timestamp}-${i}@test.com`,
                                name: `Batch Customer ${i}`
                            })
                        )
                    );
                },
                20
            );

            results.push(result);
            expect(result.avgMs).toBeLessThan(200); // 5 batch creates under 200ms
        });
    });
});
