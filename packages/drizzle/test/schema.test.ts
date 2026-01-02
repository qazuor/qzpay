/**
 * Schema Definition Tests
 *
 * Tests that verify schema definitions are correctly exported and have expected structure.
 */
import { describe, expect, it } from 'vitest';
import {
    QZPAY_DRIZZLE_SCHEMA_VERSION,
    billingAuditLogs,
    billingCustomerEntitlements,
    billingCustomerLimits,
    billingCustomers,
    billingEntitlements,
    billingIdempotencyKeys,
    billingInvoiceLines,
    billingInvoicePayments,
    billingInvoices,
    billingLimits,
    billingPaymentMethods,
    billingPayments,
    billingPlans,
    billingPrices,
    billingPromoCodeUsage,
    billingPromoCodes,
    billingRefunds,
    billingSubscriptions,
    billingUsageRecords,
    billingVendorPayouts,
    billingVendors,
    billingWebhookDeadLetter,
    billingWebhookEvents
} from '../src/schema/index.js';

describe('Schema Definitions', () => {
    describe('Schema Version', () => {
        it('should export schema version', () => {
            expect(QZPAY_DRIZZLE_SCHEMA_VERSION).toBeDefined();
            expect(typeof QZPAY_DRIZZLE_SCHEMA_VERSION).toBe('string');
        });
    });

    describe('Customer Tables', () => {
        it('should have billingCustomers table with correct columns', () => {
            expect(billingCustomers).toBeDefined();

            // Check essential columns exist
            const columns = Object.keys(billingCustomers);
            expect(columns).toContain('id');
            expect(columns).toContain('externalId');
            expect(columns).toContain('email');
            expect(columns).toContain('livemode');
            expect(columns).toContain('createdAt');
            expect(columns).toContain('updatedAt');
            expect(columns).toContain('deletedAt');
        });

        it('should have billingCustomerEntitlements table', () => {
            expect(billingCustomerEntitlements).toBeDefined();
            const columns = Object.keys(billingCustomerEntitlements);
            expect(columns).toContain('customerId');
            expect(columns).toContain('entitlementKey');
        });

        it('should have billingCustomerLimits table', () => {
            expect(billingCustomerLimits).toBeDefined();
            const columns = Object.keys(billingCustomerLimits);
            expect(columns).toContain('customerId');
            expect(columns).toContain('limitKey');
            expect(columns).toContain('maxValue');
            expect(columns).toContain('currentValue');
        });
    });

    describe('Plan and Price Tables', () => {
        it('should have billingPlans table with correct columns', () => {
            expect(billingPlans).toBeDefined();
            const columns = Object.keys(billingPlans);
            expect(columns).toContain('id');
            expect(columns).toContain('name');
            expect(columns).toContain('active');
            expect(columns).toContain('livemode');
        });

        it('should have billingPrices table with correct columns', () => {
            expect(billingPrices).toBeDefined();
            const columns = Object.keys(billingPrices);
            expect(columns).toContain('id');
            expect(columns).toContain('planId');
            expect(columns).toContain('unitAmount');
            expect(columns).toContain('currency');
            expect(columns).toContain('billingInterval');
        });
    });

    describe('Subscription Table', () => {
        it('should have billingSubscriptions table with correct columns', () => {
            expect(billingSubscriptions).toBeDefined();
            const columns = Object.keys(billingSubscriptions);
            expect(columns).toContain('id');
            expect(columns).toContain('customerId');
            expect(columns).toContain('planId');
            expect(columns).toContain('status');
            expect(columns).toContain('currentPeriodStart');
            expect(columns).toContain('currentPeriodEnd');
            expect(columns).toContain('cancelAt');
        });
    });

    describe('Payment Tables', () => {
        it('should have billingPayments table with correct columns', () => {
            expect(billingPayments).toBeDefined();
            const columns = Object.keys(billingPayments);
            expect(columns).toContain('id');
            expect(columns).toContain('customerId');
            expect(columns).toContain('amount');
            expect(columns).toContain('currency');
            expect(columns).toContain('status');
            expect(columns).toContain('provider');
        });

        it('should have billingRefunds table', () => {
            expect(billingRefunds).toBeDefined();
            const columns = Object.keys(billingRefunds);
            expect(columns).toContain('paymentId');
            expect(columns).toContain('amount');
            expect(columns).toContain('reason');
        });

        it('should have billingPaymentMethods table', () => {
            expect(billingPaymentMethods).toBeDefined();
            const columns = Object.keys(billingPaymentMethods);
            expect(columns).toContain('customerId');
            expect(columns).toContain('type');
            expect(columns).toContain('isDefault');
        });
    });

    describe('Invoice Tables', () => {
        it('should have billingInvoices table with correct columns', () => {
            expect(billingInvoices).toBeDefined();
            const columns = Object.keys(billingInvoices);
            expect(columns).toContain('id');
            expect(columns).toContain('customerId');
            expect(columns).toContain('number');
            expect(columns).toContain('status');
            expect(columns).toContain('subtotal');
            expect(columns).toContain('total');
        });

        it('should have billingInvoiceLines table', () => {
            expect(billingInvoiceLines).toBeDefined();
            const columns = Object.keys(billingInvoiceLines);
            expect(columns).toContain('invoiceId');
            expect(columns).toContain('description');
            expect(columns).toContain('amount');
        });

        it('should have billingInvoicePayments table', () => {
            expect(billingInvoicePayments).toBeDefined();
            const columns = Object.keys(billingInvoicePayments);
            expect(columns).toContain('invoiceId');
            expect(columns).toContain('paymentId');
        });
    });

    describe('Promo Code Tables', () => {
        it('should have billingPromoCodes table with correct columns', () => {
            expect(billingPromoCodes).toBeDefined();
            const columns = Object.keys(billingPromoCodes);
            expect(columns).toContain('id');
            expect(columns).toContain('code');
            expect(columns).toContain('type');
            expect(columns).toContain('value');
            expect(columns).toContain('active');
        });

        it('should have billingPromoCodeUsage table', () => {
            expect(billingPromoCodeUsage).toBeDefined();
            const columns = Object.keys(billingPromoCodeUsage);
            expect(columns).toContain('promoCodeId');
            expect(columns).toContain('customerId');
            expect(columns).toContain('discountAmount');
        });
    });

    describe('Vendor Tables', () => {
        it('should have billingVendors table with correct columns', () => {
            expect(billingVendors).toBeDefined();
            const columns = Object.keys(billingVendors);
            expect(columns).toContain('id');
            expect(columns).toContain('externalId');
            expect(columns).toContain('name');
            expect(columns).toContain('onboardingStatus');
        });

        it('should have billingVendorPayouts table', () => {
            expect(billingVendorPayouts).toBeDefined();
            const columns = Object.keys(billingVendorPayouts);
            expect(columns).toContain('vendorId');
            expect(columns).toContain('amount');
            expect(columns).toContain('status');
        });
    });

    describe('Entitlement and Limit Tables', () => {
        it('should have billingEntitlements table', () => {
            expect(billingEntitlements).toBeDefined();
            const columns = Object.keys(billingEntitlements);
            expect(columns).toContain('id');
            expect(columns).toContain('key');
            expect(columns).toContain('name');
        });

        it('should have billingLimits table', () => {
            expect(billingLimits).toBeDefined();
            const columns = Object.keys(billingLimits);
            expect(columns).toContain('id');
            expect(columns).toContain('key');
            expect(columns).toContain('name');
        });
    });

    describe('Usage Records Table', () => {
        it('should have billingUsageRecords table with correct columns', () => {
            expect(billingUsageRecords).toBeDefined();
            const columns = Object.keys(billingUsageRecords);
            expect(columns).toContain('id');
            expect(columns).toContain('subscriptionId');
            expect(columns).toContain('metricName');
            expect(columns).toContain('action');
            expect(columns).toContain('quantity');
        });
    });

    describe('Infrastructure Tables', () => {
        it('should have billingWebhookEvents table', () => {
            expect(billingWebhookEvents).toBeDefined();
            const columns = Object.keys(billingWebhookEvents);
            expect(columns).toContain('id');
            expect(columns).toContain('provider');
            expect(columns).toContain('type');
            expect(columns).toContain('payload');
            expect(columns).toContain('status');
        });

        it('should have billingWebhookDeadLetter table', () => {
            expect(billingWebhookDeadLetter).toBeDefined();
            const columns = Object.keys(billingWebhookDeadLetter);
            expect(columns).toContain('providerEventId');
            expect(columns).toContain('error');
            expect(columns).toContain('attempts');
        });

        it('should have billingAuditLogs table', () => {
            expect(billingAuditLogs).toBeDefined();
            const columns = Object.keys(billingAuditLogs);
            expect(columns).toContain('id');
            expect(columns).toContain('entityType');
            expect(columns).toContain('entityId');
            expect(columns).toContain('action');
            expect(columns).toContain('actorType');
        });

        it('should have billingIdempotencyKeys table', () => {
            expect(billingIdempotencyKeys).toBeDefined();
            const columns = Object.keys(billingIdempotencyKeys);
            expect(columns).toContain('id');
            expect(columns).toContain('key');
            expect(columns).toContain('operation');
            expect(columns).toContain('expiresAt');
        });
    });

    describe('Table Naming Convention', () => {
        it('all tables should use billing_ prefix', () => {
            // Get table names from table objects
            const tables = [
                billingCustomers,
                billingPlans,
                billingPrices,
                billingSubscriptions,
                billingPayments,
                billingInvoices,
                billingPromoCodes,
                billingVendors,
                billingAuditLogs
            ];

            for (const table of tables) {
                // Access the internal table name
                const tableName = (table as Record<string, unknown>)[Symbol.for('drizzle:Name')] as string;
                if (tableName) {
                    expect(tableName.startsWith('billing_')).toBe(true);
                }
            }
        });
    });
});
