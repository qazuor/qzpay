/**
 * In-Memory Storage Adapter for Playground Server
 *
 * Re-exports from @qazuor/qzpay-dev for simplicity.
 * The frontend maintains the source of truth in localStorage.
 */
import { createMemoryStorageAdapter } from '@qazuor/qzpay-dev';
import type { QZPayStorageAdapter } from '@qazuor/qzpay-core';

/**
 * Create an in-memory storage adapter for the playground server
 */
export function createMemoryStorage(): QZPayStorageAdapter {
    return createMemoryStorageAdapter().adapter;
}
