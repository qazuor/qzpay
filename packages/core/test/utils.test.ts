import { describe, expect, it } from 'vitest';
import { qzpayIsValidIso4217Currency } from '../src/constants/currency.js';
import {
    QZPAY_METADATA_LIMITS,
    qzpayAddInterval,
    qzpayAddMoney,
    qzpayApplyFixedDiscount,
    qzpayApplyPercentageDiscount,
    qzpayAssert,
    qzpayAssertDefined,
    qzpayAssertValidMetadata,
    qzpayCalculateProration,
    qzpayCentsToDecimal,
    qzpayCreateIdempotencyHash,
    qzpayCreateValidator,
    qzpayDaysSince,
    qzpayDaysUntil,
    qzpayDecimalToCents,
    qzpayEndOfPeriod,
    qzpayFormatDate,
    qzpayFormatDateTime,
    qzpayFormatMoney,
    qzpayGenerateCode,
    qzpayGenerateId,
    qzpayGenerateSecureToken,
    qzpayHashString,
    qzpayIsFuture,
    qzpayIsNonNegativeAmount,
    qzpayIsNonNegativeInteger,
    qzpayIsPast,
    qzpayIsPositiveAmount,
    qzpayIsPositiveInteger,
    qzpayIsRequiredString,
    qzpayIsToday,
    qzpayIsValidCurrency,
    qzpayIsValidEmail,
    qzpayIsValidPercentage,
    qzpayIsValidUuid,
    qzpayMaskString,
    qzpayParseDate,
    qzpayPercentageOf,
    qzpaySplitAmount,
    qzpayStartOfPeriod,
    qzpaySubtractInterval,
    qzpayValidateRequired
} from '../src/utils/index.js';

describe('date.utils', () => {
    describe('qzpayAddInterval', () => {
        it('should add days', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpayAddInterval(date, 'day', 5);
            expect(result.getDate()).toBe(20);
        });

        it('should add weeks', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpayAddInterval(date, 'week', 2);
            expect(result.getDate()).toBe(29);
        });

        it('should add months', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpayAddInterval(date, 'month', 2);
            expect(result.getMonth()).toBe(2);
        });

        it('should add years', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpayAddInterval(date, 'year', 1);
            expect(result.getFullYear()).toBe(2025);
        });

        it('should use default count of 1', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpayAddInterval(date, 'day');
            expect(result.getDate()).toBe(16);
        });

        it('should not mutate original date', () => {
            const date = new Date(2024, 0, 15);
            qzpayAddInterval(date, 'day', 5);
            expect(date.getDate()).toBe(15);
        });
    });

    describe('qzpaySubtractInterval', () => {
        it('should subtract days', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpaySubtractInterval(date, 'day', 5);
            expect(result.getDate()).toBe(10);
        });

        it('should subtract weeks', () => {
            const date = new Date(2024, 0, 22);
            const result = qzpaySubtractInterval(date, 'week', 1);
            expect(result.getDate()).toBe(15);
        });

        it('should subtract months', () => {
            const date = new Date(2024, 2, 15);
            const result = qzpaySubtractInterval(date, 'month', 2);
            expect(result.getMonth()).toBe(0);
        });

        it('should subtract years', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpaySubtractInterval(date, 'year', 1);
            expect(result.getFullYear()).toBe(2023);
        });
    });

    describe('qzpayStartOfPeriod', () => {
        it('should get start of day', () => {
            const date = new Date(2024, 0, 15, 14, 30, 45);
            const result = qzpayStartOfPeriod(date, 'day');
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getDate()).toBe(15);
        });

        it('should get start of week (Sunday)', () => {
            const date = new Date(2024, 0, 17); // Wednesday
            const result = qzpayStartOfPeriod(date, 'week');
            expect(result.getDay()).toBe(0); // Sunday
            expect(result.getDate()).toBe(14);
        });

        it('should get start of month', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpayStartOfPeriod(date, 'month');
            expect(result.getDate()).toBe(1);
        });

        it('should get start of year', () => {
            const date = new Date(2024, 5, 15);
            const result = qzpayStartOfPeriod(date, 'year');
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(1);
        });
    });

    describe('qzpayEndOfPeriod', () => {
        it('should get end of day', () => {
            const date = new Date(2024, 0, 15, 10, 0, 0);
            const result = qzpayEndOfPeriod(date, 'day');
            expect(result.getHours()).toBe(23);
            expect(result.getMinutes()).toBe(59);
            expect(result.getSeconds()).toBe(59);
        });

        it('should get end of week', () => {
            const date = new Date(2024, 0, 17); // Wednesday
            const result = qzpayEndOfPeriod(date, 'week');
            // End of Saturday (day 6)
            expect(result.getDate()).toBe(20);
        });

        it('should get end of month', () => {
            const date = new Date(2024, 0, 15); // January
            const result = qzpayEndOfPeriod(date, 'month');
            expect(result.getDate()).toBe(31);
        });

        it('should get end of year', () => {
            const date = new Date(2024, 5, 15);
            const result = qzpayEndOfPeriod(date, 'year');
            expect(result.getMonth()).toBe(11); // December
            expect(result.getDate()).toBe(31);
        });
    });

    describe('qzpayIsPast/qzpayIsFuture/qzpayIsToday', () => {
        it('should detect past dates', () => {
            const pastDate = new Date('2020-01-01');
            expect(qzpayIsPast(pastDate)).toBe(true);
            expect(qzpayIsFuture(pastDate)).toBe(false);
        });

        it('should detect future dates', () => {
            const futureDate = new Date('2099-01-01');
            expect(qzpayIsFuture(futureDate)).toBe(true);
            expect(qzpayIsPast(futureDate)).toBe(false);
        });

        it('should detect today', () => {
            const today = new Date();
            expect(qzpayIsToday(today)).toBe(true);
        });

        it('should not detect yesterday as today', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(qzpayIsToday(yesterday)).toBe(false);
        });
    });

    describe('qzpayDaysUntil/qzpayDaysSince', () => {
        it('should calculate days until future date', () => {
            const future = new Date();
            future.setDate(future.getDate() + 10);
            expect(qzpayDaysUntil(future)).toBe(10);
        });

        it('should calculate days since past date', () => {
            const past = new Date();
            past.setDate(past.getDate() - 10);
            expect(qzpayDaysSince(past)).toBe(10);
        });

        it('should return 0 for today', () => {
            const today = new Date();
            expect(qzpayDaysUntil(today)).toBe(0);
        });

        it('should return negative for past dates in daysUntil', () => {
            const past = new Date();
            past.setDate(past.getDate() - 5);
            expect(qzpayDaysUntil(past)).toBe(-5);
        });
    });

    describe('qzpayFormatDate', () => {
        it('should format date to ISO string', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            expect(qzpayFormatDate(date)).toBe('2024-01-15');
        });
    });

    describe('qzpayFormatDateTime', () => {
        it('should format date to full ISO string', () => {
            const date = new Date('2024-01-15T12:30:45.000Z');
            expect(qzpayFormatDateTime(date)).toBe('2024-01-15T12:30:45.000Z');
        });
    });

    describe('qzpayParseDate', () => {
        it('should parse valid ISO date string', () => {
            // Use UTC methods since '2024-01-15' is parsed as UTC midnight
            const date = qzpayParseDate('2024-01-15');
            expect(date.getUTCFullYear()).toBe(2024);
            expect(date.getUTCMonth()).toBe(0);
            expect(date.getUTCDate()).toBe(15);
        });

        it('should parse valid ISO datetime string', () => {
            const date = qzpayParseDate('2024-01-15T12:30:00Z');
            expect(date.getUTCFullYear()).toBe(2024);
            expect(date.getUTCMonth()).toBe(0);
            expect(date.getUTCDate()).toBe(15);
            expect(date.getUTCHours()).toBe(12);
            expect(date.getUTCMinutes()).toBe(30);
        });

        it('should throw for invalid date string', () => {
            expect(() => qzpayParseDate('invalid')).toThrow('Invalid date string');
        });

        it('should throw for empty string', () => {
            expect(() => qzpayParseDate('')).toThrow('Invalid date string');
        });
    });
});

