/**
 * QZPay Module Tests
 */
import { describe, expect, it } from 'vitest';
import { QZPAY_BILLING_TOKEN, QZPAY_OPTIONS_TOKEN } from '../src/constants.js';
import { QZPayWebhookService } from '../src/qzpay-webhook.service.js';
import { QZPayModule } from '../src/qzpay.module.js';
import { QZPayService } from '../src/qzpay.service.js';
import { createMockBilling } from './helpers/nestjs-mocks.js';

describe('QZPayModule', () => {
    describe('forRoot', () => {
        it('should create a dynamic module with providers', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRoot({ billing: mockBilling });

            expect(dynamicModule.module).toBe(QZPayModule);
            expect(dynamicModule.global).toBe(true);
            expect(dynamicModule.providers).toBeDefined();
            expect(dynamicModule.exports).toContain(QZPAY_BILLING_TOKEN);
            expect(dynamicModule.exports).toContain(QZPayService);
            expect(dynamicModule.exports).toContain(QZPayWebhookService);
        });

        it('should include QZPAY_OPTIONS_TOKEN provider', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRoot({ billing: mockBilling });

            const optionsProvider = dynamicModule.providers?.find(
                (p) => typeof p === 'object' && 'provide' in p && p.provide === QZPAY_OPTIONS_TOKEN
            );

            expect(optionsProvider).toBeDefined();
        });

        it('should include QZPAY_BILLING_TOKEN provider', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRoot({ billing: mockBilling });

            const billingProvider = dynamicModule.providers?.find(
                (p) => typeof p === 'object' && 'provide' in p && p.provide === QZPAY_BILLING_TOKEN
            );

            expect(billingProvider).toBeDefined();
        });

        it('should include QZPayService provider', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRoot({ billing: mockBilling });

            expect(dynamicModule.providers).toContain(QZPayService);
        });

        it('should include QZPayWebhookService provider', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRoot({ billing: mockBilling });

            expect(dynamicModule.providers).toContain(QZPayWebhookService);
        });
    });

    describe('forRootAsync', () => {
        it('should create a dynamic module with useFactory', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRootAsync({
                useFactory: () => ({ billing: mockBilling })
            });

            expect(dynamicModule.module).toBe(QZPayModule);
            expect(dynamicModule.global).toBe(true);
            expect(dynamicModule.providers).toBeDefined();
            expect(dynamicModule.exports).toContain(QZPAY_BILLING_TOKEN);
        });

        it('should support imports option', () => {
            const mockBilling = createMockBilling();
            const FakeModule = {} as never;

            const dynamicModule = QZPayModule.forRootAsync({
                imports: [FakeModule],
                useFactory: () => ({ billing: mockBilling })
            });

            expect(dynamicModule.imports).toContain(FakeModule);
        });

        it('should support inject option', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRootAsync({
                useFactory: () => ({ billing: mockBilling }),
                inject: ['ConfigService']
            });

            expect(dynamicModule.providers).toBeDefined();
        });

        it('should create a dynamic module with useClass', () => {
            class MockOptionsFactory {
                createQZPayOptions() {
                    return { billing: createMockBilling() };
                }
            }

            const dynamicModule = QZPayModule.forRootAsync({
                useClass: MockOptionsFactory
            });

            expect(dynamicModule.module).toBe(QZPayModule);
            expect(dynamicModule.providers).toBeDefined();
        });

        it('should create a dynamic module with useExisting', () => {
            class ExistingOptionsFactory {
                createQZPayOptions() {
                    return { billing: createMockBilling() };
                }
            }

            const dynamicModule = QZPayModule.forRootAsync({
                useExisting: ExistingOptionsFactory
            });

            expect(dynamicModule.module).toBe(QZPayModule);
            expect(dynamicModule.providers).toBeDefined();
        });

        it('should throw when no configuration method provided', () => {
            expect(() => {
                QZPayModule.forRootAsync({} as never);
            }).toThrow('Invalid QZPayModule async configuration');
        });

        it('should include QZPayService in async module', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRootAsync({
                useFactory: () => ({ billing: mockBilling })
            });

            expect(dynamicModule.providers).toContain(QZPayService);
        });

        it('should include QZPayWebhookService in async module', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRootAsync({
                useFactory: () => ({ billing: mockBilling })
            });

            expect(dynamicModule.providers).toContain(QZPayWebhookService);
        });

        it('should default imports to empty array when not provided', () => {
            const mockBilling = createMockBilling();
            const dynamicModule = QZPayModule.forRootAsync({
                useFactory: () => ({ billing: mockBilling })
            });

            expect(dynamicModule.imports).toEqual([]);
        });
    });
});
