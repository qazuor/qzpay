import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
        // Longer timeout for Testcontainers (container startup can take time)
        testTimeout: 60000,
        hookTimeout: 60000,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/**/index.ts']
        },
        // Pool configuration for integration tests
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true // Run tests sequentially to share container
            }
        }
    }
});
