/**
 * RequireEntitlement Decorator
 * Marks a route as requiring a specific entitlement
 */
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { REQUIRED_ENTITLEMENT_KEY } from '../constants.js';
import { EntitlementGuard } from '../guards/entitlement.guard.js';

/**
 * Decorator to require a specific entitlement for a route
 *
 * @param entitlementKey - The entitlement key to require
 *
 * @example
 * ```typescript
 * @Controller('premium')
 * export class PremiumController {
 *   @Get('/features')
 *   @RequireEntitlement('premium_features')
 *   getFeatures() {
 *     return { features: ['advanced', 'priority'] };
 *   }
 * }
 * ```
 */
export function RequireEntitlement(entitlementKey: string) {
    return applyDecorators(SetMetadata(REQUIRED_ENTITLEMENT_KEY, entitlementKey), UseGuards(EntitlementGuard));
}
