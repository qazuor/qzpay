/**
 * QZPay NestJS Types
 */
import type { ModuleMetadata, Type } from '@nestjs/common';
import type { QZPayBilling } from '@qazuor/qzpay-core';

/**
 * Configuration options for QZPayModule.forRoot()
 */
export interface QZPayModuleOptions {
    /**
     * The QZPayBilling instance to use
     */
    billing: QZPayBilling;
}

/**
 * Factory function type for async module configuration
 */
export type QZPayOptionsFactory = (...args: unknown[]) => Promise<QZPayModuleOptions> | QZPayModuleOptions;

/**
 * Options factory interface for class-based configuration
 */
export interface QZPayOptionsFactoryInterface {
    createQZPayOptions(): Promise<QZPayModuleOptions> | QZPayModuleOptions;
}

/**
 * Configuration options for QZPayModule.forRootAsync()
 */
export interface QZPayModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /**
     * Factory function to create options
     */
    useFactory?: QZPayOptionsFactory;

    /**
     * Dependencies to inject into the factory
     */
    inject?: unknown[];

    /**
     * Class to use for creating options
     */
    useClass?: Type<QZPayOptionsFactoryInterface>;

    /**
     * Existing provider to use for options
     */
    useExisting?: Type<QZPayOptionsFactoryInterface>;
}

/**
 * Rate limit configuration for guards
 */
export interface RateLimitConfig {
    /**
     * The limit key to check (e.g., 'api_requests', 'file_uploads')
     */
    limitKey: string;

    /**
     * Amount to increment the limit by (default: 1)
     */
    increment?: number;
}

/**
 * Webhook event handler type
 */
export type WebhookEventHandler<T = unknown> = (event: { type: string; data: T }) => Promise<void> | void;

/**
 * Webhook handlers map
 */
export type WebhookHandlersMap = Record<string, WebhookEventHandler>;
