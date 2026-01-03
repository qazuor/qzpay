/**
 * Entitlement Guard
 * Protects routes based on customer entitlements
 */
import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { QZPAY_BILLING_TOKEN, REQUIRED_ENTITLEMENT_KEY } from '../constants.js';

/**
 * Request interface with customer context
 */
interface RequestWithCustomer {
    customer?: { id: string };
    user?: { customerId?: string };
}

@Injectable()
export class EntitlementGuard implements CanActivate {
    constructor(
        @Inject(QZPAY_BILLING_TOKEN)
        private readonly billing: QZPayBilling,
        private readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredEntitlement = this.reflector.get<string>(REQUIRED_ENTITLEMENT_KEY, context.getHandler());

        // If no entitlement is required, allow access
        if (!requiredEntitlement) {
            return true;
        }

        const request = context.switchToHttp().getRequest<RequestWithCustomer>();
        const customerId = request.customer?.id ?? request.user?.customerId;

        if (!customerId) {
            throw new ForbiddenException('Customer context required');
        }

        const hasEntitlement = await this.billing.entitlements.check(customerId, requiredEntitlement);

        if (!hasEntitlement) {
            throw new ForbiddenException(`Missing required entitlement: ${requiredEntitlement}`);
        }

        return true;
    }
}
