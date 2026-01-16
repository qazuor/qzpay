/**
 * Database test helpers using Testcontainers
 *
 * Provides PostgreSQL container management for integration tests.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let container: StartedPostgreSqlContainer | null = null;
let sql: ReturnType<typeof postgres> | null = null;
let db: PostgresJsDatabase | null = null;

/**
 * Start a PostgreSQL container for testing
 */
export async function startTestDatabase(): Promise<{
    db: PostgresJsDatabase;
    connectionUrl: string;
}> {
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

    // Run migrations (push schema)
    await pushSchema();

    return { db, connectionUrl };
}

/**
 * Push schema to test database (faster than migrations for tests)
 */
async function pushSchema(): Promise<void> {
    if (!sql) {
        throw new Error('Database connection not initialized');
    }
    const rawSql = sql;

    // Create tables in order (respecting foreign key dependencies)

    // 1. Customers table
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

    // 3b. Add-ons table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_addons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            active BOOLEAN NOT NULL DEFAULT true,
            unit_amount INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            billing_interval VARCHAR(50) NOT NULL,
            billing_interval_count INTEGER NOT NULL DEFAULT 1,
            compatible_plan_ids TEXT[] NOT NULL DEFAULT '{}',
            allow_multiple BOOLEAN NOT NULL DEFAULT false,
            max_quantity INTEGER,
            entitlements TEXT[] NOT NULL DEFAULT '{}',
            limits JSONB NOT NULL DEFAULT '[]',
            metadata JSONB NOT NULL DEFAULT '{}',
            livemode BOOLEAN NOT NULL DEFAULT true,
            version UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
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
            cancel_at_period_end BOOLEAN DEFAULT false,
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

    // 4b. Subscription add-ons table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_subscription_addons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
            addon_id UUID NOT NULL REFERENCES billing_addons(id) ON DELETE RESTRICT,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_amount INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            canceled_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
            provider_payment_ids JSONB DEFAULT '{}',
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

    // 5b. Refunds table
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

    // 6. Entitlements definition table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_entitlements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

    // 8. Limits definition table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_limits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            default_value INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // 9. Customer limits table
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

    // 10. Invoices table
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

    // 11. Invoice lines table
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

    // 12. Invoice payments table
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

    // 13. Payment methods table
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
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            billing_details JSONB,
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 14. Promo codes table
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

    // 14b. Promo code usage table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_promo_code_usage (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            promo_code_id UUID NOT NULL REFERENCES billing_promo_codes(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL,
            subscription_id UUID,
            discount_amount INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            livemode BOOLEAN NOT NULL DEFAULT true
        )
    `;

    // 15. Vendors table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_vendors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            external_id VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255),
            email VARCHAR(255) NOT NULL,
            onboarding_status VARCHAR(50) NOT NULL DEFAULT 'pending',
            commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
            payout_schedule JSONB,
            payment_mode VARCHAR(50) DEFAULT 'automatic',
            can_receive_payments BOOLEAN DEFAULT false,
            pending_balance INTEGER DEFAULT 0,
            stripe_account_id VARCHAR(255),
            mp_merchant_id VARCHAR(255),
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            version UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    `;

    // 16. Vendor payouts table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_vendor_payouts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES billing_vendors(id) ON DELETE RESTRICT,
            amount INTEGER NOT NULL,
            currency VARCHAR(3) NOT NULL,
            status VARCHAR(50) NOT NULL,
            provider VARCHAR(50) NOT NULL,
            provider_payout_id VARCHAR(255),
            failure_code VARCHAR(100),
            failure_message VARCHAR(500),
            period_start TIMESTAMPTZ,
            period_end TIMESTAMPTZ,
            paid_at TIMESTAMPTZ,
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // 17. Usage records table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_usage_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
            metric_name VARCHAR(100) NOT NULL,
            quantity INTEGER NOT NULL,
            action VARCHAR(20) NOT NULL DEFAULT 'increment',
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            idempotency_key VARCHAR(255),
            livemode BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // 18. Audit logs table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type VARCHAR(50) NOT NULL,
            entity_id UUID NOT NULL,
            action VARCHAR(100) NOT NULL,
            actor_type VARCHAR(50) NOT NULL,
            actor_id VARCHAR(255),
            changes JSONB,
            previous_values JSONB,
            ip_address INET,
            user_agent TEXT,
            livemode BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // 19. Webhook events table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_webhook_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_event_id VARCHAR(255) NOT NULL,
            provider VARCHAR(50) NOT NULL,
            type VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            payload JSONB NOT NULL,
            processed_at TIMESTAMPTZ,
            error TEXT,
            attempts INTEGER DEFAULT 0,
            livemode BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // 20. Webhook dead letter queue table
    await rawSql`
        CREATE TABLE IF NOT EXISTS billing_webhook_dead_letter (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_event_id VARCHAR(255) NOT NULL,
            provider VARCHAR(50) NOT NULL,
            type VARCHAR(100) NOT NULL,
            payload JSONB NOT NULL,
            error TEXT NOT NULL,
            attempts INTEGER NOT NULL,
            resolved_at TIMESTAMPTZ,
            livemode BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    // Create indexes
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_external_id ON billing_customers(external_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_email ON billing_customers(email)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_stripe_id ON billing_customers(stripe_customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_mp_id ON billing_customers(mp_customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_plans_active ON billing_plans(active)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_plans_livemode ON billing_plans(livemode)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_prices_plan_id ON billing_prices(plan_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_addons_active ON billing_addons(active)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_addons_livemode ON billing_addons(livemode)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_addons_billing_interval ON billing_addons(billing_interval)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON billing_subscriptions(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_subscription_addons_subscription ON billing_subscription_addons(subscription_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_subscription_addons_addon ON billing_subscription_addons(addon_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_subscription_addons_status ON billing_subscription_addons(status)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON billing_payments(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON billing_invoices(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON billing_invoices(subscription_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_invoices_number ON billing_invoices(number)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_payment_methods_customer_id ON billing_payment_methods(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON billing_promo_codes(code)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_vendors_external_id ON billing_vendors(external_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_usage_records_subscription_id ON billing_usage_records(subscription_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON billing_audit_logs(entity_type, entity_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON billing_audit_logs(action)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON billing_audit_logs(actor_type, actor_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_id ON billing_webhook_events(provider_event_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON billing_webhook_events(status)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_resolved ON billing_webhook_dead_letter(resolved_at)`;
}

