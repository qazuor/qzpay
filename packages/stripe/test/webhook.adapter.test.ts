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
import {
    classifyStripeEvent,
    extract3DSDetails,
    extractDisputeDetails,
    extractFraudWarningDetails,
    extractPendingUpdateDetails,
    isDisputeEvent,
    isFraudWarningEvent,
    isPaymentRequires3DS,
    isPendingUpdateEvent,
    requiresImmediateAction
} from '../src/adapters/webhook.adapter.js';

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

describe('isPaymentRequires3DS', () => {
    it('should return true for payment_intent with requires_action status', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.requires_action',
            data: { id: 'pi_123', status: 'requires_action' },
            created: new Date()
        };
        expect(isPaymentRequires3DS(event)).toBe(true);
    });

    it('should return true for payment_intent with requires_confirmation status', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.created',
            data: { id: 'pi_123', status: 'requires_confirmation' },
            created: new Date()
        };
        expect(isPaymentRequires3DS(event)).toBe(true);
    });

    it('should return true for setup_intent with requires_action status', () => {
        const event = {
            id: 'evt_123',
            type: 'setup_intent.requires_action',
            data: { id: 'seti_123', status: 'requires_action' },
            created: new Date()
        };
        expect(isPaymentRequires3DS(event)).toBe(true);
    });

    it('should return false for payment_intent with succeeded status', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.succeeded',
            data: { id: 'pi_123', status: 'succeeded' },
            created: new Date()
        };
        expect(isPaymentRequires3DS(event)).toBe(false);
    });

    it('should return false for non-payment events', () => {
        const event = {
            id: 'evt_123',
            type: 'customer.created',
            data: { id: 'cus_123', status: 'requires_action' },
            created: new Date()
        };
        expect(isPaymentRequires3DS(event)).toBe(false);
    });
});

describe('extract3DSDetails', () => {
    it('should extract basic 3DS details', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.requires_action',
            data: {
                id: 'pi_123',
                status: 'requires_action',
                client_secret: 'pi_123_secret_456'
            },
            created: new Date()
        };

        const result = extract3DSDetails(event);

        expect(result.status).toBe('required');
        expect(result.paymentIntentId).toBe('pi_123');
        expect(result.clientSecret).toBe('pi_123_secret_456');
    });

    it('should extract next action redirect URL', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.requires_action',
            data: {
                id: 'pi_123',
                status: 'requires_action',
                next_action: {
                    type: 'redirect_to_url',
                    redirect_to_url: {
                        url: 'https://stripe.com/3ds'
                    }
                }
            },
            created: new Date()
        };

        const result = extract3DSDetails(event);

        expect(result.nextActionType).toBe('redirect_to_url');
        expect(result.nextActionUrl).toBe('https://stripe.com/3ds');
    });

    it('should extract use_stripe_sdk authentication flow', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.requires_action',
            data: {
                id: 'pi_123',
                status: 'requires_action',
                next_action: {
                    type: 'use_stripe_sdk',
                    use_stripe_sdk: {
                        type: 'three_d_secure_redirect'
                    }
                }
            },
            created: new Date()
        };

        const result = extract3DSDetails(event);

        expect(result.authenticationFlow).toBe('three_d_secure_redirect');
    });

    it('should extract outcome from charges', () => {
        const event = {
            id: 'evt_123',
            type: 'payment_intent.succeeded',
            data: {
                id: 'pi_123',
                status: 'succeeded',
                charges: {
                    data: [
                        {
                            id: 'ch_123',
                            outcome: {
                                network_status: 'approved_by_network',
                                risk_level: 'normal',
                                risk_score: 25,
                                seller_message: 'Payment complete'
                            }
                        }
                    ]
                }
            },
            created: new Date()
        };

        const result = extract3DSDetails(event);

        expect(result.status).toBe('succeeded');
        expect(result.outcome).toEqual({
            networkStatus: 'approved_by_network',
            riskLevel: 'normal',
            riskScore: 25,
            sellerMessage: 'Payment complete'
        });
    });

    it('should handle all status mappings', () => {
        const statusMappings = [
            { stripeStatus: 'requires_action', expectedStatus: 'required' },
            { stripeStatus: 'requires_confirmation', expectedStatus: 'required' },
            { stripeStatus: 'succeeded', expectedStatus: 'succeeded' },
            { stripeStatus: 'canceled', expectedStatus: 'failed' },
            { stripeStatus: 'requires_payment_method', expectedStatus: 'failed' },
            { stripeStatus: 'processing', expectedStatus: 'processing' },
            { stripeStatus: 'unknown_status', expectedStatus: 'unknown' },
            { stripeStatus: undefined, expectedStatus: 'unknown' }
        ];

        for (const { stripeStatus, expectedStatus } of statusMappings) {
            const event = {
                id: 'evt_123',
                type: 'payment_intent.test',
                data: { id: 'pi_123', status: stripeStatus },
                created: new Date()
            };
            const result = extract3DSDetails(event);
            expect(result.status).toBe(expectedStatus);
        }
    });
});

