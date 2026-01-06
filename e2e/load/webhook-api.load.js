/**
 * K6 Load Test - Webhook Processing
 *
 * Tests the performance of webhook ingestion and processing
 *
 * Run with:
 *   k6 run webhook-api.load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { stressTestOptions, randomString } from './k6.config.js';

// Custom metrics
const webhooksReceived = new Counter('webhooks_received');
const webhooksProcessed = new Counter('webhooks_processed');
const webhookErrorRate = new Rate('webhook_errors');
const webhookProcessingTime = new Trend('webhook_processing_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || 'whsec_test_secret';

// Use stress test options for webhook processing
export const options = {
    ...stressTestOptions,
    thresholds: {
        ...stressTestOptions.thresholds,
        webhooks_processed: ['count>200'],
        webhook_processing_time: ['p(95)<200'], // Webhooks should be fast
        webhook_errors: ['rate<0.01']
    }
};

// Webhook event types to simulate
const WEBHOOK_EVENTS = [
    { type: 'payment_intent.succeeded', weight: 40 },
    { type: 'payment_intent.payment_failed', weight: 5 },
    { type: 'customer.subscription.created', weight: 15 },
    { type: 'customer.subscription.updated', weight: 15 },
    { type: 'customer.subscription.deleted', weight: 5 },
    { type: 'invoice.paid', weight: 10 },
    { type: 'invoice.payment_failed', weight: 5 },
    { type: 'charge.refunded', weight: 5 }
];

function selectRandomEventType() {
    const totalWeight = WEBHOOK_EVENTS.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const event of WEBHOOK_EVENTS) {
        random -= event.weight;
        if (random <= 0) {
            return event.type;
        }
    }

    return WEBHOOK_EVENTS[0].type;
}

function generateWebhookPayload(eventType) {
    const timestamp = Math.floor(Date.now() / 1000);
    const eventId = `evt_${randomString(24)}`;

    const basePayload = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: timestamp,
        type: eventType,
        livemode: false,
        pending_webhooks: 1,
        request: {
            id: `req_${randomString(14)}`,
            idempotency_key: null
        }
    };

    // Generate type-specific data
    switch (eventType) {
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed':
            basePayload.data = {
                object: {
                    id: `pi_${randomString(24)}`,
                    object: 'payment_intent',
                    amount: Math.floor(Math.random() * 100000) + 100,
                    currency: 'usd',
                    customer: `cus_${randomString(14)}`,
                    status: eventType.includes('succeeded') ? 'succeeded' : 'failed',
                    created: timestamp
                }
            };
            break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            basePayload.data = {
                object: {
                    id: `sub_${randomString(24)}`,
                    object: 'subscription',
                    customer: `cus_${randomString(14)}`,
                    status: eventType.includes('deleted') ? 'canceled' : 'active',
                    current_period_start: timestamp,
                    current_period_end: timestamp + 30 * 24 * 3600,
                    items: {
                        data: [
                            {
                                id: `si_${randomString(14)}`,
                                price: { id: `price_${randomString(14)}` }
                            }
                        ]
                    }
                }
            };
            break;

        case 'invoice.paid':
        case 'invoice.payment_failed':
            basePayload.data = {
                object: {
                    id: `in_${randomString(24)}`,
                    object: 'invoice',
                    customer: `cus_${randomString(14)}`,
                    subscription: `sub_${randomString(24)}`,
                    amount_paid: Math.floor(Math.random() * 10000) + 100,
                    currency: 'usd',
                    status: eventType.includes('paid') ? 'paid' : 'open',
                    created: timestamp
                }
            };
            break;

        case 'charge.refunded':
            basePayload.data = {
                object: {
                    id: `ch_${randomString(24)}`,
                    object: 'charge',
                    amount: Math.floor(Math.random() * 10000) + 100,
                    amount_refunded: Math.floor(Math.random() * 5000) + 100,
                    customer: `cus_${randomString(14)}`,
                    refunded: true
                }
            };
            break;

        default:
            basePayload.data = { object: {} };
    }

    return basePayload;
}

function generateWebhookSignature(payload, secret, timestamp) {
    const payloadString = JSON.stringify(payload);
    const signedPayload = `${timestamp}.${payloadString}`;
    const signature = crypto.hmac('sha256', secret, signedPayload, 'hex');
    return `t=${timestamp},v1=${signature}`;
}

export default function () {
    const eventType = selectRandomEventType();
    const payload = generateWebhookPayload(eventType);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateWebhookSignature(payload, WEBHOOK_SECRET, timestamp);

    group('Webhook Processing', () => {
        const startTime = Date.now();

        const res = http.post(`${BASE_URL}/api/webhooks/stripe`, JSON.stringify(payload), {
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': signature
            }
        });

        webhookProcessingTime.add(Date.now() - startTime);
        webhooksReceived.add(1);

        const success = check(res, {
            'webhook status is 200': (r) => r.status === 200,
            'webhook acknowledged': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.received === true || body.acknowledged === true || r.status === 200;
                } catch {
                    return r.status === 200;
                }
            }
        });

        if (success) {
            webhooksProcessed.add(1);
        } else {
            webhookErrorRate.add(1);
        }
    });

    // Minimal sleep for high-throughput webhook testing
    sleep(0.1);
}

export function teardown() {
    console.log('Webhook load test completed');
}
