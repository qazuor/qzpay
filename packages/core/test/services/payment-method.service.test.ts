/**
 * Tests for payment method service helpers
 */
import { describe, expect, it } from 'vitest';
import type { QZPayCardDetails, QZPayPaymentMethod } from '../../src/index.js';
import {
    qzpayCheckPaymentMethodExpiration,
    qzpayFilterActivePaymentMethods,
    qzpayGetCardBrandIcon,
    qzpayGetCardExpirationDate,
    qzpayGetCardExpirationDisplay,
    qzpayGetDaysUntilCardExpiration,
    qzpayGetExpiringPaymentMethods,
    qzpayGetPaymentMethodDisplayLabel,
    qzpayGetPaymentMethodTypeDisplay,
    qzpayIsCardExpired,
    qzpayPaymentMethodCanBeDeleted,
    qzpayPaymentMethodIsActive,
    qzpayPaymentMethodIsDefault,
    qzpayPaymentMethodIsExpired,
    qzpayPaymentMethodIsValid,
    qzpayShouldSendExpirationWarning,
    qzpaySortPaymentMethods,
    qzpayValidateBillingDetails
} from '../../src/index.js';

// ==================== Test Fixtures ====================

function createCard(overrides: Partial<QZPayCardDetails> = {}): QZPayCardDetails {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    return {
        brand: 'visa',
        last4: '4242',
        expMonth: futureDate.getMonth() + 1,
        expYear: futureDate.getFullYear(),
        fingerprint: 'fp_123',
        funding: 'credit',
        ...overrides
    };
}

function createPaymentMethod(overrides: Partial<QZPayPaymentMethod> = {}): QZPayPaymentMethod {
    return {
        id: 'pm_123',
        customerId: 'cus_123',
        type: 'card',
        card: createCard(),
        bankAccount: null,
        billingDetails: {
            name: 'John Doe',
            email: 'john@example.com'
        },
        isDefault: false,
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

// ==================== Card Expiration Tests ====================

describe('Card Expiration', () => {
    describe('qzpayGetCardExpirationDate', () => {
        it('should get expiration date for card', () => {
            const card = createCard({ expMonth: 12, expYear: 2025 });
            const expirationDate = qzpayGetCardExpirationDate(card);

            expect(expirationDate.getFullYear()).toBe(2025);
            expect(expirationDate.getMonth()).toBe(11); // December is month 11
            expect(expirationDate.getDate()).toBe(31);
        });

        it('should set time to end of day', () => {
            const card = createCard({ expMonth: 12, expYear: 2025 });
            const expirationDate = qzpayGetCardExpirationDate(card);

            expect(expirationDate.getHours()).toBe(23);
            expect(expirationDate.getMinutes()).toBe(59);
        });
    });

    describe('qzpayIsCardExpired', () => {
        it('should return false for future expiration', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 2);

            const card = createCard({
                expMonth: futureDate.getMonth() + 1,
                expYear: futureDate.getFullYear()
            });

            expect(qzpayIsCardExpired(card)).toBe(false);
        });

        it('should return true for past expiration', () => {
            const card = createCard({ expMonth: 1, expYear: 2020 });
            expect(qzpayIsCardExpired(card)).toBe(true);
        });

        it('should handle current month expiration correctly', () => {
            const now = new Date();
            const card = createCard({
                expMonth: now.getMonth() + 1,
                expYear: now.getFullYear()
            });

            // Card expires at end of month, so should not be expired yet
            if (now.getDate() < 28) {
                expect(qzpayIsCardExpired(card)).toBe(false);
            }
        });
    });

    describe('qzpayGetDaysUntilCardExpiration', () => {
        it('should calculate days until expiration', () => {
            const now = new Date('2024-01-01T00:00:00Z');
            const card = createCard({ expMonth: 12, expYear: 2024 });

            const days = qzpayGetDaysUntilCardExpiration(card, now);
            expect(days).toBeGreaterThan(300);
            expect(days).toBeLessThan(370);
        });

        it('should return negative days for expired card', () => {
            // Use a fixed "now" date that is after the card expiration
            const now = new Date('2027-03-01T00:00:00Z');
            const card = createCard({ expMonth: 12, expYear: 2026 });

            const days = qzpayGetDaysUntilCardExpiration(card, now);
            expect(days).toBeLessThan(0);
        });
    });

    describe('qzpayCheckPaymentMethodExpiration', () => {
        it('should check card payment method expiration', () => {
            // Card expiring in December 2027, checked from mid-November 2027
            // Dec 31 - Nov 15 = ~46 days, within 60 day warning
            const card = createCard({ expMonth: 12, expYear: 2027 });
            const pm = createPaymentMethod({ card });

            const now = new Date('2027-11-15T00:00:00Z');
            const check = qzpayCheckPaymentMethodExpiration(pm, [60], now);

            expect(check.isExpired).toBe(false);
            expect(check.isExpiringSoon).toBe(true);
            expect(check.daysUntilExpiration).toBeGreaterThan(0);
        });

        it('should handle non-card payment methods', () => {
            const pm = createPaymentMethod({
                type: 'bank_account',
                card: null,
                bankAccount: {
                    accountHolderName: 'John Doe',
                    accountHolderType: 'individual',
                    bankName: 'Test Bank',
                    last4: '1234',
                    routingNumber: '110000000'
                }
            });

            const check = qzpayCheckPaymentMethodExpiration(pm);

            expect(check.isExpired).toBe(false);
            expect(check.isExpiringSoon).toBe(false);
            expect(check.daysUntilExpiration).toBeNull();
        });
    });

    describe('qzpayShouldSendExpirationWarning', () => {
        it('should send warning at configured days', () => {
            expect(qzpayShouldSendExpirationWarning(30, [30, 7, 1], [])).toBe(true);
            expect(qzpayShouldSendExpirationWarning(7, [30, 7, 1], [])).toBe(true);
        });

        it('should not resend warnings', () => {
            expect(qzpayShouldSendExpirationWarning(30, [30, 7, 1], [30])).toBe(false);
        });

        it('should not send at non-configured days', () => {
            expect(qzpayShouldSendExpirationWarning(15, [30, 7, 1], [])).toBe(false);
        });
    });
});

