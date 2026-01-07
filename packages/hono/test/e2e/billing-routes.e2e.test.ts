/**
 * Billing Routes E2E Tests
 *
 * Tests the Hono billing routes against a real PostgreSQL database
 * using Testcontainers for true end-to-end testing.
 */
import { type QZPayBilling, createQZPayBilling } from '@qazuor/qzpay-core';
import { type QZPayDrizzleStorageAdapter, createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBillingRoutes } from '../../src/routes/billing.routes.js';

describe('Billing Routes E2E', () => {
    let container: StartedPostgreSqlContainer;
    let sql: ReturnType<typeof postgres>;
    let db: PostgresJsDatabase;
    let storageAdapter: QZPayDrizzleStorageAdapter;
    let billing: QZPayBilling;
    let routes: ReturnType<typeof createBillingRoutes>;

    beforeAll(async () => {
        // Start PostgreSQL container
        container = await new PostgreSqlContainer('postgres:16-alpine')
            .withDatabase('qzpay_hono_test')
            .withUsername('test')
            .withPassword('test')
            .start();

        const connectionUrl = container.getConnectionUri();
        sql = postgres(connectionUrl);
        db = drizzle(sql);

        // Create schema
        await createSchema(sql);

        // Create storage adapter and billing
        storageAdapter = createQZPayDrizzleAdapter(db, { livemode: true });
        billing = createQZPayBilling({
            storage: storageAdapter,
            livemode: true,
            defaultCurrency: 'usd'
        });

        // Create routes
        routes = createBillingRoutes({ billing });
    });

    afterAll(async () => {
        if (sql) await sql.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        await clearData(sql);
    });

    describe('Customer Routes', () => {
        it('should create and retrieve a customer', async () => {
            // Create customer
            const createResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'e2e-user-1',
                    email: 'e2e@example.com',
                    name: 'E2E Test User'
                })
            });

            expect(createResponse.status).toBe(201);
            const createData = await createResponse.json();
            expect(createData.success).toBe(true);
            expect(createData.data.email).toBe('e2e@example.com');

            const customerId = createData.data.id;

            // Retrieve customer
            const getResponse = await routes.request(`/billing/customers/${customerId}`);
            expect(getResponse.status).toBe(200);
            const getData = await getResponse.json();
            expect(getData.data.id).toBe(customerId);
            expect(getData.data.externalId).toBe('e2e-user-1');
        });

        it('should update a customer', async () => {
            // Create
            const createResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'update-test',
                    email: 'update@example.com',
                    name: 'Original Name'
                })
            });

            const { data: customer } = await createResponse.json();

            // Update
            const updateResponse = await routes.request(`/billing/customers/${customer.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Name' })
            });

            expect(updateResponse.status).toBe(200);
            const updateData = await updateResponse.json();
            expect(updateData.data.name).toBe('Updated Name');
        });

        it('should list customers with pagination', async () => {
            // Create multiple customers
            for (let i = 0; i < 5; i++) {
                await routes.request('/billing/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        externalId: `list-user-${i}`,
                        email: `list${i}@example.com`,
                        name: `List User ${i}`
                    })
                });
            }

            // List with pagination
            const listResponse = await routes.request('/billing/customers?limit=3&offset=0');
            expect(listResponse.status).toBe(200);

            const listData = await listResponse.json();
            expect(listData.success).toBe(true);
            expect(listData.data).toHaveLength(3);
            expect(listData.pagination.total).toBe(5);
        });

        it('should return 404 for non-existent customer', async () => {
            const response = await routes.request('/billing/customers/00000000-0000-0000-0000-000000000000');
            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should delete a customer', async () => {
            // Create
            const createResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'delete-test',
                    email: 'delete@example.com',
                    name: 'Delete Test'
                })
            });

            const { data: customer } = await createResponse.json();

            // Delete
            const deleteResponse = await routes.request(`/billing/customers/${customer.id}`, {
                method: 'DELETE'
            });

            expect(deleteResponse.status).toBe(200);

            // Verify deleted
            const getResponse = await routes.request(`/billing/customers/${customer.id}`);
            expect(getResponse.status).toBe(404);
        });
    });

    describe('Subscription Routes', () => {
        let customerId: string;
        let planId: string;

        beforeEach(async () => {
            // Create customer
            const customerResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'sub-e2e-user',
                    email: 'sub@example.com',
                    name: 'Subscription User'
                })
            });
            const customerData = await customerResponse.json();
            customerId = customerData.data.id;

            // Create plan directly
            const plan = await storageAdapter.plans.create({
                name: 'E2E Test Plan',
                active: true,
                livemode: true
            });
            planId = plan.id;
        });

        it('should create a subscription', async () => {
            const response = await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    planId
                })
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.customerId).toBe(customerId);
            expect(data.data.status).toBe('active');
        });

        it('should get subscription by ID', async () => {
            // Create
            const createResponse = await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, planId })
            });
            const { data: subscription } = await createResponse.json();

            // Get
            const getResponse = await routes.request(`/billing/subscriptions/${subscription.id}`);
            expect(getResponse.status).toBe(200);

            const getData = await getResponse.json();
            expect(getData.data.id).toBe(subscription.id);
        });

        it('should cancel a subscription', async () => {
            // Create
            const createResponse = await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, planId })
            });
            const { data: subscription } = await createResponse.json();

            // Cancel immediately (cancelAtPeriodEnd: false)
            const cancelResponse = await routes.request(`/billing/subscriptions/${subscription.id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancelAtPeriodEnd: false })
            });

            expect(cancelResponse.status).toBe(200);
            const cancelData = await cancelResponse.json();
            expect(cancelData.data.status).toBe('canceled');
        });

        it('should get subscriptions by customer', async () => {
            // Create 2 subscriptions
            await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, planId })
            });

            // Create another plan for second subscription
            const plan2 = await storageAdapter.plans.create({
                name: 'E2E Plan 2',
                active: true,
                livemode: true
            });

            await routes.request('/billing/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, planId: plan2.id })
            });

            // List by customer using query parameter
            const listResponse = await routes.request(`/billing/subscriptions?customerId=${customerId}`);
            expect(listResponse.status).toBe(200);

            const listData = await listResponse.json();
            expect(listData.data).toHaveLength(2);
        });
    });

    describe('Payment Routes', () => {
        let customerId: string;

        beforeEach(async () => {
            const customerResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'pay-e2e-user',
                    email: 'pay@example.com',
                    name: 'Payment User'
                })
            });
            const customerData = await customerResponse.json();
            customerId = customerData.data.id;
        });

        it('should process a payment', async () => {
            const response = await routes.request('/billing/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    amount: 5000,
                    currency: 'usd'
                })
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.amount).toBe(5000);
            // Currency is normalized to uppercase by Zod validation
            expect(data.data.currency).toBe('USD');
        });

        it('should get payment by ID', async () => {
            // Create
            const createResponse = await routes.request('/billing/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    amount: 2500,
                    currency: 'usd'
                })
            });
            const { data: payment } = await createResponse.json();

            // Get
            const getResponse = await routes.request(`/billing/payments/${payment.id}`);
            expect(getResponse.status).toBe(200);

            const getData = await getResponse.json();
            expect(getData.data.id).toBe(payment.id);
        });

        it('should refund a payment', async () => {
            // Create payment
            const createResponse = await routes.request('/billing/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    amount: 10000,
                    currency: 'usd'
                })
            });
            const { data: payment } = await createResponse.json();

            // Refund
            const refundResponse = await routes.request(`/billing/payments/${payment.id}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 5000 })
            });

            expect(refundResponse.status).toBe(200);
            const refundData = await refundResponse.json();
            expect(refundData.data.status).toBe('partially_refunded');
        });
    });

    describe('Invoice Routes', () => {
        let customerId: string;

        beforeEach(async () => {
            const customerResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'inv-e2e-user',
                    email: 'invoice@example.com',
                    name: 'Invoice User'
                })
            });
            const customerData = await customerResponse.json();
            customerId = customerData.data.id;
        });

        it('should create an invoice', async () => {
            const response = await routes.request('/billing/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    lines: [{ description: 'Service Fee', quantity: 1, unitAmount: 2999 }]
                })
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.total).toBe(2999);
        });

        it('should void an invoice', async () => {
            // Create
            const createResponse = await routes.request('/billing/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    lines: [{ description: 'Test', quantity: 1, unitAmount: 1000 }]
                })
            });
            const { data: invoice } = await createResponse.json();

            // Void
            const voidResponse = await routes.request(`/billing/invoices/${invoice.id}/void`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(voidResponse.status).toBe(200);
            const voidData = await voidResponse.json();
            expect(voidData.data.status).toBe('void');
        });
    });

    describe('Entitlement Routes', () => {
        let customerId: string;

        beforeEach(async () => {
            const customerResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'ent-e2e-user',
                    email: 'entitlement@example.com',
                    name: 'Entitlement User'
                })
            });
            const customerData = await customerResponse.json();
            customerId = customerData.data.id;
        });

        it('should grant and check entitlement', async () => {
            // Grant
            const grantResponse = await routes.request(`/billing/customers/${customerId}/entitlements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entitlementKey: 'premium_features' })
            });

            expect(grantResponse.status).toBe(201);

            // Check
            const checkResponse = await routes.request(`/billing/customers/${customerId}/entitlements/premium_features`);
            expect(checkResponse.status).toBe(200);

            const checkData = await checkResponse.json();
            expect(checkData.data.hasEntitlement).toBe(true);
        });

        it('should revoke entitlement', async () => {
            // Grant
            await routes.request(`/billing/customers/${customerId}/entitlements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entitlementKey: 'temp_feature' })
            });

            // Revoke
            const revokeResponse = await routes.request(`/billing/customers/${customerId}/entitlements/temp_feature`, {
                method: 'DELETE'
            });

            expect(revokeResponse.status).toBe(200);

            // Check
            const checkResponse = await routes.request(`/billing/customers/${customerId}/entitlements/temp_feature`);
            const checkData = await checkResponse.json();
            expect(checkData.data.hasEntitlement).toBe(false);
        });
    });

    describe('Limit Routes', () => {
        let customerId: string;

        beforeEach(async () => {
            const customerResponse = await routes.request('/billing/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'lim-e2e-user',
                    email: 'limit@example.com',
                    name: 'Limit User'
                })
            });
            const customerData = await customerResponse.json();
            customerId = customerData.data.id;
        });

        it('should check and get limits', async () => {
            // Set limit directly via billing API (no route for setting limits)
            await billing.limits.set(customerId, 'api_calls', 1000);

            // Check via route
            const checkResponse = await routes.request(`/billing/customers/${customerId}/limits/api_calls`);
            expect(checkResponse.status).toBe(200);

            const checkData = await checkResponse.json();
            expect(checkData.data.maxValue).toBe(1000);
            expect(checkData.data.currentValue).toBe(0);
            expect(checkData.data.allowed).toBe(true);
        });

        it('should increment limit via route', async () => {
            // Set limit directly via billing API
            await billing.limits.set(customerId, 'requests', 100);

            // Increment via route
            const incrementResponse = await routes.request(`/billing/customers/${customerId}/limits/requests/increment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 25 })
            });

            expect(incrementResponse.status).toBe(200);
            const incrementData = await incrementResponse.json();
            expect(incrementData.data.currentValue).toBe(25);
        });

        it('should get all limits for customer', async () => {
            // Set multiple limits
            await billing.limits.set(customerId, 'limit1', 100);
            await billing.limits.set(customerId, 'limit2', 200);

            // Get all via route
            const response = await routes.request(`/billing/customers/${customerId}/limits`);
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.data).toHaveLength(2);
        });
    });
});