/**
 * Stop the test database container
 */
export async function stopTestDatabase(): Promise<void> {
    if (sql) {
        await sql.end();
        sql = null;
    }

    if (container) {
        await container.stop();
        container = null;
    }

    db = null;
}

/**
 * Clear all data from test tables
 */
export async function clearTestData(): Promise<void> {
    if (!sql) return;

    // Disable foreign key checks temporarily
    await sql`SET session_replication_role = replica`;

    // Truncate all tables (order matters for foreign keys)
    await sql`TRUNCATE TABLE billing_webhook_dead_letter CASCADE`;
    await sql`TRUNCATE TABLE billing_webhook_events CASCADE`;
    await sql`TRUNCATE TABLE billing_audit_logs CASCADE`;
    await sql`TRUNCATE TABLE billing_usage_records CASCADE`;
    await sql`TRUNCATE TABLE billing_vendor_payouts CASCADE`;
    await sql`TRUNCATE TABLE billing_vendors CASCADE`;
    await sql`TRUNCATE TABLE billing_promo_code_usage CASCADE`;
    await sql`TRUNCATE TABLE billing_promo_codes CASCADE`;
    await sql`TRUNCATE TABLE billing_payment_methods CASCADE`;
    await sql`TRUNCATE TABLE billing_invoice_payments CASCADE`;
    await sql`TRUNCATE TABLE billing_invoice_lines CASCADE`;
    await sql`TRUNCATE TABLE billing_invoices CASCADE`;
    await sql`TRUNCATE TABLE billing_customer_limits CASCADE`;
    await sql`TRUNCATE TABLE billing_customer_entitlements CASCADE`;
    await sql`TRUNCATE TABLE billing_limits CASCADE`;
    await sql`TRUNCATE TABLE billing_entitlements CASCADE`;
    await sql`TRUNCATE TABLE billing_refunds CASCADE`;
    await sql`TRUNCATE TABLE billing_payments CASCADE`;
    await sql`TRUNCATE TABLE billing_subscription_addons CASCADE`;
    await sql`TRUNCATE TABLE billing_subscriptions CASCADE`;
    await sql`TRUNCATE TABLE billing_addons CASCADE`;
    await sql`TRUNCATE TABLE billing_prices CASCADE`;
    await sql`TRUNCATE TABLE billing_plans CASCADE`;
    await sql`TRUNCATE TABLE billing_customers CASCADE`;

    // Re-enable foreign key checks
    await sql`SET session_replication_role = DEFAULT`;
}

/**
 * Get the current test database connection
 */
export function getTestDatabase(): PostgresJsDatabase {
    if (!db) {
        throw new Error('Test database not initialized. Call startTestDatabase() first.');
    }
    return db;
}
