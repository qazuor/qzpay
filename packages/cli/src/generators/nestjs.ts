/**
 * NestJS Generator
 *
 * Generates NestJS-specific files including the billing module,
 * service, and webhook controller for integration with NestJS applications.
 *
 * @packageDocumentation
 */
import type { InitConfig } from '../types/config.js';
import { toPascalCase } from '../utils/template.js';

/**
 * Generate `billing.module.ts` file content for NestJS.
 *
 * Creates a dynamic NestJS module with:
 * - `forRoot()` method for synchronous configuration
 * - `forRootAsync()` method for async/factory configuration
 * - Global module registration option
 * - BillingService and WebhookHandlers providers
 * - WebhooksController for webhook endpoints
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code for NestJS module
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'nestjs' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: false },
 *   plans: { tiers: [] }
 * };
 *
 * const content = generateNestModule(config);
 * // Returns NestJS BillingModule with forRoot/forRootAsync
 * ```
 */
export function generateNestModule(config: InitConfig): string {
    const pascal = toPascalCase(config.project.name);

    return `/**
 * ${pascal} - Billing Module (NestJS)
 */
import { Module, Global, DynamicModule } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhookHandlers } from './webhooks.js';

export interface BillingModuleOptions {
    isGlobal?: boolean;
}

@Global()
@Module({})
export class BillingModule {
    static forRoot(options: BillingModuleOptions = {}): DynamicModule {
        return {
            module: BillingModule,
            global: options.isGlobal ?? true,
            providers: [BillingService, WebhookHandlers],
            controllers: [WebhooksController],
            exports: [BillingService]
        };
    }

    static forRootAsync(options: {
        isGlobal?: boolean;
        useFactory: () => Promise<BillingModuleOptions> | BillingModuleOptions;
        inject?: unknown[];
    }): DynamicModule {
        return {
            module: BillingModule,
            global: options.isGlobal ?? true,
            providers: [
                {
                    provide: 'BILLING_OPTIONS',
                    useFactory: options.useFactory,
                    inject: options.inject || []
                },
                BillingService,
                WebhookHandlers
            ],
            controllers: [WebhooksController],
            exports: [BillingService]
        };
    }
}
`;
}

/**
 * Generate `billing.service.ts` file content for NestJS.
 *
 * Creates an Injectable service that wraps QZPayBilling with methods for:
 * - Customer CRUD operations
 * - Subscription management
 * - Payment and invoice retrieval
 * - Refund processing
 * - Usage tracking (if enabled)
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code for NestJS service
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'nestjs' },
 *   features: { subscriptions: true, oneTime: false, usageBased: true, marketplace: false, addons: false },
 *   plans: { tiers: [{ name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 }] }
 * };
 *
 * const content = generateNestService(config);
 * // Returns NestJS BillingService with usage tracking methods
 * ```
 */
export function generateNestService(config: InitConfig): string {
    const pascal = toPascalCase(config.project.name);

    let content = `/**
 * ${pascal} - Billing Service (NestJS)
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { billing } from './qzpay.config.js';
import type { ${pascal}Customer, ${pascal}PlanTier } from './types.js';

@Injectable()
export class BillingService implements OnModuleInit {
    private readonly billing = billing;

    async onModuleInit(): Promise<void> {
        console.log('[BillingService] Initialized');
    }

    // ========================================================================
    // Customer Management
    // ========================================================================

    async createCustomer(data: {
        email: string;
        name: string;
        planTier?: ${pascal}PlanTier;
    }): Promise<${pascal}Customer> {
        const customer = await this.billing.customers.create({
            email: data.email,
            name: data.name,
            metadata: {
                planTier: data.planTier || '${config.plans.tiers[0]?.name || 'free'}'
            }
        });

        return this.mapCustomer(customer);
    }

    async getCustomer(customerId: string): Promise<${pascal}Customer | null> {
        const customer = await this.billing.customers.get(customerId);
        if (!customer) return null;
        return this.mapCustomer(customer);
    }

    async updateCustomer(
        customerId: string,
        data: Partial<{ email: string; name: string; metadata: Record<string, unknown> }>
    ): Promise<${pascal}Customer | null> {
        const customer = await this.billing.customers.update(customerId, data);
        if (!customer) return null;
        return this.mapCustomer(customer);
    }

    // ========================================================================
    // Subscription Management
    // ========================================================================

    async createSubscription(
        customerId: string,
        priceId: string
    ): Promise<{ subscriptionId: string; checkoutUrl?: string }> {
        const checkout = await this.billing.checkout.createSession({
            customerId,
            priceId,
            mode: 'subscription',
            successUrl: \`\${process.env.APP_URL}/billing/success\`,
            cancelUrl: \`\${process.env.APP_URL}/billing/cancel\`
        });

        return {
            subscriptionId: checkout.subscriptionId || '',
            checkoutUrl: checkout.url
        };
    }

    async cancelSubscription(subscriptionId: string, immediately = false): Promise<void> {
        await this.billing.subscriptions.cancel(subscriptionId, {
            cancelAtPeriodEnd: !immediately
        });
    }

    async getSubscription(subscriptionId: string) {
        return this.billing.subscriptions.get(subscriptionId);
    }

    async listSubscriptions(customerId: string) {
        return this.billing.subscriptions.list({ customerId });
    }

    // ========================================================================
    // Payment Management
    // ========================================================================

    async getPayment(paymentId: string) {
        return this.billing.payments.get(paymentId);
    }

    async listPayments(customerId: string) {
        return this.billing.payments.list({ customerId });
    }

    async refundPayment(paymentId: string, amount?: number) {
        return this.billing.payments.refund(paymentId, amount);
    }

    // ========================================================================
    // Invoice Management
    // ========================================================================

    async getInvoice(invoiceId: string) {
        return this.billing.invoices.get(invoiceId);
    }

    async listInvoices(customerId: string) {
        return this.billing.invoices.list({ customerId });
    }
`;

    if (config.features.usageBased) {
        content += `
    // ========================================================================
    // Usage Tracking
    // ========================================================================

    async recordUsage(customerId: string, metric: string, quantity: number): Promise<void> {
        await this.billing.limits.recordUsage(customerId, metric, quantity);
    }

    async checkUsageLimit(customerId: string, metric: string) {
        return this.billing.limits.check(customerId, metric);
    }

    async getUsageLimits(customerId: string) {
        return this.billing.limits.getByCustomerId(customerId);
    }
`;
    }

    content += `
    // ========================================================================
    // Helpers
    // ========================================================================

    private mapCustomer(customer: {
        id: string;
        email: string;
        name?: string | null;
        metadata?: Record<string, unknown>;
        createdAt?: Date;
    }): ${pascal}Customer {
        return {
            id: customer.id,
            email: customer.email,
            name: customer.name || '',
            planTier: (customer.metadata?.planTier as ${pascal}PlanTier) || '${config.plans.tiers[0]?.name || 'free'}',
${config.features.addons ? '            activeAddOns: (customer.metadata?.activeAddOns as string[]) || [],\n' : ''}            createdAt: customer.createdAt || new Date(),
            metadata: customer.metadata
        };
    }
}
`;

    return content;
}

