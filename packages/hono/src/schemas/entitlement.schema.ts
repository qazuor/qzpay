/**
 * Entitlement validation schemas for QZPay Hono
 */
import { z } from 'zod';

/**
 * Schema for granting an entitlement to a customer
 */
export const GrantEntitlementSchema = z.object({
    entitlementKey: z.string().min(1, 'Entitlement key is required'),
    source: z.enum(['subscription', 'purchase', 'manual']).default('manual'),
    sourceId: z.string().optional()
});

// Type exports
export type GrantEntitlementInput = z.infer<typeof GrantEntitlementSchema>;
