/**
 * Entitlement Guard Tests
 */
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_ENTITLEMENT_KEY } from '../../src/constants.js';
import { EntitlementGuard } from '../../src/guards/entitlement.guard.js';
import { createMockBilling, createMockExecutionContext, createMockReflector } from '../helpers/nestjs-mocks.js';

describe('EntitlementGuard', () => {
    describe('canActivate', () => {
        it('should allow access when no entitlement required', async () => {
            const mockBilling = createMockBilling();
            const mockReflector = createMockReflector({});
            const mockContext = createMockExecutionContext();

            const guard = new EntitlementGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });

        it('should allow access when customer has entitlement', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.check).mockResolvedValue(true);

            const mockReflector = createMockReflector({
                [REQUIRED_ENTITLEMENT_KEY]: 'feature_api'
            });
            const mockContext = createMockExecutionContext();

            const guard = new EntitlementGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
            expect(mockBilling.entitlements.check).toHaveBeenCalledWith('cus_123', 'feature_api');
        });

        it('should deny access when customer lacks entitlement', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.check).mockResolvedValue(false);

            const mockReflector = createMockReflector({
                [REQUIRED_ENTITLEMENT_KEY]: 'feature_premium'
            });
            const mockContext = createMockExecutionContext();

            const guard = new EntitlementGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(ForbiddenException);
            await expect(guard.canActivate(mockContext as never)).rejects.toThrow('Missing required entitlement: feature_premium');
        });

        it('should throw when no customer context', async () => {
            const mockBilling = createMockBilling();
            const mockReflector = createMockReflector({
                [REQUIRED_ENTITLEMENT_KEY]: 'feature_api'
            });
            const mockContext = createMockExecutionContext({
                customer: undefined,
                user: undefined
            });

            const guard = new EntitlementGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(ForbiddenException);
            await expect(guard.canActivate(mockContext as never)).rejects.toThrow('Customer context required');
        });

        it('should use customer.id when available', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.check).mockResolvedValue(true);

            const mockReflector = createMockReflector({
                [REQUIRED_ENTITLEMENT_KEY]: 'feature_api'
            });
            const mockContext = createMockExecutionContext({
                customer: { id: 'cus_from_customer' },
                user: { customerId: 'cus_from_user' }
            });

            const guard = new EntitlementGuard(mockBilling, mockReflector as never);
            await guard.canActivate(mockContext as never);

            expect(mockBilling.entitlements.check).toHaveBeenCalledWith('cus_from_customer', 'feature_api');
        });

        it('should fallback to user.customerId when customer.id not available', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.entitlements.check).mockResolvedValue(true);

            const mockReflector = createMockReflector({
                [REQUIRED_ENTITLEMENT_KEY]: 'feature_api'
            });
            const mockContext = createMockExecutionContext({
                customer: undefined,
                user: { customerId: 'cus_from_user' }
            });

            const guard = new EntitlementGuard(mockBilling, mockReflector as never);
            await guard.canActivate(mockContext as never);

            expect(mockBilling.entitlements.check).toHaveBeenCalledWith('cus_from_user', 'feature_api');
        });
    });
});
