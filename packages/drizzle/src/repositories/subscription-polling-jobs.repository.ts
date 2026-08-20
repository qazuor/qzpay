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
 * when a second active job is attempted for the same provider resource
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
     * there is already a `pending` job for the same
     * `(provider, provider_resource_id)`. The caller can then choose to
     * read the existing job and treat it as the source of truth.
     *
     * Note this is scoped to the RESOURCE, not the subscription: several
     * concurrent one-time checkouts belonging to one subscription each get
     * their own job. See the index JSDoc in the schema for why.
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
     * Find the active (`pending`) polling job for a single provider
     * resource, if any. At most one can exist — the partial-unique index
     * on `(provider, provider_resource_id)` enforces it.
     *
     * This is the precise lookup a webhook handler should use to close the
     * job its event resolved. Prefer it over
     * {@link findActiveBySubscriptionId}, which cannot tell apart several
     * concurrent jobs belonging to the same subscription.
     */
    async findActiveByProviderResourceId(provider: string, providerResourceId: string): Promise<QZPayBillingSubscriptionPollingJob | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptionPollingJobs)
            .where(
                and(
                    eq(billingSubscriptionPollingJobs.provider, provider),
                    eq(billingSubscriptionPollingJobs.providerResourceId, providerResourceId),
                    eq(billingSubscriptionPollingJobs.status, 'pending')
                )
            )
            .limit(1);
        return firstOrNull(result);
    }

    /**
     * Find AN active (`pending`) polling job for a subscription, if any.
     *
     * A subscription may now have SEVERAL active jobs at once — one per
     * in-flight one-time checkout — so this returns the OLDEST one rather
     * than an arbitrary row. The `ORDER BY created_at, id` is load-bearing:
     * without it Postgres may return a different row per call, which makes
     * a caller that closes "the" job close a different purchase's job each
     * time.
     *
     * Because of that ambiguity, callers that know which resource their
     * event refers to MUST use {@link findActiveByProviderResourceId}
     * instead. This method remains for callers that genuinely act on the
     * subscription as a whole (e.g. cancelling everything in flight).
     */
    async findActiveBySubscriptionId(subscriptionId: string): Promise<QZPayBillingSubscriptionPollingJob | null> {
        const result = await this.db
            .select()
            .from(billingSubscriptionPollingJobs)
            .where(
                and(eq(billingSubscriptionPollingJobs.subscriptionId, subscriptionId), eq(billingSubscriptionPollingJobs.status, 'pending'))
            )
            .orderBy(asc(billingSubscriptionPollingJobs.createdAt), asc(billingSubscriptionPollingJobs.id))
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
