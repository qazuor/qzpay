/**
 * Storage adapter selection prompt
 */
import * as p from '@clack/prompts';
import type { StorageConfig } from '../types/config.js';

export async function collectStorageSelection(): Promise<StorageConfig | symbol> {
    const storage = await p.select({
        message: 'Storage adapter',
        options: [
            { value: 'drizzle', label: 'Drizzle (PostgreSQL)', hint: 'Production-ready' },
            { value: 'in-memory', label: 'In-memory', hint: 'Development/testing only' }
        ]
    });

    if (p.isCancel(storage)) return storage;

    return {
        type: storage as 'drizzle' | 'in-memory'
    };
}
