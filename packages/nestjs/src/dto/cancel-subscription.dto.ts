/**
 * DTO for cancelling a subscription
 */
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CancelSubscriptionDto {
    /**
     * Whether to cancel at the end of the current billing period
     */
    @IsOptional()
    @IsBoolean()
    cancelAtPeriodEnd?: boolean;

    /**
     * Reason for cancellation
     */
    @IsOptional()
    @IsString()
    reason?: string;
}
