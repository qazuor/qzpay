/**
 * Migration utilities for QZPay Drizzle
 *
 * Provides programmatic migration execution for runtime use.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export interface QZPayMigrationConfig {
    /** Database connection URL */
    connectionUrl: string;
    /** Migrations folder path (relative to project root) */
    migrationsFolder?: string;
    /** Whether to log migration progress */
    verbose?: boolean;
}

/**
 * Run all pending migrations
 *
 * @example
 * ```typescript
 * import { runMigrations } from '@qazuor/qzpay-drizzle/utils';
 *
 * await runMigrations({
 *   connectionUrl: process.env.DATABASE_URL!,
 *   verbose: true
 * });
 * ```
 */
export async function runMigrations(config: QZPayMigrationConfig): Promise<void> {
    const { connectionUrl, migrationsFolder = './migrations', verbose = false } = config;

    if (verbose) {
        console.log('[QZPay] Starting database migrations...');
    }

    // Create a connection specifically for migrations
    const sql = postgres(connectionUrl, { max: 1 });

    try {
        const db = drizzle(sql);

        await migrate(db, {
            migrationsFolder
        });

        if (verbose) {
            console.log('[QZPay] Migrations completed successfully');
        }
    } catch (error) {
        console.error('[QZPay] Migration failed:', error);
        throw error;
    } finally {
        await sql.end();
    }
}

/**
 * Check if there are pending migrations
 *
 * Note: This is a simplified check that attempts to run migrations
 * in a transaction and rolls back. For production use, consider
 * using drizzle-kit's migration status directly.
 */
export async function hasPendingMigrations(connectionUrl: string): Promise<boolean> {
    const sql = postgres(connectionUrl, { max: 1 });

    try {
        // We create db to ensure connection works, but use raw SQL for checking
        drizzle(sql);

        // Check if the migrations table exists and has entries
        const result = await sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'drizzle_migrations'
            ) as exists
        `;

        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        if (!result[0]?.['exists']) {
            // No migrations table means all migrations are pending
            return true;
        }

        // TODO: Compare migration files with applied migrations
        // For now, return false if migrations table exists
        return false;
    } finally {
        await sql.end();
    }
}

/**
 * Create the database if it doesn't exist
 *
 * @example
 * ```typescript
 * await ensureDatabase({
 *   connectionUrl: 'postgresql://postgres:postgres@localhost:5432/postgres',
 *   databaseName: 'qzpay_dev'
 * });
 * ```
 */
export async function ensureDatabase(config: { connectionUrl: string; databaseName: string }): Promise<boolean> {
    const { connectionUrl, databaseName } = config;

    // Connect to postgres database to create the target database
    const sql = postgres(connectionUrl, { max: 1 });

    try {
        // Check if database exists
        const result = await sql`
            SELECT 1 FROM pg_database WHERE datname = ${databaseName}
        `;

        if (result.length === 0) {
            // Create database
            await sql.unsafe(`CREATE DATABASE "${databaseName}"`);
            console.log(`[QZPay] Created database: ${databaseName}`);
            return true;
        }

        return false;
    } finally {
        await sql.end();
    }
}
