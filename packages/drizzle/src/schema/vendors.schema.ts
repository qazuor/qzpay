/**
 * Vendors schema for QZPay billing
 *
 * Stores marketplace vendor information and payouts.
 */
import { boolean, index, integer, jsonb, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

/**
 * Billing vendors table
 *
 * Marketplace vendors with commission rates and payout settings.
 */
export const billingVendors = pgTable(
    'billing_vendors',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        externalId: varchar('external_id', { length: 255 }).notNull().unique(),
        email: varchar('email', { length: 255 }).notNull(),
        name: varchar('name', { length: 255 }),
        commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull(),
        paymentMode: varchar('payment_mode', { length: 50 }).default('automatic'),
        stripeAccountId: varchar('stripe_account_id', { length: 255 }),
        mpMerchantId: varchar('mp_merchant_id', { length: 255 }),
        onboardingStatus: varchar('onboarding_status', { length: 50 }).default('pending'),
        canReceivePayments: boolean('can_receive_payments').default(false),
        pendingBalance: integer('pending_balance').default(0),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        version: uuid('version').notNull().defaultRandom(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        externalIdIdx: index('idx_vendors_external_id').on(table.externalId),
        stripeAccountIdx: index('idx_vendors_stripe_account').on(table.stripeAccountId),
        mpMerchantIdx: index('idx_vendors_mp_merchant').on(table.mpMerchantId)
    })
);

/**
 * Billing vendor payouts table
 *
 * Records payouts to marketplace vendors.
 */
export const billingVendorPayouts = pgTable(
    'billing_vendor_payouts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        vendorId: uuid('vendor_id')
            .notNull()
            .references(() => billingVendors.id, { onDelete: 'restrict' }),
        amount: integer('amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        status: varchar('status', { length: 50 }).notNull(),
        provider: varchar('provider', { length: 50 }).notNull(),
        providerPayoutId: varchar('provider_payout_id', { length: 255 }),
        failureCode: varchar('failure_code', { length: 100 }),
        failureMessage: varchar('failure_message', { length: 500 }),
        periodStart: timestamp('period_start', { withTimezone: true }),
        periodEnd: timestamp('period_end', { withTimezone: true }),
        paidAt: timestamp('paid_at', { withTimezone: true }),
        livemode: boolean('livemode').notNull().default(true),
        metadata: jsonb('metadata').default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        vendorIdx: index('idx_vendor_payouts_vendor').on(table.vendorId),
        statusIdx: index('idx_vendor_payouts_status').on(table.status),
        providerIdIdx: index('idx_vendor_payouts_provider_id').on(table.providerPayoutId)
    })
);

/**
 * Type for billing vendor record
 */
export type QZPayBillingVendor = typeof billingVendors.$inferSelect;

/**
 * Type for creating a new billing vendor
 */
export type QZPayBillingVendorInsert = typeof billingVendors.$inferInsert;

/**
 * Type for vendor payout record
 */
export type QZPayBillingVendorPayout = typeof billingVendorPayouts.$inferSelect;

/**
 * Type for creating vendor payout
 */
export type QZPayBillingVendorPayoutInsert = typeof billingVendorPayouts.$inferInsert;

/**
 * Zod schema for validating vendor inserts
 */
export const billingVendorInsertSchema = createInsertSchema(billingVendors);

/**
 * Zod schema for validating vendor selects
 */
export const billingVendorSelectSchema = createSelectSchema(billingVendors);

/**
 * Type for vendor insert validation
 */
export type QZPayBillingVendorInsertInput = z.infer<typeof billingVendorInsertSchema>;
