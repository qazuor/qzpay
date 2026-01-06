/**
 * K6 Load Test - Mixed Workload
 *
 * Simulates realistic mixed traffic patterns with various API operations
 *
 * Run with:
 *   k6 run mixed-workload.load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { defaultOptions, apiHeaders, randomString, mockCustomerData, mockPaymentData } from './k6.config.js';

// Custom metrics
const operationsCompleted = new Counter('operations_completed');
const operationsByType = {
    customer: new Counter('customer_operations'),
    payment: new Counter('payment_operations'),
    subscription: new Counter('subscription_operations'),
    invoice: new Counter('invoice_operations'),
    plan: new Counter('plan_operations')
};
const operationErrorRate = new Rate('operation_errors');
const operationLatency = new Trend('operation_latency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'sk_test_load_test_key';

// Workload distribution (percentages)
const WORKLOAD_DISTRIBUTION = {
    readCustomer: 20,
    createCustomer: 5,
    readPayments: 15,
    createPayment: 10,
    readSubscriptions: 15,
    createSubscription: 5,
    readInvoices: 15,
    readPlans: 10,
    searchOperations: 5
};

export const options = {
    stages: [
        { duration: '1m', target: 20 }, // Ramp up
        { duration: '3m', target: 50 }, // Steady state
        { duration: '2m', target: 100 }, // Peak load
        { duration: '2m', target: 50 }, // Back to steady
        { duration: '1m', target: 0 } // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1500'],
        http_req_failed: ['rate<0.02'],
        operation_errors: ['rate<0.05'],
        operation_latency: ['p(95)<600']
    }
};

function selectOperation() {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const [operation, weight] of Object.entries(WORKLOAD_DISTRIBUTION)) {
        cumulative += weight;
        if (random <= cumulative) {
            return operation;
        }
    }

    return 'readCustomer'; // Default fallback
}

export function setup() {
    const headers = apiHeaders(API_KEY);

    // Create some test data for read operations
    const testCustomers = [];
    const testSubscriptions = [];

    for (let i = 0; i < 5; i++) {
        const customerData = {
            email: `mixed_load_${i}_${randomString(4)}@example.com`,
            name: `Load Test Customer ${i}`,
            externalId: `ext_mixed_${i}_${randomString(8)}`
        };

        const res = http.post(`${BASE_URL}/api/customers`, JSON.stringify(customerData), { headers });

        try {
            if (res.status === 200 || res.status === 201) {
                testCustomers.push(JSON.parse(res.body).id);
            }
        } catch {
            testCustomers.push(`cust_test_${i}`);
        }
    }

    return {
        apiKey: API_KEY,
        testCustomers,
        testSubscriptions
    };
}

export default function (data) {
    const headers = apiHeaders(data.apiKey);
    const operation = selectOperation();
    const startTime = Date.now();

    let success = false;

    switch (operation) {
        case 'readCustomer':
            success = readCustomerOperation(headers, data);
            operationsByType.customer.add(1);
            break;

        case 'createCustomer':
            success = createCustomerOperation(headers);
            operationsByType.customer.add(1);
            break;

        case 'readPayments':
            success = readPaymentsOperation(headers, data);
            operationsByType.payment.add(1);
            break;

        case 'createPayment':
            success = createPaymentOperation(headers, data);
            operationsByType.payment.add(1);
            break;

        case 'readSubscriptions':
            success = readSubscriptionsOperation(headers, data);
            operationsByType.subscription.add(1);
            break;

        case 'createSubscription':
            success = createSubscriptionOperation(headers, data);
            operationsByType.subscription.add(1);
            break;

        case 'readInvoices':
            success = readInvoicesOperation(headers, data);
            operationsByType.invoice.add(1);
            break;

        case 'readPlans':
            success = readPlansOperation(headers);
            operationsByType.plan.add(1);
            break;

        case 'searchOperations':
            success = searchOperation(headers);
            break;

        default:
            success = readCustomerOperation(headers, data);
    }

    operationLatency.add(Date.now() - startTime);
    operationsCompleted.add(1);

    if (!success) {
        operationErrorRate.add(1);
    }

    // Variable think time based on operation type
    const thinkTime = operation.startsWith('create') ? 1 : 0.5;
    sleep(thinkTime);
}

function readCustomerOperation(headers, data) {
    const customerId = data.testCustomers[Math.floor(Math.random() * data.testCustomers.length)] || 'cust_test';

    const res = http.get(`${BASE_URL}/api/customers/${customerId}`, { headers });

    return check(res, {
        'read customer ok': (r) => r.status === 200 || r.status === 404
    });
}

function createCustomerOperation(headers) {
    const customerData = mockCustomerData();

    const res = http.post(`${BASE_URL}/api/customers`, JSON.stringify(customerData), { headers });

    return check(res, {
        'create customer ok': (r) => r.status === 200 || r.status === 201
    });
}

function readPaymentsOperation(headers, data) {
    const customerId = data.testCustomers[Math.floor(Math.random() * data.testCustomers.length)];

    const res = http.get(`${BASE_URL}/api/payments?customerId=${customerId}&limit=10`, { headers });

    return check(res, {
        'read payments ok': (r) => r.status === 200
    });
}

function createPaymentOperation(headers, data) {
    const customerId = data.testCustomers[Math.floor(Math.random() * data.testCustomers.length)];
    const paymentData = mockPaymentData(customerId);

    const res = http.post(`${BASE_URL}/api/payments`, JSON.stringify(paymentData), { headers });

    return check(res, {
        'create payment ok': (r) => r.status === 200 || r.status === 201
    });
}

function readSubscriptionsOperation(headers, data) {
    const customerId = data.testCustomers[Math.floor(Math.random() * data.testCustomers.length)];

    const res = http.get(`${BASE_URL}/api/subscriptions?customerId=${customerId}&limit=10`, { headers });

    return check(res, {
        'read subscriptions ok': (r) => r.status === 200
    });
}

function createSubscriptionOperation(headers, data) {
    const customerId = data.testCustomers[Math.floor(Math.random() * data.testCustomers.length)];
    const subData = {
        customerId,
        priceId: `price_monthly_${randomString(4)}`,
        metadata: { source: 'load_test' }
    };

    const res = http.post(`${BASE_URL}/api/subscriptions`, JSON.stringify(subData), { headers });

    return check(res, {
        'create subscription ok': (r) => r.status === 200 || r.status === 201
    });
}

function readInvoicesOperation(headers, data) {
    const customerId = data.testCustomers[Math.floor(Math.random() * data.testCustomers.length)];

    const res = http.get(`${BASE_URL}/api/invoices?customerId=${customerId}&limit=20`, { headers });

    return check(res, {
        'read invoices ok': (r) => r.status === 200
    });
}

function readPlansOperation(headers) {
    const res = http.get(`${BASE_URL}/api/plans?active=true`, { headers });

    return check(res, {
        'read plans ok': (r) => r.status === 200
    });
}

function searchOperation(headers) {
    const queries = [
        '/api/customers?email=test@example.com',
        '/api/payments?status=succeeded&limit=5',
        '/api/subscriptions?status=active&limit=5',
        '/api/invoices?status=paid&limit=5'
    ];

    const query = queries[Math.floor(Math.random() * queries.length)];
    const res = http.get(`${BASE_URL}${query}`, { headers });

    return check(res, {
        'search ok': (r) => r.status === 200
    });
}

export function teardown(data) {
    console.log('Mixed workload load test completed');
}
