/**
 * Subscription polling jobs repository for QZPay Drizzle
 *
 * Provides storage operations for the provider-status polling fallback.
 * See `subscription-polling-jobs.schema.ts` and the qzpay-core
 * `QZPaySubscriptionPollingJobStorage` interface.
 */
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
    type QZPayBillingSubscriptionPollingJob,
    type QZPayBillingSubscriptionPollingJobInsert,
    billingSubscriptionPollingJobs
} from '../schema/index.js';
import { firstOrNull } from './base.repository.js';

/**
 * Postgres unique-violation SQLSTATE.
 */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Type guard for the Postgres unique-violation error shape.
 *
 * Drizzle wraps the underlying driver error in a "Failed query" Error
 * whose original PostgresError lands on `.cause`. We check both the
 * outer shape (in case a future driver surfaces `code` directly) and
 * the nested `cause` so the guard works regardless of wrapping depth.
 */
function isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const direct = error as { code?: string };
    if (direct.code === PG_UNIQUE_VIOLATION) {
        return true;
    }
    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === 'object') {
        const innerCode = (cause as { code?: string }).code;
        if (innerCode === PG_UNIQUE_VIOLATION) {
            return true;
        }
    }
    return false;
}

/**
 * Subscription polling jobs repository.
 *
 * All public methods are designed to be safe under concurrent worker
 * access. `create` swallows the partial-unique violation that fires
 * when a second active job is attempted for the same subscription
 * and returns `null` in that case. `tryLockedUpdate` performs a
 * `WHERE id = $1 AND version = $2` UPDATE and returns `null` when
 * another worker already moved the row forward.
 */
export class QZPaySubscriptionPollingJobsRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    /**
     * Insert a new pending polling job.
     *
     * Returns `null` if a partial-unique violation is raised — i.e.,
     * there is already a `pending` job for the same subscription. The
     * caller can then choose to read the existing job and treat it as
     * the source of truth.
     */
    async create(input: QZPayBillingSubscriptionPollingJobInsert): Promise<QZPayBillingSubscriptionPollingJob | null> {
        try {
            const result = await this.db.insert(billingSubscriptionPollingJobs).values(input).returning();
            return firstOrNull(result);
        } catch (error) {
            if (isUniqueViolation(error)) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Find a polling job by id.
     */
    async findById(id: string): Promise<QZPayBillingSubscriptionPollingJob | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptionPollingJobs)
            .where(eq(billingSubscriptionPollingJobs.id, id))
            .limit(1);
        return firstOrNull(result);
    }

    /**
     * Find the active (`pending`) polling job for a subscription, if any.
     * Returns the single active job because the partial-unique index
     * enforces at most one.
     */
    async findActiveBySubscriptionId(subscriptionId: string): Promise<QZPayBillingSubscriptionPollingJob | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptionPollingJobs)
            .where(
                and(eq(billingSubscriptionPollingJobs.subscriptionId, subscriptionId), eq(billingSubscriptionPollingJobs.status, 'pending'))
            )
            .limit(1);
        return firstOrNull(result);
    }

    /**
     * Fetch up to `limit` pending jobs whose `next_poll_at <= now`,
     * ordered by `next_poll_at` ascending so most-overdue jobs are
     * processed first.
     */
    async findDuePending(now: Date, limit: number): Promise<QZPayBillingSubscriptionPollingJob[]> {
        const safeLimit = Math.max(1, Math.min(limit, 200));
        return this.db
            .select()
            .from(billingSubscriptionPollingJobs)
            .where(and(eq(billingSubscriptionPollingJobs.status, 'pending'), lte(billingSubscriptionPollingJobs.nextPollAt, now)))
            .orderBy(asc(billingSubscriptionPollingJobs.nextPollAt))
            .limit(safeLimit);
    }

    /**
     * Optimistic-locked update.
     *
     * The UPDATE only fires when both `id` AND `version` match the row
     * the caller previously read. On success the row's `version` is
     * rotated to a fresh uuid (server-side via gen_random_uuid()) and
     * `updated_at` is bumped. Returns `null` when another worker has
     * already moved the row (the version no longer matches).
     */
    async tryLockedUpdate(params: {
        id: string;
        expectedVersion: string;
        status?: string;
        incrementAttemptsBy?: number;
        lastPolledAt?: Date;
        lastProviderStatus?: string | null;
        lastError?: string | null;
        nextPollAt?: Date;
        completedAt?: Date | null;
    }): Promise<QZPayBillingSubscriptionPollingJob | null> {
        const updates: Partial<QZPayBillingSubscriptionPollingJobInsert> & { version?: string; updatedAt?: Date } = {
            updatedAt: new Date()
        };
        if (params.status !== undefined) {
            updates.status = params.status;
        }
        if (params.lastPolledAt !== undefined) {
            updates.lastPolledAt = params.lastPolledAt;
        }
        if (params.lastProviderStatus !== undefined) {
            updates.lastProviderStatus = params.lastProviderStatus;
        }
        if (params.lastError !== undefined) {
            updates.lastError = params.lastError;
        }
        if (params.nextPollAt !== undefined) {
            updates.nextPollAt = params.nextPollAt;
        }
        if (params.completedAt !== undefined) {
            updates.completedAt = params.completedAt;
        }
        // Drizzle does not have a built-in for "increment column by N"
        // in this version, so use a raw SQL expression. The cast keeps
        // TypeScript happy without losing the increment semantics.
        const attemptsExpr =
            params.incrementAttemptsBy && params.incrementAttemptsBy !== 0
                ? sql`${billingSubscriptionPollingJobs.attempts} + ${params.incrementAttemptsBy}`
                : undefined;

        const result = await this.db
            .update(billingSubscriptionPollingJobs)
            .set({
                ...updates,
                // Rotate the version token on every successful update so
                // a subsequent UPDATE with the previous token fails.
                version: sql`gen_random_uuid()`,
                ...(attemptsExpr ? { attempts: attemptsExpr as unknown as number } : {})
            })
            .where(
                and(eq(billingSubscriptionPollingJobs.id, params.id), eq(billingSubscriptionPollingJobs.version, params.expectedVersion))
            )
            .returning();

        return firstOrNull(result);
    }
}
