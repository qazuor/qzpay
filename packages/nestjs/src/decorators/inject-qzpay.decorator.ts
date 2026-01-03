/**
 * InjectQZPay Decorator
 * Injects the QZPayBilling instance into a class property or constructor parameter
 */
import { Inject } from '@nestjs/common';
import { QZPAY_BILLING_TOKEN } from '../constants.js';

/**
 * Decorator to inject the QZPayBilling instance
 *
 * @example
 * ```typescript
 * @Controller('billing')
 * export class BillingController {
 *   constructor(@InjectQZPay() private billing: QZPayBilling) {}
 * }
 * ```
 */
export function InjectQZPay(): ParameterDecorator & PropertyDecorator {
    return Inject(QZPAY_BILLING_TOKEN);
}
