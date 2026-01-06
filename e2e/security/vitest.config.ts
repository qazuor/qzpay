import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['**/*.security.test.ts', '**/*.test.ts'],
        exclude: ['**/node_modules/**'],
        environment: 'node',
        globals: true,
        testTimeout: 10000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage'
        }
    }
});
