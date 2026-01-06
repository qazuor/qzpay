/**
 * K6 Load Testing Configuration
 *
 * This file defines shared configuration and utilities for k6 load tests.
 * Run tests with: k6 run <test-file.js>
 */

/**
 * Default load test options
 */
export const defaultOptions = {
    // Standard load test stages
    stages: [
        { duration: '30s', target: 10 }, // Ramp up to 10 users
        { duration: '1m', target: 50 }, // Ramp up to 50 users
        { duration: '2m', target: 50 }, // Stay at 50 users
        { duration: '30s', target: 0 } // Ramp down
    ],
    // Thresholds define pass/fail criteria
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms
        http_req_failed: ['rate<0.01'], // Error rate under 1%
        http_reqs: ['rate>10'] // At least 10 requests per second
    }
};

/**
 * Stress test options - higher load for finding breaking points
 */
export const stressTestOptions = {
    stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '1m', target: 300 },
        { duration: '2m', target: 300 },
        { duration: '1m', target: 0 }
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000'],
        http_req_failed: ['rate<0.05'] // Allow up to 5% error rate under stress
    }
};

/**
 * Spike test options - sudden traffic spikes
 */
export const spikeTestOptions = {
    stages: [
        { duration: '10s', target: 10 },
        { duration: '10s', target: 500 }, // Sudden spike
        { duration: '30s', target: 500 },
        { duration: '10s', target: 10 },
        { duration: '30s', target: 10 },
        { duration: '10s', target: 0 }
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        http_req_failed: ['rate<0.10'] // Allow up to 10% during spikes
    }
};

/**
 * Soak test options - prolonged load for memory leak detection
 */
export const soakTestOptions = {
    stages: [
        { duration: '1m', target: 50 },
        { duration: '30m', target: 50 }, // Extended duration
        { duration: '1m', target: 0 }
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01']
    }
};

/**
 * Generate a random customer ID
 */
export function randomCustomerId() {
    return `cust_${randomString(16)}`;
}

/**
 * Generate a random subscription ID
 */
export function randomSubscriptionId() {
    return `sub_${randomString(16)}`;
}

/**
 * Generate a random string
 */
export function randomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate a random email
 */
export function randomEmail() {
    return `loadtest_${randomString(8)}@example.com`;
}

/**
 * Generate mock customer data
 */
export function mockCustomerData() {
    return {
        email: randomEmail(),
        name: `Load Test User ${randomString(4)}`,
        externalId: `ext_${randomString(12)}`,
        metadata: {
            source: 'load_test',
            timestamp: Date.now()
        }
    };
}

/**
 * Generate mock payment data
 */
export function mockPaymentData(customerId) {
    return {
        customerId: customerId,
        amount: Math.floor(Math.random() * 10000) + 100, // $1-$100
        currency: 'USD',
        paymentMethodId: `pm_${randomString(16)}`,
        metadata: {
            source: 'load_test'
        }
    };
}

/**
 * Generate mock subscription data
 */
export function mockSubscriptionData(customerId, priceId) {
    return {
        customerId: customerId,
        priceId: priceId || `price_${randomString(16)}`,
        metadata: {
            source: 'load_test'
        }
    };
}

/**
 * Common headers for API requests
 */
export function apiHeaders(apiKey) {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Request-Id': `req_${randomString(16)}`
    };
}
