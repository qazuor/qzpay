// @ts-nocheck
/**
 * Transaction Examples for QZPay Drizzle
 *
 * Demonstrates how to use transaction utilities for multi-table operations.
 * Note: This file is excluded from type checking as it contains example code
 * that demonstrates API usage patterns.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { QZPayInvoicesRepository } from '../repositories/invoices.repository.js';
import { QZPayPromoCodesRepository } from '../repositories/promo-codes.repository.js';
import { QZPaySubscriptionsRepository } from '../repositories/subscriptions.repository.js';
import type { QZPayDatabase } from '../utils/connection.js';
import { executeTransaction, retryTransaction, transactional, withIsolationLevel, withTransaction } from '../utils/transaction.js';

/**
 * Example 1: Create invoice with lines using withTransaction
 *
 * This ensures that both the invoice and its lines are created together,
 * or neither is created if any operation fails.
 */
export async function createInvoiceWithLines(
    db: QZPayDatabase,
    invoiceData: {
        customerId: string;
        subscriptionId?: string;
        number: string;
        status: string;
        currency: string;
        livemode: boolean;
    },
    lineItems: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        priceId?: string;
    }>
) {
    return withTransaction(db, async (tx) => {
        const invoiceRepo = new QZPayInvoicesRepository(tx as unknown as PostgresJsDatabase);

        // Calculate totals
        const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);

        // Create invoice
        const invoice = await invoiceRepo.create({
            ...invoiceData,
            subtotal,
            total: subtotal,
            amountRemaining: subtotal
        });

        // Create invoice lines
        const lines = await invoiceRepo.createLines(
            lineItems.map((item) => ({
                invoiceId: invoice.id,
                description: item.description,
                quantity: item.quantity,
                unitAmount: item.unitAmount,
                amount: item.quantity * item.unitAmount,
                currency: invoiceData.currency,
                priceId: item.priceId ?? null
            }))
        );

        return { invoice, lines };
    });
}

/**
 * Example 2: Create subscription with promo code using transactional helper
 *
 * This uses the transactional() helper for a cleaner API when you need
 * to execute multiple independent operations in sequence.
 */
export async function createSubscriptionWithPromoCode(
    db: QZPayDatabase,
    subscriptionData: {
        customerId: string;
        planId: string;
        priceId: string;
        status: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        billingInterval: string;
        intervalCount: number;
        livemode: boolean;
    },
    promoCodeData: {
        promoCodeId: string;
        customerId: string;
        subscriptionId?: string;
        discountAmount: number;
    }
) {
    const [subscription, promoCodeUsage] = await transactional(db, [
        async (tx) => {
            const subscriptionRepo = new QZPaySubscriptionsRepository(tx as unknown as PostgresJsDatabase);
            return subscriptionRepo.create(subscriptionData);
        },
        async (tx) => {
            const promoCodeRepo = new QZPayPromoCodesRepository(tx as unknown as PostgresJsDatabase);
            return promoCodeRepo.recordUsage({
                ...promoCodeData,
                subscriptionId: undefined, // Will be set after
                usedAt: new Date()
            });
        }
    ]);

    // Update the usage record with the subscription ID
    await withTransaction(db, async (tx) => {
        const _promoCodeRepo = new QZPayPromoCodesRepository(tx as unknown as PostgresJsDatabase);
        // Note: We'd need an update method in the repo for this
        // This is just for demonstration
    });

    return { subscription, promoCodeUsage };
}

/**
 * Example 3: Handle race conditions with retryTransaction
 *
 * When multiple processes might update the same record concurrently,
 * use retryTransaction to automatically retry on deadlocks or serialization errors.
 */
export async function updateSubscriptionWithRetry(
    db: QZPayDatabase,
    subscriptionId: string,
    updates: {
        status?: string;
        canceledAt?: Date;
    }
) {
    return retryTransaction(
        db,
        async (tx) => {
            const subscriptionRepo = new QZPaySubscriptionsRepository(tx as unknown as PostgresJsDatabase);

            // Read current subscription
            const subscription = await subscriptionRepo.findById(subscriptionId);
            if (!subscription) {
                throw new Error(`Subscription ${subscriptionId} not found`);
            }

            // Update with new data
            return subscriptionRepo.update(subscriptionId, updates);
        },
        {
            maxRetries: 3,
            baseDelay: 100,
            maxDelay: 1000
        }
    );
}

/**
 * Example 4: Use serializable isolation for critical operations
 *
 * For operations that require the highest level of consistency,
 * use serializable isolation level.
 */
