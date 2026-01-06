/**
 * QZPay NestJS E2E Tests
 *
 * Integration tests with real PostgreSQL database via Testcontainers.
 * Tests QZPayService and QZPayModule with real Drizzle adapter.
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { type QZPayBilling, createQZPayBilling } from '@qazuor/qzpay-core';
import { type QZPayDrizzleStorageAdapter, createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QZPayModule } from '../../src/qzpay.module.js';
import { QZPayService } from '../../src/qzpay.service.js';

describe('QZPay NestJS E2E Tests', () => {
    let container: StartedPostgreSqlContainer;
    let sql: ReturnType<typeof postgres>;
    let db: PostgresJsDatabase;
    let storageAdapter: QZPayDrizzleStorageAdapter;
    let billing: QZPayBilling;
    let module: TestingModule;
    let qzPayService: QZPayService;

    beforeAll(async () => {
        // Start PostgreSQL container
        container = await new PostgreSqlContainer('postgres:16-alpine')
            .withDatabase('qzpay_test')
            .withUsername('test')
            .withPassword('test')
            .start();

        const connectionUrl = container.getConnectionUri();

        // Create database connection
        sql = postgres(connectionUrl);
        db = drizzle(sql);

        // Push schema
        await pushSchema(sql);

        // Create storage adapter and billing instance
        storageAdapter = createQZPayDrizzleAdapter(db, { livemode: false });
        billing = createQZPayBilling({
            storage: storageAdapter,
            livemode: false,
            defaultCurrency: 'usd'
        });

        // Create NestJS testing module
        module = await Test.createTestingModule({
            imports: [
                QZPayModule.forRoot({
                    billing
                })
            ]
        }).compile();

        qzPayService = module.get<QZPayService>(QZPayService);
    }, 60000);

    afterAll(async () => {
        await module.close();
        await sql.end();
        await container.stop();
    });

    beforeEach(async () => {
        await clearTestData(sql);
    });

    describe('Customer Operations', () => {
        it('should create a customer', async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'user-123',
                email: 'test@example.com',
                name: 'Test User'
            });

            expect(customer).toBeDefined();
            expect(customer.id).toBeDefined();
            expect(customer.externalId).toBe('user-123');
            expect(customer.email).toBe('test@example.com');
            expect(customer.name).toBe('Test User');
        });

        it('should get customer by ID', async () => {
            const created = await qzPayService.createCustomer({
                externalId: 'user-456',
                email: 'get@example.com',
                name: 'Get Test'
            });

            const fetched = await qzPayService.getCustomer(created.id);

            expect(fetched).toBeDefined();
            expect(fetched?.id).toBe(created.id);
        });

        it('should get customer by external ID', async () => {
            await qzPayService.createCustomer({
                externalId: 'external-789',
                email: 'external@example.com',
                name: 'External Test'
            });

            const fetched = await qzPayService.getCustomerByExternalId('external-789');

            expect(fetched).toBeDefined();
            expect(fetched?.externalId).toBe('external-789');
        });

        it('should update a customer', async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'update-user',
                email: 'update@example.com',
                name: 'Original Name'
            });

            const updated = await qzPayService.updateCustomer(customer.id, {
                name: 'Updated Name'
            });

            expect(updated?.name).toBe('Updated Name');
        });

        it('should delete a customer', async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'delete-user',
                email: 'delete@example.com',
                name: 'Delete Test'
            });

            await qzPayService.deleteCustomer(customer.id);

            const deleted = await qzPayService.getCustomer(customer.id);
            expect(deleted).toBeNull();
        });
    });

    describe('Subscription Operations', () => {
        let customerId: string;
        let planId: string;

        beforeEach(async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'sub-customer',
                email: 'sub@example.com',
                name: 'Sub Customer'
            });
            customerId = customer.id;

            // Create a plan directly in storage
            const plan = await storageAdapter.plans.create({
                name: 'Test Plan',
                active: true,
                livemode: false
            });
            planId = plan.id;
        });

        it('should create a subscription', async () => {
            const subscription = await qzPayService.createSubscription({
                customerId,
                planId
            });

            expect(subscription).toBeDefined();
            expect(subscription.id).toBeDefined();
            expect(subscription.customerId).toBe(customerId);
            expect(subscription.status).toBe('active');
        });

        it('should get subscription by ID', async () => {
            const created = await qzPayService.createSubscription({
                customerId,
                planId
            });

            const fetched = await qzPayService.getSubscription(created.id);

            expect(fetched).toBeDefined();
            expect(fetched?.id).toBe(created.id);
        });

        it('should get subscriptions by customer ID', async () => {
            await qzPayService.createSubscription({
                customerId,
                planId
            });

            const subscriptions = await qzPayService.getSubscriptionsByCustomerId(customerId);

            expect(subscriptions).toHaveLength(1);
        });

        it('should get active subscription', async () => {
            await qzPayService.createSubscription({
                customerId,
                planId
            });

            const active = await qzPayService.getActiveSubscription(customerId);

            expect(active).toBeDefined();
            expect(active?.status).toBe('active');
        });

        it('should cancel a subscription', async () => {
            const subscription = await qzPayService.createSubscription({
                customerId,
                planId
            });

            const canceled = await qzPayService.cancelSubscription(subscription.id);

            expect(canceled.status).toBe('canceled');
        });

        it('should pause and resume a subscription', async () => {
            const subscription = await qzPayService.createSubscription({
                customerId,
                planId
            });

            const paused = await qzPayService.pauseSubscription(subscription.id);
            expect(paused.status).toBe('paused');

            const resumed = await qzPayService.resumeSubscription(subscription.id);
            expect(resumed.status).toBe('active');
        });
    });

    describe('Payment Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'payment-customer',
                email: 'payment@example.com',
                name: 'Payment Customer'
            });
            customerId = customer.id;
        });

        it('should process a payment', async () => {
            const payment = await qzPayService.processPayment({
                customerId,
                amount: 5000,
                currency: 'usd'
            });

            expect(payment).toBeDefined();
            expect(payment.id).toBeDefined();
            expect(payment.amount).toBe(5000);
            expect(payment.currency).toBe('usd');
            // Without payment adapter, status is pending
            expect(payment.status).toBe('pending');
        });

        it('should get payment by ID', async () => {
            const created = await qzPayService.processPayment({
                customerId,
                amount: 3000,
                currency: 'usd'
            });

            const fetched = await qzPayService.getPayment(created.id);

            expect(fetched).toBeDefined();
            expect(fetched?.id).toBe(created.id);
        });

        it('should get payments by customer ID', async () => {
            await qzPayService.processPayment({
                customerId,
                amount: 1000,
                currency: 'usd'
            });
            await qzPayService.processPayment({
                customerId,
                amount: 2000,
                currency: 'usd'
            });

            const payments = await qzPayService.getPaymentsByCustomerId(customerId);

            expect(payments).toHaveLength(2);
        });
    });

    describe('Invoice Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'invoice-customer',
                email: 'invoice@example.com',
                name: 'Invoice Customer'
            });
            customerId = customer.id;
        });

        it('should create an invoice', async () => {
            const invoice = await qzPayService.createInvoice({
                customerId,
                lines: [
                    {
                        description: 'Test Item',
                        quantity: 1,
                        unitAmount: 2500
                    }
                ]
            });

            expect(invoice).toBeDefined();
            expect(invoice.id).toBeDefined();
            expect(invoice.total).toBe(2500);
        });

        it('should get invoice by ID', async () => {
            const created = await qzPayService.createInvoice({
                customerId,
                lines: [
                    {
                        description: 'Another Item',
                        quantity: 2,
                        unitAmount: 1000
                    }
                ]
            });

            const fetched = await qzPayService.getInvoice(created.id);

            expect(fetched).toBeDefined();
            expect(fetched?.id).toBe(created.id);
        });

        it('should get invoices by customer ID', async () => {
            await qzPayService.createInvoice({
                customerId,
                lines: [{ description: 'Item 1', quantity: 1, unitAmount: 1000 }]
            });
            await qzPayService.createInvoice({
                customerId,
                lines: [{ description: 'Item 2', quantity: 1, unitAmount: 2000 }]
            });

            const invoices = await qzPayService.getInvoicesByCustomerId(customerId);

            expect(invoices).toHaveLength(2);
        });

        it('should mark invoice as paid', async () => {
            const invoice = await qzPayService.createInvoice({
                customerId,
                lines: [{ description: 'Paid Item', quantity: 1, unitAmount: 5000 }]
            });

            const payment = await qzPayService.processPayment({
                customerId,
                amount: 5000,
                currency: 'usd'
            });

            const paid = await qzPayService.markInvoicePaid(invoice.id, payment.id);

            expect(paid.status).toBe('paid');
        });
    });

    describe('Entitlement Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'entitlement-customer',
                email: 'entitlement@example.com',
                name: 'Entitlement Customer'
            });
            customerId = customer.id;
        });

        it('should check entitlement (false when not granted)', async () => {
            const hasEntitlement = await qzPayService.checkEntitlement(customerId, 'premium_feature');

            expect(hasEntitlement).toBe(false);
        });

        it('should check entitlement (true when granted)', async () => {
            // Grant entitlement via billing directly
            await billing.entitlements.grant(customerId, 'premium_feature');

            const hasEntitlement = await qzPayService.checkEntitlement(customerId, 'premium_feature');

            expect(hasEntitlement).toBe(true);
        });

        it('should get entitlements for customer', async () => {
            await billing.entitlements.grant(customerId, 'feature_a');
            await billing.entitlements.grant(customerId, 'feature_b');

            const entitlements = await qzPayService.getEntitlements(customerId);

            expect(entitlements).toHaveLength(2);
        });
    });

    describe('Limit Operations', () => {
        let customerId: string;

        beforeEach(async () => {
            const customer = await qzPayService.createCustomer({
                externalId: 'limit-customer',
                email: 'limit@example.com',
                name: 'Limit Customer'
            });
            customerId = customer.id;
        });

        it('should set and check a limit', async () => {
            await qzPayService.setLimit(customerId, 'api_calls', 100);

            const check = await qzPayService.checkLimit(customerId, 'api_calls');

            expect(check.allowed).toBe(true);
            expect(check.maxValue).toBe(100);
            expect(check.currentValue).toBe(0);
            expect(check.remaining).toBe(100);
        });

        it('should increment a limit', async () => {
            await qzPayService.setLimit(customerId, 'requests', 50);

            await qzPayService.incrementLimit(customerId, 'requests', 10);
            await qzPayService.incrementLimit(customerId, 'requests', 5);

            const check = await qzPayService.checkLimit(customerId, 'requests');

            expect(check.currentValue).toBe(15);
            expect(check.remaining).toBe(35);
        });

        it('should get limits for customer', async () => {
            await qzPayService.setLimit(customerId, 'limit_a', 100);
            await qzPayService.setLimit(customerId, 'limit_b', 200);

            const limits = await qzPayService.getLimits(customerId);

            expect(limits).toHaveLength(2);
        });

        it('should block when limit exceeded', async () => {
            await qzPayService.setLimit(customerId, 'tight_limit', 5);
            await qzPayService.incrementLimit(customerId, 'tight_limit', 5);

            const check = await qzPayService.checkLimit(customerId, 'tight_limit');

            expect(check.allowed).toBe(false);
            expect(check.remaining).toBe(0);
        });
    });

    describe('Service Utility Methods', () => {
        it('should return livemode status', () => {
            const isLivemode = qzPayService.isLivemode();
            expect(isLivemode).toBe(false);
        });

        it('should return billing instance', () => {
            const billingInstance = qzPayService.getBilling();
            expect(billingInstance).toBeDefined();
            expect(billingInstance).toBe(billing);
        });
    });

    describe('Event Handling', () => {
        it('should subscribe to events', async () => {
            const events: string[] = [];

            const unsubscribe = qzPayService.on('customer.created', () => {
                events.push('customer.created');
            });

            await qzPayService.createCustomer({
                externalId: 'event-customer',
                email: 'event@example.com',
                name: 'Event Customer'
            });

            expect(events).toContain('customer.created');

            unsubscribe();
        });

        it('should support one-time event subscription', async () => {
            let callCount = 0;

            qzPayService.once('customer.created', () => {
                callCount++;
            });

            await qzPayService.createCustomer({
                externalId: 'once-customer-1',
                email: 'once1@example.com',
                name: 'Once Customer 1'
            });

            await qzPayService.createCustomer({
                externalId: 'once-customer-2',
                email: 'once2@example.com',
                name: 'Once Customer 2'
            });

            expect(callCount).toBe(1);
        });
    });

    describe('Module Configuration', () => {
        it('should work with forRootAsync configuration', async () => {
            const asyncModule = await Test.createTestingModule({
                imports: [
                    QZPayModule.forRootAsync({
                        useFactory: () => ({
                            billing
                        })
                    })
                ]
            }).compile();

            const service = asyncModule.get<QZPayService>(QZPayService);
            expect(service).toBeDefined();

            const customer = await service.createCustomer({
                externalId: 'async-customer',
                email: 'async@example.com',
                name: 'Async Customer'
            });

            expect(customer.id).toBeDefined();

            await asyncModule.close();
        });
    });
});

// Helper function to push schema (simplified version)
async function pushSchema(rawSql: ReturnType<typeof postgres>): Promise<void> {
    // Create tables in order (respecting foreign key dependencies)

    // 1. Customers table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            external_id VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            stripe_customer_id VARCHAR(255),
            mp_customer_id VARCHAR(255),
            preferred_language VARCHAR(10) DEFAULT 'en',
            segment VARCHAR(50),
            tier VARCHAR(20),
            billing_address JSONB,
            shipping_address JSONB,
            tax_id VARCHAR(50),
            tax_id_type VARCHAR(20),
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            version UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 2. Plans table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            active BOOLEAN NOT NULL DEFAULT true,
            features JSONB NOT NULL DEFAULT '[]',
            entitlements TEXT[] NOT NULL DEFAULT '{}',
            limits JSONB NOT NULL DEFAULT '{}',
            metadata JSONB NOT NULL DEFAULT '{}',
            livemode BOOLEAN NOT NULL DEFAULT true,
            version UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 3. Prices table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_prices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_id UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
            nickname VARCHAR(255),
            currency VARCHAR(3) NOT NULL,
            unit_amount INTEGER NOT NULL,
            billing_interval VARCHAR(50) NOT NULL,
            interval_count INTEGER NOT NULL DEFAULT 1,
            trial_days INTEGER,
            active BOOLEAN NOT NULL DEFAULT true,
            stripe_price_id VARCHAR(255),
            mp_price_id VARCHAR(255),
            metadata JSONB NOT NULL DEFAULT '{}',
            livemode BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // 4. Subscriptions table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES billing_customers(id),
            plan_id VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL,
            billing_interval VARCHAR(50) NOT NULL,
            interval_count INTEGER DEFAULT 1,
            current_period_start TIMESTAMPTZ NOT NULL,
            current_period_end TIMESTAMPTZ NOT NULL,
            trial_start TIMESTAMPTZ,
            trial_end TIMESTAMPTZ,
            trial_converted BOOLEAN DEFAULT false,
            trial_converted_at TIMESTAMPTZ,
            cancel_at TIMESTAMPTZ,
            canceled_at TIMESTAMPTZ,
            ended_at TIMESTAMPTZ,
            promo_code_id UUID,
            default_payment_method_id UUID,
            grace_period_ends_at TIMESTAMPTZ,
            retry_count INTEGER DEFAULT 0,
            next_retry_at TIMESTAMPTZ,
            stripe_subscription_id VARCHAR(255),
            mp_subscription_id VARCHAR(255),
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            version UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 5. Payments table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES billing_customers(id),
            subscription_id UUID REFERENCES billing_subscriptions(id),
            invoice_id UUID,
            amount INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            base_amount INTEGER,
            base_currency VARCHAR(3),
            exchange_rate NUMERIC(18, 8),
            status VARCHAR(50) NOT NULL,
            provider VARCHAR(50) NOT NULL,
            provider_payment_id VARCHAR(255),
            payment_method_id UUID,
            refunded_amount INTEGER DEFAULT 0,
            failure_code VARCHAR(100),
            failure_message TEXT,
            idempotency_key VARCHAR(255),
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            version UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 6. Refunds table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_refunds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id UUID NOT NULL REFERENCES billing_payments(id),
            amount INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            status VARCHAR(50) NOT NULL,
            reason VARCHAR(100),
            provider_refund_id VARCHAR(255),
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // 7. Customer entitlements table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_customer_entitlements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES billing_customers(id),
            entitlement_key VARCHAR(100) NOT NULL,
            granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            source VARCHAR(50) NOT NULL DEFAULT 'manual',
            source_id UUID,
            livemode BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(customer_id, entitlement_key)
        )
    `;

    // 8. Customer limits table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_customer_limits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES billing_customers(id),
            limit_key VARCHAR(100) NOT NULL,
            max_value INTEGER NOT NULL,
            current_value INTEGER NOT NULL DEFAULT 0,
            reset_at TIMESTAMPTZ,
            source VARCHAR(50) NOT NULL DEFAULT 'manual',
            source_id UUID,
            livemode BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(customer_id, limit_key)
        )
    `;

    // 9. Invoices table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_invoices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES billing_customers(id),
            subscription_id UUID REFERENCES billing_subscriptions(id),
            number VARCHAR(50) NOT NULL UNIQUE,
            status VARCHAR(50) NOT NULL DEFAULT 'draft',
            currency VARCHAR(3) NOT NULL,
            subtotal INTEGER NOT NULL DEFAULT 0,
            discount INTEGER DEFAULT 0,
            tax INTEGER NOT NULL DEFAULT 0,
            total INTEGER NOT NULL DEFAULT 0,
            amount_paid INTEGER NOT NULL DEFAULT 0,
            amount_remaining INTEGER DEFAULT 0,
            description TEXT,
            due_date TIMESTAMPTZ,
            paid_at TIMESTAMPTZ,
            voided_at TIMESTAMPTZ,
            period_start TIMESTAMPTZ,
            period_end TIMESTAMPTZ,
            stripe_invoice_id VARCHAR(255),
            mp_invoice_id VARCHAR(255),
            hosted_invoice_url TEXT,
            pdf_url TEXT,
            billing_reason VARCHAR(50),
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            version UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 10. Invoice lines table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_invoice_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
            description VARCHAR(500) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_amount INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            price_id VARCHAR(255),
            period_start TIMESTAMPTZ,
            period_end TIMESTAMPTZ,
            proration BOOLEAN DEFAULT false,
            metadata JSONB DEFAULT '{}'
        )
    `;

    // 11. Invoice payments table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_invoice_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
            payment_id UUID NOT NULL,
            amount_applied INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            livemode BOOLEAN NOT NULL DEFAULT true
        )
    `;

    // 12. Payment methods table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_payment_methods (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES billing_customers(id),
            provider VARCHAR(50) NOT NULL,
            provider_payment_method_id VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            last_four VARCHAR(4),
            brand VARCHAR(50),
            exp_month INTEGER,
            exp_year INTEGER,
            is_default BOOLEAN DEFAULT false,
            billing_details JSONB,
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 13. Promo codes table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_promo_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) NOT NULL UNIQUE,
            type VARCHAR(50) NOT NULL,
            value INTEGER NOT NULL,
            config JSONB DEFAULT '{}',
            max_uses INTEGER,
            used_count INTEGER DEFAULT 0,
            max_per_customer INTEGER DEFAULT 1,
            valid_plans TEXT[],
            new_customers_only BOOLEAN DEFAULT false,
            existing_customers_only BOOLEAN DEFAULT false,
            starts_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            combinable BOOLEAN DEFAULT false,
            active BOOLEAN DEFAULT true,
            livemode BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // Create indexes
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_external_id ON billing_customers(external_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON billing_subscriptions(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON billing_payments(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON billing_invoices(customer_id)`;
}

// Helper function to clear test data
async function clearTestData(rawSql: ReturnType<typeof postgres>): Promise<void> {
    await rawSql`SET session_replication_role = replica`;

    await rawSql`TRUNCATE TABLE billing_invoice_payments CASCADE`;
    await rawSql`TRUNCATE TABLE billing_invoice_lines CASCADE`;
    await rawSql`TRUNCATE TABLE billing_invoices CASCADE`;
    await rawSql`TRUNCATE TABLE billing_customer_limits CASCADE`;
    await rawSql`TRUNCATE TABLE billing_customer_entitlements CASCADE`;
    await rawSql`TRUNCATE TABLE billing_refunds CASCADE`;
    await rawSql`TRUNCATE TABLE billing_payments CASCADE`;
    await rawSql`TRUNCATE TABLE billing_subscriptions CASCADE`;
    await rawSql`TRUNCATE TABLE billing_prices CASCADE`;
    await rawSql`TRUNCATE TABLE billing_promo_codes CASCADE`;
    await rawSql`TRUNCATE TABLE billing_payment_methods CASCADE`;
    await rawSql`TRUNCATE TABLE billing_plans CASCADE`;
    await rawSql`TRUNCATE TABLE billing_customers CASCADE`;

    await rawSql`SET session_replication_role = DEFAULT`;
}
