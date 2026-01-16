/**
 * Sanitization utilities tests
 */
import { describe, expect, it } from 'vitest';
import { QZPayErrorCode, QZPayMercadoPagoError } from '../src/utils/error-mapper.js';
import { sanitizeEmail, sanitizeName, sanitizeOptional, sanitizePhone } from '../src/utils/sanitize.utils.js';

describe('sanitizeEmail', () => {
    describe('when given valid email', () => {
        it('should trim whitespace', () => {
            expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
        });

        it('should convert to lowercase', () => {
            expect(sanitizeEmail('User@Example.COM')).toBe('user@example.com');
        });

        it('should handle both trim and lowercase', () => {
            expect(sanitizeEmail('  User@EXAMPLE.com  ')).toBe('user@example.com');
        });

        it('should handle email with plus addressing', () => {
            expect(sanitizeEmail('user+tag@example.com')).toBe('user+tag@example.com');
        });

        it('should handle email with dots in local part', () => {
            expect(sanitizeEmail('first.last@example.com')).toBe('first.last@example.com');
        });

        it('should handle subdomain', () => {
            expect(sanitizeEmail('user@mail.example.com')).toBe('user@mail.example.com');
        });
    });

    describe('when given invalid email', () => {
        it('should throw error for missing @', () => {
            expect(() => sanitizeEmail('userexample.com')).toThrow(QZPayMercadoPagoError);
            expect(() => sanitizeEmail('userexample.com')).toThrow('Invalid email format');
        });

        it('should throw error for missing domain', () => {
            expect(() => sanitizeEmail('user@')).toThrow(QZPayMercadoPagoError);
        });

        it('should throw error for missing local part', () => {
            expect(() => sanitizeEmail('@example.com')).toThrow(QZPayMercadoPagoError);
        });

        it('should throw error for empty string', () => {
            expect(() => sanitizeEmail('')).toThrow(QZPayMercadoPagoError);
        });

        it('should throw error for whitespace only', () => {
            expect(() => sanitizeEmail('   ')).toThrow(QZPayMercadoPagoError);
        });

        it('should throw INVALID_REQUEST error code', () => {
            try {
                sanitizeEmail('invalid@');
            } catch (error) {
                expect(error).toBeInstanceOf(QZPayMercadoPagoError);
                expect((error as QZPayMercadoPagoError).code).toBe(QZPayErrorCode.INVALID_REQUEST);
            }
        });
    });
});

describe('sanitizeName', () => {
    describe('when given valid name', () => {
        it('should trim leading and trailing whitespace', () => {
            expect(sanitizeName('  John Doe  ')).toBe('John Doe');
        });

        it('should normalize multiple spaces to single space', () => {
            expect(sanitizeName('John   Doe')).toBe('John Doe');
        });

        it('should handle hyphens', () => {
            expect(sanitizeName('Mary-Jane Watson')).toBe('Mary-Jane Watson');
        });

        it('should handle apostrophes', () => {
            expect(sanitizeName("O'Brien")).toBe("O'Brien");
        });

        it('should handle dots (Jr., Sr.)', () => {
            expect(sanitizeName('John Doe Jr.')).toBe('John Doe Jr.');
        });

        it('should handle accented characters', () => {
            expect(sanitizeName('José García')).toBe('José García');
            expect(sanitizeName('François Müller')).toBe('François Müller');
            expect(sanitizeName('Søren Ødegård')).toBe('Søren Ødegård');
        });

        it('should handle Chinese characters', () => {
            expect(sanitizeName('李明')).toBe('李明');
        });

        it('should handle Arabic characters', () => {
            expect(sanitizeName('محمد علي')).toBe('محمد علي');
        });

        it('should handle numbers', () => {
            expect(sanitizeName('Louis XIV')).toBe('Louis XIV');
        });

        it('should handle complex names', () => {
            expect(sanitizeName("John O'Brien-Smith Jr.")).toBe("John O'Brien-Smith Jr.");
        });
    });

    describe('when given dangerous input', () => {
        it('should remove HTML tags', () => {
            expect(sanitizeName('<script>alert("xss")</script>')).toBe('scriptalertxssscript');
        });

        it('should remove control characters', () => {
            expect(sanitizeName('John\x00Doe')).toBe('JohnDoe');
            expect(sanitizeName('John\x1FDoe')).toBe('JohnDoe');
        });

        it('should remove special symbols', () => {
            expect(sanitizeName('John@Doe#Test')).toBe('JohnDoeTest');
        });

        it('should remove SQL injection attempts', () => {
            // Apostrophe is kept (valid in names like O'Brien), semicolons and dashes are removed
            expect(sanitizeName("'; DROP TABLE users; --")).toBe("' DROP TABLE users --");
        });

        it('should handle emoji removal', () => {
            // Emoji is removed, but multiple spaces are normalized to single space
            expect(sanitizeName('John 😀 Doe')).toBe('John Doe');
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            expect(sanitizeName('')).toBe('');
        });

        it('should handle whitespace only', () => {
            expect(sanitizeName('   ')).toBe('');
        });

        it('should handle single character', () => {
            expect(sanitizeName('A')).toBe('A');
        });
    });
});