export async function applyPromoCodeWithIsolation(db: QZPayDatabase, promoCodeCode: string, customerId: string, subscriptionId: string) {
    return withIsolationLevel(db, 'serializable', async (tx) => {
        const promoCodeRepo = new QZPayPromoCodesRepository(tx as unknown as PostgresJsDatabase);

        // Validate promo code
        const validation = await promoCodeRepo.validateAndGet(promoCodeCode, customerId, true);

        if (!validation.valid || !validation.promoCode) {
            throw new Error(validation.error ?? 'Invalid promo code');
        }

        // Check if customer already used this code
        const hasUsed = await promoCodeRepo.hasCustomerUsedCode(validation.promoCode.id, customerId);
        if (hasUsed) {
            throw new Error('Promo code already used by this customer');
        }

        // Record usage
        const usage = await promoCodeRepo.recordUsage({
            promoCodeId: validation.promoCode.id,
            customerId,
            subscriptionId,
            discountAmount: validation.promoCode.discountAmount ?? 0,
            usedAt: new Date()
        });

        return { promoCode: validation.promoCode, usage };
    });
}

/**
 * Example 5: Complex transaction with custom configuration
 *
 * Use executeTransaction for full control over transaction behavior.
 */
export async function processSubscriptionRenewal(
    db: QZPayDatabase,
    subscriptionId: string,
    invoiceData: {
        customerId: string;
        number: string;
        status: string;
        currency: string;
        livemode: boolean;
    },
    lineItems: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
    }>
) {
    return executeTransaction(
        db,
        {
            isolationLevel: 'repeatable read',
            autoRetry: true,
            maxRetries: 3
        },
        async (tx) => {
            const subscriptionRepo = new QZPaySubscriptionsRepository(tx as unknown as PostgresJsDatabase);
            const invoiceRepo = new QZPayInvoicesRepository(tx as unknown as PostgresJsDatabase);

            // Get current subscription
            const subscription = await subscriptionRepo.findById(subscriptionId);
            if (!subscription) {
                throw new Error(`Subscription ${subscriptionId} not found`);
            }

            // Calculate new period
            const currentPeriodStart = subscription.currentPeriodEnd;
            const currentPeriodEnd = new Date(currentPeriodStart);
            currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

            // Update subscription billing period
            const updatedSubscription = await subscriptionRepo.updateBillingPeriod(subscriptionId, currentPeriodStart, currentPeriodEnd);

            // Calculate invoice total
            const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);

            // Create renewal invoice
            const invoice = await invoiceRepo.create({
                ...invoiceData,
                subscriptionId,
                subtotal,
                total: subtotal,
                amountRemaining: subtotal,
                periodStart: currentPeriodStart,
                periodEnd: currentPeriodEnd
            });

            // Create invoice lines
            const lines = await invoiceRepo.createLines(
                lineItems.map((item) => ({
                    invoiceId: invoice.id,
                    description: item.description,
                    quantity: item.quantity,
                    unitAmount: item.unitAmount,
                    amount: item.quantity * item.unitAmount,
                    currency: invoiceData.currency,
                    periodStart: currentPeriodStart,
                    periodEnd: currentPeriodEnd
                }))
            );

            return {
                subscription: updatedSubscription,
                invoice,
                lines
            };
        }
    );
}

/**
 * Example 6: Nested transactions (will use the outer transaction)
 *
 * Drizzle automatically handles nested transactions by using savepoints.
 */
export async function nestedTransactionExample(
    db: QZPayDatabase,
    customerId: string,
    subscriptionData: {
        planId: string;
        priceId: string;
        status: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        billingInterval: string;
        intervalCount: number;
        livemode: boolean;
    }
) {
    return withTransaction(db, async (tx) => {
        const subscriptionRepo = new QZPaySubscriptionsRepository(tx as unknown as PostgresJsDatabase);

        // Create subscription in outer transaction
        const subscription = await subscriptionRepo.create({
            customerId,
            ...subscriptionData
        });

        // This would typically use a savepoint internally
        const initialInvoice = await withTransaction(tx as unknown as PostgresJsDatabase, async (innerTx) => {
            const invoiceRepo = new QZPayInvoicesRepository(innerTx as unknown as PostgresJsDatabase);

            return invoiceRepo.create({
                customerId,
                subscriptionId: subscription.id,
                number: `INV-${Date.now()}`,
                status: 'draft',
                subtotal: 0,
                total: 0,
                amountRemaining: 0,
                currency: 'usd',
                livemode: subscriptionData.livemode
            });
        });

        return { subscription, initialInvoice };
    });
}
