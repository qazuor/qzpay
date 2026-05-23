/**
 * Subscription polling job type mappers
 *
 * Maps between Drizzle schema rows and qzpay-core domain types.
 */
import type {
    QZPayMetadata,
    QZPayPollingResourceType,
    QZPaySchedulePollingInput,
    QZPaySubscriptionPollingJob,
    QZPaySubscriptionPollingJobStatus
} from '@qazuor/qzpay-core';
import type { QZPayBillingSubscriptionPollingJob, QZPayBillingSubscriptionPollingJobInsert } from '../schema/index.js';

/**
 * Defaults applied when a schedule input does not specify them.
 *
 * - `initialDelayMs`: 30 seconds. Aggressive enough that fast-authorizing
 *   providers (Stripe-style, instant) flip soon after start-paid completes;
 *   slow enough to not race the webhook for providers that DO emit.
 * - `maxAttempts`: 60. With a 30s base cadence, this gives ≈30 minutes
 *   of polling before giving up, which matches the typical end-user
 *   patience window for a checkout flow.
 */
export const POLLING_JOB_DEFAULTS = {
    initialDelayMs: 30_000,
    maxAttempts: 60
} as const;

/**
 * Map a Drizzle polling job row to the qzpay-core domain shape.
 */
export function mapDrizzlePollingJobToCore(row: QZPayBillingSubscriptionPollingJob): QZPaySubscriptionPollingJob {
    return {
        id: row.id,
        subscriptionId: row.subscriptionId,
        provider: row.provider,
        providerResourceId: row.providerResourceId,
        resourceType: row.resourceType as QZPayPollingResourceType,
        status: row.status as QZPaySubscriptionPollingJobStatus,
        attempts: row.attempts,
        maxAttempts: row.maxAttempts,
        nextPollAt: row.nextPollAt,
        lastPolledAt: row.lastPolledAt ?? null,
        lastProviderStatus: row.lastProviderStatus ?? null,
        lastError: row.lastError ?? null,
        metadata: (row.metadata as QZPayMetadata) ?? {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        completedAt: row.completedAt ?? null,
        version: row.version
    };
}

/**
 * Map a schedule-polling input to the Drizzle insert shape, applying
 * the timing defaults from {@link POLLING_JOB_DEFAULTS}.
 *
 * The caller MUST provide a `provider` value (the storage adapter
 * resolves the default upstream, not in the mapper, so a missing
 * provider raises a clear error here rather than silently dropping it).
 */
export function mapPollingScheduleInputToDrizzleInsert(
    input: QZPaySchedulePollingInput & { provider: string }
): QZPayBillingSubscriptionPollingJobInsert {
    const initialDelayMs = input.initialDelayMs ?? POLLING_JOB_DEFAULTS.initialDelayMs;
    const nextPollAt = new Date(Date.now() + initialDelayMs);
    return {
        subscriptionId: input.subscriptionId,
        provider: input.provider,
        providerResourceId: input.providerResourceId,
        resourceType: input.resourceType ?? 'subscription',
        status: 'pending',
        attempts: 0,
        maxAttempts: input.maxAttempts ?? POLLING_JOB_DEFAULTS.maxAttempts,
        nextPollAt,
        metadata: input.metadata ?? {}
    };
}
