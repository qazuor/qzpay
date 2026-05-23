/**
 * Subscription polling job types for QZPay
 *
 * Polling jobs are an opt-in fallback for providers whose subscription
 * webhooks are unreliable (e.g., MercadoPago's `subscription_preapproval`
 * event family). qzpay-core defines the domain shape; storage adapters
 * persist these records and consuming applications run the cron loop
 * that scans pending jobs and calls the provider's REST endpoint.
 *
 * See `SPEC-143-billing-testing-coverage/docs/polling-fallback-design.md`
 * in the consumer application for the architectural rationale.
 */
import type { QZPayMetadata } from './common.types.js';

/**
 * Lifecycle status of a polling job.
 *
 * - `pending`: the cron will pick up this job whenever `nextPollAt`
 *   is due. Continues polling until a terminal state is reached.
 * - `succeeded`: the provider returned a terminal authorized state
 *   (e.g. MP `authorized`) and the local subscription transitioned.
 *   Also used when a webhook arrived first and the job was cancelled
 *   as part of cleanup.
 * - `failed`: the provider returned a terminal failure state
 *   (e.g. MP `cancelled` or `rejected`).
 * - `timeout`: `maxAttempts` was reached without the provider ever
 *   returning a terminal state. The local subscription is marked as
 *   failed-to-authorize so the user can retry.
 * - `cancelled`: cancelled externally (e.g., user cancelled the
 *   subscription from the application before the provider authorized).
 */
export type QZPaySubscriptionPollingJobStatus = 'pending' | 'succeeded' | 'failed' | 'timeout' | 'cancelled';

/**
 * Provider-agnostic classification of the resource the polling job is
 * tracking. Drives which REST endpoint the cron's adapter call hits.
 *
 * - `subscription`: recurring authorization resource (MP `preapproval`,
 *   Stripe `subscription`). The adapter calls its subscription-retrieve
 *   endpoint with `providerResourceId` directly.
 * - `one_time_payment`: a one-time payment session / preference whose
 *   payment id is not known until the user completes checkout (MP
 *   `preference` with deferred payment, Stripe `checkout.session` in
 *   payment mode). The adapter searches the payments collection by the
 *   session/preference id stored in `providerResourceId` and applies the
 *   first approved match.
 */
export type QZPayPollingResourceType = 'subscription' | 'one_time_payment';

/**
 * Persisted polling job record.
 *
 * Stored as one row in `billing_subscription_polling_jobs`. The
 * `version` field is an optimistic-lock token that workers must
 * include in their `UPDATE ... WHERE` clause to detect concurrent
 * modifications.
 */
export interface QZPaySubscriptionPollingJob {
    /** Job identifier (uuid). */
    id: string;
    /** Local subscription id this job is polling for. */
    subscriptionId: string;
    /** Provider identifier (e.g. `mercadopago`). */
    provider: string;
    /**
     * Provider-side resource id the cron uses to query status.
     *
     * Interpretation depends on {@link resourceType}: for `subscription`
     * this is the recurring-authorization id (e.g. MP preapproval id);
     * for `one_time_payment` this is the checkout/preference session id
     * the cron searches payments by.
     */
    providerResourceId: string;
    /**
     * Classification driving which REST endpoint the cron's adapter
     * call hits. See {@link QZPayPollingResourceType}. Existing rows
     * default to `subscription` for backward compatibility.
     */
    resourceType: QZPayPollingResourceType;
    /** Current lifecycle status. */
    status: QZPaySubscriptionPollingJobStatus;
    /** Number of poll attempts executed so far. */
    attempts: number;
    /** Cap on attempts before the job is marked `timeout`. */
    maxAttempts: number;
    /** When the next poll attempt is due. */
    nextPollAt: Date;
    /** When the last poll attempt ran (null until the first attempt). */
    lastPolledAt: Date | null;
    /** Raw provider status returned by the last poll (e.g. `pending`, `authorized`). */
    lastProviderStatus: string | null;
    /** Last error message captured by a failed poll attempt. */
    lastError: string | null;
    /** Application metadata. */
    metadata: QZPayMetadata;
    /** Created-at timestamp. */
    createdAt: Date;
    /** Updated-at timestamp. */
    updatedAt: Date;
    /** Completion timestamp (set when status leaves `pending`). */
    completedAt: Date | null;
    /** Optimistic-lock token. Reset on every state change. */
    version: string;
}

/**
 * Input to `billing.subscriptions.schedulePolling`.
 *
 * `provider` defaults to the configured payment adapter's provider name.
 * `initialDelayMs` and `maxAttempts` have safe defaults when omitted.
 */
export interface QZPaySchedulePollingInput {
    /** Local subscription id the job will poll for. */
    subscriptionId: string;
    /**
     * Provider-side resource id (preapproval id, preference id, etc.).
     * Interpreted by the consuming adapter per {@link resourceType}.
     */
    providerResourceId: string;
    /**
     * Classification of the polled resource. See {@link QZPayPollingResourceType}.
     * Defaults to `subscription` so existing callers retain their preapproval
     * polling behavior without code changes.
     */
    resourceType?: QZPayPollingResourceType;
    /** Override provider name. Defaults to the configured payment adapter's provider. */
    provider?: string;
    /** Delay before the first poll attempt, in ms. Default: 30000 (30s). */
    initialDelayMs?: number;
    /** Max attempts before timeout. Default: 60 (≈30 min at 30s cadence). */
    maxAttempts?: number;
    /** Optional metadata to attach to the job. */
    metadata?: QZPayMetadata;
}

/**
 * Input to `billing.subscriptions.updatePollingJob`.
 *
 * Workers call this after polling the provider to update the job's
 * state. The implementation enforces optimistic locking using
 * {@link expectedVersion}; if the row's `version` does not match,
 * the update fails (returns `null`) so the caller can decide whether
 * to retry or abandon.
 */
export interface QZPayUpdatePollingJobInput {
    /** Job id. */
    id: string;
    /** Optimistic-lock token previously read for this job. */
    expectedVersion: string;
    /** Next status the job should transition to. */
    status?: QZPaySubscriptionPollingJobStatus;
    /** Increment attempts by this amount (typical: 1). */
    incrementAttemptsBy?: number;
    /** Set `lastPolledAt` to this value (typical: now()). */
    lastPolledAt?: Date;
    /** Update `lastProviderStatus`. */
    lastProviderStatus?: string | null;
    /** Update `lastError`. */
    lastError?: string | null;
    /** Update `nextPollAt`. */
    nextPollAt?: Date;
    /** Mark `completedAt` (typically passed alongside a terminal `status`). */
    completedAt?: Date | null;
}
