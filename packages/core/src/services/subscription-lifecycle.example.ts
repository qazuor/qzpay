/**
 * Example usage of the Subscription Lifecycle Service
 *
 * This example shows how to set up and use the subscription lifecycle service
 * in a cron job or background worker to handle renewals, trial conversions,
 * payment retries, and automatic cancellations.
 */

import type { QZPayStorageAdapter } from '../adapters/storage.adapter.js';
import type { createQZPayBilling } from '../billing.js';
import { createSubscriptionLifecycle } from './subscription-lifecycle.service.js';

/**
 * Example: Setup subscription lifecycle service
 */
export function setupSubscriptionLifecycle(billing: ReturnType<typeof createQZPayBilling>, storage: QZPayStorageAdapter) {
    const lifecycle = createSubscriptionLifecycle(billing, storage, {
        // Grace period configuration
        gracePeriodDays: 7, // 7 days before canceling due to non-payment

        // Retry schedule: retry after 1 day, then 3 days, then 5 days
        retryIntervals: [1, 3, 5],

        // Convert trials immediately when they end
        trialConversionDays: 0,

        // Process payment callback
        processPayment: async (input) => {
            // This is where you integrate with your payment provider
            // Example with Stripe:
            /*
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: input.amount,
                    currency: input.currency,
                    customer: providerCustomerId,
                    payment_method: input.paymentMethodId,
                    confirm: true,
                    metadata: {
                        subscriptionId: input.metadata.subscriptionId,
                        type: input.metadata.type,
                    },
                });

                return {
                    success: paymentIntent.status === 'succeeded',
                    paymentId: paymentIntent.id,
                    error: paymentIntent.status !== 'succeeded'
                        ? `Payment failed: ${paymentIntent.status}`
                        : undefined,
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown payment error',
                };
            }
            */

            // Example with MercadoPago:
            /*
            const mercadopago = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
            const payment = new Payment(mercadopago);

            try {
                const result = await payment.create({
                    body: {
                        transaction_amount: input.amount / 100, // Convert to decimal
                        description: `Subscription ${input.metadata.type}`,
                        payment_method_id: input.paymentMethodId,
                        payer: {
                            email: payerEmail,
                        },
                        metadata: {
                            subscription_id: input.metadata.subscriptionId,
                            type: input.metadata.type,
                        },
                    },
                });

                return {
                    success: result.status === 'approved',
                    paymentId: result.id?.toString(),
                    error: result.status !== 'approved'
                        ? `Payment ${result.status}: ${result.status_detail}`
                        : undefined,
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown payment error',
                };
            }
            */

            // Placeholder implementation
            console.log('Processing payment:', input);
            return {
                success: true,
                paymentId: `pay_${Date.now()}`
            };
        },

        // Get default payment method callback
        getDefaultPaymentMethod: async (customerId) => {
            // Get the customer's default payment method from storage
            const paymentMethod = await storage.paymentMethods.findDefaultByCustomerId(customerId);

            if (!paymentMethod) {
                return null;
            }

            // Map to the format expected by the lifecycle service
            // Get the first provider payment method ID (in production, you'd select based on active provider)
            const providerPaymentMethodId = Object.values(paymentMethod.providerPaymentMethodIds)[0];
            if (!providerPaymentMethodId) {
                return null;
            }

            return {
                id: paymentMethod.id,
                providerPaymentMethodId
            };
        },

        // Event callback (optional)
        onEvent: async (event) => {
            console.log(`[Lifecycle] ${event.type}`, {
                subscriptionId: event.subscriptionId,
                customerId: event.customerId,
                data: event.data
            });

            // Example: Send notifications
            switch (event.type) {
                case 'subscription.renewed':
                    // Send renewal confirmation email
                    break;

                case 'subscription.renewal_failed':
                    // Send payment failed email
                    break;

                case 'subscription.trial_converted':
                    // Send trial conversion email
                    break;

                case 'subscription.trial_conversion_failed':
                    // Send trial conversion failed email
                    break;

                case 'subscription.entered_grace_period':
                    // Send grace period warning email
                    break;

                case 'subscription.retry_scheduled':
                    // Send retry scheduled email
                    break;

                case 'subscription.retry_succeeded':
                    // Send payment recovered email
                    break;

                case 'subscription.retry_failed':
                    // Send retry failed email
                    break;

                case 'subscription.canceled_nonpayment':
                    // Send subscription canceled email
                    break;
            }
        }
    });

    return lifecycle;
}

/**
 * Example: Run lifecycle processing in a cron job
 */
