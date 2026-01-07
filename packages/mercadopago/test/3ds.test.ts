import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { describe, expect, it } from 'vitest';
import {
    extractMP3DSFromPaymentEvent,
    extractMP3DSPaymentInfo,
    getMP3DSChallengeUrl,
    isPaymentEventRequires3DS
} from '../src/adapters/webhook.adapter.js';
import { extractMP3DSResult, isMP3DSRequired, mapQZPayToMP3DSMode } from '../src/types.js';

describe('3D Secure Types', () => {
    describe('isMP3DSRequired', () => {
        it('should return true when pending with pending_challenge', () => {
            expect(isMP3DSRequired('pending', 'pending_challenge')).toBe(true);
        });

        it('should return false for approved payments', () => {
            expect(isMP3DSRequired('approved', 'accredited')).toBe(false);
        });

        it('should return false for other pending statuses', () => {
            expect(isMP3DSRequired('pending', 'pending_contingency')).toBe(false);
        });
    });

    describe('extractMP3DSResult', () => {
        it('should return null for undefined input', () => {
            expect(extractMP3DSResult(undefined)).toBeNull();
        });

        it('should return null for null input', () => {
            expect(extractMP3DSResult(null)).toBeNull();
        });

        it('should extract authenticated status (Y)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'Y',
                version: '2.1.0',
                cavv: 'test-cavv',
                eci: '05',
                xid: 'test-xid'
            });

            expect(result).not.toBeNull();
            expect(result?.status).toBe('authenticated');
            expect(result?.version).toBe('2.1.0');
            expect(result?.cavv).toBe('test-cavv');
        });

        it('should extract authenticated status (A)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'A'
            });

            expect(result?.status).toBe('authenticated');
        });

        it('should extract challenge_required status (C)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'C'
            });

            expect(result?.status).toBe('challenge_required');
        });

        it('should extract failed status (N)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'N'
            });

            expect(result?.status).toBe('failed');
        });

        it('should extract failed status (R)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'R'
            });

            expect(result?.status).toBe('failed');
        });

        it('should extract failed status (U)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'U'
            });

            expect(result?.status).toBe('failed');
        });

        it('should return not_required for unknown status', () => {
            const result = extractMP3DSResult({
                authentication_status: 'X'
            });

            expect(result?.status).toBe('not_required');
        });

        it('should be case insensitive', () => {
            const result = extractMP3DSResult({
                authentication_status: 'y'
            });

            expect(result?.status).toBe('authenticated');
        });
    });

    describe('mapQZPayToMP3DSMode', () => {
        it('should map mandatory mode', () => {
            expect(mapQZPayToMP3DSMode('mandatory')).toBe('mandatory');
        });

        it('should map optional mode', () => {
            expect(mapQZPayToMP3DSMode('optional')).toBe('optional');
        });

        it('should map not_supported mode', () => {
            expect(mapQZPayToMP3DSMode('not_supported')).toBe('not_supported');
        });
    });
});

