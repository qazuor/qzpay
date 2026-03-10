/**
 * Limit validation schemas for QZPay Hono
 */
import { z } from 'zod';

/**
 * Schema for incrementing a customer limit
 */
export const IncrementLimitSchema = z.object({
    amount: z.number().positive('Amount must be positive').optional().default(1)
});

/**
 * Schema for recording usage on a customer limit
 */
export const RecordUsageSchema = z.object({
    quantity: z.number().positive('Quantity must be positive'),
    action: z.enum(['increment', 'set']).default('increment')
});

/**
 * Schema for setting a customer limit (admin)
 */
export const AdminSetLimitSchema = z.object({
    maxValue: z.number().int('maxValue must be an integer').nonnegative('maxValue must be non-negative'),
    source: z.enum(['subscription', 'purchase', 'manual', 'addon']).default('manual'),
    sourceId: z.string().uuid('sourceId must be a valid UUID').optional()
});

// Type exports
export type IncrementLimitInput = z.infer<typeof IncrementLimitSchema>;
export type RecordUsageInput = z.infer<typeof RecordUsageSchema>;
export type AdminSetLimitInput = z.infer<typeof AdminSetLimitSchema>;
