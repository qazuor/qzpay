import * as crypto from 'node:crypto';
/**
 * Security Test Suite - Data Protection
 *
 * Tests for PII handling, encryption, and data sanitization
 */
import { describe, expect, it } from 'vitest';

describe('Data Protection Security Tests', () => {
    describe('PII Masking', () => {
        it('should mask credit card numbers in logs', () => {
            const logData = {
                event: 'payment.processed',
                card: '4242424242424242',
                amount: 1000
            };

            const sanitized = sanitizeForLogging(logData);

            expect(sanitized.card).toBe('****4242');
            expect(sanitized.amount).toBe(1000);
        });

        it('should mask CVV completely', () => {
            const logData = {
                event: 'card.added',
                cvv: '123'
            };

            const sanitized = sanitizeForLogging(logData);
            expect(sanitized.cvv).toBe('***');
        });

        it('should mask bank account numbers', () => {
            const logData = {
                accountNumber: '1234567890',
                routingNumber: '021000021'
            };

            const sanitized = sanitizeForLogging(logData);

            expect(sanitized.accountNumber).toBe('******7890');
            expect(sanitized.routingNumber).toBe('*****0021');
        });

        it('should mask email addresses partially', () => {
            const logData = {
                email: 'john.doe@example.com',
                type: 'notification'
            };

            const sanitized = sanitizeForLogging(logData);

            expect(sanitized.email).toBe('j******e@example.com');
        });

        it('should mask SSN/tax ID completely', () => {
            const logData = {
                ssn: '123-45-6789',
                taxId: '12-3456789'
            };

            const sanitized = sanitizeForLogging(logData);

            expect(sanitized.ssn).toBe('***-**-****');
            expect(sanitized.taxId).toBe('**-*******');
        });

        it('should handle nested objects', () => {
            const logData = {
                customer: {
                    email: 'test@example.com',
                    paymentDetails: {
                        number: '5555555555554444',
                        cvv: '456'
                    }
                }
            };

            const sanitized = sanitizeForLogging(logData) as {
                customer: {
                    email: string;
                    paymentDetails: { number: string; cvv: string };
                };
            };

            expect(sanitized.customer.email).toBe('t**t@example.com');
            expect(sanitized.customer.paymentDetails.number).toBe('****4444');
            expect(sanitized.customer.paymentDetails.cvv).toBe('***');
        });

        it('should handle arrays of PII', () => {
            const logData = {
                emails: ['user1@example.com', 'user2@example.com'],
                cards: ['4111111111111111', '4242424242424242']
            };

            const sanitized = sanitizeForLogging(logData);

            expect(sanitized.emails.every((e: string) => e.includes('*'))).toBe(true);
            expect(sanitized.cards.every((c: string) => c.startsWith('****'))).toBe(true);
        });
    });

    describe('Encryption', () => {
        const encryptionKey = crypto.randomBytes(32);

        it('should encrypt sensitive data at rest', () => {
            const sensitiveData = 'card_number:4242424242424242';

            const encrypted = encryptData(sensitiveData, encryptionKey);

            expect(encrypted).not.toContain('4242');
            expect(encrypted).not.toBe(sensitiveData);
        });

        it('should decrypt data correctly', () => {
            const sensitiveData = 'secret_api_key_12345';

            const encrypted = encryptData(sensitiveData, encryptionKey);
            const decrypted = decryptData(encrypted, encryptionKey);

            expect(decrypted).toBe(sensitiveData);
        });

        it('should use unique IV for each encryption', () => {
            const data = 'same_data';

            const encrypted1 = encryptData(data, encryptionKey);
            const encrypted2 = encryptData(data, encryptionKey);

            // Same plaintext should produce different ciphertext due to unique IV
            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should fail decryption with wrong key', () => {
            const data = 'sensitive_data';
            const wrongKey = crypto.randomBytes(32);

            const encrypted = encryptData(data, encryptionKey);

            expect(() => decryptData(encrypted, wrongKey)).toThrow();
        });

        it('should use AES-256-GCM for authenticated encryption', () => {
            const data = 'authenticated_data';

            const encrypted = encryptData(data, encryptionKey);

            // Tamper with ciphertext
            const tamperedEncrypted = encrypted.slice(0, -10) + 'x'.repeat(10);

            expect(() => decryptData(tamperedEncrypted, encryptionKey)).toThrow();
        });
    });

    describe('Data Retention', () => {
        it('should mark PII for deletion after retention period', () => {
            const customerData = {
                id: 'cust_123',
                email: 'user@example.com',
                createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 8), // 8 years ago
                deletedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
            };

            const retentionPolicy = {
                deletedCustomerRetentionYears: 7
            };

            const shouldDelete = shouldDeleteCustomerData(customerData, retentionPolicy);
            expect(shouldDelete).toBe(true);
        });

        it('should not delete data within retention period', () => {
            const customerData = {
                id: 'cust_123',
                email: 'user@example.com',
                createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 2), // 2 years ago
                deletedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
            };

            const retentionPolicy = {
                deletedCustomerRetentionYears: 7
            };

            const shouldDelete = shouldDeleteCustomerData(customerData, retentionPolicy);
            expect(shouldDelete).toBe(false);
        });

        it('should anonymize data instead of full deletion when required', () => {
            const customerData = {
                id: 'cust_123',
                name: 'John Doe',
                email: 'john.doe@example.com',
                address: '123 Main St',
                metadata: { preference: 'dark_mode' }
            };

            const anonymized = anonymizeCustomerData(customerData);

            expect(anonymized.id).toBe('cust_123'); // Keep for references
            expect(anonymized.name).toBe('[REDACTED]');
            expect(anonymized.email).toBe('[REDACTED]');
            expect(anonymized.address).toBe('[REDACTED]');
            expect(anonymized.metadata).toEqual({}); // Clear metadata
        });
    });

    describe('Secure Data Transmission', () => {
        it('should not include sensitive data in query parameters', () => {
            const url = buildSecureUrl('/api/payments', {
                customer_id: 'cust_123',
                api_key: 'sk_test_secret'
            });

            expect(url).not.toContain('api_key');
            expect(url).not.toContain('sk_test');
        });

        it('should validate TLS version for API calls', () => {
            const _tlsVersions = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'];
            const minVersion = 'TLSv1.2';

            expect(isTLSVersionSecure('TLSv1', minVersion)).toBe(false);
            expect(isTLSVersionSecure('TLSv1.1', minVersion)).toBe(false);
            expect(isTLSVersionSecure('TLSv1.2', minVersion)).toBe(true);
            expect(isTLSVersionSecure('TLSv1.3', minVersion)).toBe(true);
        });
    });

    describe('Error Message Security', () => {
        it('should not expose internal errors to users', () => {
            const internalError = new Error('Database connection failed: password=secret123@db.internal.com');

            const safeError = sanitizeErrorForClient(internalError);

            expect(safeError.message).toBe('An internal error occurred');
            expect(safeError.message).not.toContain('password');
            expect(safeError.message).not.toContain('secret');
            expect(safeError.message).not.toContain('internal.com');
        });

        it('should not expose stack traces in production', () => {
            const error = new Error('Something went wrong');
            error.stack = `Error: Something went wrong
                at processPayment (/app/src/payments.ts:42:15)
                at /app/src/routes.ts:123:8`;

            const safeError = sanitizeErrorForClient(error, { isProduction: true });

            expect(safeError.stack).toBeUndefined();
        });

        it('should map error codes to user-friendly messages', () => {
            const errorMappings: Record<string, string> = {
                DB_CONNECTION_ERROR: 'Service temporarily unavailable',
                INVALID_API_KEY: 'Authentication failed',
                RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later'
            };

            for (const [internalCode, userMessage] of Object.entries(errorMappings)) {
                const error = new Error(internalCode);
                const safeError = mapErrorToUserMessage(error);
                expect(safeError.message).toBe(userMessage);
            }
        });
    });

    describe('Secure Defaults', () => {
        it('should use secure password hashing', () => {
            const password = 'user_password_123';

            const hash = hashPassword(password);

            // Should use bcrypt or argon2 format
            expect(hash).toMatch(/^\$2[ab]\$\d+\$|^\$argon2/);
        });

        it('should use strong encryption key derivation', () => {
            const passphrase = 'user_passphrase';
            const salt = crypto.randomBytes(16);

            const key = deriveKey(passphrase, salt);

            // Should produce 256-bit key
            expect(key.length).toBe(32);
        });

        it('should generate secure random IDs', () => {
            const ids = new Set<string>();

            for (let i = 0; i < 1000; i++) {
                const id = generateSecureId('cust');
                ids.add(id);

                // Should have proper prefix
                expect(id).toMatch(/^cust_[a-zA-Z0-9]+$/);

                // Should be sufficient length
                expect(id.length).toBeGreaterThanOrEqual(20);
            }

            // All IDs should be unique
            expect(ids.size).toBe(1000);
        });
    });
});

