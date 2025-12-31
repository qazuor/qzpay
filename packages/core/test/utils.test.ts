import { describe, expect, it } from 'vitest';
import {
    qzpayAddInterval,
    qzpayAddMoney,
    qzpayApplyFixedDiscount,
    qzpayApplyPercentageDiscount,
    qzpayAssert,
    qzpayCalculateProration,
    qzpayCentsToDecimal,
    qzpayCreateValidator,
    qzpayDaysSince,
    qzpayDaysUntil,
    qzpayDecimalToCents,
    qzpayFormatDate,
    qzpayFormatMoney,
    qzpayGenerateCode,
    qzpayGenerateId,
    qzpayIsFuture,
    qzpayIsPast,
    qzpayIsToday,
    qzpayIsValidCurrency,
    qzpayIsValidEmail,
    qzpayMaskEmail,
    qzpayMaskString,
    qzpayPercentageOf,
    qzpaySplitAmount,
    qzpaySubtractInterval
} from '../src/utils/index.js';

describe('date.utils', () => {
    describe('qzpayAddInterval', () => {
        it('should add days', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpayAddInterval(date, 'day', 5);
            expect(result.getDate()).toBe(20);
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
    });

    describe('qzpaySubtractInterval', () => {
        it('should subtract days', () => {
            const date = new Date(2024, 0, 15);
            const result = qzpaySubtractInterval(date, 'day', 5);
            expect(result.getDate()).toBe(10);
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
    });

    describe('qzpayFormatDate', () => {
        it('should format date to ISO string', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            expect(qzpayFormatDate(date)).toBe('2024-01-15');
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
    });

    describe('qzpayMaskString', () => {
        it('should mask string keeping last chars visible', () => {
            expect(qzpayMaskString('1234567890', 4)).toBe('******7890');
        });
    });

    describe('qzpayMaskEmail', () => {
        it('should mask email address', () => {
            const masked = qzpayMaskEmail('john.doe@example.com');
            expect(masked).toContain('@example.com');
            expect(masked).toContain('*');
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
    });

    describe('qzpayIsValidCurrency', () => {
        it('should validate known currencies', () => {
            expect(qzpayIsValidCurrency('USD')).toBe(true);
            expect(qzpayIsValidCurrency('EUR')).toBe(true);
        });

        it('should reject unknown currencies', () => {
            expect(qzpayIsValidCurrency('XXX')).toBe(false);
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
    });
});
