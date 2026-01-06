/**
 * K6 Load Test - Subscription API
 *
 * Tests the performance of subscription management endpoints
 *
 * Run with:
 *   k6 run subscription-api.load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { defaultOptions, apiHeaders, mockSubscriptionData, randomCustomerId, randomString } from './k6.config.js';

// Custom metrics
const subscriptionsCreated = new Counter('subscriptions_created');
const subscriptionsCanceled = new Counter('subscriptions_canceled');
const subscriptionErrorRate = new Rate('subscription_errors');
const subscriptionCreationTime = new Trend('subscription_creation_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'sk_test_load_test_key';

// Test price IDs (these would be pre-created in a real scenario)
const TEST_PRICES = ['price_monthly_basic', 'price_monthly_pro', 'price_yearly_enterprise'];

export const options = {
    ...defaultOptions,
    thresholds: {
        ...defaultOptions.thresholds,
        subscriptions_created: ['count>30'],
        subscription_creation_time: ['p(95)<2000'], // Subscriptions under 2s
        subscription_errors: ['rate<0.05'] // Under 5% errors
    }
};

export function setup() {
    const headers = apiHeaders(API_KEY);

    // Create a test customer
    const customerData = {
        email: `sub_loadtest_${randomString(8)}@example.com`,
        name: 'Subscription Load Test Customer',
        externalId: `ext_sub_${randomString(12)}`
    };

    const res = http.post(`${BASE_URL}/api/customers`, JSON.stringify(customerData), { headers });

    let customerId = randomCustomerId();
    try {
        if (res.status === 200 || res.status === 201) {
            customerId = JSON.parse(res.body).id;
        }
    } catch {
        console.warn('Could not create test customer');
    }

    return { apiKey: API_KEY, customerId };
}

export default function (data) {
    const headers = apiHeaders(data.apiKey);
    const priceId = TEST_PRICES[Math.floor(Math.random() * TEST_PRICES.length)];

    group('Subscription Lifecycle', () => {
        // Create subscription
        let subscriptionId;

        group('Create Subscription', () => {
            const subData = mockSubscriptionData(data.customerId, priceId);
            const startTime = Date.now();

            const createRes = http.post(`${BASE_URL}/api/subscriptions`, JSON.stringify(subData), { headers });

            subscriptionCreationTime.add(Date.now() - startTime);

            const success = check(createRes, {
                'subscription create status ok': (r) => r.status === 200 || r.status === 201,
                'subscription has id': (r) => {
                    try {
                        const body = JSON.parse(r.body);
                        return body.id != null;
                    } catch {
                        return false;
                    }
                },
                'subscription has status': (r) => {
                    try {
                        const body = JSON.parse(r.body);
                        return ['active', 'pending', 'trialing', 'incomplete'].includes(body.status);
                    } catch {
                        return false;
                    }
                }
            });

            if (success) {
                subscriptionsCreated.add(1);
                try {
                    subscriptionId = JSON.parse(createRes.body).id;
                } catch {
                    subscriptionId = null;
                }
            } else {
                subscriptionErrorRate.add(1);
            }
        });

        // Get subscription details
        if (subscriptionId) {
            group('Get Subscription', () => {
                const getRes = http.get(`${BASE_URL}/api/subscriptions/${subscriptionId}`, { headers });

                check(getRes, {
                    'get subscription status is 200': (r) => r.status === 200,
                    'get subscription returns correct id': (r) => {
                        try {
                            return JSON.parse(r.body).id === subscriptionId;
                        } catch {
                            return false;
                        }
                    }
                });
            });

            // Update subscription (change plan) - 20% of the time
            if (Math.random() < 0.2) {
                group('Update Subscription', () => {
                    const newPriceId = TEST_PRICES[Math.floor(Math.random() * TEST_PRICES.length)];
                    const updateData = { priceId: newPriceId };

                    const updateRes = http.patch(
                        `${BASE_URL}/api/subscriptions/${subscriptionId}`,
                        JSON.stringify(updateData),
                        { headers }
                    );

                    check(updateRes, {
                        'update subscription status ok': (r) => r.status === 200
                    });
                });
            }

            // Cancel subscription - 10% of the time
            if (Math.random() < 0.1) {
                group('Cancel Subscription', () => {
                    const cancelRes = http.post(
                        `${BASE_URL}/api/subscriptions/${subscriptionId}/cancel`,
                        JSON.stringify({ cancelAtPeriodEnd: true }),
                        { headers }
                    );

                    const cancelSuccess = check(cancelRes, {
                        'cancel subscription status ok': (r) => r.status === 200
                    });

                    if (cancelSuccess) {
                        subscriptionsCanceled.add(1);
                    }
                });
            }
        }
    });

    // List subscriptions
    group('List Subscriptions', () => {
        const listRes = http.get(`${BASE_URL}/api/subscriptions?customerId=${data.customerId}&limit=10`, { headers });

        check(listRes, {
            'list subscriptions status is 200': (r) => r.status === 200
        });
    });

    sleep(1);
}

export function teardown(data) {
    console.log('Subscription API load test completed');
}