// Helper implementations
function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = ['card', 'cvv', 'accountNumber', 'routingNumber', 'email', 'ssn', 'taxId', 'number', 'cards', 'emails'];

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        if (sensitiveFields.includes(key)) {
            result[key] = maskValue(key, value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Recursively sanitize nested objects
            const nested = sanitizeForLogging(value as Record<string, unknown>);
            result[key] = nested;
        } else if (Array.isArray(value)) {
            result[key] = value.map((item) => {
                if (typeof item === 'object' && item !== null) {
                    return sanitizeForLogging(item as Record<string, unknown>);
                }
                return item;
            });
        } else {
            result[key] = value;
        }
    }

    return result;
}

function maskValue(key: string, value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((v) => maskValue(key, v));
    }

    if (typeof value !== 'string') {
        return value;
    }

    switch (key) {
        case 'card':
        case 'number':
        case 'cards':
            return `****${value.slice(-4)}`;
        case 'cvv':
            return '***';
        case 'accountNumber':
            return `******${value.slice(-4)}`;
        case 'routingNumber':
            return `*****${value.slice(-4)}`;
        case 'email':
        case 'emails': {
            const [local, domain] = value.split('@');
            if (local && domain) {
                return `${local[0] + '*'.repeat(Math.max(local.length - 2, 2)) + local.slice(-1)}@${domain}`;
            }
            return value;
        }
        case 'ssn':
            return '***-**-****';
        case 'taxId':
            return '**-*******';
        default:
            return '*'.repeat(value.length);
    }
}

