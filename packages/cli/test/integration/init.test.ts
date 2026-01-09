import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
/**
 * Integration tests for init command
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateProject } from '../../src/generators/index.js';
import { fullConfig, libraryConfig, minimalConfig, nestjsConfig } from '../fixtures/config.js';

// Mock @clack/prompts for spinner
vi.mock('@clack/prompts', async () => {
    const actual = await vi.importActual('@clack/prompts');
    return {
        ...actual,
        spinner: vi.fn().mockReturnValue({
            start: vi.fn(),
            stop: vi.fn()
        }),
        intro: vi.fn(),
        outro: vi.fn(),
        note: vi.fn(),
        log: { info: vi.fn(), error: vi.fn() }
    };
});

describe('generateProject integration', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'qzpay-cli-test-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('minimal config (Stripe + Hono)', () => {
        it('should generate all required files', async () => {
            const config = { ...minimalConfig, project: { ...minimalConfig.project, outputDir: tempDir } };

            const files = await generateProject(config);

            expect(files).toContain('qzpay.config.ts');
            expect(files).toContain('.env.example');
            expect(files).toContain('types.ts');
            expect(files).toContain('plans.ts');
            expect(files).toContain('services.ts');
            expect(files).toContain('routes.ts');
            expect(files).toContain('webhooks.ts');
        });

        it('should create files on disk', async () => {
            const config = { ...minimalConfig, project: { ...minimalConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const dirContents = await readdir(tempDir);
            expect(dirContents).toContain('qzpay.config.ts');
            expect(dirContents).toContain('.env.example');
            expect(dirContents).toContain('types.ts');
        });

        it('should generate valid TypeScript in config file', async () => {
            const config = { ...minimalConfig, project: { ...minimalConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const configContent = await readFile(join(tempDir, 'qzpay.config.ts'), 'utf-8');
            expect(configContent).toContain("import { QZPayBilling } from '@qazuor/qzpay-core'");
            expect(configContent).toContain('export const billing');
            expect(configContent).toContain('export default billing');
        });

        it('should include correct env vars in .env.example', async () => {
            const config = { ...minimalConfig, project: { ...minimalConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const envContent = await readFile(join(tempDir, '.env.example'), 'utf-8');
            expect(envContent).toContain('DATABASE_URL');
            expect(envContent).toContain('STRIPE_SECRET_KEY');
            expect(envContent).toContain('STRIPE_WEBHOOK_SECRET');
            expect(envContent).toContain('PORT');
        });
    });

    describe('full config (Both providers + all features)', () => {
        it('should generate files with all features', async () => {
            const config = { ...fullConfig, project: { ...fullConfig.project, outputDir: tempDir } };

            const files = await generateProject(config);

            expect(files.length).toBeGreaterThan(5);
        });

        it('should include both providers in config', async () => {
            const config = { ...fullConfig, project: { ...fullConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const configContent = await readFile(join(tempDir, 'qzpay.config.ts'), 'utf-8');
            expect(configContent).toContain('QZPayStripeAdapter');
            expect(configContent).toContain('createQZPayMercadoPagoAdapter');
        });

        it('should include addon types when addons is enabled', async () => {
            const config = { ...fullConfig, project: { ...fullConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const typesContent = await readFile(join(tempDir, 'types.ts'), 'utf-8');
            expect(typesContent).toContain('AddOn');
            expect(typesContent).toContain('addOns:');
        });

        it('should include marketplace types when marketplace is enabled', async () => {
            const config = { ...fullConfig, project: { ...fullConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const typesContent = await readFile(join(tempDir, 'types.ts'), 'utf-8');
            expect(typesContent).toContain('Vendor');
            expect(typesContent).toContain('stripeAccountId');
        });

        it('should include usage tracking in services', async () => {
            const config = { ...fullConfig, project: { ...fullConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const servicesContent = await readFile(join(tempDir, 'services.ts'), 'utf-8');
            expect(servicesContent).toContain('trackUsage');
            expect(servicesContent).toContain('checkUsageLimit');
            expect(servicesContent).toContain('getUsageSummary');
        });
    });

    describe('NestJS config', () => {
        it('should generate NestJS-specific files', async () => {
            const config = { ...nestjsConfig, project: { ...nestjsConfig.project, outputDir: tempDir } };

            const files = await generateProject(config);

            expect(files).toContain('billing.module.ts');
            expect(files).toContain('billing.service.ts');
            expect(files).toContain('webhooks.controller.ts');
            expect(files).toContain('webhooks.ts');
        });

        it('should not generate Hono routes', async () => {
            const config = { ...nestjsConfig, project: { ...nestjsConfig.project, outputDir: tempDir } };

            const files = await generateProject(config);

            expect(files).not.toContain('routes.ts');
        });

        it('should generate valid NestJS module', async () => {
            const config = { ...nestjsConfig, project: { ...nestjsConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const moduleContent = await readFile(join(tempDir, 'billing.module.ts'), 'utf-8');
            expect(moduleContent).toContain("import { Module, Global, DynamicModule } from '@nestjs/common'");
            expect(moduleContent).toContain('export class BillingModule');
            expect(moduleContent).toContain('forRoot');
            expect(moduleContent).toContain('forRootAsync');
        });

        it('should generate valid NestJS service', async () => {
            const config = { ...nestjsConfig, project: { ...nestjsConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const serviceContent = await readFile(join(tempDir, 'billing.service.ts'), 'utf-8');
            expect(serviceContent).toContain('@Injectable()');
            expect(serviceContent).toContain('export class BillingService');
            expect(serviceContent).toContain('implements OnModuleInit');
        });
    });

    describe('library-only config (no framework)', () => {
        it('should not generate routes or webhooks files', async () => {
            const config = { ...libraryConfig, project: { ...libraryConfig.project, outputDir: tempDir } };

            const files = await generateProject(config);

            expect(files).not.toContain('routes.ts');
            expect(files).not.toContain('webhooks.ts');
            expect(files).not.toContain('billing.module.ts');
        });

        it('should generate core files only', async () => {
            const config = { ...libraryConfig, project: { ...libraryConfig.project, outputDir: tempDir } };

            const files = await generateProject(config);

            expect(files).toContain('qzpay.config.ts');
            expect(files).toContain('.env.example');
            expect(files).toContain('types.ts');
            expect(files).toContain('plans.ts');
            expect(files).toContain('services.ts');
            expect(files.length).toBe(5);
        });

        it('should use MercadoPago adapter', async () => {
            const config = { ...libraryConfig, project: { ...libraryConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const configContent = await readFile(join(tempDir, 'qzpay.config.ts'), 'utf-8');
            expect(configContent).toContain('createQZPayMercadoPagoAdapter');
            expect(configContent).not.toContain('QZPayStripeAdapter');
        });

        it('should not include server variables in env', async () => {
            const config = { ...libraryConfig, project: { ...libraryConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const envContent = await readFile(join(tempDir, '.env.example'), 'utf-8');
            expect(envContent).not.toContain('PORT');
            expect(envContent).not.toContain('JWT_SECRET');
        });
    });

    describe('file content consistency', () => {
        it('should use consistent project name across all files', async () => {
            const config = { ...minimalConfig, project: { ...minimalConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const configContent = await readFile(join(tempDir, 'qzpay.config.ts'), 'utf-8');
            const typesContent = await readFile(join(tempDir, 'types.ts'), 'utf-8');
            const plansContent = await readFile(join(tempDir, 'plans.ts'), 'utf-8');

            // All should use PascalCase project name
            expect(configContent).toContain('TestBilling');
            expect(typesContent).toContain('TestBilling');
            expect(plansContent).toContain('TestBilling');
        });

        it('should use consistent pricing constant name', async () => {
            const config = { ...minimalConfig, project: { ...minimalConfig.project, outputDir: tempDir } };

            await generateProject(config);

            const typesContent = await readFile(join(tempDir, 'types.ts'), 'utf-8');
            const plansContent = await readFile(join(tempDir, 'plans.ts'), 'utf-8');

            expect(typesContent).toContain('TEST_BILLING_PRICING');
            expect(plansContent).toContain('TEST_BILLING_PRICING');
        });
    });
});
