/**
 * Database test helpers using Testcontainers
 *
 * Provides PostgreSQL container management for integration tests.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
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
    const rawSql = sql!;

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

    // Create indexes
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_external_id ON billing_customers(external_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_email ON billing_customers(email)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_stripe_id ON billing_customers(stripe_customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_customers_mp_id ON billing_customers(mp_customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_plans_active ON billing_plans(active)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_plans_livemode ON billing_plans(livemode)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_prices_plan_id ON billing_prices(plan_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON billing_subscriptions(customer_id)`;
    await rawSql`CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON billing_payments(customer_id)`;
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

    // Truncate all tables
    await sql`TRUNCATE TABLE billing_customer_limits CASCADE`;
    await sql`TRUNCATE TABLE billing_customer_entitlements CASCADE`;
    await sql`TRUNCATE TABLE billing_limits CASCADE`;
    await sql`TRUNCATE TABLE billing_entitlements CASCADE`;
    await sql`TRUNCATE TABLE billing_refunds CASCADE`;
    await sql`TRUNCATE TABLE billing_payments CASCADE`;
    await sql`TRUNCATE TABLE billing_subscriptions CASCADE`;
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
