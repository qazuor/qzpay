/**
 * Provider refund status normalization.
 *
 * Every provider spells the outcome of a refund differently (MercadoPago:
 * `approved` / `in_process` / `rejected` / `cancelled`; Stripe: `succeeded` /
 * `pending` / `requires_action` / `failed` / `canceled`). Core needs a single
 * verdict to decide whether the local payment row may claim the money went
 * back to the customer.
 *
 * The classification is deliberately **allowlist-based on success**: only a
 * status explicitly known to mean "the provider moved the money" yields
 * `'succeeded'`. Anything unrecognised degrades to `'pending'`, never to
 * success — an unknown string must not be able to mark a payment `refunded`
 * (H-146).
 */

/** Provider statuses that mean the refund is settled and the money is back. */
const QZPAY_REFUND_SUCCEEDED_STATUSES: readonly string[] = [
    'approved',
    'succeeded',
    'success',
    'completed',
    'refunded',
    'partially_refunded'
];

/** Provider statuses that mean the refund was refused and no money moved. */
const QZPAY_REFUND_FAILED_STATUSES: readonly string[] = ['rejected', 'failed', 'cancelled', 'canceled', 'error', 'declined'];

/**
 * Normalized verdict for a provider refund response.
 *
 * - `succeeded` — money returned; the local row may be marked refunded.
 * - `failed` — the provider refused; the local row must stay untouched.
 * - `pending` — not settled yet (or an unrecognised status); the local row
 *   must not claim a refund until a webhook confirms it.
 */
export type QZPayRefundOutcome = 'succeeded' | 'failed' | 'pending';

/**
 * Classify a raw provider refund status into a core outcome.
 *
 * @param providerStatus - Raw `status` string as returned by the provider adapter.
 * @returns The normalized outcome. Unknown/empty statuses map to `'pending'`.
 *
 * @example
 * qzpayClassifyRefundStatus('approved'); // 'succeeded'
 * qzpayClassifyRefundStatus('in_process'); // 'pending'
 * qzpayClassifyRefundStatus('rejected'); // 'failed'
 * qzpayClassifyRefundStatus('who_knows'); // 'pending' — never 'succeeded'
 */
export function qzpayClassifyRefundStatus(providerStatus: string | null | undefined): QZPayRefundOutcome {
    const normalized = (providerStatus ?? '').trim().toLowerCase();
    if (QZPAY_REFUND_SUCCEEDED_STATUSES.includes(normalized)) {
        return 'succeeded';
    }
    if (QZPAY_REFUND_FAILED_STATUSES.includes(normalized)) {
        return 'failed';
    }
    return 'pending';
}
