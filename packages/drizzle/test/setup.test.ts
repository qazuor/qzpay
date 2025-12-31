/**
 * Drizzle package setup tests
 */
import { describe, expect, it } from 'vitest';
import { QZPAY_DRIZZLE_SCHEMA_VERSION } from '../src/schema/index.js';

describe('QZPay Drizzle Package', () => {
    it('should export schema version', () => {
        expect(QZPAY_DRIZZLE_SCHEMA_VERSION).toBe('0.0.1');
    });

    it('should be properly configured', () => {
        // Placeholder test to verify package setup
        expect(true).toBe(true);
    });
});
