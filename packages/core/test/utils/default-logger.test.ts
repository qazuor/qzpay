/**
 * Tests for the default logger implementation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLogger, noopLogger } from '../../src/utils/default-logger.js';

describe('Default Logger', () => {
    let consoleSpy: {
        debug: ReturnType<typeof vi.spyOn>;
        info: ReturnType<typeof vi.spyOn>;
        warn: ReturnType<typeof vi.spyOn>;
        error: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
        consoleSpy = {
            debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
            info: vi.spyOn(console, 'info').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {})
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createDefaultLogger', () => {
        it('should create a logger with default configuration', () => {
            const logger = createDefaultLogger();

            expect(logger).toHaveProperty('debug');
            expect(logger).toHaveProperty('info');
            expect(logger).toHaveProperty('warn');
            expect(logger).toHaveProperty('error');
        });

        it('should log info messages by default', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.info('Test message');

            expect(consoleSpy.info).toHaveBeenCalledTimes(1);
            expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('Test message'));
        });

        it('should not log debug messages by default (level is info)', () => {
            const logger = createDefaultLogger({ colorize: false });

            logger.debug('Debug message');

            expect(consoleSpy.debug).not.toHaveBeenCalled();
        });

        it('should log debug messages when level is set to debug', () => {
            const logger = createDefaultLogger({ level: 'debug', colorize: false, timestamps: false });

            logger.debug('Debug message');

            expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
        });

        it('should log warn messages', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.warn('Warning message');

            expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
        });

        it('should log error messages', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.error('Error message');

            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
            expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Error message'));
        });

        it('should include metadata in log messages', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.info('Test message', { customerId: 'cus_123', operation: 'create' });

            expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('cus_123'));
            expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('create'));
        });

        it('should format Error objects in metadata', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });
            const testError = new Error('Test error');

            logger.error('Operation failed', { error: testError });

            expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
        });

        it('should include [QZPay] prefix in messages', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.info('Test message');

            expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[QZPay]'));
        });

        it('should include timestamps when enabled', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: true });

            logger.info('Test message');

            // ISO timestamp pattern
            expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/));
        });

        it('should not include timestamps when disabled', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.info('Test message');

            // Should not match ISO timestamp pattern at the start
            const call = consoleSpy.info.mock.calls[0]?.[0] as string;
            expect(call).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('Log level filtering', () => {
        it('should only log messages at or above the configured level', () => {
            const warnLogger = createDefaultLogger({ level: 'warn', colorize: false });

            warnLogger.debug('Debug');
            warnLogger.info('Info');
            warnLogger.warn('Warn');
            warnLogger.error('Error');

            expect(consoleSpy.debug).not.toHaveBeenCalled();
            expect(consoleSpy.info).not.toHaveBeenCalled();
            expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
        });

        it('should log all levels when set to debug', () => {
            const debugLogger = createDefaultLogger({ level: 'debug', colorize: false });

            debugLogger.debug('Debug');
            debugLogger.info('Info');
            debugLogger.warn('Warn');
            debugLogger.error('Error');

            expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
            expect(consoleSpy.info).toHaveBeenCalledTimes(1);
            expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
        });

        it('should only log errors when set to error level', () => {
            const errorLogger = createDefaultLogger({ level: 'error', colorize: false });

            errorLogger.debug('Debug');
            errorLogger.info('Info');
            errorLogger.warn('Warn');
            errorLogger.error('Error');

            expect(consoleSpy.debug).not.toHaveBeenCalled();
            expect(consoleSpy.info).not.toHaveBeenCalled();
            expect(consoleSpy.warn).not.toHaveBeenCalled();
            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
        });
    });

    describe('noopLogger', () => {
        it('should have all log methods', () => {
            expect(noopLogger).toHaveProperty('debug');
            expect(noopLogger).toHaveProperty('info');
            expect(noopLogger).toHaveProperty('warn');
            expect(noopLogger).toHaveProperty('error');
        });

        it('should not log anything', () => {
            noopLogger.debug('Debug');
            noopLogger.info('Info');
            noopLogger.warn('Warn');
            noopLogger.error('Error');

            expect(consoleSpy.debug).not.toHaveBeenCalled();
            expect(consoleSpy.info).not.toHaveBeenCalled();
            expect(consoleSpy.warn).not.toHaveBeenCalled();
            expect(consoleSpy.error).not.toHaveBeenCalled();
        });
    });

    describe('Metadata handling', () => {
        it('should handle empty metadata', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.info('Test message', {});

            expect(consoleSpy.info).toHaveBeenCalledTimes(1);
        });

        it('should handle undefined metadata', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.info('Test message', undefined);

            expect(consoleSpy.info).toHaveBeenCalledTimes(1);
        });

        it('should handle complex nested metadata', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.info('Test message', {
                customerId: 'cus_123',
                nested: { deep: { value: 42 } }
            });

            expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('cus_123'));
        });

        it('should handle non-Error errors in metadata', () => {
            const logger = createDefaultLogger({ colorize: false, timestamps: false });

            logger.error('Failed', { error: 'string error' });

            expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
        });
    });
});