export async function runLifecycleCron(billing: ReturnType<typeof createQZPayBilling>, storage: QZPayStorageAdapter) {
    const lifecycle = setupSubscriptionLifecycle(billing, storage);

    // Run all lifecycle processes
    const results = await lifecycle.processAll();

    console.log('Lifecycle processing completed:', {
        renewals: {
            processed: results.renewals.processed,
            succeeded: results.renewals.succeeded,
            failed: results.renewals.failed
        },
        trialConversions: {
            processed: results.trialConversions.processed,
            succeeded: results.trialConversions.succeeded,
            failed: results.trialConversions.failed
        },
        retries: {
            processed: results.retries.processed,
            succeeded: results.retries.succeeded,
            failed: results.retries.failed
        },
        cancellations: {
            processed: results.cancellations.processed
        }
    });

    // Handle failures
    if (results.renewals.failed > 0) {
        console.error(
            'Failed renewals:',
            results.renewals.details.filter((d) => !d.success)
        );
    }

    if (results.trialConversions.failed > 0) {
        console.error(
            'Failed trial conversions:',
            results.trialConversions.details.filter((d) => !d.success)
        );
    }

    if (results.retries.failed > 0) {
        console.error(
            'Failed retries:',
            results.retries.details.filter((d) => !d.success)
        );
    }

    return results;
}

/**
 * Example: Run specific lifecycle operations
 */
export async function runSpecificOperations(billing: ReturnType<typeof createQZPayBilling>, storage: QZPayStorageAdapter) {
    const lifecycle = setupSubscriptionLifecycle(billing, storage);

    // Run only renewals
    const renewals = await lifecycle.processRenewals();
    console.log('Renewals:', renewals);

    // Run only trial conversions
    const conversions = await lifecycle.processTrialConversions();
    console.log('Trial conversions:', conversions);

    // Run only retries
    const retries = await lifecycle.processRetries();
    console.log('Retries:', retries);

    // Run only cancellations
    const cancellations = await lifecycle.processCancellations();
    console.log('Cancellations:', cancellations);
}

/**
 * Example: Schedule with node-cron
 */
export function scheduleWithNodeCron(_billing: ReturnType<typeof createQZPayBilling>, _storage: QZPayStorageAdapter) {
    // Using node-cron (install with: pnpm add node-cron @types/node-cron)
    /*
    import cron from 'node-cron';

    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running subscription lifecycle processing...');
        await runLifecycleCron(billing, storage);
    });

    // Or run daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('Running daily subscription lifecycle processing...');
        await runLifecycleCron(billing, storage);
    });
    */

    console.log('Scheduled subscription lifecycle processing');
}

/**
 * Example: Schedule with BullMQ
 */
export function scheduleWithBullMQ(_billing: ReturnType<typeof createQZPayBilling>, _storage: QZPayStorageAdapter) {
    // Using BullMQ (install with: pnpm add bullmq)
    /*
    import { Queue, Worker } from 'bullmq';

    const connection = { host: 'localhost', port: 6379 };

    // Create queue
    const lifecycleQueue = new Queue('subscription-lifecycle', { connection });

    // Add repeating job (every hour)
    lifecycleQueue.add(
        'process-all',
        {},
        {
            repeat: {
                pattern: '0 * * * *', // Cron pattern
            },
        }
    );

    // Create worker
    const worker = new Worker(
        'subscription-lifecycle',
        async (job) => {
            console.log('Processing subscription lifecycle...');
            return await runLifecycleCron(billing, storage);
        },
        { connection }
    );

    worker.on('completed', (job, result) => {
        console.log(`Job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed:`, err);
    });
    */

    console.log('Scheduled subscription lifecycle with BullMQ');
}

/**
 * Example: Custom retry intervals
 */
export function customRetryIntervals(billing: ReturnType<typeof createQZPayBilling>, storage: QZPayStorageAdapter) {
    // More aggressive retry schedule
    const aggressiveLifecycle = createSubscriptionLifecycle(billing, storage, {
        gracePeriodDays: 14,
        retryIntervals: [1, 2, 3, 5, 7], // 5 retry attempts
        trialConversionDays: 0,
        processPayment: async () => ({ success: true, paymentId: 'test' }),
        getDefaultPaymentMethod: async () => null
    });

    // More lenient retry schedule
    const lenientLifecycle = createSubscriptionLifecycle(billing, storage, {
        gracePeriodDays: 30,
        retryIntervals: [3, 7, 14], // 3 retry attempts with longer intervals
        trialConversionDays: 0,
        processPayment: async () => ({ success: true, paymentId: 'test' }),
        getDefaultPaymentMethod: async () => null
    });

    return { aggressiveLifecycle, lenientLifecycle };
}