describe('isDisputeEvent', () => {
    it('should return true for dispute events', () => {
        expect(isDisputeEvent({ id: 'evt_1', type: 'charge.dispute.created', data: {}, created: new Date() })).toBe(true);
        expect(isDisputeEvent({ id: 'evt_1', type: 'charge.dispute.updated', data: {}, created: new Date() })).toBe(true);
        expect(isDisputeEvent({ id: 'evt_1', type: 'charge.dispute.closed', data: {}, created: new Date() })).toBe(true);
    });

    it('should return false for non-dispute events', () => {
        expect(isDisputeEvent({ id: 'evt_1', type: 'charge.succeeded', data: {}, created: new Date() })).toBe(false);
        expect(isDisputeEvent({ id: 'evt_1', type: 'payment_intent.succeeded', data: {}, created: new Date() })).toBe(false);
    });
});

describe('extractDisputeDetails', () => {
    it('should extract dispute details', () => {
        const event = {
            id: 'evt_123',
            type: 'charge.dispute.created',
            data: {
                id: 'dp_123',
                charge: 'ch_456',
                payment_intent: 'pi_789',
                amount: 5000,
                currency: 'usd',
                status: 'needs_response',
                reason: 'fraudulent',
                is_charge_refundable: true,
                has_evidence: false,
                evidence_details: {
                    due_by: 1704067200
                },
                metadata: { order_id: 'ord_123' }
            },
            created: new Date()
        };

        const result = extractDisputeDetails(event);

        expect(result.disputeId).toBe('dp_123');
        expect(result.chargeId).toBe('ch_456');
        expect(result.paymentIntentId).toBe('pi_789');
        expect(result.amount).toBe(5000);
        expect(result.currency).toBe('usd');
        expect(result.status).toBe('needs_response');
        expect(result.reason).toBe('fraudulent');
        expect(result.isChargeRefundable).toBe(true);
        expect(result.hasEvidence).toBe(false);
        expect(result.evidenceDueBy).toEqual(new Date(1704067200 * 1000));
        expect(result.metadata).toEqual({ order_id: 'ord_123' });
    });

    it('should handle missing optional fields', () => {
        const event = {
            id: 'evt_123',
            type: 'charge.dispute.created',
            data: {
                id: 'dp_123',
                charge: 'ch_456'
            },
            created: new Date()
        };

        const result = extractDisputeDetails(event);

        expect(result.disputeId).toBe('dp_123');
        expect(result.chargeId).toBe('ch_456');
        expect(result.paymentIntentId).toBeUndefined();
        expect(result.amount).toBe(0);
        expect(result.evidenceDueBy).toBeUndefined();
        expect(result.metadata).toBeUndefined();
    });
});

describe('isPendingUpdateEvent', () => {
    it('should return true for pending update events', () => {
        expect(
            isPendingUpdateEvent({ id: 'evt_1', type: 'customer.subscription.pending_update_applied', data: {}, created: new Date() })
        ).toBe(true);
        expect(
            isPendingUpdateEvent({ id: 'evt_1', type: 'customer.subscription.pending_update_expired', data: {}, created: new Date() })
        ).toBe(true);
    });

    it('should return false for non-pending-update events', () => {
        expect(isPendingUpdateEvent({ id: 'evt_1', type: 'customer.subscription.created', data: {}, created: new Date() })).toBe(false);
        expect(isPendingUpdateEvent({ id: 'evt_1', type: 'customer.subscription.updated', data: {}, created: new Date() })).toBe(false);
    });
});

