/**
 * DTO for refunding a payment
 */
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RefundPaymentDto {
    /**
     * Amount to refund (in cents/minor units)
     * If not provided, full refund will be processed
     */
    @IsOptional()
    @IsNumber()
    @Min(1)
    amount?: number;

    /**
     * Reason for the refund
     */
    @IsOptional()
    @IsString()
    reason?: string;
}
