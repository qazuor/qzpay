/**
 * @qazuor/qzpay-dev
 *
 * Development and testing utilities for QZPay billing library.
 *
 * This package provides:
 * - Mock payment adapter for simulating payment providers
 * - Memory storage adapter for in-memory data persistence
 * - Test card numbers for payment simulation
 * - Seed templates for quick setup
 *
 * @example
 * ```typescript
 * import {
 *   createMockPaymentAdapter,
 *   createMemoryStorageAdapter,
 *   TEST_CARDS,
 *   seedTemplates,
 * } from '@qazuor/qzpay-dev';
 * import { QZPayBilling } from '@qazuor/qzpay-core';
 *
 * // Create adapters
 * const { adapter: payment, setCardNumber } = createMockPaymentAdapter();
 * const { adapter: storage, seed } = createMemoryStorageAdapter();
 *
 * // Seed with sample data
 * seed(seedTemplates.saas);
 *
 * // Create billing instance
 * const billing = new QZPayBilling({ payment, storage });
 *
 * // Simulate different payment outcomes
 * setCardNumber(TEST_CARDS.DECLINED);
 * ```
 *
 * @packageDocumentation
 */

// Adapters
export {
    createMockPaymentAdapter,
    createMemoryStorageAdapter,
    type MockPaymentAdapterConfig,
    type MemoryStorageAdapterConfig,
    type MemoryStorageSnapshot,
    type MemoryStorageData
} from './adapters/index.js';

// Test cards
export {
    TEST_CARDS,
    CARD_ERRORS,
    STRIPE_TEST_CARDS,
    MERCADOPAGO_TEST_CARDS,
    getCardError,
    isTestCard,
    getPaymentOutcome,
    type TestCardKey,
    type TestCardNumber
} from './test-cards.js';

// Seed templates
export { seedTemplates, type SeedTemplate } from './seeds/index.js';
