/**
 * Drizzle adapter configuration types
 */

/**
 * Configuration for creating the Drizzle storage adapter
 */
export interface QZPayDrizzleConfig {
    /**
     * PostgreSQL connection string
     * @example "postgresql://user:password@localhost:5432/qzpay"
     */
    connectionString: string;

    /**
     * Schema name for table prefix isolation
     * @default "public"
     */
    schema?: string;

    /**
     * Enable connection pooling
     * @default true
     */
    pooling?: boolean;

    /**
     * Maximum number of connections in the pool
     * @default 10
     */
    maxConnections?: number;

    /**
     * Connection idle timeout in milliseconds
     * @default 30000
     */
    idleTimeout?: number;

    /**
     * Enable SSL connection
     * @default false in development, true in production
     */
    ssl?: boolean | 'require' | 'prefer';

    /**
     * Enable prepared statements
     * @default true
     */
    preparedStatements?: boolean;

    /**
     * Custom table prefix (replaces 'billing_')
     * @default "billing_"
     */
    tablePrefix?: string;

    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean;
}

/**
 * Database connection status
 */
export interface QZPayDrizzleConnectionStatus {
    connected: boolean;
    poolSize: number;
    activeConnections: number;
    idleConnections: number;
    waitingQueries: number;
}
