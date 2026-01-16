import type { QZPayMetadata } from '../types/common.types.js';
import { QZPayError } from './base.error.js';

/**
 * Error thrown when an operation conflicts with the current state of a resource.
 *
 * @example
 * ```ts
 * const existing = await storage.addons.findSubscriptionAddOn(subscriptionId, addOnId);
 * if (existing && existing.status === 'active') {
 *   throw new QZPayConflictError(
 *     `Add-on ${addOnId} is already attached to subscription`,
 *     'subscription_addon',
 *     { subscriptionId, addOnId }
 *   );
 * }
 * ```
 *
 * @example
 * ```ts
 * try {
 *   await billing.subscriptions.addAddOn(input);
 * } catch (error) {
 *   if (error instanceof QZPayConflictError) {
 *     console.error(`Conflict (${error.conflictType}): ${error.message}`);
 *   }
 * }
 * ```
 */
export class QZPayConflictError extends QZPayError {
    /**
     * The type of conflict that occurred (e.g., 'duplicate', 'incompatible', 'already_exists').
     */
    public readonly conflictType: string;

    constructor(message: string, conflictType: string, metadata?: QZPayMetadata) {
        super(message, {
            ...metadata,
            conflictType
        });
        this.name = 'QZPayConflictError';
        this.conflictType = conflictType;
    }
}