describe('money.utils', () => {
    describe('qzpayCentsToDecimal/qzpayDecimalToCents', () => {
        it('should convert cents to decimal', () => {
            expect(qzpayCentsToDecimal(1999, 'USD')).toBe(19.99);
        });

        it('should convert decimal to cents', () => {
            expect(qzpayDecimalToCents(19.99, 'USD')).toBe(1999);
        });

        it('should handle zero decimal currencies', () => {
            expect(qzpayCentsToDecimal(1000, 'CLP')).toBe(1000);
            expect(qzpayDecimalToCents(1000, 'CLP')).toBe(1000);
        });
    });

    describe('qzpayFormatMoney', () => {
        it('should format money with currency symbol', () => {
            const formatted = qzpayFormatMoney(1999, 'USD', 'en-US');
            expect(formatted).toContain('19.99');
        });
    });

    describe('qzpayAddMoney', () => {
        it('should add amounts', () => {
            expect(qzpayAddMoney(1000, 500)).toBe(1500);
        });
    });

    describe('qzpayPercentageOf', () => {
        it('should calculate percentage', () => {
            expect(qzpayPercentageOf(10000, 10)).toBe(1000);
        });
    });

    describe('qzpayApplyPercentageDiscount', () => {
        it('should apply percentage discount', () => {
            expect(qzpayApplyPercentageDiscount(10000, 20)).toBe(8000);
        });
    });

    describe('qzpayApplyFixedDiscount', () => {
        it('should apply fixed discount', () => {
            expect(qzpayApplyFixedDiscount(10000, 2000)).toBe(8000);
        });

        it('should not go below zero', () => {
            expect(qzpayApplyFixedDiscount(1000, 2000)).toBe(0);
        });
    });

    describe('qzpayCalculateProration', () => {
        it('should calculate proration', () => {
            const result = qzpayCalculateProration(3000, 30, 15);
            expect(result).toBe(1500);
        });

        it('should throw error when totalDays is 0', () => {
            expect(() => qzpayCalculateProration(3000, 0, 15)).toThrow(
                'Cannot calculate proration: period has no days (daysInPeriod <= 0)'
            );
        });

        it('should throw error when totalDays is negative', () => {
            expect(() => qzpayCalculateProration(3000, -10, 15)).toThrow(
                'Cannot calculate proration: period has no days (daysInPeriod <= 0)'
            );
        });

        it('should handle zero usedDays', () => {
            const result = qzpayCalculateProration(3000, 30, 0);
            expect(result).toBe(0);
        });

        it('should handle usedDays equal to totalDays', () => {
            const result = qzpayCalculateProration(3000, 30, 30);
            expect(result).toBe(3000);
        });
    });

    describe('qzpaySplitAmount', () => {
        it('should split amount between platform and vendor', () => {
            const { platformFee, vendorAmount } = qzpaySplitAmount(10000, 10);
            expect(platformFee).toBe(1000);
            expect(vendorAmount).toBe(9000);
        });
    });
});

