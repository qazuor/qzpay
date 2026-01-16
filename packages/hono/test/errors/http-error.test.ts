/**
 * HTTP Error Tests
 */
import { describe, expect, it } from 'vitest';
import { HttpStatus, QZPayHttpError } from '../../src/errors/http-error.js';

describe('QZPayHttpError', () => {
    it('should create error with correct properties', () => {
        const error = new QZPayHttpError(404, 'NOT_FOUND', 'Resource not found');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(QZPayHttpError);
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe('Resource not found');
        expect(error.name).toBe('QZPayHttpError');
    });

    it('should work with instanceof checks', () => {
        const error = new QZPayHttpError(422, 'VALIDATION_ERROR', 'Invalid input');

        expect(error instanceof Error).toBe(true);
        expect(error instanceof QZPayHttpError).toBe(true);
    });

    it('should have proper prototype chain', () => {
        const error = new QZPayHttpError(500, 'INTERNAL_ERROR', 'Server error');

        expect(Object.getPrototypeOf(error)).toBe(QZPayHttpError.prototype);
    });
});

describe('HttpStatus', () => {
    it('should have all standard HTTP status codes', () => {
        expect(HttpStatus.OK).toBe(200);
        expect(HttpStatus.CREATED).toBe(201);
        expect(HttpStatus.BAD_REQUEST).toBe(400);
        expect(HttpStatus.UNAUTHORIZED).toBe(401);
        expect(HttpStatus.FORBIDDEN).toBe(403);
        expect(HttpStatus.NOT_FOUND).toBe(404);
        expect(HttpStatus.CONFLICT).toBe(409);
        expect(HttpStatus.UNPROCESSABLE_ENTITY).toBe(422);
        expect(HttpStatus.TOO_MANY_REQUESTS).toBe(429);
        expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
    });

    it('should be readonly', () => {
        // Object is frozen, modifications throw in strict mode
        expect(Object.isFrozen(HttpStatus)).toBe(true);
        expect(() => {
            // @ts-expect-error - Testing runtime immutability
            HttpStatus.NOT_FOUND = 999;
        }).toThrow(TypeError);

        // Value remains unchanged
        expect(HttpStatus.NOT_FOUND).toBe(404);
    });
});
