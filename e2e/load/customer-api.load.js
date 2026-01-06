/**
 * K6 Load Test - Customer API
 *
 * Tests the performance of customer management endpoints
 *
 * Run with:
 *   k6 run customer-api.load.js
 *   k6 run --env BASE_URL=http://localhost:3000 customer-api.load.js
 *   k6 run --vus 10 --duration 30s customer-api.load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { defaultOptions, apiHeaders, mockCustomerData, randomCustomerId } from './k6.config.js';

// Custom metrics
const customerCreated = new Counter('customers_created');
const customerRetrieved = new Counter('customers_retrieved');
const customerUpdated = new Counter('customers_updated');
const errorRate = new Rate('errors');
const customerCreationTime = new Trend('customer_creation_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'sk_test_load_test_key';

export const options = {
    ...defaultOptions,
    thresholds: {
        ...defaultOptions.thresholds,
        customers_created: ['count>100'], // At least 100 customers created
        errors: ['rate<0.01'] // Less than 1% error rate
    }
};

export function setup() {
    // Verify API is accessible
    const res = http.get(`${BASE_URL}/health`, { headers: apiHeaders(API_KEY) });
    if (res.status !== 200) {
        console.warn('API health check failed, tests may fail');
    }
    return { apiKey: API_KEY };
}

export default function (data) {
    const headers = apiHeaders(data.apiKey);

    group('Customer Lifecycle', () => {
        // Create a new customer
        group('Create Customer', () => {
            const customerData = mockCustomerData();
            const startTime = Date.now();

            const createRes = http.post(`${BASE_URL}/api/customers`, JSON.stringify(customerData), {
                headers
            });

            customerCreationTime.add(Date.now() - startTime);

            const createSuccess = check(createRes, {
                'create status is 201 or 200': (r) => r.status === 201 || r.status === 200,
                'create has customer id': (r) => {
                    try {
                        const body = JSON.parse(r.body);
                        return body.id && body.id.startsWith('cust_');
                    } catch {
                        return false;
                    }
                }
            });

            if (createSuccess) {
                customerCreated.add(1);
            } else {
                errorRate.add(1);
            }

            // Store customer ID for subsequent operations
            let customerId;
            try {
                customerId = JSON.parse(createRes.body).id;
            } catch {
                customerId = null;
            }

            // Get customer details
            if (customerId) {
                group('Get Customer', () => {
                    const getRes = http.get(`${BASE_URL}/api/customers/${customerId}`, { headers });

                    const getSuccess = check(getRes, {
                        'get status is 200': (r) => r.status === 200,
                        'get returns correct customer': (r) => {
                            try {
                                const body = JSON.parse(r.body);
                                return body.id === customerId;
                            } catch {
                                return false;
                            }
                        }
                    });

                    if (getSuccess) {
                        customerRetrieved.add(1);
                    } else {
                        errorRate.add(1);
                    }
                });

                // Update customer
                group('Update Customer', () => {
                    const updateData = {
                        name: `Updated User ${Date.now()}`,
                        metadata: { updated: true, loadTest: true }
                    };

                    const updateRes = http.patch(
                        `${BASE_URL}/api/customers/${customerId}`,
                        JSON.stringify(updateData),
                        { headers }
                    );

                    const updateSuccess = check(updateRes, {
                        'update status is 200': (r) => r.status === 200,
                        'update reflects changes': (r) => {
                            try {
                                const body = JSON.parse(r.body);
                                return body.metadata && body.metadata.updated === true;
                            } catch {
                                return false;
                            }
                        }
                    });

                    if (updateSuccess) {
                        customerUpdated.add(1);
                    } else {
                        errorRate.add(1);
                    }
                });
            }
        });
    });

    // List customers (pagination test)
    group('List Customers', () => {
        const listRes = http.get(`${BASE_URL}/api/customers?limit=20`, { headers });

        check(listRes, {
            'list status is 200': (r) => r.status === 200,
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

    sleep(1); // Think time between iterations
}

export function teardown(data) {
    console.log('Customer API load test completed');
    console.log(`Total customers created: ${customerCreated.name}`);
}
