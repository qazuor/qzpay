import { QZPayError } from './base.error.js';

/**
 * Error thrown when a requested entity is not found.
 *
 * @example
 * ```ts
 * const subscription = await storage.subscriptions.findById(id);
 * if (!subscription) {
 *   throw new QZPayNotFoundError('Subscription', id);
 * }
 * ```
 *
 * @example
 * ```ts
 * try {
 *   await billing.subscriptions.getById(id);
 * } catch (error) {
 *   if (error instanceof QZPayNotFoundError) {
 *     console.error(`${error.entityType} with ID ${error.entityId} not found`);
 *   }
 * }
 * ```
 */
export class QZPayNotFoundError extends QZPayError {
    /**
     * The type of entity that was not found (e.g., 'Subscription', 'Plan', 'Customer').
     */
    public readonly entityType: string;

    /**
     * The ID of the entity that was not found.
     */
    public readonly entityId: string;

    constructor(entityType: string, entityId: string) {
        super(`${entityType} ${entityId} not found`, {
            entityType,
            entityId
        });
        this.name = 'QZPayNotFoundError';
        this.entityType = entityType;
        this.entityId = entityId;
    }
}
