/**
 * Webhooks Generator
 *
 * Generates the `webhooks.ts` file with webhook handler functions
 * for processing payment provider events (Stripe, MercadoPago).
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';
import { toPascalCase } from '../utils/template.js';

/**
 * Generate `webhooks.ts` file content with webhook handlers.
 *
 * Creates webhook handling functions for:
 * - Subscription lifecycle (created, updated, canceled)
 * - Payment events (succeeded, failed)
 * - Invoice events (paid)
 * - Provider-specific event handlers (Stripe, MercadoPago)
 *
 * For NestJS, generates an Injectable service class.
 * For Hono, generates standalone async functions.
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code for webhook handlers
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: false },
 *   plans: { tiers: [] }
 * };
 *
 * const content = generateWebhooks(config);
 * // Returns Hono webhook handlers with Stripe event processing
 * ```
 */
export function generateWebhooks(config: InitConfig): string {
    if (config.framework.type === 'none') {
        return '// Webhooks not generated - no framework selected\n';
    }

    const pascal = toPascalCase(config.project.name);

    if (config.framework.type === 'nestjs') {
        return generateNestJSWebhooks(config, pascal);
    }

    // Hono webhooks (more detailed handler)
    let content = `/**
 * ${pascal} - Webhook Handlers
 *
 * This file contains custom webhook handling logic.
 * The base webhook routes are created by @qazuor/qzpay-hono in routes.ts.
 * Add your domain-specific logic here.
 */
import { billing } from './qzpay.config.js';

/**
 * Handle subscription created event
 */
export async function handleSubscriptionCreated(subscriptionId: string): Promise<void> {
    const subscription = await billing.subscriptions.get(subscriptionId);
    if (!subscription) return;

    console.log(\`[${pascal}] New subscription: \${subscription.id}\`);

    // TODO: Implement your subscription created logic
    // - Grant initial entitlements
    // - Send welcome email
    // - Initialize usage limits
    // - Create related resources
}

/**
 * Handle subscription updated event
 */
export async function handleSubscriptionUpdated(subscriptionId: string): Promise<void> {
    const subscription = await billing.subscriptions.get(subscriptionId);
    if (!subscription) return;

    console.log(\`[${pascal}] Subscription updated: \${subscription.id}, status: \${subscription.status}\`);

    // TODO: Implement your subscription updated logic
    // - Update entitlements based on new plan
    // - Adjust usage limits
    // - Handle plan upgrades/downgrades
}

/**
 * Handle subscription canceled event
 */
export async function handleSubscriptionCanceled(subscriptionId: string): Promise<void> {
    console.log(\`[${pascal}] Subscription canceled: \${subscriptionId}\`);

    // TODO: Implement your subscription canceled logic
    // - Revoke entitlements
    // - Send cancellation confirmation
    // - Schedule data retention/cleanup
    // - Trigger win-back campaign
}

/**
 * Handle payment succeeded event
 */
export async function handlePaymentSucceeded(paymentId: string): Promise<void> {
    const payment = await billing.payments.get(paymentId);
    if (!payment) return;

    console.log(\`[${pascal}] Payment succeeded: \${payment.id}, amount: \${payment.amount}\`);

    // TODO: Implement your payment succeeded logic
    // - Send receipt
    // - Fulfill one-time purchases
    // - Update customer lifetime value
    // - Trigger thank you email
}

/**
 * Handle payment failed event
 */
export async function handlePaymentFailed(paymentId: string): Promise<void> {
    const payment = await billing.payments.get(paymentId);
    if (!payment) return;

    console.log(\`[${pascal}] Payment failed: \${payment.id}\`);

    // TODO: Implement your payment failed logic
    // - Send payment failure notification
    // - Suggest alternative payment methods
    // - Schedule retry notification
    // - Consider grace period
}

/**
 * Handle invoice paid event
 */
export async function handleInvoicePaid(invoiceId: string): Promise<void> {
    const invoice = await billing.invoices.get(invoiceId);
    if (!invoice) return;

    console.log(\`[${pascal}] Invoice paid: \${invoice.id}\`);

    // TODO: Implement your invoice paid logic
    // - Send invoice receipt
    // - Reset usage counters (for usage-based billing)
    // - Update billing period
}
`;

    if (config.provider.stripe) {
        content += `
/**
 * Handle Stripe-specific events
 * Called from the webhook route in routes.ts
 */
export async function handleStripeEvent(event: {
    type: string;
    data: { object: Record<string, unknown> };
}): Promise<void> {
    switch (event.type) {
        case 'customer.subscription.created':
            await handleSubscriptionCreated(event.data.object.id as string);
            break;
        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object.id as string);
            break;
        case 'customer.subscription.deleted':
            await handleSubscriptionCanceled(event.data.object.id as string);
            break;
        case 'payment_intent.succeeded':
            await handlePaymentSucceeded(event.data.object.id as string);
            break;
        case 'payment_intent.payment_failed':
            await handlePaymentFailed(event.data.object.id as string);
            break;
        case 'invoice.paid':
            await handleInvoicePaid(event.data.object.id as string);
            break;
        default:
            console.log(\`[${pascal}] Unhandled event type: \${event.type}\`);
    }
}
`;
    }

    if (config.provider.mercadopago) {
        content += `
/**
 * Handle MercadoPago IPN (Instant Payment Notification)
 */
export async function handleMercadoPagoIPN(notification: {
    type: string;
    data: { id: string };
}): Promise<void> {
    console.log(\`[${pascal}] MercadoPago IPN: \${notification.type}\`);

    switch (notification.type) {
        case 'payment':
            // Fetch payment details and handle
            await handlePaymentSucceeded(notification.data.id);
            break;
        case 'subscription_preapproval':
            // Handle subscription events
            await handleSubscriptionUpdated(notification.data.id);
            break;
        default:
            console.log(\`[${pascal}] Unhandled MercadoPago notification: \${notification.type}\`);
    }
}
`;
    }

    return content;
}

/**
 * Generate NestJS-specific webhook handlers as an Injectable service.
 * @internal
 */
function generateNestJSWebhooks(_config: InitConfig, pascal: string): string {
    return `/**
 * ${pascal} - Webhook Handlers (NestJS)
 *
 * Import these handlers in your webhook controller.
 */
import { Injectable } from '@nestjs/common';
import { BillingService } from './billing.service.js';

@Injectable()
export class WebhookHandlers {
    constructor(private readonly billingService: BillingService) {}

    async handleSubscriptionCreated(subscriptionId: string): Promise<void> {
        console.log(\`[${pascal}] New subscription: \${subscriptionId}\`);
        // TODO: Implement subscription created logic
    }

    async handleSubscriptionCanceled(subscriptionId: string): Promise<void> {
        console.log(\`[${pascal}] Subscription canceled: \${subscriptionId}\`);
        // TODO: Implement subscription canceled logic
    }

    async handlePaymentSucceeded(paymentId: string): Promise<void> {
        console.log(\`[${pascal}] Payment succeeded: \${paymentId}\`);
        // TODO: Implement payment succeeded logic
    }

    async handlePaymentFailed(paymentId: string): Promise<void> {
        console.log(\`[${pascal}] Payment failed: \${paymentId}\`);
        // TODO: Implement payment failed logic
    }
}
`;
}