// ==================== Payment Method Status Tests ====================

describe('Payment Method Status', () => {
    describe('qzpayPaymentMethodIsActive', () => {
        it('should return true for active payment method', () => {
            const pm = createPaymentMethod({ status: 'active' });
            expect(qzpayPaymentMethodIsActive(pm)).toBe(true);
        });

        it('should return false for inactive payment method', () => {
            const pm = createPaymentMethod({ status: 'expired' });
            expect(qzpayPaymentMethodIsActive(pm)).toBe(false);
        });
    });

    describe('qzpayPaymentMethodIsDefault', () => {
        it('should return true for default payment method', () => {
            const pm = createPaymentMethod({ isDefault: true });
            expect(qzpayPaymentMethodIsDefault(pm)).toBe(true);
        });
    });

    describe('qzpayPaymentMethodIsExpired', () => {
        it('should return true for expired payment method', () => {
            const pm = createPaymentMethod({ status: 'expired' });
            expect(qzpayPaymentMethodIsExpired(pm)).toBe(true);
        });
    });

    describe('qzpayPaymentMethodIsValid', () => {
        it('should return true for active payment method', () => {
            const pm = createPaymentMethod({ status: 'active' });
            expect(qzpayPaymentMethodIsValid(pm)).toBe(true);
        });
    });
});

// ==================== Deletion Tests ====================

describe('Payment Method Deletion', () => {
    describe('qzpayPaymentMethodCanBeDeleted', () => {
        it('should allow deleting non-default payment method', () => {
            const pm = createPaymentMethod({ isDefault: false });
            const result = qzpayPaymentMethodCanBeDeleted(pm, [], false);

            expect(result.canDelete).toBe(true);
        });

        it('should prevent deleting only payment method with active subscriptions', () => {
            const pm = createPaymentMethod({ isDefault: true });
            const result = qzpayPaymentMethodCanBeDeleted(pm, [], true);

            expect(result.canDelete).toBe(false);
            expect(result.error).toContain('only payment method');
        });

        it('should prevent deleting default without setting another', () => {
            const pm = createPaymentMethod({ isDefault: true });
            const others = [createPaymentMethod({ id: 'pm_456' })];
            const result = qzpayPaymentMethodCanBeDeleted(pm, others, false);

            expect(result.canDelete).toBe(false);
            expect(result.error).toContain('Set another payment method as default');
        });

        it('should allow deleting default if no subscriptions and no others', () => {
            const pm = createPaymentMethod({ isDefault: true });
            const result = qzpayPaymentMethodCanBeDeleted(pm, [], false);

            expect(result.canDelete).toBe(true);
        });
    });
});

// ==================== Display Tests ====================