describe('3D Secure Webhook Helpers', () => {
    const createMockEvent = (data: Record<string, unknown>): QZPayWebhookEvent => ({
        id: 'evt_123',
        type: 'payment.updated',
        data,
        created: new Date()
    });

    describe('extractMP3DSFromPaymentEvent', () => {
        it('should extract 3DS info from event', () => {
            const event = createMockEvent({
                id: 'pay_123',
                three_ds_info: {
                    authentication_status: 'Y',
                    version: '2.1.0'
                }
            });

            const result = extractMP3DSFromPaymentEvent(event);

            expect(result).not.toBeNull();
            expect(result?.status).toBe('authenticated');
        });

        it('should return null when no 3DS info', () => {
            const event = createMockEvent({
                id: 'pay_123'
            });

            const result = extractMP3DSFromPaymentEvent(event);

            expect(result).toBeNull();
        });
    });

    describe('isPaymentEventRequires3DS', () => {
        it('should return true when payment requires 3DS', () => {
            const event = createMockEvent({
                status: 'pending',
                status_detail: 'pending_challenge'
            });

            expect(isPaymentEventRequires3DS(event)).toBe(true);
        });

        it('should return false when payment is approved', () => {
            const event = createMockEvent({
                status: 'approved',
                status_detail: 'accredited'
            });

            expect(isPaymentEventRequires3DS(event)).toBe(false);
        });

        it('should return false when missing status', () => {
            const event = createMockEvent({});

            expect(isPaymentEventRequires3DS(event)).toBe(false);
        });
    });

    describe('getMP3DSChallengeUrl', () => {
        it('should get URL from init_point', () => {
            const event = createMockEvent({
                init_point: 'https://mercadopago.com/challenge'
            });

            expect(getMP3DSChallengeUrl(event)).toBe('https://mercadopago.com/challenge');
        });

        it('should get URL from three_ds_info', () => {
            const event = createMockEvent({
                three_ds_info: {
                    external_resource_url: 'https://3ds.com/challenge'
                }
            });

            expect(getMP3DSChallengeUrl(event)).toBe('https://3ds.com/challenge');
        });

        it('should get URL from point_of_interaction', () => {
            const event = createMockEvent({
                point_of_interaction: {
                    transaction_data: {
                        ticket_url: 'https://ticket.com/challenge'
                    }
                }
            });

            expect(getMP3DSChallengeUrl(event)).toBe('https://ticket.com/challenge');
        });

        it('should return null when no URL available', () => {
            const event = createMockEvent({
                id: 'pay_123'
            });

            expect(getMP3DSChallengeUrl(event)).toBeNull();
        });

        it('should prioritize init_point', () => {
            const event = createMockEvent({
                init_point: 'https://init.com',
                three_ds_info: {
                    external_resource_url: 'https://3ds.com'
                }
            });

            expect(getMP3DSChallengeUrl(event)).toBe('https://init.com');
        });
    });

    describe('extractMP3DSPaymentInfo', () => {
        it('should extract complete payment info', () => {
            const event = createMockEvent({
                id: 'pay_123',
                status: 'pending',
                status_detail: 'pending_challenge',
                init_point: 'https://challenge.com',
                three_ds_info: {
                    authentication_status: 'C',
                    version: '2.1.0'
                }
            });

            const info = extractMP3DSPaymentInfo(event);

            expect(info.paymentId).toBe('pay_123');
            expect(info.status).toBe('pending');
            expect(info.requires3DS).toBe(true);
            expect(info.challengeUrl).toBe('https://challenge.com');
            expect(info.threeDSecure?.status).toBe('challenge_required');
        });

        it('should handle missing data gracefully', () => {
            const event = createMockEvent({});

            const info = extractMP3DSPaymentInfo(event);

            expect(info.paymentId).toBe('');
            expect(info.status).toBe('unknown');
            expect(info.requires3DS).toBe(false);
            expect(info.challengeUrl).toBeNull();
            expect(info.threeDSecure).toBeNull();
        });
    });
});

// ==================== Challenge Flow Tests ====================

