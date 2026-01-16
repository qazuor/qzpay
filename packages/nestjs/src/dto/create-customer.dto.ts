/**
 * DTO for creating a customer
 */
import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
    /**
     * Customer email address
     */
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    /**
     * External ID for the customer (e.g., from your application)
     */
    @IsString()
    @IsNotEmpty()
    externalId!: string;

    /**
     * Customer name
     */
    @IsOptional()
    @IsString()
    name?: string;

    /**
     * Additional metadata
     */
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
