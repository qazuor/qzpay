/**
 * Mock Payment Adapter for QZPay Playground
 *
 * This is a wrapper around @qazuor/qzpay-dev that integrates with
 * the playground's time simulation system via useConfigStore.
 */
import {
    createMockPaymentAdapter as createDevMockPaymentAdapter,
    TEST_CARDS,
    CARD_ERRORS,
    getPaymentOutcome,
} from '@qazuor/qzpay-dev';
import type { QZPayPaymentAdapter } from '@qazuor/qzpay-core';
import { useConfigStore } from '../stores/config.store';

// Re-export test cards for convenience
export { TEST_CARDS, CARD_ERRORS, getPaymentOutcome };

// Lazy-initialized adapter instance
let adapterInstance: ReturnType<typeof createDevMockPaymentAdapter> | null = null;

/**
 * Get or create the mock payment adapter instance
 * Uses the playground's time simulation system
 */
function getAdapterInstance(): ReturnType<typeof createDevMockPaymentAdapter> {
    if (!adapterInstance) {
        adapterInstance = createDevMockPaymentAdapter({
            getCurrentTime: () => useConfigStore.getState().getCurrentTime(),
        });
    }
    return adapterInstance;
}

/**
 * Create a mock payment adapter for the playground
 * Integrates with the playground's time simulation
 */
export function createMockPaymentAdapter(): QZPayPaymentAdapter {
    return getAdapterInstance().adapter;
}

/**
 * Set the simulated card number for testing different outcomes
 */
export function setMockCardNumber(cardNumber: string): void {
    getAdapterInstance().setCardNumber(cardNumber);
}

/**
 * Get the current simulated card number
 */
export function getMockCardNumber(): string {
    return getAdapterInstance().getCardNumber();
}

/**
 * Simulate completing a 3DS challenge
 */
export function simulateComplete3DS(paymentId: string): void {
    getAdapterInstance().complete3DS(paymentId);
}

/**
 * Simulate completing a checkout session
 */
export function simulateCompleteCheckout(
    checkoutId: string,
    options?: {
        subscriptionId?: string;
        paymentIntentId?: string;
    }
): void {
    getAdapterInstance().completeCheckout(checkoutId, options);
}

/**
 * Reset all mock data and reinitialize the adapter
 */
export function resetMockPaymentAdapter(): void {
    if (adapterInstance) {
        adapterInstance.reset();
    }
}
