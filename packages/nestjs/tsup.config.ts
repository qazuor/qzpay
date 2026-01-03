import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata', 'rxjs']
});
