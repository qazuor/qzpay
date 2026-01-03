/**
 * QZPay NestJS Module
 * Dynamic module for integrating QZPay billing into NestJS applications
 */
import { type DynamicModule, type InjectionToken, Module, type Provider } from '@nestjs/common';
import { QZPAY_BILLING_TOKEN, QZPAY_OPTIONS_TOKEN } from './constants.js';
import { QZPayWebhookService } from './qzpay-webhook.service.js';
import { QZPayService } from './qzpay.service.js';
import type { QZPayModuleAsyncOptions, QZPayModuleOptions, QZPayOptionsFactoryInterface } from './types.js';

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic modules require static-only class pattern
export class QZPayModule {
    /**
     * Register QZPayModule with synchronous configuration
     *
     * @example
     * ```typescript
     * QZPayModule.forRoot({
     *   billing: createQZPayBilling({ storage, paymentAdapter })
     * })
     * ```
     */
    static forRoot(options: QZPayModuleOptions): DynamicModule {
        const providers: Provider[] = [
            {
                provide: QZPAY_OPTIONS_TOKEN,
                useValue: options
            },
            {
                provide: QZPAY_BILLING_TOKEN,
                useValue: options.billing
            },
            QZPayService,
            QZPayWebhookService
        ];

        return {
            module: QZPayModule,
            global: true,
            providers,
            exports: [QZPAY_BILLING_TOKEN, QZPayService, QZPayWebhookService]
        };
    }

    /**
     * Register QZPayModule with asynchronous configuration
     *
     * @example
     * ```typescript
     * QZPayModule.forRootAsync({
     *   imports: [ConfigModule],
     *   useFactory: (configService: ConfigService) => ({
     *     billing: createQZPayBilling({
     *       storage: createDrizzleAdapter(db),
     *       paymentAdapter: createStripeAdapter({
     *         secretKey: configService.get('STRIPE_SECRET_KEY')
     *       })
     *     })
     *   }),
     *   inject: [ConfigService]
     * })
     * ```
     */
    static forRootAsync(options: QZPayModuleAsyncOptions): DynamicModule {
        const providers: Provider[] = [...QZPayModule.createAsyncProviders(options), QZPayService, QZPayWebhookService];

        return {
            module: QZPayModule,
            global: true,
            imports: options.imports ?? [],
            providers,
            exports: [QZPAY_BILLING_TOKEN, QZPayService, QZPayWebhookService]
        };
    }

    private static createAsyncProviders(options: QZPayModuleAsyncOptions): Provider[] {
        if (options.useFactory) {
            return [
                {
                    provide: QZPAY_OPTIONS_TOKEN,
                    useFactory: options.useFactory,
                    inject: (options.inject ?? []) as InjectionToken[]
                },
                {
                    provide: QZPAY_BILLING_TOKEN,
                    useFactory: (opts: QZPayModuleOptions) => opts.billing,
                    inject: [QZPAY_OPTIONS_TOKEN]
                }
            ];
        }

        if (options.useClass) {
            return [
                {
                    provide: options.useClass,
                    useClass: options.useClass
                },
                {
                    provide: QZPAY_OPTIONS_TOKEN,
                    useFactory: async (optionsFactory: QZPayOptionsFactoryInterface) => optionsFactory.createQZPayOptions(),
                    inject: [options.useClass]
                },
                {
                    provide: QZPAY_BILLING_TOKEN,
                    useFactory: (opts: QZPayModuleOptions) => opts.billing,
                    inject: [QZPAY_OPTIONS_TOKEN]
                }
            ];
        }

        if (options.useExisting) {
            return [
                {
                    provide: QZPAY_OPTIONS_TOKEN,
                    useFactory: async (optionsFactory: QZPayOptionsFactoryInterface) => optionsFactory.createQZPayOptions(),
                    inject: [options.useExisting]
                },
                {
                    provide: QZPAY_BILLING_TOKEN,
                    useFactory: (opts: QZPayModuleOptions) => opts.billing,
                    inject: [QZPAY_OPTIONS_TOKEN]
                }
            ];
        }

        throw new Error('Invalid QZPayModule async configuration. Provide useFactory, useClass, or useExisting.');
    }
}
