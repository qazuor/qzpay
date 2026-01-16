/**
 * Error Mapper Tests
 */
import { describe, expect, it } from 'vitest';
import { isConflictError, isNotFoundError, isValidationError, mapErrorToHttpStatus } from '../../src/errors/error-mapper.js';
import { HttpStatus } from '../../src/errors/http-error.js';
import { QZPayHttpError } from '../../src/errors/http-error.js';

describe('Error Mapper', () => {
    describe('mapErrorToHttpStatus', () => {
        it('should map QZPayHttpError correctly', () => {
            const error = new QZPayHttpError(404, 'NOT_FOUND', 'Resource not found');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(404);
            expect(result.code).toBe('NOT_FOUND');
            expect(result.message).toBe('Resource not found');
        });

        it('should map "not found" error to 404', () => {
            const error = new Error('Customer not found');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.NOT_FOUND);
            expect(result.code).toBe('NOT_FOUND');
            expect(result.message).toBe('Customer not found');
        });

        it('should map "does not exist" error to 404', () => {
            const error = new Error('Resource does not exist');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.NOT_FOUND);
            expect(result.code).toBe('NOT_FOUND');
        });

        it('should map "already exists" error to 409', () => {
            const error = new Error('Customer already exists');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.CONFLICT);
            expect(result.code).toBe('CONFLICT');
        });

        it('should map "duplicate" error to 409', () => {
            const error = new Error('Duplicate entry found');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.CONFLICT);
            expect(result.code).toBe('CONFLICT');
        });

        it('should map "invalid" error to 422', () => {
            const error = new Error('Invalid email format');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
            expect(result.code).toBe('VALIDATION_ERROR');
        });

        it('should map "validation" error to 422', () => {
            const error = new Error('Validation failed for field');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
            expect(result.code).toBe('VALIDATION_ERROR');
        });

        it('should map "required" error to 422', () => {
            const error = new Error('Email is required');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
            expect(result.code).toBe('VALIDATION_ERROR');
        });

        it('should map "bad request" error to 400', () => {
            const error = new Error('Bad request format');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.BAD_REQUEST);
            expect(result.code).toBe('BAD_REQUEST');
        });

        it('should map "unauthorized" error to 401', () => {
            const error = new Error('Unauthorized access');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.UNAUTHORIZED);
            expect(result.code).toBe('UNAUTHORIZED');
        });

        it('should map "forbidden" error to 403', () => {
            const error = new Error('Forbidden resource');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.FORBIDDEN);
            expect(result.code).toBe('FORBIDDEN');
        });

        it('should map "rate limit" error to 429', () => {
            const error = new Error('Rate limit exceeded');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
            expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
        });

        it('should default to 500 for unknown errors', () => {
            const error = new Error('Something went wrong');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
            expect(result.code).toBe('INTERNAL_ERROR');
            expect(result.message).toBe('Something went wrong');
        });

        it('should handle non-Error objects', () => {
            const result = mapErrorToHttpStatus('String error');

            expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
            expect(result.code).toBe('INTERNAL_ERROR');
            expect(result.message).toBe('String error');
        });

        it('should be case-insensitive for pattern matching', () => {
            const error = new Error('CUSTOMER NOT FOUND');
            const result = mapErrorToHttpStatus(error);

            expect(result.status).toBe(HttpStatus.NOT_FOUND);
            expect(result.code).toBe('NOT_FOUND');
        });
    });

    describe('isNotFoundError', () => {
        it('should return true for not found errors', () => {
            const error = new Error('Customer not found');
            expect(isNotFoundError(error)).toBe(true);
        });

        it('should return false for other errors', () => {
            const error = new Error('Something went wrong');
            expect(isNotFoundError(error)).toBe(false);
        });
    });

    describe('isValidationError', () => {
        it('should return true for validation errors', () => {
            const error = new Error('Invalid email format');
            expect(isValidationError(error)).toBe(true);
        });

        it('should return false for other errors', () => {
            const error = new Error('Something went wrong');
            expect(isValidationError(error)).toBe(false);
        });
    });

    describe('isConflictError', () => {
        it('should return true for conflict errors', () => {
            const error = new Error('Customer already exists');
            expect(isConflictError(error)).toBe(true);
        });

        it('should return false for other errors', () => {
            const error = new Error('Something went wrong');
            expect(isConflictError(error)).toBe(false);
        });
    });
});
