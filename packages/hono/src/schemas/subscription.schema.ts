/**
 * Extended subscription validation schemas for QZPay Hono
 *
 * These schemas extend the base schemas from validators with additional fields
 * needed for subscription operations.
 */
import { z } from 'zod';
import {
    CreateSubscriptionSchema as BaseCreateSubscriptionSchema,
    UpdateSubscriptionSchema as BaseUpdateSubscriptionSchema
} from '../validators/schemas.js';

/**
 * Extended schema for creating a subscription with promo code support
 */
export const CreateSubscriptionWithPromoSchema = BaseCreateSubscriptionSchema.extend({
    promoCodeId: z.string().optional()
});

/**
 * Extended schema for updating a subscription with additional fields
 */
export const UpdateSubscriptionExtendedSchema = BaseUpdateSubscriptionSchema.extend({
    prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).optional(),
    status: z.enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired']).optional(),
    canceledAt: z.coerce.date().optional(),
    cancelAt: z.coerce.date().optional(),
    currentPeriodStart: z.coerce.date().optional(),
    currentPeriodEnd: z.coerce.date().optional()
});

// Type exports
export type CreateSubscriptionWithPromoInput = z.infer<typeof CreateSubscriptionWithPromoSchema>;
export type UpdateSubscriptionExtendedInput = z.infer<typeof UpdateSubscriptionExtendedSchema>;
