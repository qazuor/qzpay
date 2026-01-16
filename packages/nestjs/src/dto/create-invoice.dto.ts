/**
 * DTO for creating an invoice
 */
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Min,
    ValidateNested
} from 'class-validator';

/**
 * DTO for invoice line item
 */
export class CreateInvoiceLineDto {
    /**
     * Line item description
     */
    @IsString()
    @IsNotEmpty()
    description!: string;

    /**
     * Quantity
     */
    @IsInt()
    @Min(1)
    quantity!: number;

    /**
     * Unit amount (in cents/minor units)
     */
    @IsNumber()
    @Min(0)
    unitAmount!: number;

    /**
     * Associated price ID (optional)
     */
    @IsOptional()
    @IsString()
    priceId?: string;
}

export class CreateInvoiceDto {
    /**
     * Customer ID
     */
    @IsString()
    @IsNotEmpty()
    customerId!: string;

    /**
     * Associated subscription ID (optional)
     */
    @IsOptional()
    @IsString()
    subscriptionId?: string;

    /**
     * Invoice line items
     */
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceLineDto)
    lines!: CreateInvoiceLineDto[];

    /**
     * Due date (ISO 8601 date string)
     */
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    /**
     * Additional metadata
     */
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
