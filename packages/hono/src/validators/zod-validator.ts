/**
 * Custom Zod Validator with proper HTTP status codes
 *
 * Wraps @hono/zod-validator to return 422 for validation errors
 * instead of the default 400.
 */
import { zValidator as honoZValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodSchema } from 'zod';
import { HttpStatus } from '../errors/http-error.js';

/**
 * Custom zValidator that returns 422 for validation errors
 *
 * This wraps the @hono/zod-validator to use HTTP 422 (Unprocessable Entity)
 * for validation errors, which is more semantically correct than 400.
 *
 * @param target - Validation target ('json', 'query', 'param', etc.)
 * @param schema - Zod schema to validate against
 * @returns Hono middleware validator
 *
 * @example
 * ```typescript
 * import { zValidator } from '@qazuor/qzpay-hono';
 *
 * router.post('/customers', zValidator('json', CreateCustomerSchema), async (c) => {
 *   // If validation fails, returns 422 with error details
 * });
 * ```
 */
export function zValidator<Target extends keyof ValidationTargets, Schema extends ZodSchema>(target: Target, schema: Schema) {
    return honoZValidator(target, schema, (result, c) => {
        if (!result.success) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
                        details: result.error.errors
                    }
                },
                HttpStatus.UNPROCESSABLE_ENTITY as ContentfulStatusCode
            );
        }
        // Return undefined when validation succeeds to continue processing
        return undefined;
    });
}
