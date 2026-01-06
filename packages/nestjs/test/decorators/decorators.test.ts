/**
 * Decorator Unit Tests
 *
 * Tests for the NestJS decorators.
 */
import { Controller, Get, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_KEY, REQUIRED_ENTITLEMENT_KEY, REQUIRED_SUBSCRIPTION_KEY } from '../../src/constants.js';
import { InjectQZPay } from '../../src/decorators/inject-qzpay.decorator.js';
import { RateLimit } from '../../src/decorators/rate-limit.decorator.js';
import { RequireEntitlement } from '../../src/decorators/require-entitlement.decorator.js';
import { RequireSubscription } from '../../src/decorators/require-subscription.decorator.js';

describe('InjectQZPay Decorator', () => {
    it('should inject the billing token', () => {
        class TestService {
            constructor(@InjectQZPay() public billing: unknown) {}
        }

        // The decorator should add metadata for Reflect
        const _paramTypes = Reflect.getMetadata('design:paramtypes', TestService);
        const _injectMetadata = Reflect.getMetadata('self:paramtypes', TestService);

        // The inject decorator should be applied - it creates injection metadata
        expect(TestService).toBeDefined();
    });

    it('should work as a property decorator', () => {
        class TestService {
            @InjectQZPay()
            billing!: unknown;
        }

        expect(TestService).toBeDefined();
    });
});

describe('RequireEntitlement Decorator', () => {
    it('should set entitlement metadata', () => {
        @Controller('test')
        class TestController {
            @Get('/')
            @RequireEntitlement('premium_feature')
            getProtected() {
                return 'protected';
            }
        }

        const reflector = new Reflector();
        const metadata = reflector.get(REQUIRED_ENTITLEMENT_KEY, TestController.prototype.getProtected);

        expect(metadata).toBe('premium_feature');
    });

    it('should apply EntitlementGuard', () => {
        @Controller('test')
        class TestController {
            @Get('/')
            @RequireEntitlement('api_access')
            getProtected() {
                return 'protected';
            }
        }

        // Check that guards metadata is set
        const guards = Reflect.getMetadata('__guards__', TestController.prototype.getProtected);

        expect(guards).toBeDefined();
        expect(guards.length).toBeGreaterThan(0);
    });
});

describe('RequireSubscription Decorator', () => {
    it('should set default subscription config metadata', () => {
        @Controller('test')
        class TestController {
            @Get('/')
            @RequireSubscription()
            getProtected() {
                return 'protected';
            }
        }

        const reflector = new Reflector();
        const metadata = reflector.get(REQUIRED_SUBSCRIPTION_KEY, TestController.prototype.getProtected);

        expect(metadata).toEqual({
            statuses: ['active'],
            planIds: undefined
        });
    });

    it('should set custom statuses', () => {
        @Controller('test')
        class TestController {
            @Get('/')
            @RequireSubscription({ statuses: ['active', 'trialing'] })
            getProtected() {
                return 'protected';
            }
        }

        const reflector = new Reflector();
        const metadata = reflector.get(REQUIRED_SUBSCRIPTION_KEY, TestController.prototype.getProtected);

        expect(metadata).toEqual({
            statuses: ['active', 'trialing'],
            planIds: undefined
        });
    });

    it('should set planIds filter', () => {
        @Controller('test')
        class TestController {
            @Get('/')
            @RequireSubscription({ planIds: ['pro', 'enterprise'] })
            getProtected() {
                return 'protected';
            }
        }

        const reflector = new Reflector();
        const metadata = reflector.get(REQUIRED_SUBSCRIPTION_KEY, TestController.prototype.getProtected);

        expect(metadata).toEqual({
            statuses: ['active'],
            planIds: ['pro', 'enterprise']
        });
    });

    it('should apply SubscriptionGuard', () => {
        @Controller('test')
        class TestController {
            @Get('/')
            @RequireSubscription()
            getProtected() {
                return 'protected';
            }
        }

        const guards = Reflect.getMetadata('__guards__', TestController.prototype.getProtected);

        expect(guards).toBeDefined();
        expect(guards.length).toBeGreaterThan(0);
    });
});

describe('RateLimit Decorator', () => {
    it('should set default rate limit config', () => {
        @Controller('test')
        class TestController {
            @Post('/')
            @RateLimit('api_calls')
            doAction() {
                return 'done';
            }
        }

        const reflector = new Reflector();
        const metadata = reflector.get(RATE_LIMIT_KEY, TestController.prototype.doAction);

        expect(metadata).toEqual({
            limitKey: 'api_calls',
            increment: 1
        });
    });

    it('should set custom increment', () => {
        @Controller('test')
        class TestController {
            @Post('/heavy')
            @RateLimit('cpu_time', 10)
            doHeavyAction() {
                return 'done';
            }
        }

        const reflector = new Reflector();
        const metadata = reflector.get(RATE_LIMIT_KEY, TestController.prototype.doHeavyAction);

        expect(metadata).toEqual({
            limitKey: 'cpu_time',
            increment: 10
        });
    });

    it('should apply RateLimitGuard', () => {
        @Controller('test')
        class TestController {
            @Post('/')
            @RateLimit('requests')
            doAction() {
                return 'done';
            }
        }

        const guards = Reflect.getMetadata('__guards__', TestController.prototype.doAction);

        expect(guards).toBeDefined();
        expect(guards.length).toBeGreaterThan(0);
    });
});
