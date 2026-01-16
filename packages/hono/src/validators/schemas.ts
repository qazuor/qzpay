/**
 * Zod Validation Schemas for QZPay Hono
 *
 * These schemas are exported for users to extend with their own fields.
 * Use the base schemas as starting points and extend as needed.
 */
import { z } from 'zod';

// ==================== Base Schemas (for extension) ====================

/**
 * Base customer fields - extendable
 *
 * @example
 * ```typescript
 * const MyCustomerSchema = CustomerBaseSchema.extend({
 *     companyName: z.string(),
 *     taxId: z.string().regex(/^\d{11}$/)
 * });
 * ```
 */
export const CustomerBaseSchema = z.object({
    email: z.string().email('Invalid email format'),
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    externalId: z.string().optional(),
    phone: z.string().optional(),
    metadata: z.record(z.string()).optional()
});

/**
 * Base subscription fields - extendable
 */
export const SubscriptionBaseSchema = z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
    planId: z.string().min(1, 'Plan ID is required'),
    priceId: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    trialDays: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string()).optional()
});

/**
 * Base payment fields - extendable
 */
export const PaymentBaseSchema = z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
    amount: z.number().int().positive('Amount must be positive'),
    currency: z
        .string()
        .length(3, 'Currency must be 3 characters')
        .transform((val) => val.toUpperCase()),
    paymentMethodId: z.string().optional(),
    description: z.string().optional(),
    metadata: z.record(z.string()).optional()
});

/**
 * Invoice line item schema
 */
export const InvoiceLineSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().int().positive('Quantity must be positive'),
    unitAmount: z.number().int().nonnegative('Unit amount must be non-negative'),
    priceId: z.string().optional()
});

/**
 * Base invoice fields - extendable
 */
export const InvoiceBaseSchema = z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
    subscriptionId: z.string().optional(),
    dueDate: z.coerce.date().optional(),
    lines: z.array(InvoiceLineSchema).optional().default([]),
    metadata: z.record(z.string()).optional()
});

/**
 * Base price fields - extendable
 */
export const PriceBaseSchema = z.object({
    productId: z.string().min(1, 'Product ID is required'),
    amount: z.number().int().nonnegative('Amount must be non-negative'),
    currency: z
        .string()
        .length(3, 'Currency must be 3 characters')
        .transform((val) => val.toUpperCase()),
    interval: z.enum(['day', 'week', 'month', 'year']).optional(),
    intervalCount: z.number().int().positive().optional(),
    trialDays: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string()).optional()
});

// ==================== Request Schemas (used by routes) ====================

// Customer schemas
export const CreateCustomerSchema = CustomerBaseSchema;
export const UpdateCustomerSchema = CustomerBaseSchema.partial();

// Subscription schemas
export const CreateSubscriptionSchema = SubscriptionBaseSchema;
export const UpdateSubscriptionSchema = SubscriptionBaseSchema.partial().omit({ customerId: true });
export const CancelSubscriptionSchema = z.object({
    cancelAtPeriodEnd: z.boolean().default(true),
    reason: z.string().max(500).optional()
});

// Payment schemas
export const ProcessPaymentSchema = PaymentBaseSchema;
export const CapturePaymentSchema = z.object({
    amount: z.number().int().positive().optional()
});
export const RefundPaymentSchema = z.object({
    amount: z.number().int().positive('Amount must be positive').optional(),
    reason: z.string().max(500).optional()
});

// Invoice schemas
export const CreateInvoiceSchema = InvoiceBaseSchema;
export const VoidInvoiceSchema = z.object({
    reason: z.string().max(500).optional()
});
export const PayInvoiceSchema = z.object({
    paymentMethodId: z.string().optional()
});

// Price schemas
export const CreatePriceSchema = PriceBaseSchema;
export const UpdatePriceSchema = PriceBaseSchema.partial().omit({ productId: true });

// ==================== Query/Pagination Schemas ====================

/**
 * Pagination schema for list endpoints
 */
export const PaginationSchema = z.object({
    limit: z.coerce.number().int().positive().max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0)
});

/**
 * Customer query schema with pagination and filters
 */
export const CustomerQuerySchema = PaginationSchema.extend({
    email: z.string().email().optional(),
    externalId: z.string().optional()
});

