/**
 * Global test setup for QZPay
 *
 * This file runs before all tests and sets up the global test environment.
 */

import { afterAll, afterEach, beforeAll } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

// Global setup
beforeAll(async () => {
    // Add any global setup here
    // e.g., start mock servers, initialize test database
});

// Cleanup after each test
afterEach(async () => {
    // Add any per-test cleanup here
    // e.g., reset mocks, clear test data
});

// Global teardown
afterAll(async () => {
    // Add any global teardown here
    // e.g., stop mock servers, close database connections
});

// Extend expect with custom matchers if needed
// expect.extend({
//   toBeValidQZPayCustomer(received) {
//     // Custom matcher implementation
//   },
// });
