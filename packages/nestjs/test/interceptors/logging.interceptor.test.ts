import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
/**
 * Logging Interceptor Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayLoggingInterceptor } from '../../src/interceptors/logging.interceptor.js';

describe('QZPayLoggingInterceptor', () => {
    let interceptor: QZPayLoggingInterceptor;
    let mockExecutionContext: ExecutionContext;
    let mockCallHandler: CallHandler;
    let mockRequest: Record<string, unknown>;

    beforeEach(() => {
        mockRequest = {
            method: 'POST',
            url: '/billing/customers',
            body: { email: 'test@example.com', name: 'Test User' },
            ip: '127.0.0.1',
            headers: {
                'user-agent': 'test-agent/1.0',
                'x-request-id': 'req_123'
            }
        };

        mockExecutionContext = {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: vi.fn(),
                getNext: vi.fn()
            }),
            getClass: vi.fn(),
            getHandler: vi.fn(),
            getArgs: vi.fn(),
            getArgByIndex: vi.fn(),
            switchToRpc: vi.fn(),
            switchToWs: vi.fn(),
            getType: vi.fn()
        } as unknown as ExecutionContext;

        mockCallHandler = {
            handle: vi.fn()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('default configuration', () => {
        beforeEach(() => {
            interceptor = new QZPayLoggingInterceptor();
        });

        it('should log successful request and response', async () => {
            const responseData = { id: 'cus_123', email: 'test@example.com' };
            vi.mocked(mockCallHandler.handle).mockReturnValue(of(responseData));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            const result = await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            expect(result).toEqual(responseData);
            expect(logSpy).toHaveBeenCalled();
        });

        it('should log request with sanitized body', async () => {
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('POST /billing/customers - Request started'), expect.any(String));
        });

        it('should log error on request failure', async () => {
            const error = new Error('Database connection failed');
            vi.mocked(mockCallHandler.handle).mockReturnValue(throwError(() => error));

            const errorSpy = vi.spyOn(interceptor.logger, 'error');

            await expect(lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler))).rejects.toThrow(
                'Database connection failed'
            );

            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Database connection failed'), expect.any(String));
        });

        it('should include timing information', async () => {
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'log');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ms'), expect.any(String));
        });

        it('should generate request ID when not provided', async () => {
            mockRequest.headers = { 'user-agent': 'test-agent/1.0' };
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logCall = logSpy.mock.calls[0];
            expect(logCall[0]).toMatch(/\[qzpay-\d+-\w+\]/);
        });

        it('should use provided request ID', async () => {
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logCall = logSpy.mock.calls[0];
            expect(logCall[0]).toContain('[req_123]');
        });
    });

    describe('sensitive data sanitization', () => {
        beforeEach(() => {
            interceptor = new QZPayLoggingInterceptor();
        });

        it('should sanitize sensitive fields in request body', async () => {
            mockRequest.body = {
                email: 'test@example.com',
                cardNumber: '4111111111111111',
                cvv: '123',
                apiKey: 'sk_test_123',
                password: 'secret123'
            };

            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body.cardNumber).toBe('[REDACTED]');
            expect(logData.body.cvv).toBe('[REDACTED]');
            expect(logData.body.apiKey).toBe('[REDACTED]');
            expect(logData.body.password).toBe('[REDACTED]');
            expect(logData.body.email).toBe('test@example.com');
        });

        it('should sanitize nested sensitive fields', async () => {
            mockRequest.body = {
                user: {
                    email: 'test@example.com',
                    password: 'secret123'
                },
                payment: {
                    cardNumber: '4111111111111111',
                    cvv: '123'
                }
            };

            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body.user.password).toBe('[REDACTED]');
            expect(logData.body.payment.cardNumber).toBe('[REDACTED]');
            expect(logData.body.payment.cvv).toBe('[REDACTED]');
            expect(logData.body.user.email).toBe('test@example.com');
        });

        it('should sanitize arrays with sensitive data', async () => {
            mockRequest.body = {
                users: [
                    { email: 'user1@example.com', password: 'pass1' },
                    { email: 'user2@example.com', password: 'pass2' }
                ]
            };

            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body.users[0].password).toBe('[REDACTED]');
            expect(logData.body.users[1].password).toBe('[REDACTED]');
            expect(logData.body.users[0].email).toBe('user1@example.com');
        });

        it('should handle case-insensitive sensitive field names', async () => {
            mockRequest.body = {
                CardNumber: '4111111111111111',
                API_KEY: 'sk_test_123',
                AccessToken: 'token_123'
            };

            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body.CardNumber).toBe('[REDACTED]');
            expect(logData.body.API_KEY).toBe('[REDACTED]');
            expect(logData.body.AccessToken).toBe('[REDACTED]');
        });
    });

    describe('custom configuration', () => {
        it('should not log request body when disabled', async () => {
            interceptor = new QZPayLoggingInterceptor({ logRequestBody: false });
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body).toBeUndefined();
        });

        it('should log response body when enabled', async () => {
            interceptor = new QZPayLoggingInterceptor({ logResponseBody: true });
            const responseData = { id: 'cus_123', email: 'test@example.com' };
            vi.mocked(mockCallHandler.handle).mockReturnValue(of(responseData));

            const logSpy = vi.spyOn(interceptor.logger, 'log');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body).toBeDefined();
            expect(logData.body.id).toBe('cus_123');
        });

        it('should use custom sensitive fields', async () => {
            interceptor = new QZPayLoggingInterceptor({
                sensitiveFields: ['customSecret', 'privateData']
            });

            mockRequest.body = {
                email: 'test@example.com',
                customSecret: 'secret123',
                privateData: 'private123',
                cardNumber: '4111111111111111' // Not in custom list
            };

            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body.customSecret).toBe('[REDACTED]');
            expect(logData.body.privateData).toBe('[REDACTED]');
            expect(logData.body.cardNumber).toBe('4111111111111111'); // Not redacted
        });

        it('should truncate long body fields', async () => {
            interceptor = new QZPayLoggingInterceptor({ maxBodyLength: 10 });

            mockRequest.body = {
                longField: 'This is a very long string that should be truncated'
            };

            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body.longField).toContain('...[truncated]');
            expect(logData.body.longField.length).toBeLessThan(50);
        });

        it('should use custom log levels', async () => {
            interceptor = new QZPayLoggingInterceptor({
                successLogLevel: 'verbose',
                errorLogLevel: 'warn'
            });

            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const verboseSpy = vi.spyOn(interceptor.logger, 'verbose');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            expect(verboseSpy).toHaveBeenCalled();
        });

        it('should not include timing when disabled', async () => {
            interceptor = new QZPayLoggingInterceptor({ includeTiming: false });
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'log');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.duration).toBeUndefined();
        });

        it('should use custom logger name', () => {
            interceptor = new QZPayLoggingInterceptor({ loggerName: 'CustomLogger' });
            expect(interceptor.logger.context).toBe('CustomLogger');
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            interceptor = new QZPayLoggingInterceptor();
        });

        it('should log error details', async () => {
            const error = new Error('Payment processing failed');
            vi.mocked(mockCallHandler.handle).mockReturnValue(throwError(() => error));

            const errorSpy = vi.spyOn(interceptor.logger, 'error');

            await expect(lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler))).rejects.toThrow(
                'Payment processing failed'
            );

            const logData = JSON.parse(errorSpy.mock.calls[0][1] as string);
            expect(logData.errorName).toBe('Error');
            expect(logData.errorMessage).toBe('Payment processing failed');
            expect(logData.status).toBe('error');
        });

        it('should include request body in error logs', async () => {
            const error = new Error('Validation failed');
            vi.mocked(mockCallHandler.handle).mockReturnValue(throwError(() => error));

            const errorSpy = vi.spyOn(interceptor.logger, 'error');

            await expect(lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler))).rejects.toThrow('Validation failed');

            const logData = JSON.parse(errorSpy.mock.calls[0][1] as string);
            expect(logData.requestBody).toBeDefined();
            expect(logData.requestBody.email).toBe('test@example.com');
        });

        it('should sanitize sensitive data in error logs', async () => {
            mockRequest.body = {
                email: 'test@example.com',
                password: 'secret123'
            };

            const error = new Error('Authentication failed');
            vi.mocked(mockCallHandler.handle).mockReturnValue(throwError(() => error));

            const errorSpy = vi.spyOn(interceptor.logger, 'error');

            await expect(lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler))).rejects.toThrow(
                'Authentication failed'
            );

            const logData = JSON.parse(errorSpy.mock.calls[0][1] as string);
            expect(logData.requestBody.password).toBe('[REDACTED]');
            expect(logData.requestBody.email).toBe('test@example.com');
        });
    });

    describe('edge cases', () => {
        beforeEach(() => {
            interceptor = new QZPayLoggingInterceptor();
        });

        it('should handle empty request body', async () => {
            mockRequest.body = {};
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.body).toBeUndefined();
        });

        it('should handle null body', async () => {
            mockRequest.body = null;
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            expect(logSpy).toHaveBeenCalled();
        });

        it('should handle missing user-agent', async () => {
            mockRequest.headers = {};
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.userAgent).toBe('unknown');
        });

        it('should truncate very long user-agent', async () => {
            mockRequest.headers = {
                'user-agent': 'a'.repeat(200)
            };
            vi.mocked(mockCallHandler.handle).mockReturnValue(of({}));

            const logSpy = vi.spyOn(interceptor.logger, 'debug');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            const logData = JSON.parse(logSpy.mock.calls[0][1] as string);
            expect(logData.userAgent).toContain('...');
            expect(logData.userAgent.length).toBeLessThanOrEqual(103);
        });

        it('should handle null response data', async () => {
            vi.mocked(mockCallHandler.handle).mockReturnValue(of(null));

            const logSpy = vi.spyOn(interceptor.logger, 'log');

            await lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler));

            expect(logSpy).toHaveBeenCalled();
        });
    });
});