describe('3DS Challenge Flow', () => {
    const createMockEvent = (data: Record<string, unknown>): QZPayWebhookEvent => ({
        id: 'evt_123',
        type: 'payment.updated',
        data,
        created: new Date()
    });

    describe('Challenge Initiation', () => {
        it('should detect challenge is required from pending_challenge status', () => {
            const event = createMockEvent({
                id: 'pay_123',
                status: 'pending',
                status_detail: 'pending_challenge',
                three_ds_info: {
                    authentication_status: 'C',
                    version: '2.2.0'
                },
                init_point: 'https://bank.com/3ds/challenge'
            });

            expect(isPaymentEventRequires3DS(event)).toBe(true);
            expect(getMP3DSChallengeUrl(event)).toBe('https://bank.com/3ds/challenge');

            const info = extractMP3DSPaymentInfo(event);
            expect(info.requires3DS).toBe(true);
            expect(info.threeDSecure?.status).toBe('challenge_required');
        });

        it('should handle challenge URL with query parameters', () => {
            const event = createMockEvent({
                init_point: 'https://bank.com/3ds?ref=123&token=abc'
            });

            expect(getMP3DSChallengeUrl(event)).toBe('https://bank.com/3ds?ref=123&token=abc');
        });

        it('should handle challenge URL from external_resource_url', () => {
            const event = createMockEvent({
                three_ds_info: {
                    external_resource_url: 'https://3ds-challenge.mercadopago.com/v1/auth',
                    authentication_status: 'C'
                }
            });

            const url = getMP3DSChallengeUrl(event);
            expect(url).toBe('https://3ds-challenge.mercadopago.com/v1/auth');
        });
    });

    describe('Challenge Completion', () => {
        it('should detect successful authentication after challenge (Y)', () => {
            const event = createMockEvent({
                id: 'pay_123',
                status: 'approved',
                status_detail: 'accredited',
                three_ds_info: {
                    authentication_status: 'Y',
                    version: '2.2.0',
                    cavv: 'AAABBWFlmQAAAABjRWWZEEFgFz0=',
                    eci: '05',
                    xid: 'MDAwMDAwMDAwMDAwMDAwMDAwMTI='
                }
            });

            expect(isPaymentEventRequires3DS(event)).toBe(false);

            const result = extractMP3DSFromPaymentEvent(event);
            expect(result?.status).toBe('authenticated');
            expect(result?.cavv).toBe('AAABBWFlmQAAAABjRWWZEEFgFz0=');
            expect(result?.eci).toBe('05');
            expect(result?.xid).toBe('MDAwMDAwMDAwMDAwMDAwMDAwMTI=');
        });

        it('should detect failed authentication after challenge (N)', () => {
            const event = createMockEvent({
                id: 'pay_123',
                status: 'rejected',
                status_detail: 'cc_rejected_3ds_failed',
                three_ds_info: {
                    authentication_status: 'N',
                    version: '2.2.0'
                }
            });

            const result = extractMP3DSFromPaymentEvent(event);
            expect(result?.status).toBe('failed');
        });
    });
});

// ==================== Frictionless Flow Tests ====================

describe('3DS Frictionless Flow', () => {
    const createMockEvent = (data: Record<string, unknown>): QZPayWebhookEvent => ({
        id: 'evt_123',
        type: 'payment.updated',
        data,
        created: new Date()
    });

    it('should detect frictionless authentication (Y without challenge)', () => {
        const event = createMockEvent({
            id: 'pay_123',
            status: 'approved',
            status_detail: 'accredited',
            three_ds_info: {
                authentication_status: 'Y',
                version: '2.2.0',
                eci: '05'
            }
        });

        // Payment is approved, 3DS not required (already done)
        expect(isPaymentEventRequires3DS(event)).toBe(false);

        const result = extractMP3DSFromPaymentEvent(event);
        expect(result?.status).toBe('authenticated');
    });

    it('should detect attempted authentication (A)', () => {
        const event = createMockEvent({
            id: 'pay_123',
            status: 'approved',
            status_detail: 'accredited',
            three_ds_info: {
                authentication_status: 'A',
                version: '1.0.2',
                eci: '06'
            }
        });

        const result = extractMP3DSFromPaymentEvent(event);
        expect(result?.status).toBe('authenticated');
        expect(result?.eci).toBe('06');
    });

    it('should handle informational only (I)', () => {
        const result = extractMP3DSResult({
            authentication_status: 'I',
            version: '2.2.0'
        });

        expect(result?.status).toBe('not_required');
    });
});

// ==================== Fallback Tests ====================