// Schema creation helper
async function createSchema(sql: ReturnType<typeof postgres>): Promise<void> {
    await sql`
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

    await sql`
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

    await sql`
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

    await sql`
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
            provider VARCHAR(50) NOT NULL DEFAULT 'internal',
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

    await sql`
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

    await sql`
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

    await sql`
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

    await sql`
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

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_customers_external_id ON billing_customers(external_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON billing_subscriptions(customer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON billing_payments(customer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON billing_invoices(customer_id)`;
}

// Data clearing helper
async function clearData(sql: ReturnType<typeof postgres>): Promise<void> {
    await sql`SET session_replication_role = replica`;
    await sql`TRUNCATE TABLE billing_customer_limits CASCADE`;
    await sql`TRUNCATE TABLE billing_customer_entitlements CASCADE`;
    await sql`TRUNCATE TABLE billing_invoice_lines CASCADE`;
    await sql`TRUNCATE TABLE billing_invoices CASCADE`;
    await sql`TRUNCATE TABLE billing_payments CASCADE`;
    await sql`TRUNCATE TABLE billing_subscriptions CASCADE`;
    await sql`TRUNCATE TABLE billing_plans CASCADE`;
    await sql`TRUNCATE TABLE billing_customers CASCADE`;
    await sql`SET session_replication_role = DEFAULT`;
}