describe('sanitizePhone', () => {
    describe('when given valid phone', () => {
        it('should remove whitespace', () => {
            expect(sanitizePhone('555 123 4567')).toBe('5551234567');
        });

        it('should remove parentheses', () => {
            expect(sanitizePhone('(555) 123-4567')).toBe('5551234567');
        });

        it('should remove hyphens', () => {
            expect(sanitizePhone('555-123-4567')).toBe('5551234567');
        });

        it('should preserve leading plus sign', () => {
            expect(sanitizePhone('+1 555 123 4567')).toBe('+15551234567');
        });

        it('should handle international format', () => {
            expect(sanitizePhone('+54 9 11 1234-5678')).toBe('+5491112345678');
        });

        it('should handle mixed formatting', () => {
            expect(sanitizePhone('+1 (555) 123-4567')).toBe('+15551234567');
        });

        it('should handle dots', () => {
            expect(sanitizePhone('555.123.4567')).toBe('5551234567');
        });

        it('should handle 7 digit number (minimum)', () => {
            expect(sanitizePhone('1234567')).toBe('1234567');
        });
    });

    describe('when given invalid phone', () => {
        it('should throw error for too short number', () => {
            expect(() => sanitizePhone('123456')).toThrow(QZPayMercadoPagoError);
            expect(() => sanitizePhone('123456')).toThrow('must have at least 7 digits');
        });

        it('should throw error for empty string', () => {
            expect(() => sanitizePhone('')).toThrow(QZPayMercadoPagoError);
        });

        it('should throw error for whitespace only', () => {
            expect(() => sanitizePhone('   ')).toThrow(QZPayMercadoPagoError);
        });

        it('should throw error for non-numeric string', () => {
            expect(() => sanitizePhone('abcdefg')).toThrow(QZPayMercadoPagoError);
        });

        it('should throw INVALID_REQUEST error code', () => {
            try {
                sanitizePhone('123');
            } catch (error) {
                expect(error).toBeInstanceOf(QZPayMercadoPagoError);
                expect((error as QZPayMercadoPagoError).code).toBe(QZPayErrorCode.INVALID_REQUEST);
            }
        });
    });

    describe('edge cases', () => {
        it('should handle plus with whitespace', () => {
            expect(sanitizePhone('  +1234567  ')).toBe('+1234567');
        });

        it('should not add plus if not present', () => {
            expect(sanitizePhone('1234567')).toBe('1234567');
        });

        it('should handle multiple plus signs (keeps digits only)', () => {
            expect(sanitizePhone('+1+234567')).toBe('+1234567');
        });
    });
});

describe('sanitizeOptional', () => {
    describe('when given undefined or null', () => {
        it('should return null for undefined', () => {
            expect(sanitizeOptional(undefined, sanitizeName)).toBeNull();
        });

        it('should return null for null', () => {
            expect(sanitizeOptional(null, sanitizeName)).toBeNull();
        });
    });

    describe('when given empty strings', () => {
        it('should return null for empty string', () => {
            expect(sanitizeOptional('', sanitizeName)).toBeNull();
        });

        it('should return null for whitespace only', () => {
            expect(sanitizeOptional('   ', sanitizeName)).toBeNull();
        });
    });

    describe('when given valid values', () => {
        it('should sanitize and return value', () => {
            expect(sanitizeOptional('  John Doe  ', sanitizeName)).toBe('John Doe');
        });

        it('should work with sanitizeEmail', () => {
            expect(sanitizeOptional('  User@Example.COM  ', sanitizeEmail)).toBe('user@example.com');
        });

        it('should work with sanitizePhone', () => {
            expect(sanitizeOptional('+1 (555) 123-4567', sanitizePhone)).toBe('+15551234567');
        });
    });

    describe('when sanitizer returns empty', () => {
        it('should return null if sanitized value is empty', () => {
            // Create a sanitizer that removes all content
            const removeAll = () => '';
            expect(sanitizeOptional('anything', removeAll)).toBeNull();
        });

        it('should return null if sanitized value is whitespace', () => {
            const toWhitespace = () => '   ';
            expect(sanitizeOptional('anything', toWhitespace)).toBeNull();
        });
    });
});
