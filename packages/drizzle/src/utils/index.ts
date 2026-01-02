/**
 * QZPay Drizzle Utilities
 *
 * Helper functions for database operations, pagination, and migrations.
 */

// Connection utilities
export {
    buildDatabaseUrl,
    createConnection,
    getPoolStats,
    parseDatabaseUrl,
    type QZPayConnection,
    type QZPayConnectionConfig,
    type QZPayPoolStats
} from './connection.js';
// Migration utilities
export { ensureDatabase, hasPendingMigrations, type QZPayMigrationConfig, runMigrations } from './migrate.js';
// Optimistic locking utilities
// Note: QZPayOptimisticLockError is exported from repositories/base.repository.ts
export {
    atomicDecrement,
    atomicIncrement,
    compareAndSwap,
    generateVersion,
    isOptimisticLockError,
    type QZPayOptimisticRetryOptions,
    type QZPayOptimisticUpdateResult,
    VERSION_DEFAULT,
    verifyOptimisticUpdate,
    withNewVersion,
    withOptimisticRetry,
    withVersionCheck
} from './optimistic-locking.js';
// Pagination utilities
export {
    buildCursorPaginatedResult,
    buildOffsetPaginatedResult,
    calculatePageInfo,
    createCursorWhereClause,
    getPaginationOrderBy,
    normalizePaginationOptions,
    offsetToPage,
    pageToOffset,
    QZPAY_PAGINATION_DEFAULTS,
    type QZPayCursorPaginatedResult,
    type QZPayCursorPaginationOptions,
    type QZPayOffsetPaginatedResult,
    type QZPayOffsetPaginationOptions
} from './pagination.js';
// Soft delete utilities
export {
    canPermanentlyDelete,
    eligibleForPermanentDeletion,
    excludeDeleted,
    getCascadeTargets,
    isActive,
    isSoftDeleted,
    onlyDeleted,
    type QZPayCascadeSoftDeleteOptions,
    type QZPayRetentionPolicyOptions,
    type QZPaySoftDeleteOptions,
    restoreValues,
    shouldPermanentlyDelete,
    softDeleteFilter,
    softDeleteValues,
    withSoftDeleteFilter
} from './soft-delete.js';
