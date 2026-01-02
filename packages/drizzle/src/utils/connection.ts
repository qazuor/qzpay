/**
 * Database connection utilities for QZPay Drizzle
 *
 * Provides helpers for managing PostgreSQL connections with Drizzle ORM.
 */
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

/**
 * Connection pool configuration options
 */
export interface QZPayConnectionConfig {
    /** Database connection URL */
    connectionUrl: string;
    /** Maximum number of connections in the pool (default: 10) */
    maxConnections?: number;
    /** Idle timeout in seconds (default: 20) */
    idleTimeout?: number;
    /** Connection timeout in milliseconds (default: 30000) */
    connectTimeout?: number;
    /** Whether to log queries (default: false) */
    debug?: boolean;
    /** SSL mode (default: 'prefer') */
    ssl?: 'require' | 'prefer' | 'disable' | boolean;
    /** Application name for connection identification */
    applicationName?: string;
}

/**
 * Active connection instance
 */
export interface QZPayConnection {
    /** Drizzle database instance */
    db: PostgresJsDatabase;
    /** Raw postgres.js client */
    client: Sql;
    /** Close the connection pool */
    close: () => Promise<void>;
    /** Check if connection is alive */
    isAlive: () => Promise<boolean>;
}

/**
 * Create a new database connection
 *
 * @example
 * ```typescript
 * import { createConnection } from '@qazuor/qzpay-drizzle/utils';
 *
 * const connection = await createConnection({
 *   connectionUrl: process.env.DATABASE_URL!,
 *   maxConnections: 20,
 *   debug: process.env.NODE_ENV === 'development'
 * });
 *
 * // Use the connection
 * const { db } = connection;
 *
 * // Clean up when done
 * await connection.close();
 * ```
 */
export function createConnection(config: QZPayConnectionConfig): QZPayConnection {
    const {
        connectionUrl,
        maxConnections = 10,
        idleTimeout = 20,
        connectTimeout = 30000,
        debug = false,
        ssl = 'prefer',
        applicationName = 'qzpay'
    } = config;

    const client = postgres(connectionUrl, {
        max: maxConnections,
        idle_timeout: idleTimeout,
        connect_timeout: connectTimeout / 1000,
        debug: debug
            ? (_connection, query, params) => {
                  console.log('[QZPay SQL]', query, params);
              }
            : false,
        ssl: ssl === 'disable' ? false : ssl === 'require' ? 'require' : 'prefer',
        connection: {
            application_name: applicationName
        }
    });

    const db = drizzle(client);

    return {
        db,
        client,
        close: async () => {
            await client.end();
        },
        isAlive: async () => {
            try {
                await client`SELECT 1`;
                return true;
            } catch {
                return false;
            }
        }
    };
}

/**
 * Parse a database URL into its components
 *
 * @example
 * ```typescript
 * const parts = parseDatabaseUrl('postgresql://user:pass@localhost:5432/mydb?sslmode=require');
 * // { host: 'localhost', port: 5432, database: 'mydb', user: 'user', password: 'pass', ssl: true }
 * ```
 */
export function parseDatabaseUrl(url: string): {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
} {
    const parsed = new URL(url);

    return {
        host: parsed.hostname,
        port: Number.parseInt(parsed.port || '5432', 10),
        database: parsed.pathname.slice(1),
        user: parsed.username,
        password: parsed.password,
        ssl: parsed.searchParams.get('sslmode') === 'require'
    };
}

/**
 * Build a database URL from components
 *
 * @example
 * ```typescript
 * const url = buildDatabaseUrl({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'qzpay_dev',
 *   user: 'postgres',
 *   password: 'secret'
 * });
 * // 'postgresql://postgres:secret@localhost:5432/qzpay_dev'
 * ```
 */
export function buildDatabaseUrl(config: {
    host: string;
    port?: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
}): string {
    const { host, port = 5432, database, user, password, ssl } = config;
    const sslParam = ssl ? '?sslmode=require' : '';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslParam}`;
}

/**
 * Connection pool statistics
 */
export interface QZPayPoolStats {
    /** Total connections in pool */
    total: number;
    /** Active connections */
    active: number;
    /** Idle connections */
    idle: number;
    /** Waiting requests */
    waiting: number;
}

/**
 * Get connection pool statistics
 *
 * Note: This requires access to the postgres.js internal state
 * and may not be available in all configurations.
 */
export function getPoolStats(client: Sql): QZPayPoolStats | null {
    try {
        // postgres.js exposes some statistics through internal properties
        // This is implementation-specific and may change
        const stats = client as unknown as {
            options?: { max?: number };
        };

        return {
            total: stats.options?.max ?? 0,
            active: 0, // Not directly exposed by postgres.js
            idle: 0,
            waiting: 0
        };
    } catch {
        return null;
    }
}