describe('Payment Method Display', () => {
    describe('qzpayGetPaymentMethodTypeDisplay', () => {
        it('should return display name for card', () => {
            expect(qzpayGetPaymentMethodTypeDisplay('card')).toBe('Credit/Debit Card');
        });

        it('should return display name for bank account', () => {
            expect(qzpayGetPaymentMethodTypeDisplay('bank_account')).toBe('Bank Account');
        });

        it('should return display name for SEPA', () => {
            expect(qzpayGetPaymentMethodTypeDisplay('sepa_debit')).toBe('SEPA Direct Debit');
        });
    });

    describe('qzpayGetPaymentMethodDisplayLabel', () => {
        it('should format card display label', () => {
            const card = createCard({ brand: 'visa', last4: '4242' });
            const pm = createPaymentMethod({ card });

            const label = qzpayGetPaymentMethodDisplayLabel(pm);

            expect(label).toContain('Visa');
            expect(label).toContain('4242');
        });

        it('should format bank account display label', () => {
            const pm = createPaymentMethod({
                type: 'bank_account',
                card: null,
                bankAccount: {
                    accountHolderName: 'John Doe',
                    accountHolderType: 'individual',
                    bankName: 'Chase',
                    last4: '1234',
                    routingNumber: '110000000'
                }
            });

            const label = qzpayGetPaymentMethodDisplayLabel(pm);

            expect(label).toContain('Chase');
            expect(label).toContain('1234');
        });

        it('should handle null bank name', () => {
            const pm = createPaymentMethod({
                type: 'bank_account',
                card: null,
                bankAccount: {
                    accountHolderName: 'John Doe',
                    accountHolderType: 'individual',
                    bankName: null,
                    last4: '1234',
                    routingNumber: '110000000'
                }
            });

            const label = qzpayGetPaymentMethodDisplayLabel(pm);

            expect(label).toContain('Bank');
            expect(label).toContain('1234');
        });
    });

    describe('qzpayGetCardExpirationDisplay', () => {
        it('should format expiration as MM/YY', () => {
            const card = createCard({ expMonth: 12, expYear: 2025 });
            const display = qzpayGetCardExpirationDisplay(card);

            expect(display).toBe('12/25');
        });

        it('should zero-pad month', () => {
            const card = createCard({ expMonth: 3, expYear: 2025 });
            const display = qzpayGetCardExpirationDisplay(card);

            expect(display).toBe('03/25');
        });
    });

    describe('qzpayGetCardBrandIcon', () => {
        it('should return icon for known brands', () => {
            expect(qzpayGetCardBrandIcon(createCard({ brand: 'visa' }))).toBe('visa');
            expect(qzpayGetCardBrandIcon(createCard({ brand: 'mastercard' }))).toBe('mastercard');
            expect(qzpayGetCardBrandIcon(createCard({ brand: 'amex' }))).toBe('amex');
        });

        it('should return default icon for unknown brand', () => {
            expect(qzpayGetCardBrandIcon(createCard({ brand: 'unknown_brand' as 'visa' }))).toBe('credit-card');
        });
    });
});

// ==================== Validation Tests ====================

describe('Payment Method Validation', () => {
    describe('qzpayValidateBillingDetails', () => {
        it('should validate correct billing details', () => {
            const result = qzpayValidateBillingDetails({
                name: 'John Doe',
                email: 'john@example.com'
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject invalid email', () => {
            const result = qzpayValidateBillingDetails({
                name: 'John Doe',
                email: 'not-an-email'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid email format');
        });

        it('should allow missing email', () => {
            const result = qzpayValidateBillingDetails({
                name: 'John Doe',
                email: null
            });

            expect(result.valid).toBe(true);
        });
    });
});

// ==================== Filter and Sort Tests ====================

describe('Payment Method Filtering and Sorting', () => {
    describe('qzpaySortPaymentMethods', () => {
        it('should sort default first', () => {
            const pms = [
                createPaymentMethod({ id: 'pm_1', isDefault: false }),
                createPaymentMethod({ id: 'pm_2', isDefault: true }),
                createPaymentMethod({ id: 'pm_3', isDefault: false })
            ];

            const sorted = qzpaySortPaymentMethods(pms);

            expect(sorted[0]?.id).toBe('pm_2');
        });

        it('should sort by creation date for non-default', () => {
            const old = new Date('2024-01-01');
            const newer = new Date('2024-02-01');

            const pms = [createPaymentMethod({ id: 'pm_1', createdAt: old }), createPaymentMethod({ id: 'pm_2', createdAt: newer })];

            const sorted = qzpaySortPaymentMethods(pms);

            // Newest first
            expect(sorted[0]?.id).toBe('pm_2');
        });
    });

    describe('qzpayFilterActivePaymentMethods', () => {
        it('should filter active payment methods', () => {
            const pms = [
                createPaymentMethod({ status: 'active' }),
                createPaymentMethod({ status: 'expired' }),
                createPaymentMethod({ status: 'active' })
            ];

            const active = qzpayFilterActivePaymentMethods(pms);

            expect(active).toHaveLength(2);
            expect(active.every((pm) => pm.status === 'active')).toBe(true);
        });
    });

    describe('qzpayGetExpiringPaymentMethods', () => {
        it('should find expiring payment methods', () => {
            // Use future dates for deterministic testing
            // Card expires Dec 31, 2027 (end of month 12)
            // Now is Nov 15, 2027 - gives ~46 days until expiration
            const now = new Date('2027-11-15T00:00:00Z');

            const pms = [
                createPaymentMethod({ card: createCard({ expMonth: 12, expYear: 2027 }) }), // Expires soon (within 60 days)
                createPaymentMethod({ card: createCard({ expMonth: 12, expYear: 2029 }) }), // Not expiring (2 years away)
                createPaymentMethod({
                    type: 'bank_account',
                    card: null,
                    bankAccount: {
                        accountHolderName: 'John Doe',
                        accountHolderType: 'individual',
                        bankName: 'Test',
                        last4: '1234',
                        routingNumber: '110000000'
                    }
                }) // No expiration
            ];

            const expiring = qzpayGetExpiringPaymentMethods(pms, 60, now);

            expect(expiring).toHaveLength(1);
        });
    });
});
