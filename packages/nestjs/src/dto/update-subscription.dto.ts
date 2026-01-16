/**
 * DTO for updating a subscription
 */
import { IsInt, IsObject, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateSubscriptionDto {
    /**
     * New plan ID
     */
    @IsOptional()
    @IsString()
    planId?: string;

    /**
     * New price ID
     */
    @IsOptional()
    @IsString()
    priceId?: string;

    /**
     * New quantity
     */
    @IsOptional()
    @IsInt()
    @IsPositive()
    quantity?: number;

    /**
     * Additional metadata
     */
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
