/**
 * Transaction Utilities Tests
 *
 * Tests for transaction context propagation and rollback behavior.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayCustomersRepository } from '../../src/repositories/customers.repository.js';
import { QZPayInvoicesRepository } from '../../src/repositories/invoices.repository.js';
import { QZPayPlansRepository } from '../../src/repositories/plans.repository.js';
import { executeTransaction, retryTransaction, transactional, withIsolationLevel, withTransaction } from '../../src/utils/transaction.js';
import { clearTestData, startTestDatabase, stopTestDatabase } from '../helpers/db-helpers.js';

describe('Transaction Utilities', () => {
    let db: PostgresJsDatabase;
    let customersRepo: QZPayCustomersRepository;
    let plansRepo: QZPayPlansRepository;
    let invoicesRepo: QZPayInvoicesRepository;

    beforeAll(async () => {
        const result = await startTestDatabase();
        db = result.db;
        customersRepo = new QZPayCustomersRepository(db);
        plansRepo = new QZPayPlansRepository(db);
        invoicesRepo = new QZPayInvoicesRepository(db);
    });

    afterAll(async () => {
        await stopTestDatabase();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    describe('withTransaction', () => {
        it('should commit transaction on success', async () => {
            const result = await withTransaction(db, async (tx) => {
                const customersRepoTx = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);

                const customer = await customersRepoTx.create({
                    externalId: 'tx-commit-test',
                    email: 'commit@example.com',
                    name: 'Commit Test',
                    livemode: true
                });

                return customer.id;
            });

            // Verify customer was created
            const customer = await customersRepo.findById(result);
            expect(customer).not.toBeNull();
            expect(customer?.email).toBe('commit@example.com');
        });

        it('should rollback transaction on error', async () => {
            let createdId: string | undefined;

            await expect(
                withTransaction(db, async (tx) => {
                    const customersRepoTx = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);

                    const customer = await customersRepoTx.create({
                        externalId: 'tx-rollback-test',
                        email: 'rollback@example.com',
                        name: 'Rollback Test',
                        livemode: true
                    });

                    createdId = customer.id;

                    // Simulate error
                    throw new Error('Transaction should rollback');
                })
            ).rejects.toThrow('Transaction should rollback');

            // Verify customer was NOT created (rolled back)
            if (createdId) {
                const customer = await customersRepo.findById(createdId);
                expect(customer).toBeNull();
            }
        });

        it('should support multiple operations in transaction', async () => {
            const result = await withTransaction(db, async (tx) => {
                const customersRepoTx = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);
                const plansRepoTx = new QZPayPlansRepository(tx as unknown as PostgresJsDatabase);

                const customer = await customersRepoTx.create({
                    externalId: 'multi-op-test',
                    email: 'multi@example.com',
                    name: 'Multi Op Test',
                    livemode: true
                });

                const plan = await plansRepoTx.create({
                    name: 'Multi Op Plan',
                    description: 'Created in transaction',
                    active: true,
                    livemode: true
                });

                return { customerId: customer.id, planId: plan.id };
            });

            // Verify both were created
            const customer = await customersRepo.findById(result.customerId);
            const plan = await plansRepo.findById(result.planId);

            expect(customer).not.toBeNull();
            expect(plan).not.toBeNull();
        });

        it('should rollback all operations on partial failure', async () => {
            let customerId: string | undefined;
            let planId: string | undefined;

            await expect(
                withTransaction(db, async (tx) => {
                    const customersRepoTx = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);
                    const plansRepoTx = new QZPayPlansRepository(tx as unknown as PostgresJsDatabase);

                    const customer = await customersRepoTx.create({
                        externalId: 'partial-fail-test',
                        email: 'partial@example.com',
                        name: 'Partial Fail Test',
                        livemode: true
                    });
                    customerId = customer.id;

                    const plan = await plansRepoTx.create({
                        name: 'Partial Fail Plan',
                        description: 'Should be rolled back',
                        active: true,
                        livemode: true
                    });
                    planId = plan.id;

                    // Fail after both operations
                    throw new Error('Partial failure');
                })
            ).rejects.toThrow('Partial failure');

            // Verify both were rolled back
            if (customerId) {
                const customer = await customersRepo.findById(customerId);
                expect(customer).toBeNull();
            }

            if (planId) {
                const plan = await plansRepo.findById(planId);
                expect(plan).toBeNull();
            }
        });
    });

    describe('transactional', () => {
        it('should execute operations sequentially', async () => {
            const [customer, plan] = await transactional(db, [
                async (tx) => {
                    const repo = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);
                    return repo.create({
                        externalId: 'seq-test',
                        email: 'seq@example.com',
                        name: 'Sequential Test',
                        livemode: true
                    });
                },
                async (tx) => {
                    const repo = new QZPayPlansRepository(tx as unknown as PostgresJsDatabase);
                    return repo.create({
                        name: 'Sequential Plan',
                        description: 'Created sequentially',
                        active: true,
                        livemode: true
                    });
                }
            ]);

            expect(customer.id).toBeDefined();
            expect(plan.id).toBeDefined();

            // Verify both exist
            const verifyCustomer = await customersRepo.findById(customer.id);
            const verifyPlan = await plansRepo.findById(plan.id);

            expect(verifyCustomer).not.toBeNull();
            expect(verifyPlan).not.toBeNull();
        });

        it('should rollback all operations if any fails', async () => {
            let customerId: string | undefined;

            await expect(
                transactional(db, [
                    async (tx) => {
                        const repo = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);
                        const customer = await repo.create({
                            externalId: 'seq-fail-test',
                            email: 'seqfail@example.com',
                            name: 'Sequential Fail Test',
                            livemode: true
                        });
                        customerId = customer.id;
                        return customer;
                    },
                    async (_tx) => {
                        throw new Error('Second operation failed');
                    }
                ])
            ).rejects.toThrow('Second operation failed');

            // Verify customer was rolled back
            if (customerId) {
                const customer = await customersRepo.findById(customerId);
                expect(customer).toBeNull();
            }
        });
    });

    describe('retryTransaction', () => {
        it('should retry on transient errors', async () => {
            let attempts = 0;

            const result = await retryTransaction(
                db,
                async (tx) => {
                    const repo = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);
                    attempts++;

                    // Fail first two attempts with retryable error
                    if (attempts < 3) {
                        throw new Error('Deadlock detected');
                    }

                    return repo.create({
                        externalId: 'retry-test',
                        email: 'retry@example.com',
                        name: 'Retry Test',
                        livemode: true
                    });
                },
                {
                    maxRetries: 3,
                    baseDelay: 10
                }
            );

            expect(attempts).toBe(3);
            expect(result.id).toBeDefined();

            // Verify customer was created
            const customer = await customersRepo.findById(result.id);
            expect(customer).not.toBeNull();
        });

        it('should not retry on non-retryable errors', async () => {
            let attempts = 0;

            await expect(
                retryTransaction(
                    db,
                    async (tx) => {
                        const _repo = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);
                        attempts++;
                        throw new Error('Business logic error');
                    },
                    {
                        maxRetries: 3,
                        baseDelay: 10
                    }
                )
            ).rejects.toThrow('Business logic error');

            expect(attempts).toBe(1); // Should not retry
        });

        it('should respect maxRetries limit', async () => {
            let attempts = 0;

            await expect(
                retryTransaction(
                    db,
                    async (_tx) => {
                        attempts++;
                        throw new Error('Serialization failure');
                    },
                    {
                        maxRetries: 2,
                        baseDelay: 10
                    }
                )
            ).rejects.toThrow('Serialization failure');

            expect(attempts).toBe(3); // Initial + 2 retries
        });

        it('should use custom retry predicate', async () => {
            let attempts = 0;

            await expect(
                retryTransaction(
                    db,
                    async (_tx) => {
                        attempts++;
                        throw new Error('Custom retryable error');
                    },
                    {
                        maxRetries: 2,
                        baseDelay: 10,
                        shouldRetry: (error) => error.message.includes('Custom retryable')
                    }
                )
            ).rejects.toThrow('Custom retryable error');

            expect(attempts).toBe(3); // Should retry on custom error
        });
    });

    describe('withIsolationLevel', () => {
        it('should execute transaction with specified isolation level', async () => {
            const result = await withIsolationLevel(db, 'serializable', async (tx) => {
                const repo = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);

                return repo.create({
                    externalId: 'isolation-test',
                    email: 'isolation@example.com',
                    name: 'Isolation Test',
                    livemode: true
                });
            });

            expect(result.id).toBeDefined();

            // Verify customer was created
            const customer = await customersRepo.findById(result.id);
            expect(customer).not.toBeNull();
        });
    });

    describe('executeTransaction', () => {
        it('should execute with custom options', async () => {
            const result = await executeTransaction(
                db,
                {
                    isolationLevel: 'repeatable read'
                },
                async (tx) => {
                    const repo = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);

                    return repo.create({
                        externalId: 'execute-test',
                        email: 'execute@example.com',
                        name: 'Execute Test',
                        livemode: true
                    });
                }
            );

            expect(result.id).toBeDefined();

            // Verify customer was created
            const customer = await customersRepo.findById(result.id);
            expect(customer).not.toBeNull();
        });

        it('should auto-retry when enabled', async () => {
            let attempts = 0;

            const result = await executeTransaction(
                db,
                {
                    autoRetry: true,
                    maxRetries: 3
                },
                async (tx) => {
                    const repo = new QZPayCustomersRepository(tx as unknown as PostgresJsDatabase);
                    attempts++;

                    // Fail first attempt with retryable error
                    if (attempts === 1) {
                        throw new Error('Could not serialize access');
                    }

                    return repo.create({
                        externalId: 'auto-retry-test',
                        email: 'autoretry@example.com',
                        name: 'Auto Retry Test',
                        livemode: true
                    });
                }
            );

            expect(attempts).toBe(2);
            expect(result.id).toBeDefined();
        });
    });

    describe('Real-world scenarios', () => {
        it('should create invoice with lines atomically', async () => {
            // Create customer first
            const customer = await customersRepo.create({
                externalId: 'invoice-test',
                email: 'invoice@example.com',
                name: 'Invoice Test',
                livemode: true
            });

            const result = await withTransaction(db, async (tx) => {
                const invoiceRepoTx = new QZPayInvoicesRepository(tx as unknown as PostgresJsDatabase);

                const invoice = await invoiceRepoTx.create({
                    customerId: customer.id,
                    number: 'INV-001',
                    status: 'open',
                    subtotal: 10000,
                    total: 10000,
                    amountRemaining: 10000,
                    currency: 'usd',
                    livemode: true
                });

                const lines = await invoiceRepoTx.createLines([
                    {
                        invoiceId: invoice.id,
                        description: 'Line 1',
                        quantity: 1,
                        unitAmount: 5000,
                        amount: 5000,
                        currency: 'usd'
                    },
                    {
                        invoiceId: invoice.id,
                        description: 'Line 2',
                        quantity: 2,
                        unitAmount: 2500,
                        amount: 5000,
                        currency: 'usd'
                    }
                ]);

                return { invoice, lines };
            });

            expect(result.invoice.id).toBeDefined();
            expect(result.lines).toHaveLength(2);

            // Verify invoice and lines exist
            const invoice = await invoicesRepo.findById(result.invoice.id);
            const lines = await invoicesRepo.findLinesByInvoiceId(result.invoice.id);

            expect(invoice).not.toBeNull();
            expect(lines).toHaveLength(2);
        });

        it('should rollback invoice creation if line creation fails', async () => {
            // Create customer first
            const customer = await customersRepo.create({
                externalId: 'invoice-rollback-test',
                email: 'invoicerollback@example.com',
                name: 'Invoice Rollback Test',
                livemode: true
            });

            let invoiceId: string | undefined;

            await expect(
                withTransaction(db, async (tx) => {
                    const invoiceRepoTx = new QZPayInvoicesRepository(tx as unknown as PostgresJsDatabase);

                    const invoice = await invoiceRepoTx.create({
                        customerId: customer.id,
                        number: 'INV-002',
                        status: 'open',
                        subtotal: 10000,
                        total: 10000,
                        amountRemaining: 10000,
                        currency: 'usd',
                        livemode: true
                    });

                    invoiceId = invoice.id;

                    // Simulate line creation failure
                    throw new Error('Failed to create lines');
                })
            ).rejects.toThrow('Failed to create lines');

            // Verify invoice was rolled back
            if (invoiceId) {
                const invoice = await invoicesRepo.findById(invoiceId);
                expect(invoice).toBeNull();
            }
        });
    });
});
