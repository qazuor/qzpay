/**
 * Drizzle Kit configuration for QZPay
 *
 * This configuration is used by drizzle-kit for:
 * - Generating migrations (db:generate)
 * - Pushing schema changes (db:push)
 * - Running migrations (db:migrate)
 * - Opening Drizzle Studio (db:studio)
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    // Schema files location (use compiled output for drizzle-kit compatibility)
    schema: './dist/schema/index.js',

    // Output directory for migrations
    out: './migrations',

    // Database dialect
    dialect: 'postgresql',

    // Database connection
    // Uses environment variable or defaults for development
    dbCredentials: {
        url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/qzpay_dev'
    },

    // Migration table name
    tablesFilter: ['billing_*'],

    // Verbose output
    verbose: true,

    // Strict mode for type checking
    strict: true
});
