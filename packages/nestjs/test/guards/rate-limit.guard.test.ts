/**
 * Rate Limit Guard Tests
 */
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_KEY } from '../../src/constants.js';
import { RateLimitGuard } from '../../src/guards/rate-limit.guard.js';
import { createMockBilling, createMockExecutionContext, createMockReflector } from '../helpers/nestjs-mocks.js';

describe('RateLimitGuard', () => {
    describe('canActivate', () => {
        it('should allow access when no rate limit configured', async () => {
            const mockBilling = createMockBilling();
            const mockReflector = createMockReflector({});
            const mockContext = createMockExecutionContext();

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
        });

        it('should allow access and increment when within limit', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.check).mockResolvedValue(true);
            vi.mocked(mockBilling.limits.increment).mockResolvedValue({} as never);

            const mockReflector = createMockReflector({
                [RATE_LIMIT_KEY]: { limitKey: 'api_calls' }
            });
            const mockContext = createMockExecutionContext();

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            expect(result).toBe(true);
            expect(mockBilling.limits.check).toHaveBeenCalledWith('cus_123', 'api_calls');
            expect(mockBilling.limits.increment).toHaveBeenCalledWith('cus_123', 'api_calls', 1);
        });

        it('should deny access when rate limit exceeded', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.check).mockResolvedValue(false);

            const mockReflector = createMockReflector({
                [RATE_LIMIT_KEY]: { limitKey: 'api_calls' }
            });
            const mockContext = createMockExecutionContext();

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(ForbiddenException);
            await expect(guard.canActivate(mockContext as never)).rejects.toThrow('Rate limit exceeded: api_calls');
        });

        it('should throw when no customer context', async () => {
            const mockBilling = createMockBilling();
            const mockReflector = createMockReflector({
                [RATE_LIMIT_KEY]: { limitKey: 'api_calls' }
            });
            const mockContext = createMockExecutionContext({
                customer: undefined,
                user: undefined
            });

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);

            await expect(guard.canActivate(mockContext as never)).rejects.toThrow(ForbiddenException);
            await expect(guard.canActivate(mockContext as never)).rejects.toThrow('Customer context required for rate limiting');
        });

        it('should use custom increment amount', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.check).mockResolvedValue(true);
            vi.mocked(mockBilling.limits.increment).mockResolvedValue({} as never);

            const mockReflector = createMockReflector({
                [RATE_LIMIT_KEY]: { limitKey: 'api_calls', increment: 5 }
            });
            const mockContext = createMockExecutionContext();

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);
            await guard.canActivate(mockContext as never);

            expect(mockBilling.limits.increment).toHaveBeenCalledWith('cus_123', 'api_calls', 5);
        });

        it('should still allow access when increment fails', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.check).mockResolvedValue(true);
            vi.mocked(mockBilling.limits.increment).mockRejectedValue(new Error('Increment failed'));

            const mockReflector = createMockReflector({
                [RATE_LIMIT_KEY]: { limitKey: 'api_calls' }
            });
            const mockContext = createMockExecutionContext();

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);
            const result = await guard.canActivate(mockContext as never);

            // Should still allow access even if increment fails
            expect(result).toBe(true);
        });

        it('should use customer.id when available', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.check).mockResolvedValue(true);
            vi.mocked(mockBilling.limits.increment).mockResolvedValue({} as never);

            const mockReflector = createMockReflector({
                [RATE_LIMIT_KEY]: { limitKey: 'api_calls' }
            });
            const mockContext = createMockExecutionContext({
                customer: { id: 'cus_from_customer' },
                user: { customerId: 'cus_from_user' }
            });

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);
            await guard.canActivate(mockContext as never);

            expect(mockBilling.limits.check).toHaveBeenCalledWith('cus_from_customer', 'api_calls');
        });

        it('should fallback to user.customerId when customer.id not available', async () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.limits.check).mockResolvedValue(true);
            vi.mocked(mockBilling.limits.increment).mockResolvedValue({} as never);

            const mockReflector = createMockReflector({
                [RATE_LIMIT_KEY]: { limitKey: 'api_calls' }
            });
            const mockContext = createMockExecutionContext({
                customer: undefined,
                user: { customerId: 'cus_from_user' }
            });

            const guard = new RateLimitGuard(mockBilling, mockReflector as never);
            await guard.canActivate(mockContext as never);

            expect(mockBilling.limits.check).toHaveBeenCalledWith('cus_from_user', 'api_calls');
        });
    });
});
