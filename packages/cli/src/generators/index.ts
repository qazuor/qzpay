/**
 * Generator Orchestrator
 *
 * This module coordinates all file generators and writes the generated
 * files to the specified output directory.
 *
 * @packageDocumentation
 */
import { join } from 'node:path';
import type { InitConfig } from '../types/config.js';
import { writeFile } from '../utils/fs.js';
import { generateConfig } from './config.js';
import { generateEnv } from './env.js';
import { generateNestController, generateNestModule, generateNestService } from './nestjs.js';
import { generatePlans } from './plans.js';
import { generateRoutes } from './routes.js';
import { generateServices } from './services.js';
import { generateTypes } from './types.js';
import { generateWebhooks } from './webhooks.js';

/**
 * Represents a file to be generated.
 */
interface GeneratedFile {
    /** File name (e.g., 'qzpay.config.ts') */
    name: string;
    /** Generated file content */
    content: string;
}

/**
 * Generate all project files based on the provided configuration.
 *
 * This is the main entry point for code generation. It orchestrates
 * all individual generators and writes files to the output directory.
 *
 * @param config - The complete initialization configuration
 * @returns Array of generated file names
 *
 * @example
 * ```typescript
 * import { generateProject } from '@qazuor/qzpay-cli';
 *
 * const config: InitConfig = {
 *   project: { name: 'my-billing', outputDir: './billing', description: '' },
 *   provider: { type: 'stripe', stripe: true, mercadopago: false },
 *   storage: { type: 'drizzle' },
 *   framework: { type: 'hono' },
 *   features: { subscriptions: true, oneTime: false, usageBased: false, marketplace: false, addons: false },
 *   plans: { tiers: [{ name: 'pro', displayName: 'Pro', monthlyPrice: 1999, yearlyPrice: 19990 }] }
 * };
 *
 * const files = await generateProject(config);
 * console.log('Generated:', files);
 * // ['qzpay.config.ts', '.env.example', 'types.ts', 'plans.ts', 'services.ts', 'routes.ts', 'webhooks.ts']
 * ```
 *
 * @remarks
 * The files generated depend on the configuration:
 * - Core files (always): qzpay.config.ts, .env.example, types.ts, plans.ts, services.ts
 * - Hono: routes.ts, webhooks.ts
 * - NestJS: billing.module.ts, billing.service.ts, webhooks.controller.ts, webhooks.ts
 */
export async function generateProject(config: InitConfig): Promise<string[]> {
    const outDir = config.project.outputDir;
    const files: GeneratedFile[] = [];

    // Core files (always generated)
    files.push({
        name: 'qzpay.config.ts',
        content: generateConfig(config)
    });

    files.push({
        name: '.env.example',
        content: generateEnv(config)
    });

    files.push({
        name: 'types.ts',
        content: generateTypes(config)
    });

    files.push({
        name: 'plans.ts',
        content: generatePlans(config)
    });

    files.push({
        name: 'services.ts',
        content: generateServices(config)
    });

    // Framework-specific files
    if (config.framework.type === 'hono') {
        files.push({
            name: 'routes.ts',
            content: generateRoutes(config)
        });

        files.push({
            name: 'webhooks.ts',
            content: generateWebhooks(config)
        });
    }

    if (config.framework.type === 'nestjs') {
        files.push({
            name: 'billing.module.ts',
            content: generateNestModule(config)
        });

        files.push({
            name: 'billing.service.ts',
            content: generateNestService(config)
        });

        files.push({
            name: 'webhooks.controller.ts',
            content: generateNestController(config)
        });

        files.push({
            name: 'webhooks.ts',
            content: generateWebhooks(config)
        });
    }

    // Write all files
    const writtenFiles: string[] = [];

    for (const file of files) {
        const filePath = join(outDir, file.name);
        await writeFile(filePath, file.content);
        writtenFiles.push(file.name);
    }

    return writtenFiles;
}

/**
 * Generate qzpay.config.ts file content.
 * @see {@link generateConfig}
 */
export { generateConfig } from './config.js';

/**
 * Generate .env.example file content.
 * @see {@link generateEnv}
 */
export { generateEnv } from './env.js';

/**
 * Generate types.ts file content.
 * @see {@link generateTypes}
 */
export { generateTypes } from './types.js';

/**
 * Generate plans.ts file content.
 * @see {@link generatePlans}
 */
export { generatePlans } from './plans.js';

/**
 * Generate services.ts file content.
 * @see {@link generateServices}
 */
export { generateServices } from './services.js';

/**
 * Generate routes.ts file content for Hono.
 * @see {@link generateRoutes}
 */
export { generateRoutes } from './routes.js';

/**
 * Generate webhooks.ts file content.
 * @see {@link generateWebhooks}
 */
export { generateWebhooks } from './webhooks.js';

/**
 * Generate NestJS-specific files.
 * @see {@link generateNestModule}
 * @see {@link generateNestService}
 * @see {@link generateNestController}
 */
export { generateNestModule, generateNestService, generateNestController } from './nestjs.js';