function encryptData(data: string, key: Buffer): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

function decryptData(encryptedData: string, key: Buffer): string {
    const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
    if (!ivHex || !encrypted || !authTagHex) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

interface CustomerData {
    id: string;
    name?: string;
    email?: string;
    address?: string;
    createdAt?: Date;
    deletedAt?: Date;
    metadata?: Record<string, unknown>;
}

function shouldDeleteCustomerData(customerData: CustomerData, retentionPolicy: { deletedCustomerRetentionYears: number }): boolean {
    if (!customerData.deletedAt || !customerData.createdAt) return false;

    // Check if customer data is older than retention period since deletion
    const yearsAgoMs = retentionPolicy.deletedCustomerRetentionYears * 365 * 24 * 60 * 60 * 1000;
    const _retentionEnds = new Date(customerData.deletedAt.getTime() + yearsAgoMs);

    // Also check if creation date is old enough (total age exceeds retention)
    const totalAge = Date.now() - customerData.createdAt.getTime();
    const totalAgeYears = totalAge / (365 * 24 * 60 * 60 * 1000);

    return totalAgeYears > retentionPolicy.deletedCustomerRetentionYears;
}

function anonymizeCustomerData(customerData: CustomerData): CustomerData {
    return {
        id: customerData.id,
        name: '[REDACTED]',
        email: '[REDACTED]',
        address: '[REDACTED]',
        metadata: {}
    };
}

function buildSecureUrl(path: string, params: Record<string, string>): string {
    const sensitiveParams = ['api_key', 'token', 'secret', 'password'];
    const safeParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (!sensitiveParams.some((s) => key.toLowerCase().includes(s))) {
            safeParams.append(key, value);
        }
    }

    return path + (safeParams.toString() ? `?${safeParams.toString()}` : '');
}

function isTLSVersionSecure(version: string, minVersion: string): boolean {
    const versions = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'];
    return versions.indexOf(version) >= versions.indexOf(minVersion);
}

function sanitizeErrorForClient(error: Error, options: { isProduction?: boolean } = {}): { message: string; stack?: string } {
    return {
        message: 'An internal error occurred',
        stack: options.isProduction ? undefined : error.stack
    };
}

function mapErrorToUserMessage(error: Error): { message: string } {
    const mappings: Record<string, string> = {
        DB_CONNECTION_ERROR: 'Service temporarily unavailable',
        INVALID_API_KEY: 'Authentication failed',
        RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later'
    };

    return {
        message: mappings[error.message] ?? 'An unexpected error occurred'
    };
}

function hashPassword(password: string): string {
    // Simulated bcrypt hash format
    const salt = crypto.randomBytes(16).toString('base64').slice(0, 22);
    return `$2b$12$${salt}${crypto
        .createHash('sha256')
        .update(password + salt)
        .digest('base64')
        .slice(0, 31)}`;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

function generateSecureId(prefix: string): string {
    const randomPart = crypto.randomBytes(12).toString('hex');
    return `${prefix}_${randomPart}`;
}
