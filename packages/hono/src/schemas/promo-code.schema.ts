/**
 * Promo code validation schemas for QZPay Hono
 */
import { z } from 'zod';

/**
 * Schema for validating a promo code
 */
export const ValidatePromoCodeSchema = z.object({
    code: z.string().min(1, 'Promo code is required'),
    customerId: z.string().optional(),
    planId: z.string().optional()
});

// Type exports
export type ValidatePromoCodeInput = z.infer<typeof ValidatePromoCodeSchema>;