describe('3DS Fallback Scenarios', () => {
    describe('When 3DS is unavailable', () => {
        it('should detect unavailable authentication (U)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'U',
                version: '2.2.0'
            });

            expect(result?.status).toBe('failed');
        });

        it('should detect rejected authentication (R)', () => {
            const result = extractMP3DSResult({
                authentication_status: 'R',
                version: '2.2.0'
            });

            expect(result?.status).toBe('failed');
        });
    });

    describe('Fallback to non-3DS', () => {
        it('should handle payment without 3DS info', () => {
            const createMockEvent = (data: Record<string, unknown>): QZPayWebhookEvent => ({
                id: 'evt_123',
                type: 'payment.updated',
                data,
                created: new Date()
            });

            const event = createMockEvent({
                id: 'pay_123',
                status: 'approved',
                status_detail: 'accredited'
                // No three_ds_info
            });

            const result = extractMP3DSFromPaymentEvent(event);
            expect(result).toBeNull();

            // Payment can still be processed
            expect(event.data.status).toBe('approved');
        });
    });
});

// ==================== Error Cases ====================

describe('3DS Error Cases', () => {
    describe('extractMP3DSResult edge cases', () => {
        it('should handle empty object', () => {
            const result = extractMP3DSResult({});
            // No authentication_status means we don't know the status
            expect(result?.status).toBe('not_required');
        });

        it('should handle malformed three_ds_info', () => {
            const result = extractMP3DSResult({
                authentication_status: '',
                version: ''
            });

            expect(result?.status).toBe('not_required');
        });

        it('should throw on numeric authentication_status', () => {
            expect(() =>
                extractMP3DSResult({
                    authentication_status: 1 as unknown as string
                })
            ).toThrow();
        });
    });

    describe('Timeout scenarios', () => {
        it('should handle timeout during challenge (status remains pending)', () => {
            const createMockEvent = (data: Record<string, unknown>): QZPayWebhookEvent => ({
                id: 'evt_123',
                type: 'payment.updated',
                data,
                created: new Date()
            });

            const event = createMockEvent({
                id: 'pay_123',
                status: 'pending',
                status_detail: 'pending_challenge',
                three_ds_info: {
                    authentication_status: 'C'
                }
            });

            // Still waiting for challenge
            expect(isPaymentEventRequires3DS(event)).toBe(true);
        });
    });
});

// ==================== ECI Code Tests ====================

describe('ECI (Electronic Commerce Indicator) Codes', () => {
    it('should preserve ECI 05 (authenticated)', () => {
        const result = extractMP3DSResult({
            authentication_status: 'Y',
            eci: '05'
        });

        expect(result?.eci).toBe('05');
    });

    it('should preserve ECI 06 (attempted)', () => {
        const result = extractMP3DSResult({
            authentication_status: 'A',
            eci: '06'
        });

        expect(result?.eci).toBe('06');
    });

    it('should preserve ECI 07 (non-3DS)', () => {
        const result = extractMP3DSResult({
            authentication_status: 'Y',
            eci: '07'
        });

        expect(result?.eci).toBe('07');
    });
});

// ==================== Version Tests ====================

describe('3DS Version Handling', () => {
    it('should handle 3DS 1.0', () => {
        const result = extractMP3DSResult({
            authentication_status: 'Y',
            version: '1.0.2'
        });

        expect(result?.version).toBe('1.0.2');
    });

    it('should handle 3DS 2.1', () => {
        const result = extractMP3DSResult({
            authentication_status: 'Y',
            version: '2.1.0'
        });

        expect(result?.version).toBe('2.1.0');
    });

    it('should handle 3DS 2.2', () => {
        const result = extractMP3DSResult({
            authentication_status: 'Y',
            version: '2.2.0'
        });

        expect(result?.version).toBe('2.2.0');
    });

    it('should handle missing version', () => {
        const result = extractMP3DSResult({
            authentication_status: 'Y'
        });

        expect(result?.version).toBeUndefined();
    });
});

// ==================== Bank/Issuer Scenario Tests ====================