/**
 * Generate `webhooks.controller.ts` file content for NestJS.
 *
 * Creates a Controller that handles webhook endpoints for:
 * - Stripe webhooks with signature verification
 * - MercadoPago IPN notifications
 *
 * Uses the WebhookHandlers service for event processing.
 *
 * @param config - The complete initialization configuration
 * @returns Generated TypeScript code for NestJS webhook controller
 *
 * @example
 * ```typescript
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'both', stripe: true, mercadopago: true },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'nestjs' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: false },
 *   plans: { tiers: [] }
 * };
 *
 * const content = generateNestController(config);
 * // Returns NestJS WebhooksController with Stripe + MercadoPago endpoints
 * ```
 */
export function generateNestController(config: InitConfig): string {
    const pascal = toPascalCase(config.project.name);

    let content = `/**
 * ${pascal} - Webhooks Controller (NestJS)
 */
import { Controller, Post, Body, Headers, HttpCode, BadRequestException } from '@nestjs/common';
import { WebhookHandlers } from './webhooks.js';
`;

    if (config.provider.stripe) {
        content += `import { stripe, stripeWebhookSecret } from './qzpay.config.js';
import type Stripe from 'stripe';
`;
    }

    content += `
@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly handlers: WebhookHandlers) {}
`;

    if (config.provider.stripe) {
        content += `
    @Post('stripe')
    @HttpCode(200)
    async handleStripeWebhook(
        @Body() rawBody: Buffer,
        @Headers('stripe-signature') signature: string
    ): Promise<{ received: boolean }> {
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                stripeWebhookSecret
            );
        } catch (err) {
            throw new BadRequestException(\`Webhook Error: \${(err as Error).message}\`);
        }

        // Handle the event
        switch (event.type) {
            case 'customer.subscription.created':
                await this.handlers.handleSubscriptionCreated(
                    (event.data.object as Stripe.Subscription).id
                );
                break;
            case 'customer.subscription.deleted':
                await this.handlers.handleSubscriptionCanceled(
                    (event.data.object as Stripe.Subscription).id
                );
                break;
            case 'payment_intent.succeeded':
                await this.handlers.handlePaymentSucceeded(
                    (event.data.object as Stripe.PaymentIntent).id
                );
                break;
            case 'payment_intent.payment_failed':
                await this.handlers.handlePaymentFailed(
                    (event.data.object as Stripe.PaymentIntent).id
                );
                break;
            default:
                console.log(\`Unhandled event type: \${event.type}\`);
        }

        return { received: true };
    }
`;
    }

    if (config.provider.mercadopago) {
        content += `
    @Post('mercadopago')
    @HttpCode(200)
    async handleMercadoPagoWebhook(
        @Body() body: { type: string; data: { id: string } }
    ): Promise<{ received: boolean }> {
        console.log(\`[MercadoPago] IPN received: \${body.type}\`);

        switch (body.type) {
            case 'payment':
                await this.handlers.handlePaymentSucceeded(body.data.id);
                break;
            case 'subscription_preapproval':
                await this.handlers.handleSubscriptionCreated(body.data.id);
                break;
            default:
                console.log(\`Unhandled MercadoPago type: \${body.type}\`);
        }

        return { received: true };
    }
`;
    }

    content += `}
`;

    return content;
}
