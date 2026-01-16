/**
 * DTO for creating a subscription
 */
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateSubscriptionDto {
    /**
     * Customer ID
     */
    @IsString()
    @IsNotEmpty()
    customerId!: string;

    /**
     * Plan ID
     */
    @IsString()
    @IsNotEmpty()
    planId!: string;

    /**
     * Specific price ID (optional, defaults to plan's default price)
     */
    @IsOptional()
    @IsString()
    priceId?: string;

    /**
     * Quantity of the subscription (default: 1)
     */
    @IsOptional()
    @IsInt()
    @IsPositive()
    quantity?: number;

    /**
     * Trial period in days
     */
    @IsOptional()
    @IsInt()
    @Min(0)
    trialDays?: number;

    /**
     * Promotional code ID to apply
     */
    @IsOptional()
    @IsString()
    promoCodeId?: string;

    /**
     * Additional metadata
     */
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