describe('hash.utils', () => {
    describe('qzpayGenerateId', () => {
        it('should generate unique IDs', () => {
            const id1 = qzpayGenerateId();
            const id2 = qzpayGenerateId();
            expect(id1).not.toBe(id2);
        });

        it('should include prefix when provided', () => {
            const id = qzpayGenerateId('cus');
            expect(id.startsWith('cus_')).toBe(true);
        });

        it('should generate ID without prefix', () => {
            const id = qzpayGenerateId();
            expect(id).not.toContain('_');
        });
    });

    describe('qzpayGenerateCode', () => {
        it('should generate code with default length', () => {
            const code = qzpayGenerateCode();
            expect(code.length).toBe(8);
        });

        it('should generate code with custom length', () => {
            const code = qzpayGenerateCode(12);
            expect(code.length).toBe(12);
        });

        it('should only contain uppercase alphanumeric', () => {
            const code = qzpayGenerateCode();
            expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
        });

        it('should generate unique codes', () => {
            const codes = new Set<string>();
            for (let i = 0; i < 50; i++) {
                codes.add(qzpayGenerateCode());
            }
            expect(codes.size).toBe(50);
        });
    });

    describe('qzpayGenerateSecureToken', () => {
        it('should generate token with default length', () => {
            const token = qzpayGenerateSecureToken();
            // 32 bytes = 64 hex characters
            expect(token.length).toBe(64);
        });

        it('should generate token with custom length', () => {
            const token = qzpayGenerateSecureToken(16);
            // 16 bytes = 32 hex characters
            expect(token.length).toBe(32);
        });

        it('should only contain hex characters', () => {
            const token = qzpayGenerateSecureToken();
            expect(/^[0-9a-f]+$/.test(token)).toBe(true);
        });

        it('should generate unique tokens', () => {
            const tokens = new Set<string>();
            for (let i = 0; i < 50; i++) {
                tokens.add(qzpayGenerateSecureToken());
            }
            expect(tokens.size).toBe(50);
        });
    });

    describe('qzpayHashString', () => {
        it('should generate SHA-256 hash', async () => {
            const hash = await qzpayHashString('test input');
            // SHA-256 produces 64 hex characters
            expect(hash.length).toBe(64);
            expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
        });

        it('should produce deterministic output', async () => {
            const hash1 = await qzpayHashString('same input');
            const hash2 = await qzpayHashString('same input');
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different inputs', async () => {
            const hash1 = await qzpayHashString('input1');
            const hash2 = await qzpayHashString('input2');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('qzpayCreateIdempotencyHash', () => {
        it('should create hash from multiple parts', async () => {
            const hash = await qzpayCreateIdempotencyHash('user-123', 'charge', '1000');
            expect(hash.length).toBe(64);
        });

        it('should produce deterministic output', async () => {
            const hash1 = await qzpayCreateIdempotencyHash('a', 'b', 'c');
            const hash2 = await qzpayCreateIdempotencyHash('a', 'b', 'c');
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different parts', async () => {
            const hash1 = await qzpayCreateIdempotencyHash('a', 'b');
            const hash2 = await qzpayCreateIdempotencyHash('a', 'c');
            expect(hash1).not.toBe(hash2);
        });

        it('should handle single part', async () => {
            const hash = await qzpayCreateIdempotencyHash('single');
            expect(hash.length).toBe(64);
        });
    });

    describe('qzpayMaskString', () => {
        it('should mask string keeping last chars visible', () => {
            expect(qzpayMaskString('1234567890', 4)).toBe('******7890');
        });

        it('should mask entire string if shorter than visible chars', () => {
            expect(qzpayMaskString('abc', 4)).toBe('***');
        });

        it('should mask string exactly at visible chars boundary', () => {
            expect(qzpayMaskString('abcd', 4)).toBe('****');
        });

        it('should use default visible chars of 4', () => {
            expect(qzpayMaskString('1234567890')).toBe('******7890');
        });

        it('should handle empty string', () => {
            expect(qzpayMaskString('')).toBe('');
        });
    });
});

describe('validation.utils', () => {
    describe('qzpayIsValidEmail', () => {
        it('should validate correct email', () => {
            expect(qzpayIsValidEmail('test@example.com')).toBe(true);
        });

        it('should reject invalid email', () => {
            expect(qzpayIsValidEmail('invalid')).toBe(false);
            expect(qzpayIsValidEmail('invalid@')).toBe(false);
        });

        it('should validate email with subdomain', () => {
            expect(qzpayIsValidEmail('user@mail.example.com')).toBe(true);
        });

        it('should reject email with spaces', () => {
            expect(qzpayIsValidEmail('test @example.com')).toBe(false);
        });

        it('should validate email with plus addressing', () => {
            expect(qzpayIsValidEmail('user+tag@example.com')).toBe(true);
        });

        it('should validate email with dots in local part', () => {
            expect(qzpayIsValidEmail('first.last@example.com')).toBe(true);
        });

        it('should validate email with numbers', () => {
            expect(qzpayIsValidEmail('user123@example456.com')).toBe(true);
        });

        it('should validate email with hyphens in domain', () => {
            expect(qzpayIsValidEmail('user@my-domain.com')).toBe(true);
        });

        it('should reject email without domain', () => {
            expect(qzpayIsValidEmail('user@')).toBe(false);
        });

        it('should reject email without local part', () => {
            expect(qzpayIsValidEmail('@example.com')).toBe(false);
        });

        it('should reject email with double @', () => {
            expect(qzpayIsValidEmail('user@@example.com')).toBe(false);
        });
    });

    describe('qzpayIsValidCurrency', () => {
        it('should validate known currencies', () => {
            expect(qzpayIsValidCurrency('USD')).toBe(true);
            expect(qzpayIsValidCurrency('EUR')).toBe(true);
        });

        it('should reject unknown currencies', () => {
            expect(qzpayIsValidCurrency('XXX')).toBe(false);
        });

        it('should accept lowercase currencies (case-insensitive)', () => {
            expect(qzpayIsValidCurrency('usd')).toBe(true);
            expect(qzpayIsValidCurrency('eur')).toBe(true);
        });
    });

    describe('qzpayIsValidIso4217Currency', () => {
        it('should validate all ISO 4217 currencies', () => {
            expect(qzpayIsValidIso4217Currency('USD')).toBe(true);
            expect(qzpayIsValidIso4217Currency('EUR')).toBe(true);
            expect(qzpayIsValidIso4217Currency('JPY')).toBe(true);
            expect(qzpayIsValidIso4217Currency('GBP')).toBe(true);
            expect(qzpayIsValidIso4217Currency('CHF')).toBe(true);
        });

        it('should validate Latin American currencies', () => {
            expect(qzpayIsValidIso4217Currency('ARS')).toBe(true);
            expect(qzpayIsValidIso4217Currency('BRL')).toBe(true);
            expect(qzpayIsValidIso4217Currency('MXN')).toBe(true);
            expect(qzpayIsValidIso4217Currency('CLP')).toBe(true);
            expect(qzpayIsValidIso4217Currency('COP')).toBe(true);
        });

        it('should be case-insensitive', () => {
            expect(qzpayIsValidIso4217Currency('usd')).toBe(true);
            expect(qzpayIsValidIso4217Currency('Eur')).toBe(true);
            expect(qzpayIsValidIso4217Currency('jPy')).toBe(true);
        });

        it('should reject invalid currency codes', () => {
            expect(qzpayIsValidIso4217Currency('FAKE')).toBe(false);
            expect(qzpayIsValidIso4217Currency('ABC')).toBe(false);
            expect(qzpayIsValidIso4217Currency('12')).toBe(false);
        });

        it('should validate special ISO codes', () => {
            expect(qzpayIsValidIso4217Currency('XXX')).toBe(true); // No currency
            expect(qzpayIsValidIso4217Currency('XAU')).toBe(true); // Gold
            expect(qzpayIsValidIso4217Currency('XAG')).toBe(true); // Silver
        });
    });

    describe('qzpayIsPositiveInteger', () => {
        it('should return true for positive integers', () => {
            expect(qzpayIsPositiveInteger(1)).toBe(true);
            expect(qzpayIsPositiveInteger(100)).toBe(true);
        });

        it('should return false for zero', () => {
            expect(qzpayIsPositiveInteger(0)).toBe(false);
        });

        it('should return false for negative integers', () => {
            expect(qzpayIsPositiveInteger(-1)).toBe(false);
        });

        it('should return false for floats', () => {
            expect(qzpayIsPositiveInteger(1.5)).toBe(false);
        });
    });

    describe('qzpayIsNonNegativeInteger', () => {
        it('should return true for zero', () => {
            expect(qzpayIsNonNegativeInteger(0)).toBe(true);
        });

        it('should return true for positive integers', () => {
            expect(qzpayIsNonNegativeInteger(1)).toBe(true);
            expect(qzpayIsNonNegativeInteger(100)).toBe(true);
        });

        it('should return false for negative integers', () => {
            expect(qzpayIsNonNegativeInteger(-1)).toBe(false);
        });

        it('should return false for floats', () => {
            expect(qzpayIsNonNegativeInteger(1.5)).toBe(false);
        });
    });

    describe('qzpayIsPositiveAmount', () => {
        it('should return true for positive integers', () => {
            expect(qzpayIsPositiveAmount(1)).toBe(true);
            expect(qzpayIsPositiveAmount(100)).toBe(true);
            expect(qzpayIsPositiveAmount(1000)).toBe(true);
        });

        it('should return true for positive decimals', () => {
            expect(qzpayIsPositiveAmount(0.01)).toBe(true);
            expect(qzpayIsPositiveAmount(19.99)).toBe(true);
            expect(qzpayIsPositiveAmount(100.5)).toBe(true);
        });

        it('should return false for zero', () => {
            expect(qzpayIsPositiveAmount(0)).toBe(false);
        });

        it('should return false for negative amounts', () => {
            expect(qzpayIsPositiveAmount(-1)).toBe(false);
            expect(qzpayIsPositiveAmount(-0.01)).toBe(false);
            expect(qzpayIsPositiveAmount(-100)).toBe(false);
        });

        it('should return false for NaN', () => {
            expect(qzpayIsPositiveAmount(Number.NaN)).toBe(false);
        });

        it('should return false for non-numbers', () => {
            expect(qzpayIsPositiveAmount('100' as unknown as number)).toBe(false);
            expect(qzpayIsPositiveAmount(null as unknown as number)).toBe(false);
            expect(qzpayIsPositiveAmount(undefined as unknown as number)).toBe(false);
        });
    });

    describe('qzpayIsNonNegativeAmount', () => {
        it('should return true for zero', () => {
            expect(qzpayIsNonNegativeAmount(0)).toBe(true);
        });

        it('should return true for positive integers', () => {
            expect(qzpayIsNonNegativeAmount(1)).toBe(true);
            expect(qzpayIsNonNegativeAmount(100)).toBe(true);
        });

        it('should return true for positive decimals', () => {
            expect(qzpayIsNonNegativeAmount(0.01)).toBe(true);
            expect(qzpayIsNonNegativeAmount(19.99)).toBe(true);
        });

        it('should return false for negative amounts', () => {
            expect(qzpayIsNonNegativeAmount(-1)).toBe(false);
            expect(qzpayIsNonNegativeAmount(-0.01)).toBe(false);
            expect(qzpayIsNonNegativeAmount(-100)).toBe(false);
        });

        it('should return false for NaN', () => {
            expect(qzpayIsNonNegativeAmount(Number.NaN)).toBe(false);
        });

        it('should return false for non-numbers', () => {
            expect(qzpayIsNonNegativeAmount('100' as unknown as number)).toBe(false);
        });
    });

    describe('qzpayIsValidPercentage', () => {
        it('should return true for valid percentages', () => {
            expect(qzpayIsValidPercentage(0)).toBe(true);
            expect(qzpayIsValidPercentage(50)).toBe(true);
            expect(qzpayIsValidPercentage(100)).toBe(true);
        });

        it('should return false for negative values', () => {
            expect(qzpayIsValidPercentage(-1)).toBe(false);
        });

        it('should return false for values over 100', () => {
            expect(qzpayIsValidPercentage(101)).toBe(false);
        });

        it('should allow decimal percentages', () => {
            expect(qzpayIsValidPercentage(50.5)).toBe(true);
        });
    });

    describe('qzpayIsValidUuid', () => {
        it('should validate correct UUID v4', () => {
            expect(qzpayIsValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        });

        it('should validate UUID v1', () => {
            expect(qzpayIsValidUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
        });

        it('should reject invalid UUID', () => {
            expect(qzpayIsValidUuid('not-a-uuid')).toBe(false);
            expect(qzpayIsValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
        });

        it('should be case insensitive', () => {
            expect(qzpayIsValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
        });
    });

    describe('qzpayIsRequiredString', () => {
        it('should return true for non-empty string', () => {
            expect(qzpayIsRequiredString('hello')).toBe(true);
        });

        it('should return false for empty string', () => {
            expect(qzpayIsRequiredString('')).toBe(false);
        });

        it('should return false for whitespace-only string', () => {
            expect(qzpayIsRequiredString('   ')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(qzpayIsRequiredString(null)).toBe(false);
            expect(qzpayIsRequiredString(undefined)).toBe(false);
            expect(qzpayIsRequiredString(123)).toBe(false);
        });
    });

    describe('qzpayValidateRequired', () => {
        it('should validate all required fields present', () => {
            const result = qzpayValidateRequired({ name: 'John', email: 'john@test.com' }, ['name', 'email']);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect missing fields', () => {
            const result = qzpayValidateRequired({ name: '' }, ['name', 'email']);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('name is required');
            expect(result.errors).toContain('email is required');
        });

        it('should detect null values', () => {
            const result = qzpayValidateRequired({ name: null }, ['name']);
            expect(result.valid).toBe(false);
        });

        it('should detect undefined values', () => {
            const result = qzpayValidateRequired({}, ['name']);
            expect(result.valid).toBe(false);
        });
    });

    describe('qzpayAssert', () => {
        it('should not throw when condition is true', () => {
            expect(() => qzpayAssert(true, 'error')).not.toThrow();
        });

        it('should throw when condition is false', () => {
            expect(() => qzpayAssert(false, 'error')).toThrow('error');
        });
    });

    describe('qzpayAssertDefined', () => {
        it('should not throw for defined values', () => {
            expect(() => qzpayAssertDefined('value', 'field')).not.toThrow();
            expect(() => qzpayAssertDefined(0, 'field')).not.toThrow();
            expect(() => qzpayAssertDefined('', 'field')).not.toThrow();
        });

        it('should throw for null', () => {
            expect(() => qzpayAssertDefined(null, 'customerId')).toThrow('customerId is required');
        });

        it('should throw for undefined', () => {
            expect(() => qzpayAssertDefined(undefined, 'amount')).toThrow('amount is required');
        });
    });

    describe('qzpayCreateValidator', () => {
        it('should validate required fields', () => {
            const result = qzpayCreateValidator({ name: '', email: 'test@test.com' }).required('name').email('email').validate();

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('name is required');
        });

        it('should validate email format', () => {
            const result = qzpayCreateValidator({ email: 'invalid' }).email('email').validate();

            expect(result.valid).toBe(false);
        });

        it('should pass valid data', () => {
            const result = qzpayCreateValidator({ name: 'John', email: 'john@test.com' }).required('name').email('email').validate();

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate positive integer', () => {
            const result = qzpayCreateValidator({ amount: -5 }).positiveInteger('amount').validate();

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('amount');
        });

        it('should pass valid positive integer', () => {
            const result = qzpayCreateValidator({ amount: 100 }).positiveInteger('amount').validate();

            expect(result.valid).toBe(true);
        });

        it('should validate currency', () => {
            const result = qzpayCreateValidator({ currency: 'INVALID' }).currency('currency').validate();

            expect(result.valid).toBe(false);
        });

        it('should pass valid currency', () => {
            const result = qzpayCreateValidator({ currency: 'USD' }).currency('currency').validate();

            expect(result.valid).toBe(true);
        });

        it('should support custom validation', () => {
            const obj = { age: 15 };
            const result = qzpayCreateValidator(obj)
                .custom(obj.age >= 18, 'Must be 18 or older')
                .validate();

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Must be 18 or older');
        });

        it('should support custom message for required', () => {
            const result = qzpayCreateValidator({ name: '' }).required('name', 'Name cannot be empty').validate();

            expect(result.errors).toContain('Name cannot be empty');
        });

        it('should chain multiple validations', () => {
            const result = qzpayCreateValidator({
                name: '',
                email: 'invalid',
                amount: -1,
                currency: 'XXX'
            })
                .required('name')
                .email('email')
                .positiveInteger('amount')
                .currency('currency')
                .validate();

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBe(4);
        });

        it('should throw on assertValid when invalid', () => {
            expect(() => qzpayCreateValidator({ name: '' }).required('name').assertValid()).toThrow('Validation failed');
        });

        it('should not throw on assertValid when valid', () => {
            expect(() => qzpayCreateValidator({ name: 'John' }).required('name').assertValid()).not.toThrow();
        });

        it('should validate positive amounts', () => {
            const resultInvalid = qzpayCreateValidator({ amount: -100 }).positiveAmount('amount').validate();
            expect(resultInvalid.valid).toBe(false);
            expect(resultInvalid.errors[0]).toContain('amount');

            const resultZero = qzpayCreateValidator({ amount: 0 }).positiveAmount('amount').validate();
            expect(resultZero.valid).toBe(false);

            const resultValid = qzpayCreateValidator({ amount: 100 }).positiveAmount('amount').validate();
            expect(resultValid.valid).toBe(true);

            const resultDecimal = qzpayCreateValidator({ amount: 19.99 }).positiveAmount('amount').validate();
            expect(resultDecimal.valid).toBe(true);
        });

        it('should validate non-negative amounts', () => {
            const resultInvalid = qzpayCreateValidator({ amount: -100 }).nonNegativeAmount('amount').validate();
            expect(resultInvalid.valid).toBe(false);
            expect(resultInvalid.errors[0]).toContain('cannot be negative');

            const resultZero = qzpayCreateValidator({ amount: 0 }).nonNegativeAmount('amount').validate();
            expect(resultZero.valid).toBe(true);

            const resultValid = qzpayCreateValidator({ amount: 100 }).nonNegativeAmount('amount').validate();
            expect(resultValid.valid).toBe(true);
        });

        it('should validate ISO 4217 currency codes', () => {
            const resultValid = qzpayCreateValidator({ currency: 'USD' }).iso4217Currency('currency').validate();
            expect(resultValid.valid).toBe(true);

            const resultValidJpy = qzpayCreateValidator({ currency: 'JPY' }).iso4217Currency('currency').validate();
            expect(resultValidJpy.valid).toBe(true);

            const resultInvalid = qzpayCreateValidator({ currency: 'FAKE' }).iso4217Currency('currency').validate();
            expect(resultInvalid.valid).toBe(false);
            expect(resultInvalid.errors[0]).toContain('ISO 4217');
        });

        it('should support custom messages for amount validations', () => {
            const result = qzpayCreateValidator({ amount: -100 }).positiveAmount('amount', 'Amount cannot be negative or zero').validate();
            expect(result.errors).toContain('Amount cannot be negative or zero');

            const result2 = qzpayCreateValidator({ discount: -10 }).nonNegativeAmount('discount', 'Discount must be positive').validate();
            expect(result2.errors).toContain('Discount must be positive');
        });
    });

    describe('qzpayAssertValidMetadata', () => {
        describe('when given valid metadata', () => {
            it('should accept string values', () => {
                const metadata = qzpayAssertValidMetadata({
                    userId: 'user_123',
                    tier: 'premium'
                });

                expect(metadata).toEqual({
                    userId: 'user_123',
                    tier: 'premium'
                });
            });

            it('should accept number values', () => {
                const metadata = qzpayAssertValidMetadata({
                    count: 42,
                    price: 19.99,
                    zero: 0
                });

                expect(metadata).toEqual({
                    count: 42,
                    price: 19.99,
                    zero: 0
                });
            });

            it('should accept boolean values', () => {
                const metadata = qzpayAssertValidMetadata({
                    isActive: true,
                    hasAccess: false
                });

                expect(metadata).toEqual({
                    isActive: true,
                    hasAccess: false
                });
            });

            it('should accept null values', () => {
                const metadata = qzpayAssertValidMetadata({
                    deletedAt: null,
                    note: null
                });

                expect(metadata).toEqual({
                    deletedAt: null,
                    note: null
                });
            });

            it('should accept mixed primitive types', () => {
                const metadata = qzpayAssertValidMetadata({
                    userId: 'user_123',
                    count: 42,
                    isActive: true,
                    deletedAt: null
                });

                expect(metadata).toEqual({
                    userId: 'user_123',
                    count: 42,
                    isActive: true,
                    deletedAt: null
                });
            });

            it('should accept empty object', () => {
                const metadata = qzpayAssertValidMetadata({});
                expect(metadata).toEqual({});
            });

            it('should accept string at maximum length', () => {
                const longString = 'a'.repeat(QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH);
                const metadata = qzpayAssertValidMetadata({
                    description: longString
                });

                expect(metadata.description).toBe(longString);
            });

            it('should accept metadata with maximum number of keys', () => {
                const maxKeys = Object.fromEntries([...Array(QZPAY_METADATA_LIMITS.MAX_KEYS)].map((_, i) => [`key${i}`, i]));
                const metadata = qzpayAssertValidMetadata(maxKeys);

                expect(Object.keys(metadata).length).toBe(QZPAY_METADATA_LIMITS.MAX_KEYS);
            });

            it('should accept negative numbers', () => {
                const metadata = qzpayAssertValidMetadata({
                    temperature: -10,
                    balance: -99.99
                });

                expect(metadata).toEqual({
                    temperature: -10,
                    balance: -99.99
                });
            });
        });

        describe('when given metadata with undefined values', () => {
            it('should remove undefined values (sanitize)', () => {
                const metadata = qzpayAssertValidMetadata({
                    userId: 'user_123',
                    removedField: undefined
                });

                expect(metadata).toEqual({
                    userId: 'user_123'
                });
                expect(metadata).not.toHaveProperty('removedField');
            });

            it('should remove multiple undefined values', () => {
                const metadata = qzpayAssertValidMetadata({
                    field1: 'value',
                    field2: undefined,
                    field3: 42,
                    field4: undefined
                });

                expect(metadata).toEqual({
                    field1: 'value',
                    field3: 42
                });
            });

            it('should handle all undefined values', () => {
                const metadata = qzpayAssertValidMetadata({
                    field1: undefined,
                    field2: undefined
                });

                expect(metadata).toEqual({});
            });
        });

        describe('when given invalid metadata', () => {
            it('should reject nested objects', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        user: { id: '123', name: 'John' }
                    })
                ).toThrow(TypeError);

                expect(() =>
                    qzpayAssertValidMetadata({
                        user: { id: '123', name: 'John' }
                    })
                ).toThrow(/object is not allowed/);
            });

            it('should reject arrays', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        tags: ['premium', 'active']
                    })
                ).toThrow(TypeError);

                expect(() =>
                    qzpayAssertValidMetadata({
                        tags: ['premium', 'active']
                    })
                ).toThrow(/array is not allowed/);
            });

            it('should reject functions', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        callback: () => console.log('test')
                    })
                ).toThrow(TypeError);

                expect(() =>
                    qzpayAssertValidMetadata({
                        callback: () => console.log('test')
                    })
                ).toThrow(/function is not allowed/);
            });

            it('should reject Symbol values', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        sym: Symbol('test')
                    })
                ).toThrow(TypeError);
            });

            it('should reject Date objects', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        createdAt: new Date()
                    })
                ).toThrow(TypeError);
            });

            it('should reject NaN', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        value: Number.NaN
                    })
                ).toThrow(TypeError);

                expect(() =>
                    qzpayAssertValidMetadata({
                        value: Number.NaN
                    })
                ).toThrow(/cannot be NaN/);
            });

            it('should reject Infinity', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        value: Number.POSITIVE_INFINITY
                    })
                ).toThrow(TypeError);

                expect(() =>
                    qzpayAssertValidMetadata({
                        value: Number.POSITIVE_INFINITY
                    })
                ).toThrow(/cannot be Infinity/);
            });

            it('should reject negative Infinity', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        value: Number.NEGATIVE_INFINITY
                    })
                ).toThrow(TypeError);
            });

            it('should reject null as metadata object', () => {
                expect(() => qzpayAssertValidMetadata(null as unknown as Record<string, unknown>)).toThrow(TypeError);
            });

            it('should reject non-object metadata', () => {
                expect(() => qzpayAssertValidMetadata('not an object' as unknown as Record<string, unknown>)).toThrow(TypeError);
                expect(() => qzpayAssertValidMetadata(123 as unknown as Record<string, unknown>)).toThrow(TypeError);
            });
        });

        describe('when metadata exceeds limits', () => {
            it('should reject metadata with too many keys', () => {
                const tooManyKeys = Object.fromEntries([...Array(QZPAY_METADATA_LIMITS.MAX_KEYS + 1)].map((_, i) => [`key${i}`, i]));

                expect(() => qzpayAssertValidMetadata(tooManyKeys)).toThrow(RangeError);

                expect(() => qzpayAssertValidMetadata(tooManyKeys)).toThrow(
                    new RegExp(`exceeds maximum of ${QZPAY_METADATA_LIMITS.MAX_KEYS} keys`)
                );
            });

            it('should reject string value that is too long', () => {
                const tooLongString = 'a'.repeat(QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH + 1);

                expect(() =>
                    qzpayAssertValidMetadata({
                        description: tooLongString
                    })
                ).toThrow(RangeError);

                expect(() =>
                    qzpayAssertValidMetadata({
                        description: tooLongString
                    })
                ).toThrow(new RegExp(`exceeds maximum length of ${QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH} characters`));
            });

            it('should include current count in error message for too many keys', () => {
                const tooManyKeys = Object.fromEntries([...Array(QZPAY_METADATA_LIMITS.MAX_KEYS + 5)].map((_, i) => [`key${i}`, i]));

                expect(() => qzpayAssertValidMetadata(tooManyKeys)).toThrow(/current: 51/);
            });

            it('should include current length in error message for string too long', () => {
                const length = QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH + 10;
                const tooLongString = 'a'.repeat(length);

                expect(() =>
                    qzpayAssertValidMetadata({
                        description: tooLongString
                    })
                ).toThrow(new RegExp(`current: ${length}`));
            });

            it('should include key name in error messages', () => {
                expect(() =>
                    qzpayAssertValidMetadata({
                        myCustomField: ['array']
                    })
                ).toThrow(/key 'myCustomField'/);

                const tooLong = 'a'.repeat(501);
                expect(() =>
                    qzpayAssertValidMetadata({
                        longDescription: tooLong
                    })
                ).toThrow(/key 'longDescription'/);
            });
        });

        describe('edge cases', () => {
            it('should count keys correctly after removing undefined', () => {
                // 51 keys total, but 2 are undefined, so only 49 valid keys
                const metadata: Record<string, unknown> = Object.fromEntries(
                    [...Array(QZPAY_METADATA_LIMITS.MAX_KEYS - 1)].map((_, i) => [`key${i}`, i])
                );
                metadata.undefinedKey1 = undefined;
                metadata.undefinedKey2 = undefined;

                // Should not throw because undefined values are not counted
                expect(() => qzpayAssertValidMetadata(metadata)).not.toThrow();
            });

            it('should handle empty strings', () => {
                const metadata = qzpayAssertValidMetadata({
                    emptyString: ''
                });

                expect(metadata.emptyString).toBe('');
            });

            it('should handle zero', () => {
                const metadata = qzpayAssertValidMetadata({
                    zero: 0
                });

                expect(metadata.zero).toBe(0);
            });

            it('should handle false', () => {
                const metadata = qzpayAssertValidMetadata({
                    isFalse: false
                });

                expect(metadata.isFalse).toBe(false);
            });

            it('should return a new object (not mutate original)', () => {
                const original = {
                    userId: 'user_123',
                    removedField: undefined
                };

                const sanitized = qzpayAssertValidMetadata(original);

                // Original should still have undefined
                expect(original).toHaveProperty('removedField');
                // Sanitized should not
                expect(sanitized).not.toHaveProperty('removedField');
                // Should be different objects
                expect(sanitized).not.toBe(original);
            });

            it('should handle special string characters', () => {
                const metadata = qzpayAssertValidMetadata({
                    emoji: '🚀',
                    unicode: '你好世界',
                    newlines: 'line1\nline2',
                    tabs: 'col1\tcol2',
                    quotes: 'He said "hello"',
                    backslash: 'path\\to\\file'
                });

                expect(metadata.emoji).toBe('🚀');
                expect(metadata.unicode).toBe('你好世界');
                expect(metadata.newlines).toBe('line1\nline2');
                expect(metadata.tabs).toBe('col1\tcol2');
                expect(metadata.quotes).toBe('He said "hello"');
                expect(metadata.backslash).toBe('path\\to\\file');
            });

            it('should count emoji correctly in string length', () => {
                // Note: Emoji like 🚀 is a surrogate pair (2 chars in JS)
                const emojiLength = '🚀'.length; // This is 2
                const repeatCount = Math.floor(QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH / emojiLength);
                const emoji = '🚀'.repeat(repeatCount);

                const metadata = qzpayAssertValidMetadata({
                    emojis: emoji
                });

                expect(metadata.emojis).toBe(emoji);
                expect(emoji.length).toBeLessThanOrEqual(QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH);

                // Adding one more emoji should exceed the limit
                const tooManyEmojis = `${emoji}🚀`;
                expect(tooManyEmojis.length).toBeGreaterThan(QZPAY_METADATA_LIMITS.MAX_VALUE_LENGTH);

                expect(() =>
                    qzpayAssertValidMetadata({
                        emojis: tooManyEmojis
                    })
                ).toThrow(RangeError);
            });
        });
    });
});
