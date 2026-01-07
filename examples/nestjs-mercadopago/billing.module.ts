/**
 * QZPay Billing Module for NestJS + MercadoPago
 *
 * Provides billing functionality using QZPay with MercadoPago adapter.
 */
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { BILLING_CONFIG, BillingService } from './billing.service';
import type { BillingModuleConfig } from './types';

@Global()
@Module({})
export class BillingModule {
    /**
     * Register the billing module with configuration
     *
     * @example
     * ```typescript
     * BillingModule.forRoot({
     *   accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
     *   webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET!,
     * })
     * ```
     */
    static forRoot(config: BillingModuleConfig): DynamicModule {
        return {
            module: BillingModule,
            providers: [
                {
                    provide: BILLING_CONFIG,
                    useValue: config
                },
                BillingService
            ],
            exports: [BillingService]
        };
    }

    /**
     * Register the billing module with async configuration
     *
     * @example
     * ```typescript
     * BillingModule.forRootAsync({
     *   imports: [ConfigModule],
     *   inject: [ConfigService],
     *   useFactory: (config: ConfigService) => ({
     *     accessToken: config.get('MERCADOPAGO_ACCESS_TOKEN'),
     *     webhookSecret: config.get('MERCADOPAGO_WEBHOOK_SECRET'),
     *   }),
     * })
     * ```
     */
    static forRootAsync(options: {
        imports?: unknown[];
        inject?: unknown[];
        useFactory: (...args: unknown[]) => BillingModuleConfig | Promise<BillingModuleConfig>;
    }): DynamicModule {
        return {
            module: BillingModule,
            imports: options.imports as [],
            providers: [
                {
                    provide: BILLING_CONFIG,
                    inject: options.inject as [],
                    useFactory: options.useFactory
                },
                BillingService
            ],
            exports: [BillingService]
        };
    }
}
