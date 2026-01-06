/**
 * Stripe Webhook Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayStripeWebhookAdapter, extractStripeEventData, mapStripeEventToQZPayEvent } from '../src/adapters/webhook.adapter.js';
import { createMockStripeClient, createMockStripeEvent } from './helpers/stripe-mocks.js';

describe('QZPayStripeWebhookAdapter', () => {
    let adapter: QZPayStripeWebhookAdapter;
    let mockStripe: ReturnType<typeof createMockStripeClient>;
    const webhookSecret = 'whsec_test123';

    beforeEach(() => {
        mockStripe = createMockStripeClient();
        adapter = new QZPayStripeWebhookAdapter(mockStripe, webhookSecret);
        vi.clearAllMocks();
    });

    describe('constructEvent', () => {
        it('should construct and return a webhook event', () => {
            const mockEvent = createMockStripeEvent('customer.created', { id: 'cus_123' });
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const result = adapter.constructEvent('payload', 'signature');

            expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith('payload', 'signature', webhookSecret);
            expect(result).toEqual({
                id: 'evt_test123',
                type: 'customer.created',
                data: expect.objectContaining({ id: 'cus_123' }),
                created: expect.any(Date)
            });
        });

        it('should handle buffer payload', () => {
            const mockEvent = createMockStripeEvent('payment_intent.succeeded');
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const buffer = Buffer.from('payload');
            adapter.constructEvent(buffer, 'signature');

            expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(buffer, 'signature', webhookSecret);
        });
    });

    describe('verifySignature', () => {
        it('should return true for valid signature', () => {
            const mockEvent = createMockStripeEvent('invoice.paid');
            vi.mocked(mockStripe.webhooks.constructEvent).mockReturnValue(mockEvent);

            const result = adapter.verifySignature('payload', 'valid_signature');

            expect(result).toBe(true);
        });

        it('should return false for invalid signature', () => {
            vi.mocked(mockStripe.webhooks.constructEvent).mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const result = adapter.verifySignature('payload', 'invalid_signature');

            expect(result).toBe(false);
        });
    });
});

describe('mapStripeEventToQZPayEvent', () => {
    describe('customer events', () => {
        it('should map customer.created', () => {
            expect(mapStripeEventToQZPayEvent('customer.created')).toBe('customer.created');
        });

        it('should map customer.updated', () => {
            expect(mapStripeEventToQZPayEvent('customer.updated')).toBe('customer.updated');
        });

        it('should map customer.deleted', () => {
            expect(mapStripeEventToQZPayEvent('customer.deleted')).toBe('customer.deleted');
        });
    });

    describe('subscription events', () => {
        it('should map customer.subscription.created', () => {
            expect(mapStripeEventToQZPayEvent('customer.subscription.created')).toBe('subscription.created');
        });

        it('should map customer.subscription.updated', () => {
            expect(mapStripeEventToQZPayEvent('customer.subscription.updated')).toBe('subscription.updated');
        });

        it('should map customer.subscription.deleted', () => {
            expect(mapStripeEventToQZPayEvent('customer.subscription.deleted')).toBe('subscription.canceled');
        });

        it('should map customer.subscription.paused', () => {
            expect(mapStripeEventToQZPayEvent('customer.subscription.paused')).toBe('subscription.paused');
        });

        it('should map customer.subscription.resumed', () => {
            expect(mapStripeEventToQZPayEvent('customer.subscription.resumed')).toBe('subscription.resumed');
        });

        it('should map customer.subscription.trial_will_end', () => {
            expect(mapStripeEventToQZPayEvent('customer.subscription.trial_will_end')).toBe('subscription.trial_ending');
        });
    });

    describe('invoice events', () => {
        it('should map invoice.created', () => {
            expect(mapStripeEventToQZPayEvent('invoice.created')).toBe('invoice.created');
        });

        it('should map invoice.finalized', () => {
            expect(mapStripeEventToQZPayEvent('invoice.finalized')).toBe('invoice.finalized');
        });

        it('should map invoice.paid', () => {
            expect(mapStripeEventToQZPayEvent('invoice.paid')).toBe('invoice.paid');
        });

        it('should map invoice.payment_failed', () => {
            expect(mapStripeEventToQZPayEvent('invoice.payment_failed')).toBe('invoice.payment_failed');
        });

        it('should map invoice.payment_action_required', () => {
            expect(mapStripeEventToQZPayEvent('invoice.payment_action_required')).toBe('invoice.payment_action_required');
        });

        it('should map invoice.voided', () => {
            expect(mapStripeEventToQZPayEvent('invoice.voided')).toBe('invoice.voided');
        });
    });

    describe('payment events', () => {
        it('should map payment_intent.succeeded', () => {
            expect(mapStripeEventToQZPayEvent('payment_intent.succeeded')).toBe('payment.succeeded');
        });

        it('should map payment_intent.payment_failed', () => {
            expect(mapStripeEventToQZPayEvent('payment_intent.payment_failed')).toBe('payment.failed');
        });

        it('should map payment_intent.canceled', () => {
            expect(mapStripeEventToQZPayEvent('payment_intent.canceled')).toBe('payment.canceled');
        });

        it('should map payment_intent.requires_action', () => {
            expect(mapStripeEventToQZPayEvent('payment_intent.requires_action')).toBe('payment.requires_action');
        });
    });

    describe('refund events', () => {
        it('should map charge.refunded', () => {
            expect(mapStripeEventToQZPayEvent('charge.refunded')).toBe('refund.created');
        });

        it('should map charge.refund.updated', () => {
            expect(mapStripeEventToQZPayEvent('charge.refund.updated')).toBe('refund.updated');
        });
    });

    describe('checkout events', () => {
        it('should map checkout.session.completed', () => {
            expect(mapStripeEventToQZPayEvent('checkout.session.completed')).toBe('checkout.completed');
        });

        it('should map checkout.session.expired', () => {
            expect(mapStripeEventToQZPayEvent('checkout.session.expired')).toBe('checkout.expired');
        });

        it('should map checkout.session.async_payment_succeeded', () => {
            expect(mapStripeEventToQZPayEvent('checkout.session.async_payment_succeeded')).toBe('checkout.async_payment_succeeded');
        });

        it('should map checkout.session.async_payment_failed', () => {
            expect(mapStripeEventToQZPayEvent('checkout.session.async_payment_failed')).toBe('checkout.async_payment_failed');
        });
    });

    describe('payment method events', () => {
        it('should map payment_method.attached', () => {
            expect(mapStripeEventToQZPayEvent('payment_method.attached')).toBe('payment_method.attached');
        });

        it('should map payment_method.detached', () => {
            expect(mapStripeEventToQZPayEvent('payment_method.detached')).toBe('payment_method.detached');
        });

        it('should map payment_method.updated', () => {
            expect(mapStripeEventToQZPayEvent('payment_method.updated')).toBe('payment_method.updated');
        });
    });

    describe('connect events', () => {
        it('should map account.updated', () => {
            expect(mapStripeEventToQZPayEvent('account.updated')).toBe('vendor.updated');
        });

        it('should map payout.paid', () => {
            expect(mapStripeEventToQZPayEvent('payout.paid')).toBe('payout.paid');
        });

        it('should map payout.failed', () => {
            expect(mapStripeEventToQZPayEvent('payout.failed')).toBe('payout.failed');
        });
    });

    describe('unknown events', () => {
        it('should return null for unknown event type', () => {
            expect(mapStripeEventToQZPayEvent('unknown.event.type')).toBeNull();
        });
    });
});

describe('extractStripeEventData', () => {
    it('should extract entity type and id', () => {
        const event = {
            id: 'evt_123',
            type: 'customer.created',
            data: { id: 'cus_123' },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.entityType).toBe('customer');
        expect(result.entityId).toBe('cus_123');
    });

    it('should extract customer ID from string', () => {
        const event = {
            id: 'evt_123',
            type: 'invoice.paid',
            data: { id: 'in_123', customer: 'cus_456' },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.customerId).toBe('cus_456');
    });

    it('should extract customer ID from object', () => {
        const event = {
            id: 'evt_123',
            type: 'invoice.paid',
            data: { id: 'in_123', customer: { id: 'cus_789' } },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.customerId).toBe('cus_789');
    });

    it('should extract subscription ID from string', () => {
        const event = {
            id: 'evt_123',
            type: 'invoice.paid',
            data: { id: 'in_123', subscription: 'sub_456' },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.subscriptionId).toBe('sub_456');
    });

    it('should extract subscription ID from object', () => {
        const event = {
            id: 'evt_123',
            type: 'invoice.paid',
            data: { id: 'in_123', subscription: { id: 'sub_789' } },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.subscriptionId).toBe('sub_789');
    });

    it('should extract invoice ID from string', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.succeeded',
            data: { id: 'pi_123', invoice: 'in_456' },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.invoiceId).toBe('in_456');
    });

    it('should extract invoice ID from object', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.succeeded',
            data: { id: 'pi_123', invoice: { id: 'in_789' } },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.invoiceId).toBe('in_789');
    });

    it('should extract payment intent ID from string', () => {
        const event = {
            id: 'evt_123',
            type: 'invoice.payment_failed',
            data: { id: 'in_123', payment_intent: 'pi_456' },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.paymentIntentId).toBe('pi_456');
    });

    it('should extract payment intent ID from object', () => {
        const event = {
            id: 'evt_123',
            type: 'invoice.payment_failed',
            data: { id: 'in_123', payment_intent: { id: 'pi_789' } },
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.paymentIntentId).toBe('pi_789');
    });

    it('should handle missing data fields', () => {
        const event = {
            id: 'evt_123',
            type: 'unknown.event',
            data: {},
            created: new Date()
        };

        const result = extractStripeEventData(event);

        expect(result.entityId).toBe('');
        expect(result.customerId).toBeUndefined();
        expect(result.subscriptionId).toBeUndefined();
        expect(result.invoiceId).toBeUndefined();
        expect(result.paymentIntentId).toBeUndefined();
    });
});

// Import the helper functions for testing
import { classifyStripeEvent, requiresImmediateAction } from '../src/adapters/webhook.adapter.js';

describe('classifyStripeEvent', () => {
    it('should classify subscription events', () => {
        expect(classifyStripeEvent('customer.subscription.created')).toBe('subscription');
        expect(classifyStripeEvent('customer.subscription.updated')).toBe('subscription');
        expect(classifyStripeEvent('customer.subscription.deleted')).toBe('subscription');
    });

    it('should classify customer events', () => {
        expect(classifyStripeEvent('customer.created')).toBe('customer');
        expect(classifyStripeEvent('customer.updated')).toBe('customer');
        expect(classifyStripeEvent('customer.deleted')).toBe('customer');
    });

    it('should classify invoice events', () => {
        expect(classifyStripeEvent('invoice.created')).toBe('invoice');
        expect(classifyStripeEvent('invoice.paid')).toBe('invoice');
        expect(classifyStripeEvent('invoice.finalized')).toBe('invoice');
    });

    it('should classify payment events', () => {
        expect(classifyStripeEvent('payment_intent.created')).toBe('payment');
        expect(classifyStripeEvent('payment_intent.succeeded')).toBe('payment');
        expect(classifyStripeEvent('charge.succeeded')).toBe('payment');
        expect(classifyStripeEvent('charge.failed')).toBe('payment');
    });

    it('should classify dispute events', () => {
        expect(classifyStripeEvent('charge.dispute.created')).toBe('dispute');
        expect(classifyStripeEvent('charge.dispute.updated')).toBe('dispute');
    });

    it('should classify refund events', () => {
        expect(classifyStripeEvent('charge.refunded')).toBe('refund');
        expect(classifyStripeEvent('charge.refund.updated')).toBe('refund');
    });

    it('should classify checkout events', () => {
        expect(classifyStripeEvent('checkout.session.completed')).toBe('checkout');
        expect(classifyStripeEvent('checkout.session.expired')).toBe('checkout');
    });

    it('should classify vendor events', () => {
        expect(classifyStripeEvent('account.updated')).toBe('vendor');
        expect(classifyStripeEvent('payout.created')).toBe('vendor');
        expect(classifyStripeEvent('transfer.created')).toBe('vendor');
    });

    it('should classify fraud events', () => {
        expect(classifyStripeEvent('radar.early_fraud_warning.created')).toBe('fraud');
    });

    it('should classify billing portal events', () => {
        expect(classifyStripeEvent('billing_portal.session.created')).toBe('billing_portal');
    });

    it('should classify other events', () => {
        expect(classifyStripeEvent('unknown.event')).toBe('other');
        expect(classifyStripeEvent('product.created')).toBe('other');
    });
});

describe('requiresImmediateAction', () => {
    it('should return true for urgent events', () => {
        const urgentTypes = [
            'payment_intent.requires_action',
            'setup_intent.requires_action',
            'invoice.payment_action_required',
            'charge.dispute.created',
            'radar.early_fraud_warning.created',
            'invoice.payment_failed'
        ];

        for (const type of urgentTypes) {
            const event = { type, data: {}, created: new Date() };
            expect(requiresImmediateAction(event)).toBe(true);
        }
    });

    it('should return false for non-urgent events', () => {
        const nonUrgentTypes = ['customer.created', 'invoice.paid', 'payment_intent.succeeded', 'customer.subscription.created'];

        for (const type of nonUrgentTypes) {
            const event = { type, data: {}, created: new Date() };
            expect(requiresImmediateAction(event)).toBe(false);
        }
    });
});
