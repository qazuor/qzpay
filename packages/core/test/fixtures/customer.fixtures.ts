/**
 * Customer test fixtures
 */
import type { QZPayCreateCustomerInput, QZPayCustomer } from '../../src/types/customer.types.js';

/**
 * Sample customer input for creation
 */
export const sampleCustomerInput: QZPayCreateCustomerInput = {
    email: 'john.doe@example.com',
    name: 'John Doe',
    externalId: 'user_123',
    metadata: {
        source: 'test'
    }
};

/**
 * Sample customer object
 */
export const sampleCustomer: QZPayCustomer = {
    id: 'cus_test_123',
    email: 'john.doe@example.com',
    name: 'John Doe',
    externalId: 'user_123',
    metadata: {
        source: 'test'
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
};

/**
 * Multiple customer fixtures for list testing
 */
export const multipleCustomers: QZPayCustomer[] = [
    {
        id: 'cus_test_1',
        email: 'alice@example.com',
        name: 'Alice Smith',
        externalId: 'user_1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    {
        id: 'cus_test_2',
        email: 'bob@example.com',
        name: 'Bob Jones',
        externalId: 'user_2',
        createdAt: new Date('2024-01-02T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z')
    },
    {
        id: 'cus_test_3',
        email: 'charlie@example.com',
        name: 'Charlie Brown',
        externalId: 'user_3',
        createdAt: new Date('2024-01-03T00:00:00Z'),
        updatedAt: new Date('2024-01-03T00:00:00Z')
    }
];

/**
 * Create a customer with custom overrides
 */
export function createCustomerFixture(overrides?: Partial<QZPayCustomer>): QZPayCustomer {
    return {
        ...sampleCustomer,
        id: `cus_test_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}