describe('Bank/Issuer Specific Scenarios', () => {
    const createMockEvent = (data: Record<string, unknown>): QZPayWebhookEvent => ({
        id: 'evt_123',
        type: 'payment.updated',
        data,
        created: new Date()
    });

    describe('Visa', () => {
        it('should handle Visa Secure (authenticated)', () => {
            const event = createMockEvent({
                id: 'pay_123',
                status: 'approved',
                three_ds_info: {
                    authentication_status: 'Y',
                    version: '2.2.0',
                    eci: '05',
                    cavv: 'VisaCAVV=='
                }
            });

            const result = extractMP3DSFromPaymentEvent(event);
            expect(result?.status).toBe('authenticated');
            expect(result?.cavv).toBe('VisaCAVV==');
        });
    });

    describe('Mastercard', () => {
        it('should handle Mastercard SecureCode (authenticated)', () => {
            const event = createMockEvent({
                id: 'pay_123',
                status: 'approved',
                three_ds_info: {
                    authentication_status: 'Y',
                    version: '2.2.0',
                    eci: '02', // Mastercard uses different ECI
                    cavv: 'MasterCAVV=='
                }
            });

            const result = extractMP3DSFromPaymentEvent(event);
            expect(result?.status).toBe('authenticated');
        });
    });

    describe('American Express', () => {
        it('should handle AMEX SafeKey (authenticated)', () => {
            const event = createMockEvent({
                id: 'pay_123',
                status: 'approved',
                three_ds_info: {
                    authentication_status: 'Y',
                    version: '2.2.0',
                    eci: '05'
                }
            });

            const result = extractMP3DSFromPaymentEvent(event);
            expect(result?.status).toBe('authenticated');
        });
    });
});

// ==================== Complete Flow Tests ====================

describe('Complete 3DS Flow Simulation', () => {
    const createMockEvent = (data: Record<string, unknown>): QZPayWebhookEvent => ({
        id: 'evt_123',
        type: 'payment.updated',
        data,
        created: new Date()
    });

    it('should handle complete challenge flow: pending → challenged → approved', () => {
        // Step 1: Initial payment requires challenge
        const step1Event = createMockEvent({
            id: 'pay_123',
            status: 'pending',
            status_detail: 'pending_challenge',
            three_ds_info: { authentication_status: 'C' },
            init_point: 'https://bank.com/3ds'
        });

        expect(isPaymentEventRequires3DS(step1Event)).toBe(true);
        expect(getMP3DSChallengeUrl(step1Event)).toBe('https://bank.com/3ds');

        // Step 2: User completes challenge successfully
        const step2Event = createMockEvent({
            id: 'pay_123',
            status: 'approved',
            status_detail: 'accredited',
            three_ds_info: {
                authentication_status: 'Y',
                version: '2.2.0',
                eci: '05',
                cavv: 'auth_completed'
            }
        });

        expect(isPaymentEventRequires3DS(step2Event)).toBe(false);
        const result = extractMP3DSFromPaymentEvent(step2Event);
        expect(result?.status).toBe('authenticated');
    });

    it('should handle complete challenge flow: pending → challenged → failed', () => {
        // Step 1: Initial payment requires challenge
        const step1Event = createMockEvent({
            id: 'pay_456',
            status: 'pending',
            status_detail: 'pending_challenge',
            three_ds_info: { authentication_status: 'C' }
        });

        expect(isPaymentEventRequires3DS(step1Event)).toBe(true);

        // Step 2: User fails challenge or cancels
        const step2Event = createMockEvent({
            id: 'pay_456',
            status: 'rejected',
            status_detail: 'cc_rejected_3ds_failed',
            three_ds_info: {
                authentication_status: 'N'
            }
        });

        const result = extractMP3DSFromPaymentEvent(step2Event);
        expect(result?.status).toBe('failed');
    });

    it('should handle frictionless approval', () => {
        // Single step - no challenge needed, approved immediately
        const event = createMockEvent({
            id: 'pay_789',
            status: 'approved',
            status_detail: 'accredited',
            three_ds_info: {
                authentication_status: 'Y',
                version: '2.2.0',
                eci: '05',
                cavv: 'frictionless_cavv'
            }
        });

        expect(isPaymentEventRequires3DS(event)).toBe(false);

        const result = extractMP3DSFromPaymentEvent(event);
        expect(result?.status).toBe('authenticated');
    });
});
