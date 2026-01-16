/**
 * DTO for processing a payment
 */
import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

/**
 * Supported currencies
 */
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'MXN', 'ARS'] as const;

export class ProcessPaymentDto {
    /**
     * Customer ID
     */
    @IsString()
    @IsNotEmpty()
    customerId!: string;

    /**
     * Payment amount (in cents/minor units)
     */
    @IsNumber()
    @Min(1)
    amount!: number;

    /**
     * Currency code (ISO 4217)
     */
    @IsString()
    @IsIn(SUPPORTED_CURRENCIES)
    currency!: string;

    /**
     * Associated invoice ID
     */
    @IsOptional()
    @IsString()
    invoiceId?: string;

    /**
     * Associated subscription ID
     */
    @IsOptional()
    @IsString()
    subscriptionId?: string;

    /**
     * Payment method ID to use
     */
    @IsOptional()
    @IsString()
    paymentMethodId?: string;

    /**
     * Additional metadata
     */
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
