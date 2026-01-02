/**
 * QZPay Drizzle Storage Adapter
 *
 * Factory function for creating a Drizzle-based storage adapter
 * that implements the QZPayStorageAdapter interface.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { QZPayDrizzleStorageAdapter, type QZPayDrizzleStorageConfig } from './drizzle-storage.adapter.js';

export { QZPayDrizzleStorageAdapter, type QZPayDrizzleStorageConfig };

/**
 * Create a QZPay storage adapter backed by Drizzle ORM
 *
 * @param db - Drizzle PostgreSQL database connection
 * @param options - Configuration options
 * @returns Storage adapter instance
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/postgres-js';
 * import postgres from 'postgres';
 * import { createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
 *
 * const client = postgres(process.env.DATABASE_URL!);
 * const db = drizzle(client);
 *
 * const storage = createQZPayDrizzleAdapter(db, { livemode: true });
 *
 * // Use with QZPay core
 * const qzpay = new QZPay({
 *   storage,
 *   // ... other options
 * });
 * ```
 */
export function createQZPayDrizzleAdapter(db: PostgresJsDatabase, options?: { livemode?: boolean }): QZPayDrizzleStorageAdapter {
    return new QZPayDrizzleStorageAdapter({
        db,
        livemode: options?.livemode ?? true
    });
}
