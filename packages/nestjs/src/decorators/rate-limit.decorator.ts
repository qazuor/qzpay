/**
 * RateLimit Decorator
 * Enforces rate limiting based on QZPay limits
 */
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { RATE_LIMIT_KEY } from '../constants.js';
import { RateLimitGuard } from '../guards/rate-limit.guard.js';
import type { RateLimitConfig } from '../types.js';

/**
 * Decorator to enforce rate limiting based on QZPay customer limits
 *
 * @param limitKey - The limit key to check and increment
 * @param increment - Amount to increment (default: 1)
 *
 * @example
 * ```typescript
 * @Controller('api')
 * export class ApiController {
 *   @Post('/generate')
 *   @RateLimit('api_requests')
 *   generate() {
 *     return { result: 'generated' };
 *   }
 *
 *   @Post('/upload')
 *   @RateLimit('file_uploads', 5) // Counts as 5 uses
 *   upload() {
 *     return { uploaded: true };
 *   }
 * }
 * ```
 */
export function RateLimit(limitKey: string, increment = 1) {
    const config: RateLimitConfig = { limitKey, increment };

    return applyDecorators(SetMetadata(RATE_LIMIT_KEY, config), UseGuards(RateLimitGuard));
}
