/**
 * Security Test Suite - Input Validation
 *
 * Tests for input validation, sanitization, and injection prevention
 */
import { describe, expect, it } from 'vitest';

describe('Input Validation Security Tests', () => {
    describe('SQL Injection Prevention', () => {
        const sqlInjectionPayloads = [
            "'; DROP TABLE customers; --",
            "1' OR '1'='1",
            '1; DELETE FROM subscriptions; --',
            "' UNION SELECT * FROM users --",
            "admin'--",
            "1' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT password FROM users LIMIT 1))) --",
            "' OR 1=1 --",
            "'; EXEC xp_cmdshell('dir'); --",
            "1; WAITFOR DELAY '0:0:10' --",
            "' OR ''='"
        ];

        it.each(sqlInjectionPayloads)('should reject SQL injection payload: %s', (payload) => {
            // Test that payload is sanitized or rejected
            const sanitized = sanitizeInput(payload);

            // Should not contain dangerous SQL keywords in executable positions
            expect(sanitized).not.toMatch(/;\s*(DROP|DELETE|UPDATE|INSERT|EXEC|UNION)/i);
            expect(sanitized).not.toMatch(/--\s*$/);
            expect(sanitized).not.toMatch(/'.*OR.*'.*='/i);
        });

        it('should escape special characters in customer email', () => {
            const maliciousEmail = "test'@example.com; DROP TABLE users;--";
            const sanitized = sanitizeEmail(maliciousEmail);

            expect(sanitized).not.toContain(';');
            expect(sanitized).not.toContain('--');
            expect(sanitized).toMatch(/^[^;-]+@[^;-]+$/);
        });

        it('should prevent NoSQL injection in metadata', () => {
            const maliciousMetadata = {
                $where: 'this.password.length > 0',
                $gt: '',
                $ne: null
            };

            const sanitized = sanitizeMetadata(maliciousMetadata);

            // Should remove MongoDB operators
            expect(sanitized).not.toHaveProperty('$where');
            expect(sanitized).not.toHaveProperty('$gt');
            expect(sanitized).not.toHaveProperty('$ne');
        });
    });

    describe('XSS Prevention', () => {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src="x" onerror="alert(1)">',
            '<svg onload="alert(1)">',
            'javascript:alert(1)',
            '<a href="javascript:alert(1)">click</a>',
            '<body onload="alert(1)">',
            '"><script>alert(String.fromCharCode(88,83,83))</script>',
            '<iframe src="javascript:alert(1)">',
            '<input onfocus="alert(1)" autofocus>',
            '<marquee onstart="alert(1)">'
        ];

        it.each(xssPayloads)('should sanitize XSS payload: %s', (payload) => {
            const sanitized = sanitizeHtml(payload);

            // Should not contain script tags or event handlers
            expect(sanitized).not.toMatch(/<script/i);
            expect(sanitized).not.toMatch(/javascript:/i);
            expect(sanitized).not.toMatch(/on\w+\s*=/i);
            expect(sanitized).not.toMatch(/<iframe/i);
        });

        it('should encode HTML entities in plan names', () => {
            const maliciousPlanName = '<script>steal(document.cookie)</script>';
            const encoded = encodeHtmlEntities(maliciousPlanName);

            expect(encoded).toContain('&lt;');
            expect(encoded).toContain('&gt;');
            expect(encoded).not.toContain('<script>');
        });

        it('should sanitize customer names', () => {
            const maliciousName = 'John<script>alert(1)</script>Doe';
            const sanitized = sanitizeCustomerName(maliciousName);

            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toBe('JohnDoe');
        });
    });

    describe('Command Injection Prevention', () => {
        const cmdInjectionPayloads = [
            '; rm -rf /',
            '| cat /etc/passwd',
            '`whoami`',
            '$(cat /etc/passwd)',
            '&& rm -rf /',
            '|| cat /etc/shadow',
            '\n/bin/sh',
            '%0a/bin/bash'
        ];

        it.each(cmdInjectionPayloads)('should reject command injection: %s', (payload) => {
            const sanitized = sanitizeInput(payload);

            expect(sanitized).not.toMatch(/[;&|`$]/);
            expect(sanitized).not.toMatch(/%0[aAdD]/);
        });
    });

    describe('Path Traversal Prevention', () => {
        const pathTraversalPayloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '....//....//....//etc/passwd',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd',
            '..%252f..%252f..%252fetc/passwd',
            '/var/log/../../../etc/passwd'
        ];

        it.each(pathTraversalPayloads)('should prevent path traversal: %s', (payload) => {
            const sanitized = sanitizePath(payload);

            expect(sanitized).not.toContain('..');
            expect(sanitized).not.toMatch(/%2e/i);
            expect(sanitized).not.toMatch(/\\/);
        });
    });

    describe('Integer Overflow Prevention', () => {
        it('should validate amount is within safe bounds', () => {
            const maxSafeAmount = 99999999999; // $999,999,999.99 in cents
            const overflow = Number.MAX_SAFE_INTEGER + 1;

            expect(validateAmount(maxSafeAmount)).toBe(true);
            expect(validateAmount(overflow)).toBe(false);
            expect(validateAmount(-1)).toBe(false);
            expect(validateAmount(0)).toBe(true);
        });

        it('should reject non-integer amounts', () => {
            expect(validateAmount(10.5)).toBe(false);
            expect(validateAmount(Number.NaN)).toBe(false);
            expect(validateAmount(Number.POSITIVE_INFINITY)).toBe(false);
        });
    });

    describe('Email Validation', () => {
        const invalidEmails = [
            'notanemail',
            '@nodomain.com',
            'no@',
            'spaces in@email.com',
            'multiple@@at.com',
            '<script>@xss.com',
            "admin'--@sql.com"
        ];

        const validEmails = ['user@example.com', 'user.name@example.co.uk', 'user+tag@example.org'];

        it.each(invalidEmails)('should reject invalid email: %s', (email) => {
            expect(validateEmail(email)).toBe(false);
        });

        it.each(validEmails)('should accept valid email: %s', (email) => {
            expect(validateEmail(email)).toBe(true);
        });
    });

    describe('ID Format Validation', () => {
        it('should validate customer ID format', () => {
            expect(validateCustomerId('cust_abc123')).toBe(true);
            expect(validateCustomerId(`cust_${'a'.repeat(100)}`)).toBe(false); // Too long
            expect(validateCustomerId('../../../etc/passwd')).toBe(false);
            expect(validateCustomerId("cust_'; DROP TABLE --")).toBe(false);
        });

        it('should validate subscription ID format', () => {
            expect(validateSubscriptionId('sub_xyz789')).toBe(true);
            expect(validateSubscriptionId('<script>alert(1)</script>')).toBe(false);
        });

        it('should validate UUID format', () => {
            expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
            expect(validateUUID('not-a-uuid')).toBe(false);
            expect(validateUUID('')).toBe(false);
        });
    });

    describe('Currency Validation', () => {
        it('should only accept valid ISO 4217 currency codes', () => {
            expect(validateCurrency('USD')).toBe(true);
            expect(validateCurrency('EUR')).toBe(true);
            expect(validateCurrency('GBP')).toBe(true);
            expect(validateCurrency('FAKE')).toBe(false);
            expect(validateCurrency('US')).toBe(false);
            expect(validateCurrency('<script>')).toBe(false);
        });
    });

    describe('URL Validation', () => {
        it('should validate callback URLs', () => {
            expect(validateCallbackUrl('https://example.com/callback')).toBe(true);
            expect(validateCallbackUrl('http://localhost:3000/webhook')).toBe(true);
            expect(validateCallbackUrl('javascript:alert(1)')).toBe(false);
            expect(validateCallbackUrl('file:///etc/passwd')).toBe(false);
            expect(validateCallbackUrl('ftp://example.com')).toBe(false);
        });

        it('should prevent SSRF in callback URLs', () => {
            // Internal network addresses should be rejected in production
            expect(validateCallbackUrl('http://127.0.0.1/internal')).toBe(false);
            expect(validateCallbackUrl('http://169.254.169.254/metadata')).toBe(false); // AWS metadata
            expect(validateCallbackUrl('http://[::1]/internal')).toBe(false);
            expect(validateCallbackUrl('http://0.0.0.0/internal')).toBe(false);
        });
    });
});

// Helper functions for testing (these would be actual implementations)
function sanitizeInput(input: string): string {
    return input
        .replace(/[;&|`$]/g, '')
        .replace(/%0[aAdD]/gi, '')
        .replace(/--\s*$/g, '')
        .replace(/'\s*(OR|AND)\s*'/gi, '');
}

function sanitizeEmail(email: string): string {
    return email.replace(/[;'"\\-]/g, '').toLowerCase();
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (!key.startsWith('$')) {
            result[key] = value;
        }
    }
    return result;
}

function sanitizeHtml(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+on\w+\s*=[^>]*>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/<iframe[^>]*>/gi, '');
}

function encodeHtmlEntities(str: string): string {
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeCustomerName(name: string): string {
    // Remove HTML tags and their content
    return name
        .replace(/<[^>]*>[^<]*<\/[^>]*>/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '');
}

function sanitizePath(path: string): string {
    return path.replace(/\.\./g, '').replace(/%2e/gi, '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function validateAmount(amount: number): boolean {
    if (!Number.isFinite(amount)) return false;
    if (!Number.isInteger(amount)) return false;
    if (amount < 0) return false;
    if (amount > Number.MAX_SAFE_INTEGER) return false;
    return true;
}

function validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && !email.includes('<') && !email.includes("'");
}

function validateCustomerId(id: string): boolean {
    return /^cust_[a-zA-Z0-9]{1,50}$/.test(id);
}

function validateSubscriptionId(id: string): boolean {
    return /^sub_[a-zA-Z0-9]{1,50}$/.test(id);
}

function validateUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function validateCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN', 'ARS'];
    return validCurrencies.includes(currency.toUpperCase());
}

function validateCallbackUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;

        // Block internal IPs (SSRF prevention) - except localhost in dev/test
        const hostname = parsed.hostname.toLowerCase();
        const isInternalIP =
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
            hostname === '0.0.0.0' ||
            hostname.startsWith('169.254.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname);

        if (isInternalIP) {
            return false;
        }

        // Allow localhost for development/testing
        if (hostname === 'localhost') {
            return true;
        }

        return true;
    } catch {
        return false;
    }
}