/**
 * Subscription query schema with pagination and filters
 */
export const SubscriptionQuerySchema = PaginationSchema.extend({
    customerId: z.string().optional(),
    status: z.enum(['active', 'canceled', 'past_due', 'trialing', 'incomplete', 'paused']).optional(),
    planId: z.string().optional()
});

/**
 * Payment query schema with pagination and filters
 */
export const PaymentQuerySchema = PaginationSchema.extend({
    customerId: z.string().optional(),
    status: z.enum(['pending', 'succeeded', 'failed', 'canceled', 'refunded']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional()
});

/**
 * Invoice query schema with pagination and filters
 */
export const InvoiceQuerySchema = PaginationSchema.extend({
    customerId: z.string().optional(),
    subscriptionId: z.string().optional(),
    status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional()
});

/**
 * Metrics query schema
 */
export const MetricsQuerySchema = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    currency: z
        .string()
        .length(3)
        .transform((val) => val.toUpperCase())
        .optional()
});

// ==================== ID Parameter Schema ====================

/**
 * UUID regex pattern for validation
 * Matches standard UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Schema for validating UUID format
 */
export const UuidSchema = z.string().regex(UUID_REGEX, 'Invalid UUID format');

/**
 * Schema for ID path parameters (accepts UUID or string IDs)
 * Use this when the ID can be any valid string identifier
 */
export const IdParamSchema = z.object({
    id: z.string().min(1, 'ID is required')
});

/**
 * Schema for UUID path parameters
 * Use this when the ID must be a valid UUID
 *
 * @example
 * ```typescript
 * router.get('/customers/:id', zValidator('param', UuidParamSchema), async (c) => {
 *     const { id } = c.req.valid('param');
 *     // id is guaranteed to be a valid UUID
 * });
 * ```
 */
export const UuidParamSchema = z.object({
    id: UuidSchema
});

/**
 * Schema for customer ID path parameter
 */
export const CustomerIdParamSchema = z.object({
    customerId: UuidSchema
});

/**
 * Schema for subscription ID path parameter
 */
export const SubscriptionIdParamSchema = z.object({
    subscriptionId: UuidSchema
});

/**
 * Schema for payment ID path parameter
 */
export const PaymentIdParamSchema = z.object({
    paymentId: UuidSchema
});

/**
 * Schema for invoice ID path parameter
 */
export const InvoiceIdParamSchema = z.object({
    invoiceId: UuidSchema
});

// ==================== Webhook Schemas ====================

/**
 * Schema for webhook verification
 */
export const WebhookHeadersSchema = z.object({
    'x-webhook-signature': z.string().optional(),
    'stripe-signature': z.string().optional(),
    'x-signature': z.string().optional()
});

// ==================== Type Exports ====================

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof CancelSubscriptionSchema>;
export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;
export type CapturePaymentInput = z.infer<typeof CapturePaymentSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
export type InvoiceLineInput = z.infer<typeof InvoiceLineSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type VoidInvoiceInput = z.infer<typeof VoidInvoiceSchema>;
export type PayInvoiceInput = z.infer<typeof PayInvoiceSchema>;
export type CreatePriceInput = z.infer<typeof CreatePriceSchema>;
export type UpdatePriceInput = z.infer<typeof UpdatePriceSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type CustomerQueryInput = z.infer<typeof CustomerQuerySchema>;
export type SubscriptionQueryInput = z.infer<typeof SubscriptionQuerySchema>;
export type PaymentQueryInput = z.infer<typeof PaymentQuerySchema>;
export type InvoiceQueryInput = z.infer<typeof InvoiceQuerySchema>;
export type MetricsQueryInput = z.infer<typeof MetricsQuerySchema>;
export type IdParamInput = z.infer<typeof IdParamSchema>;
export type UuidParamInput = z.infer<typeof UuidParamSchema>;
export type CustomerIdParamInput = z.infer<typeof CustomerIdParamSchema>;
export type SubscriptionIdParamInput = z.infer<typeof SubscriptionIdParamSchema>;
export type PaymentIdParamInput = z.infer<typeof PaymentIdParamSchema>;
export type InvoiceIdParamInput = z.infer<typeof InvoiceIdParamSchema>;