describe('extractPendingUpdateDetails', () => {
    it('should extract pending update details', () => {
        const event = {
            id: 'evt_123',
            type: 'customer.subscription.pending_update_applied',
            data: {
                id: 'sub_123',
                pending_update: {
                    expires_at: 1704067200,
                    subscription_items: [{ id: 'si_1', price: 'price_new', quantity: 2 }],
                    billing_cycle_anchor: 1704153600,
                    proration_behavior: 'create_prorations',
                    trial_end: 1704240000
                }
            },
            created: new Date()
        };

        const result = extractPendingUpdateDetails(event);

        expect(result).not.toBeNull();
        expect(result?.subscriptionId).toBe('sub_123');
        expect(result?.expiresAt).toEqual(new Date(1704067200 * 1000));
        expect(result?.subscriptionItems).toEqual([{ id: 'si_1', priceId: 'price_new', quantity: 2 }]);
        expect(result?.billingCycleAnchor).toEqual(new Date(1704153600 * 1000));
        expect(result?.prorationBehavior).toBe('create_prorations');
        expect(result?.trialEnd).toEqual(new Date(1704240000 * 1000));
    });

    it('should return null when no pending update', () => {
        const event = {
            id: 'evt_123',
            type: 'customer.subscription.updated',
            data: {
                id: 'sub_123'
            },
            created: new Date()
        };

        const result = extractPendingUpdateDetails(event);

        expect(result).toBeNull();
    });

    it('should handle partial pending update data', () => {
        const event = {
            id: 'evt_123',
            type: 'customer.subscription.pending_update_applied',
            data: {
                id: 'sub_123',
                pending_update: {}
            },
            created: new Date()
        };

        const result = extractPendingUpdateDetails(event);

        expect(result).not.toBeNull();
        expect(result?.subscriptionId).toBe('sub_123');
        expect(result?.expiresAt).toBeUndefined();
        expect(result?.subscriptionItems).toBeUndefined();
    });
});

describe('isFraudWarningEvent', () => {
    it('should return true for fraud warning events', () => {
        expect(isFraudWarningEvent({ id: 'evt_1', type: 'radar.early_fraud_warning.created', data: {}, created: new Date() })).toBe(true);
        expect(isFraudWarningEvent({ id: 'evt_1', type: 'radar.early_fraud_warning.updated', data: {}, created: new Date() })).toBe(true);
    });

    it('should return false for non-fraud events', () => {
        expect(isFraudWarningEvent({ id: 'evt_1', type: 'charge.succeeded', data: {}, created: new Date() })).toBe(false);
        expect(isFraudWarningEvent({ id: 'evt_1', type: 'payment_intent.succeeded', data: {}, created: new Date() })).toBe(false);
    });
});

describe('extractFraudWarningDetails', () => {
    it('should extract fraud warning details with string charge', () => {
        const created = new Date();
        const event = {
            id: 'evt_123',
            type: 'radar.early_fraud_warning.created',
            data: {
                id: 'issfr_123',
                charge: 'ch_456',
                payment_intent: 'pi_789',
                fraud_type: 'unauthorized_use_of_card',
                actionable: true
            },
            created
        };

        const result = extractFraudWarningDetails(event);

        expect(result.warningId).toBe('issfr_123');
        expect(result.chargeId).toBe('ch_456');
        expect(result.paymentIntentId).toBe('pi_789');
        expect(result.fraudType).toBe('unauthorized_use_of_card');
        expect(result.actionable).toBe(true);
        expect(result.created).toBe(created);
    });

    it('should extract fraud warning details with object charge', () => {
        const event = {
            id: 'evt_123',
            type: 'radar.early_fraud_warning.created',
            data: {
                id: 'issfr_123',
                charge: { id: 'ch_789' },
                fraud_type: 'card_never_received',
                actionable: false
            },
            created: new Date()
        };

        const result = extractFraudWarningDetails(event);

        expect(result.chargeId).toBe('ch_789');
        expect(result.paymentIntentId).toBeUndefined();
    });

    it('should handle missing optional fields', () => {
        const event = {
            id: 'evt_123',
            type: 'radar.early_fraud_warning.created',
            data: {
                id: 'issfr_123'
            },
            created: new Date()
        };

        const result = extractFraudWarningDetails(event);

        expect(result.warningId).toBe('issfr_123');
        expect(result.chargeId).toBe('');
        expect(result.fraudType).toBe('unknown');
        expect(result.actionable).toBe(true);
    });
});
