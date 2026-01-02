import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.test.ts', '**/*.test.tsx', 'vitest.config.ts', 'tsup.config.ts']
        }
    }
});
