/**
 * DTO for marking an invoice as paid
 */
import { IsNotEmpty, IsString } from 'class-validator';

export class MarkPaidDto {
    /**
     * Payment ID that paid this invoice
     */
    @IsString()
    @IsNotEmpty()
    paymentId!: string;
}
