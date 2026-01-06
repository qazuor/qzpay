/**
 * K6 Load Test - Payment API
 *
 * Tests the performance of payment processing endpoints
 *
 * Run with:
 *   k6 run payment-api.load.js
 *   k6 run --env BASE_URL=http://localhost:3000 payment-api.load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { defaultOptions, apiHeaders, mockPaymentData, randomCustomerId, randomString } from './k6.config.js';

// Custom metrics
const paymentsProcessed = new Counter('payments_processed');
const paymentsSucceeded = new Counter('payments_succeeded');
const paymentsFailed = new Counter('payments_failed');
const paymentErrorRate = new Rate('payment_errors');
const paymentProcessingTime = new Trend('payment_processing_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'sk_test_load_test_key';

export const options = {
    ...defaultOptions,
    thresholds: {
        ...defaultOptions.thresholds,
        payments_processed: ['count>50'],
        payment_processing_time: ['p(95)<1000'], // Payments should complete under 1s
        payment_errors: ['rate<0.02'] // Less than 2% payment errors
    }
};

export function setup() {
    // Create a test customer for payments
    const headers = apiHeaders(API_KEY);
    const customerData = {
        email: `payment_loadtest_${randomString(8)}@example.com`,
        name: 'Payment Load Test Customer',
        externalId: `ext_payment_${randomString(12)}`
    };

    const res = http.post(`${BASE_URL}/api/customers`, JSON.stringify(customerData), { headers });

    let customerId = randomCustomerId();
    try {
        if (res.status === 200 || res.status === 201) {
            customerId = JSON.parse(res.body).id;
        }
    } catch {
        console.warn('Could not create test customer, using random ID');
    }

    return { apiKey: API_KEY, customerId };
}

export default function (data) {
    const headers = apiHeaders(data.apiKey);

    group('Payment Processing', () => {
        // Create a payment
        group('Create Payment', () => {
            const paymentData = mockPaymentData(data.customerId);
            const startTime = Date.now();

            const createRes = http.post(`${BASE_URL}/api/payments`, JSON.stringify(paymentData), { headers });

            const processingTime = Date.now() - startTime;
            paymentProcessingTime.add(processingTime);
            paymentsProcessed.add(1);

            const success = check(createRes, {
                'payment status is 201 or 200': (r) => r.status === 201 || r.status === 200,
                'payment has id': (r) => {
                    try {
                        const body = JSON.parse(r.body);
                        return body.id != null;
                    } catch {
                        return false;
                    }
                },
                'payment has status': (r) => {
                    try {
                        const body = JSON.parse(r.body);
                        return ['succeeded', 'pending', 'requires_action', 'processing'].includes(body.status);
                    } catch {
                        return false;
                    }
                }
            });

            if (success) {
                paymentsSucceeded.add(1);
            } else {
                paymentsFailed.add(1);
                paymentErrorRate.add(1);
            }

            // Get payment status
            let paymentId;
            try {
                paymentId = JSON.parse(createRes.body).id;
            } catch {
                paymentId = null;
            }

            if (paymentId) {
                group('Get Payment', () => {
                    const getRes = http.get(`${BASE_URL}/api/payments/${paymentId}`, { headers });

                    check(getRes, {
                        'get payment status is 200': (r) => r.status === 200,
                        'get payment returns correct id': (r) => {
                            try {
                                const body = JSON.parse(r.body);
                                return body.id === paymentId;
                            } catch {
                                return false;
                            }
                        }
                    });
                });
            }
        });
    });

    // List payments with filters
    group('List Payments', () => {
        const listRes = http.get(`${BASE_URL}/api/payments?customerId=${data.customerId}&limit=10`, { headers });

        check(listRes, {
            'list payments status is 200': (r) => r.status === 200,
            'list returns array': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return Array.isArray(body.data || body);
                } catch {
                    return false;
                }
            }
        });
    });

    // Simulate refund request (if applicable)
    group('Refund Flow', () => {
        // Only attempt refund 10% of the time to simulate realistic usage
        if (Math.random() < 0.1) {
            const refundData = {
                paymentId: `pay_${randomString(16)}`,
                amount: Math.floor(Math.random() * 1000) + 100,
                reason: 'load_test_refund'
            };

            const refundRes = http.post(`${BASE_URL}/api/refunds`, JSON.stringify(refundData), { headers });

            check(refundRes, {
                'refund request accepted': (r) => r.status === 200 || r.status === 201 || r.status === 404
            });
        }
    });

    sleep(0.5); // Shorter think time for payment tests
}

export function teardown(data) {
    console.log('Payment API load test completed');
}
