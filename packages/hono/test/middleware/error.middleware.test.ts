/**
 * Error Middleware Tests
 */
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { HttpStatus, QZPayHttpError } from '../../src/errors/http-error.js';
import { createErrorHandler, createErrorMiddleware, createErrorResponse, throwHttpError } from '../../src/middleware/error.middleware.js';

describe('Error Middleware', () => {
    describe('createErrorResponse', () => {
        it('should create error response from Error', () => {
            const error = new Error('Something went wrong');
            const { response, status } = createErrorResponse(error);

            expect(response.success).toBe(false);
            expect(response.error?.message).toBe('Something went wrong');
            expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        });

        it('should create error response from QZPayHttpError', () => {
            const error = new QZPayHttpError(404, 'NOT_FOUND', 'Resource not found');
            const { response, status } = createErrorResponse(error);

            expect(response.success).toBe(false);
            expect(response.error?.code).toBe('NOT_FOUND');
            expect(response.error?.message).toBe('Resource not found');
            expect(status).toBe(404);
        });

        it('should include stack trace when enabled', () => {
            const error = new Error('Test error');
            const { response } = createErrorResponse(error, true);

            expect(response.error?.stack).toBeDefined();
            expect(typeof response.error?.stack).toBe('string');
        });

        it('should not include stack trace by default', () => {
            const error = new Error('Test error');
            const { response } = createErrorResponse(error, false);

            expect(response.error?.stack).toBeUndefined();
        });
    });

    describe('createErrorHandler', () => {
        it('should catch errors and return error response', async () => {
            const app = new Hono();
            app.onError(createErrorHandler({ logErrors: false }));
            app.get('/test', () => {
                throw new Error('Test error');
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.message).toBe('Test error');
        });

        it('should map errors to correct status codes', async () => {
            const app = new Hono();
            app.onError(createErrorHandler({ logErrors: false }));
            app.get('/test', () => {
                throw new Error('Customer not found');
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should handle QZPayHttpError correctly', async () => {
            const app = new Hono();
            app.onError(createErrorHandler({ logErrors: false }));
            app.get('/test', () => {
                throw new QZPayHttpError(422, 'VALIDATION_ERROR', 'Invalid input');
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Invalid input');
        });

        it('should use custom error handler when provided', async () => {
            const customHandler = vi.fn((error, c) => {
                return c.json({ custom: true, error: String(error) }, 418);
            });

            const app = new Hono();
            app.onError(createErrorHandler({ onError: customHandler, logErrors: false }));
            app.get('/test', () => {
                throw new Error('Test error');
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(response.status).toBe(418);
            expect(data.custom).toBe(true);
            expect(customHandler).toHaveBeenCalled();
        });

        it('should log errors when enabled', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const app = new Hono();
            app.onError(createErrorHandler({ logErrors: true }));
            app.get('/test', () => {
                throw new Error('Test error');
            });

            await app.request('/test');

            expect(consoleError).toHaveBeenCalled();
            consoleError.mockRestore();
        });

        it('should not log errors when disabled', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const app = new Hono();
            app.onError(createErrorHandler({ logErrors: false }));
            app.get('/test', () => {
                throw new Error('Test error');
            });

            await app.request('/test');

            expect(consoleError).not.toHaveBeenCalled();
            consoleError.mockRestore();
        });

        it('should include stack trace when configured', async () => {
            const app = new Hono();
            app.onError(createErrorHandler({ includeStackTrace: true, logErrors: false }));
            app.get('/test', () => {
                throw new Error('Test error');
            });

            const response = await app.request('/test');
            const data = await response.json();

            expect(data.error.stack).toBeDefined();
        });
    });

    describe('createErrorMiddleware (legacy)', () => {
        it('should be defined for backwards compatibility', () => {
            expect(createErrorMiddleware).toBeDefined();
            expect(typeof createErrorMiddleware).toBe('function');
        });
    });

    describe('throwHttpError', () => {
        it('should throw QZPayHttpError with correct properties', () => {
            expect(() => {
                throwHttpError(404, 'NOT_FOUND', 'Resource not found');
            }).toThrow(QZPayHttpError);

            try {
                throwHttpError(422, 'VALIDATION_ERROR', 'Invalid input');
            } catch (error) {
                expect(error).toBeInstanceOf(QZPayHttpError);
                expect((error as QZPayHttpError).statusCode).toBe(422);
                expect((error as QZPayHttpError).code).toBe('VALIDATION_ERROR');
                expect((error as QZPayHttpError).message).toBe('Invalid input');
            }
        });
    });
});
