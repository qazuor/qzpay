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

// Type exports
export type IncrementLimitInput = z.infer<typeof IncrementLimitSchema>;
export type RecordUsageInput = z.infer<typeof RecordUsageSchema>;
