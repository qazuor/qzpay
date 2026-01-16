/**
 * DTO for updating a customer
 */
import { PartialType } from '@nestjs/mapped-types';
import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto.js';

/**
 * Update customer DTO - all fields are optional
 */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
    /**
     * Customer email address
     */
    @IsOptional()
    @IsEmail()
    email?: string;

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
