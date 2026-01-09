/**
 * qzpay init command
 */
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { generateProject } from '../generators/index.js';
import { collectFeatureSelection } from '../prompts/features.js';
import { collectFrameworkSelection } from '../prompts/framework.js';
import { collectPlanConfiguration } from '../prompts/plans.js';
import { collectProjectInfo } from '../prompts/project.js';
import { collectProviderSelection } from '../prompts/provider.js';
import { collectStorageSelection } from '../prompts/storage.js';
import type { InitConfig } from '../types/config.js';

export interface InitOptions {
    dir: string;
    yes?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
    p.intro(pc.bgCyan(pc.black(' QZPay Init ')));

    // 1. Project info
    const project = await collectProjectInfo(options.dir);
    if (p.isCancel(project)) {
        p.cancel('Setup cancelled');
        process.exit(0);
    }

    // 2. Provider selection
    const provider = await collectProviderSelection();
    if (p.isCancel(provider)) {
        p.cancel('Setup cancelled');
        process.exit(0);
    }

    // 3. Storage selection
    const storage = await collectStorageSelection();
    if (p.isCancel(storage)) {
        p.cancel('Setup cancelled');
        process.exit(0);
    }

    // 4. Framework selection
    const framework = await collectFrameworkSelection();
    if (p.isCancel(framework)) {
        p.cancel('Setup cancelled');
        process.exit(0);
    }

    // 5. Features selection
    const features = await collectFeatureSelection();
    if (p.isCancel(features)) {
        p.cancel('Setup cancelled');
        process.exit(0);
    }

    // 6. Plan configuration
    const plans = await collectPlanConfiguration();
    if (p.isCancel(plans)) {
        p.cancel('Setup cancelled');
        process.exit(0);
    }

    // Assemble configuration
    const config: InitConfig = {
        project,
        provider,
        storage,
        framework,
        features,
        plans
    };

    // Generate project files
    const spinner = p.spinner();
    spinner.start('Generating project files...');

    try {
        const files = await generateProject(config);
        spinner.stop('Project generated successfully!');

        // Show generated files
        p.note(files.map((f) => `  ${pc.green('+')} ${f}`).join('\n'), 'Files created');

        // Show next steps
        const steps = getNextSteps(config);
        p.note(steps, 'Next steps');

        p.outro(pc.green('Happy billing! 💳'));
    } catch (error) {
        spinner.stop('Generation failed');
        p.log.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

function getNextSteps(config: InitConfig): string {
    const steps: string[] = [];

    steps.push(`1. ${pc.cyan('cd')} ${config.project.outputDir}`);
    steps.push(`2. Copy ${pc.cyan('.env.example')} to ${pc.cyan('.env')} and fill in your keys`);

    if (config.storage.type === 'drizzle') {
        steps.push('3. Set up your PostgreSQL database');
        steps.push(`4. Run migrations: ${pc.cyan('pnpm db:migrate')}`);
    }

    if (config.provider.stripe) {
        steps.push(`${steps.length + 1}. Get your Stripe keys from ${pc.cyan('https://dashboard.stripe.com/apikeys')}`);
    }

    if (config.provider.mercadopago) {
        steps.push(`${steps.length + 1}. Get your MercadoPago keys from ${pc.cyan('https://www.mercadopago.com/developers')}`);
    }

    steps.push(`${steps.length + 1}. Initialize plans: ${pc.cyan('npx tsx plans.ts')}`);

    if (config.framework.type !== 'none') {
        steps.push(`${steps.length + 1}. Start the server and test your webhooks`);
    }

    return steps.join('\n');
}
