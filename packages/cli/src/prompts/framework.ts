/**
 * Framework selection prompt
 */
import * as p from '@clack/prompts';
import type { FrameworkConfig } from '../types/config.js';

export async function collectFrameworkSelection(): Promise<FrameworkConfig | symbol> {
    const framework = await p.select({
        message: 'Framework integration',
        options: [
            { value: 'hono', label: 'Hono', hint: 'Fast, lightweight web framework' },
            { value: 'nestjs', label: 'NestJS', hint: 'Enterprise Node.js framework' },
            { value: 'none', label: 'Library only', hint: 'No HTTP layer, use programmatically' }
        ]
    });

    if (p.isCancel(framework)) return framework;

    return {
        type: framework as 'hono' | 'nestjs' | 'none'
    };
}
