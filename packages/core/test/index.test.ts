import { describe, expect, it } from 'vitest';

describe('@qazuor/qzpay-core', () => {
    it('should export core module', async () => {
        const core = await import('../src/index.js');
        expect(core).toBeDefined();
    });
});
