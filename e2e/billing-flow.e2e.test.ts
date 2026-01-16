import { type QZPayBilling, type QZPayPlan, createQZPayBilling } from '@qazuor/qzpay-core';
import { type QZPayDrizzleStorageAdapter, createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
/**
 * E2E Integration Tests - Billing Flow
 *
 * Tests the complete billing workflow using Core + Drizzle storage adapter.
 * These tests verify the integration between packages works correctly end-to-end.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('E2E: Billing Flow', () => {
    let container: StartedPostgreSqlContainer;
    let sql: ReturnType<typeof postgres>;
    let db: PostgresJsDatabase;
    let storage: QZPayDrizzleStorageAdapter;
    let billing: QZPayBilling;

    const testPlans: QZPayPlan[] = [
        {
            id: 'plan_basic',
            name: 'Basic Plan',
            description: 'Basic features for individuals',
            active: true,
            prices: [
                {
                    id: 'price_basic_monthly',
                    planId: 'plan_basic',
                    nickname: 'Monthly',
                    currency: 'USD',
                    unitAmount: 999,
                    billingInterval: 'month',
                    intervalCount: 1,
                    active: true,
                    trialDays: 7
                },
                {
                    id: 'price_basic_yearly',
                    planId: 'plan_basic',
                    nickname: 'Yearly',
                    currency: 'USD',
                    unitAmount: 9990,
                    billingInterval: 'year',
                    intervalCount: 1,
                    active: true
                }
            ],
            features: [
                { name: 'Basic Support', description: 'Email support' },
                { name: '5 Projects', description: 'Up to 5 projects' }
            ],
            entitlements: ['basic_access', 'email_support'],
            limits: {
                projects: 5,
                api_calls: 1000
            },
            metadata: {}
        },
        {
            id: 'plan_pro',
            name: 'Pro Plan',
            description: 'Advanced features for teams',
            active: true,
            prices: [
                {
                    id: 'price_pro_monthly',
                    planId: 'plan_pro',
                    nickname: 'Monthly',
                    currency: 'USD',
                    unitAmount: 2999,
                    billingInterval: 'month',
                    intervalCount: 1,
                    active: true,
                    trialDays: 14
                }
            ],
            features: [
                { name: 'Priority Support', description: '24/7 support' },
                { name: 'Unlimited Projects', description: 'No project limits' }
            ],
            entitlements: ['basic_access', 'pro_access', 'priority_support'],
            limits: {
                projects: -1,
                api_calls: 10000
            },
            metadata: {}
        }
    ];

    beforeAll(async () => {
        // Start PostgreSQL container
        container = await new PostgreSqlContainer('postgres:16-alpine')
            .withDatabase('qzpay_e2e')
            .withUsername('test')
            .withPassword('test')
            .start();

        const connectionUrl = container.getConnectionUri();
        sql = postgres(connectionUrl);
        db = drizzle(sql);

        // Push schema
        await pushTestSchema(sql);

        // Create storage adapter
        storage = createQZPayDrizzleAdapter(db, { livemode: false });

        // Create billing instance
        billing = createQZPayBilling({
            storage,
            plans: testPlans,
            defaultCurrency: 'USD',
            livemode: false
        });
    }, 60000);

    afterAll(async () => {
        await sql.end();
        await container.stop();
    });

    beforeEach(async () => {
        await clearTestData(sql);
    });

    describe('Customer Management', () => {
        it('should create and retrieve a customer', async () => {
            const customer = await billing.customers.create({
                externalId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            expect(customer.id).toBeDefined();
            expect(customer.email).toBe('test@example.com');
            expect(customer.name).toBe('Test User');

            const retrieved = await billing.customers.get(customer.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(customer.id);
        });

        it('should update customer details', async () => {
            const customer = await billing.customers.create({
                externalId: 'user_456',
                email: 'original@example.com'
            });

            const updated = await billing.customers.update(customer.id, {
                email: 'updated@example.com',
                name: 'Updated Name'
            });

            expect(updated?.email).toBe('updated@example.com');
            expect(updated?.name).toBe('Updated Name');
        });

        it('should sync user (upsert)', async () => {
            // First sync creates customer
            const first = await billing.customers.syncUser({
                externalId: 'sync_user_1',
                email: 'sync@example.com',
                name: 'Sync User'
            });

            expect(first.id).toBeDefined();

            // Second sync updates existing
            const second = await billing.customers.syncUser({
                externalId: 'sync_user_1',
                email: 'sync@example.com',
                name: 'Updated Sync User'
            });

            expect(second.id).toBe(first.id);
            expect(second.name).toBe('Updated Sync User');
        });
    });

    describe('Subscription Lifecycle', () => {
        it('should create a subscription with trial', async () => {
            const customer = await billing.customers.create({
                externalId: 'sub_user_1',
                email: 'subscriber@example.com'
            });

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: 'plan_basic',
                priceId: 'price_basic_monthly',
                trialDays: 7
            });

            expect(subscription.id).toBeDefined();
            expect(subscription.customerId).toBe(customer.id);
            expect(subscription.planId).toBe('plan_basic');
            expect(subscription.status).toBe('trialing');
        });

        it('should pause and resume a subscription', async () => {
            const customer = await billing.customers.create({
                externalId: 'pause_user',
                email: 'pause@example.com'
            });

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: 'plan_pro'
            });

            // Pause
            const paused = await billing.subscriptions.pause(subscription.id);
            expect(paused.status).toBe('paused');

            // Resume
            const resumed = await billing.subscriptions.resume(subscription.id);
            expect(resumed.status).toBe('active');
        });

        it('should cancel a subscription', async () => {
            const customer = await billing.customers.create({
                externalId: 'cancel_user',
                email: 'cancel@example.com'
            });

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: 'plan_basic'
            });

            const canceled = await billing.subscriptions.cancel(subscription.id, {
                reason: 'Customer request'
            });

            expect(canceled.status).toBe('canceled');
            expect(canceled.canceledAt).toBeDefined();
        });

        it('should get subscriptions by customer ID', async () => {
            const customer = await billing.customers.create({
                externalId: 'multi_sub_user',
                email: 'multi@example.com'
            });

            await billing.subscriptions.create({
                customerId: customer.id,
                planId: 'plan_basic'
            });

            await billing.subscriptions.create({
                customerId: customer.id,
                planId: 'plan_pro'
            });

            const subscriptions = await billing.subscriptions.getByCustomerId(customer.id);
            expect(subscriptions).toHaveLength(2);
        });
    });

    describe('Plans', () => {
        it('should get available plans', () => {
            const plans = billing.getPlans();

            expect(plans).toHaveLength(2);
            expect(plans[0].name).toBe('Basic Plan');
            expect(plans[1].name).toBe('Pro Plan');
        });

        it('should get plan by ID', () => {
            const plan = billing.getPlan('plan_pro');

            expect(plan).toBeDefined();
            expect(plan?.name).toBe('Pro Plan');
            expect(plan?.prices).toHaveLength(1);
        });

        it('should get active plans', async () => {
            const plans = await billing.plans.getActive();

            expect(plans.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Entitlements', () => {
        it('should grant and check entitlements', async () => {
            const customer = await billing.customers.create({
                externalId: 'ent_user',
                email: 'entitlement@example.com'
            });

            // Grant entitlement
            const entitlement = await billing.entitlements.grant(customer.id, 'premium_feature');

            expect(entitlement.customerId).toBe(customer.id);
            expect(entitlement.entitlementKey).toBe('premium_feature');

            // Check entitlement
            const hasEntitlement = await billing.entitlements.check(customer.id, 'premium_feature');
            expect(hasEntitlement).toBe(true);

            // Check non-existent entitlement
            const noEntitlement = await billing.entitlements.check(customer.id, 'non_existent');
            expect(noEntitlement).toBe(false);
        });

        it('should revoke entitlements', async () => {
            const customer = await billing.customers.create({
                externalId: 'revoke_user',
                email: 'revoke@example.com'
            });

            await billing.entitlements.grant(customer.id, 'temp_feature');
            await billing.entitlements.revoke(customer.id, 'temp_feature');

            const hasEntitlement = await billing.entitlements.check(customer.id, 'temp_feature');
            expect(hasEntitlement).toBe(false);
        });

        it('should get all entitlements for customer', async () => {
            const customer = await billing.customers.create({
                externalId: 'multi_ent_user',
                email: 'multi-ent@example.com'
            });

            await billing.entitlements.grant(customer.id, 'feature_a');
            await billing.entitlements.grant(customer.id, 'feature_b');
            await billing.entitlements.grant(customer.id, 'feature_c');

            const entitlements = await billing.entitlements.getByCustomerId(customer.id);
            expect(entitlements).toHaveLength(3);
        });
    });

    describe('Limits', () => {
        it('should set and check limits', async () => {
            const customer = await billing.customers.create({
                externalId: 'limit_user',
                email: 'limit@example.com'
            });

            // Set limit
            await billing.limits.set(customer.id, 'api_calls', 100);

            // Check limit
            const result = await billing.limits.check(customer.id, 'api_calls');
            expect(result.maxValue).toBe(100);
            expect(result.currentValue).toBe(0);
            expect(result.remaining).toBe(100);
            expect(result.allowed).toBe(true);
        });

        it('should increment limits', async () => {
            const customer = await billing.customers.create({
                externalId: 'inc_limit_user',
                email: 'inc-limit@example.com'
            });

            await billing.limits.set(customer.id, 'storage', 50);
            await billing.limits.increment(customer.id, 'storage', 10);

            const result = await billing.limits.check(customer.id, 'storage');
            expect(result.currentValue).toBe(10);
            expect(result.remaining).toBe(40);
        });

        it('should block when limit exceeded', async () => {
            const customer = await billing.customers.create({
                externalId: 'exceeded_user',
                email: 'exceeded@example.com'
            });

            await billing.limits.set(customer.id, 'requests', 5);

            // Use up all limits
            for (let i = 0; i < 5; i++) {
                await billing.limits.increment(customer.id, 'requests');
            }

            const result = await billing.limits.check(customer.id, 'requests');
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });
    });

    describe('Events', () => {
        it('should emit customer.created event', async () => {
            let emittedEvent: unknown = null;

            billing.once('customer.created', (event) => {
                emittedEvent = event;
            });

            const customer = await billing.customers.create({
                externalId: 'event_user',
                email: 'event@example.com'
            });

            // Give event time to fire
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(emittedEvent).not.toBeNull();
            // Event object contains { id, type, data, livemode, createdAt }
            expect((emittedEvent as { data: { id: string } }).data.id).toBe(customer.id);
        });

        it('should emit subscription events', async () => {
            const events: string[] = [];

            billing.on('subscription.created', () => events.push('created'));
            billing.on('subscription.canceled', () => events.push('canceled'));

            const customer = await billing.customers.create({
                externalId: 'sub_event_user',
                email: 'sub-event@example.com'
            });

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: 'plan_basic'
            });

            await billing.subscriptions.cancel(subscription.id);

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(events).toContain('created');
            expect(events).toContain('canceled');
        });
    });

    describe('Configuration', () => {
        it('should report livemode status', () => {
            expect(billing.isLivemode()).toBe(false);
        });

        it('should provide storage adapter', () => {
            expect(billing.getStorage()).toBeDefined();
        });
    });
});

/**
 * Push test schema to database
 */
async function pushTestSchema(rawSql: ReturnType<typeof postgres>): Promise<void> {
    // Create tables
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            external_id VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            phone VARCHAR(20),
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
            cancel_at_period_end BOOLEAN DEFAULT false,
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

    // Create indexes
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_external_id ON billing_customers(external_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON billing_subscriptions(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON billing_payments(customer_id)`;
}

/**
 * Clear test data
 */
async function clearTestData(rawSql: ReturnType<typeof postgres>): Promise<void> {
    await rawSql`SET session_replication_role = replica`;
    await rawSql`TRUNCATE TABLE billing_customer_limits CASCADE`;
    await rawSql`TRUNCATE TABLE billing_customer_entitlements CASCADE`;
    await rawSql`TRUNCATE TABLE billing_payments CASCADE`;
    await rawSql`TRUNCATE TABLE billing_subscriptions CASCADE`;
    await rawSql`TRUNCATE TABLE billing_prices CASCADE`;
    await rawSql`TRUNCATE TABLE billing_plans CASCADE`;
    await rawSql`TRUNCATE TABLE billing_customers CASCADE`;
    await rawSql`SET session_replication_role = DEFAULT`;
}
