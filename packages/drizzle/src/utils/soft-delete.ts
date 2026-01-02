/**
 * Soft delete utilities for QZPay Drizzle
 *
 * Provides helpers for implementing soft delete pattern across repositories.
 */
import type { SQL } from 'drizzle-orm';
import { and, isNotNull, isNull, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Soft delete options
 */
export interface QZPaySoftDeleteOptions {
    /** Whether to include soft-deleted records (default: false) */
    includeDeleted?: boolean;
    /** Whether to only return soft-deleted records (default: false) */
    onlyDeleted?: boolean;
}

/**
 * Create a WHERE clause that filters out soft-deleted records
 *
 * @example
 * ```typescript
 * const where = excludeDeleted(billingCustomers.deletedAt);
 * // Returns: isNull(billingCustomers.deletedAt)
 * ```
 */
export function excludeDeleted<T extends PgColumn>(deletedAtColumn: T): SQL {
    return isNull(deletedAtColumn);
}

/**
 * Create a WHERE clause that only returns soft-deleted records
 *
 * @example
 * ```typescript
 * const where = onlyDeleted(billingCustomers.deletedAt);
 * // Returns: isNotNull(billingCustomers.deletedAt)
 * ```
 */
export function onlyDeleted<T extends PgColumn>(deletedAtColumn: T): SQL {
    return isNotNull(deletedAtColumn);
}

/**
 * Create a soft delete filter based on options
 *
 * @example
 * ```typescript
 * const filter = softDeleteFilter(billingCustomers.deletedAt, { includeDeleted: false });
 * // Returns: isNull(billingCustomers.deletedAt)
 *
 * const filter2 = softDeleteFilter(billingCustomers.deletedAt, { onlyDeleted: true });
 * // Returns: isNotNull(billingCustomers.deletedAt)
 * ```
 */
export function softDeleteFilter<T extends PgColumn>(deletedAtColumn: T, options?: QZPaySoftDeleteOptions): SQL | undefined {
    if (options?.onlyDeleted) {
        return onlyDeleted(deletedAtColumn);
    }

    if (options?.includeDeleted) {
        return undefined; // No filter needed
    }

    // Default: exclude deleted
    return excludeDeleted(deletedAtColumn);
}

/**
 * Combine a soft delete filter with an existing WHERE clause
 *
 * @example
 * ```typescript
 * const existingWhere = eq(billingCustomers.livemode, true);
 * const combined = withSoftDeleteFilter(
 *   existingWhere,
 *   billingCustomers.deletedAt,
 *   { includeDeleted: false }
 * );
 * // Returns: and(eq(...), isNull(...))
 * ```
 */
export function withSoftDeleteFilter<T extends PgColumn>(
    existingWhere: SQL | undefined,
    deletedAtColumn: T,
    options?: QZPaySoftDeleteOptions
): SQL | undefined {
    const deleteFilter = softDeleteFilter(deletedAtColumn, options);

    if (!existingWhere && !deleteFilter) {
        return undefined;
    }

    if (!existingWhere) {
        return deleteFilter;
    }

    if (!deleteFilter) {
        return existingWhere;
    }

    return and(existingWhere, deleteFilter);
}

/**
 * Create the SET clause for soft deleting a record
 *
 * @example
 * ```typescript
 * const now = new Date();
 * const values = softDeleteValues(now);
 * // { deletedAt: now }
 * ```
 */
export function softDeleteValues(deletedAt: Date = new Date()): { deletedAt: Date } {
    return { deletedAt };
}

/**
 * Create the SET clause for restoring a soft-deleted record
 *
 * @example
 * ```typescript
 * const values = restoreValues();
 * // { deletedAt: null }
 * ```
 */
export function restoreValues(): { deletedAt: null } {
    return { deletedAt: null };
}

/**
 * Check if a record is soft-deleted
 *
 * @example
 * ```typescript
 * const customer = await repo.findById(id);
 * if (isSoftDeleted(customer)) {
 *   console.log('Customer was deleted at:', customer.deletedAt);
 * }
 * ```
 */
export function isSoftDeleted<T extends { deletedAt: Date | null }>(record: T | null): record is T & { deletedAt: Date } {
    return record !== null && record.deletedAt !== null;
}

/**
 * Check if a record is active (not soft-deleted)
 *
 * @example
 * ```typescript
 * const customer = await repo.findById(id);
 * if (isActive(customer)) {
 *   console.log('Customer is active');
 * }
 * ```
 */
export function isActive<T extends { deletedAt: Date | null }>(record: T | null): record is T & { deletedAt: null } {
    return record !== null && record.deletedAt === null;
}

/**
 * Retention policy options for permanent deletion
 */
export interface QZPayRetentionPolicyOptions {
    /** Minimum age in days before permanent deletion is allowed (default: 30) */
    minRetentionDays?: number;
    /** Maximum age in days after which records should be permanently deleted (default: 365) */
    maxRetentionDays?: number;
}

/**
 * Check if a soft-deleted record can be permanently deleted based on retention policy
 *
 * @example
 * ```typescript
 * const canDelete = canPermanentlyDelete(customer.deletedAt, { minRetentionDays: 30 });
 * ```
 */
export function canPermanentlyDelete(deletedAt: Date | null, options?: QZPayRetentionPolicyOptions): boolean {
    if (!deletedAt) {
        return false; // Cannot permanently delete non-deleted records
    }

    const minRetentionDays = options?.minRetentionDays ?? 30;
    const retentionMs = minRetentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return now - deletedAt.getTime() >= retentionMs;
}

/**
 * Check if a soft-deleted record should be permanently deleted based on max retention
 *
 * @example
 * ```typescript
 * const shouldDelete = shouldPermanentlyDelete(customer.deletedAt, { maxRetentionDays: 365 });
 * ```
 */
export function shouldPermanentlyDelete(deletedAt: Date | null, options?: QZPayRetentionPolicyOptions): boolean {
    if (!deletedAt) {
        return false;
    }

    const maxRetentionDays = options?.maxRetentionDays ?? 365;
    const maxRetentionMs = maxRetentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return now - deletedAt.getTime() >= maxRetentionMs;
}

/**
 * Create a WHERE clause to find records eligible for permanent deletion
 *
 * @example
 * ```typescript
 * const where = eligibleForPermanentDeletion(billingCustomers.deletedAt, { maxRetentionDays: 365 });
 * ```
 */
export function eligibleForPermanentDeletion<T extends PgColumn>(deletedAtColumn: T, options?: QZPayRetentionPolicyOptions): SQL {
    const maxRetentionDays = options?.maxRetentionDays ?? 365;

    return and(isNotNull(deletedAtColumn), sql`${deletedAtColumn} < NOW() - INTERVAL '${sql.raw(String(maxRetentionDays))} days'`)!;
}

/**
 * Cascade soft delete options
 */
export interface QZPayCascadeSoftDeleteOptions {
    /** Whether to cascade to related records (default: true) */
    cascade?: boolean;
    /** Specific relations to cascade to */
    relations?: string[];
}

/**
 * Build a list of tables to cascade soft delete to
 * This is a helper for documentation - actual implementation depends on your schema
 *
 * @example
 * ```typescript
 * const cascades = getCascadeTargets('customer');
 * // ['subscriptions', 'payments', 'invoices', 'paymentMethods']
 * ```
 */
export function getCascadeTargets(entityType: string): string[] {
    const cascadeMap: Record<string, string[]> = {
        customer: ['subscriptions', 'payments', 'invoices', 'paymentMethods', 'customerEntitlements', 'customerLimits'],
        subscription: ['payments', 'invoices'],
        plan: ['prices', 'subscriptions'],
        vendor: ['vendorPayouts']
    };

    return cascadeMap[entityType] ?? [];
}
