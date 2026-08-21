/**
 * Error Mapper Tests
 */
import { QZPayConflictError, QZPayError, QZPayNotFoundError, QZPayProviderSyncError, QZPayValidationError } from '@qazuor/qzpay-core';
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

        // Regression coverage for HOS-667: a deliberate rejection thrown by
        // qzpay-core (e.g. the refund guard on a payment with no provider
        // link) must map to a 4xx by TYPE, not fall through to the generic
        // 500 default just because its message doesn't match one of the
        // ERROR_PATTERNS regexes below.
        describe('qzpay-core typed error hierarchy', () => {
            it('should map QZPayValidationError to 422 VALIDATION_ERROR', () => {
                const error = new QZPayValidationError(
                    'Payment payment_123 is not linked to mercadopago — cannot refund at the provider',
                    'paymentId',
                    'payment_123'
                );
                const result = mapErrorToHttpStatus(error);

                expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
                expect(result.code).toBe('VALIDATION_ERROR');
                expect(result.message).toBe(error.message);
            });

            it('should map QZPayNotFoundError to 404 NOT_FOUND', () => {
                const error = new QZPayNotFoundError('Subscription', 'sub_123');
                const result = mapErrorToHttpStatus(error);

                expect(result.status).toBe(HttpStatus.NOT_FOUND);
                expect(result.code).toBe('NOT_FOUND');
                expect(result.message).toBe(error.message);
            });

            it('should map QZPayConflictError to 409 CONFLICT', () => {
                const error = new QZPayConflictError('Add-on already attached to subscription', 'already_exists');
                const result = mapErrorToHttpStatus(error);

                expect(result.status).toBe(HttpStatus.CONFLICT);
                expect(result.code).toBe('CONFLICT');
                expect(result.message).toBe(error.message);
            });

            it('should map QZPayProviderSyncError to 502 PROVIDER_SYNC_FAILED', () => {
                const error = new QZPayProviderSyncError('Failed to create customer in MercadoPago', 'mercadopago', 'create_customer');
                const result = mapErrorToHttpStatus(error);

                expect(result.status).toBe(HttpStatus.BAD_GATEWAY);
                expect(result.code).toBe('PROVIDER_SYNC_FAILED');
                expect(result.message).toBe(error.message);
            });

            it('should NOT map a QZPayValidationError with a message resembling another pattern to that pattern (type wins over text)', () => {
                // Message text alone would otherwise match the "not found"
                // pattern below and misclassify this as a 404.
                const error = new QZPayValidationError('Plan not found in the allowed list for this field', 'planId', 'unknown-plan');
                const result = mapErrorToHttpStatus(error);

                expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
                expect(result.code).toBe('VALIDATION_ERROR');
            });

            it('should default an unclassified base QZPayError to 500 (fail-safe: unrecognized never gets promoted)', () => {
                const error = new QZPayError('Something went sideways inside qzpay-core');
                const result = mapErrorToHttpStatus(error);

                expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
                expect(result.code).toBe('INTERNAL_ERROR');
            });

            it('should still classify by name when instanceof fails (duplicated qzpay-core copy)', () => {
                // Arrange: an error shaped exactly like one thrown from a
                // SECOND copy of qzpay-core resolved elsewhere in the
                // dependency tree. `instanceof` compares constructor
                // identity, so it is false here even though this is, for
                // every practical purpose, a QZPayValidationError. Without
                // the name fallback this silently regressed to 500 — and
                // only ever in real deployments, never in a test run, which
                // is the worst place for a regression to hide.
                const foreignError = new Error('Payment abc is not linked to mercadopago');
                foreignError.name = 'QZPayValidationError';

                // Act
                const result = mapErrorToHttpStatus(foreignError);

                // Assert
                expect(foreignError instanceof QZPayValidationError).toBe(false);
                expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
                expect(result.code).toBe('VALIDATION_ERROR');
            });

            it('should not classify an ordinary error whose name was never set by qzpay-core', () => {
                // Arrange: guards the fallback above against over-reach —
                // only the exact class names qualify, not any error that
                // happens to mention a provider.
                const error = new Error('Payment abc is not linked to mercadopago');

                // Act
                const result = mapErrorToHttpStatus(error);

                // Assert
                expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
                expect(result.code).toBe('INTERNAL_ERROR');
            });
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

        it('should return true for a QZPayNotFoundError instance', () => {
            const error = new QZPayNotFoundError('Customer', 'cus_123');
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

        it('should return true for a QZPayValidationError instance', () => {
            const error = new QZPayValidationError('Payment is not linked to the provider', 'paymentId', 'payment_123');
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

        it('should return true for a QZPayConflictError instance', () => {
            const error = new QZPayConflictError('Add-on already attached to subscription', 'already_exists');
            expect(isConflictError(error)).toBe(true);
        });

        it('should return false for other errors', () => {
            const error = new Error('Something went wrong');
            expect(isConflictError(error)).toBe(false);
        });
    });
});
