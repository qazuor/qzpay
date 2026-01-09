/**
 * Project info prompts
 */
import * as p from '@clack/prompts';
import type { ProjectConfig } from '../types/config.js';

export async function collectProjectInfo(defaultDir: string): Promise<ProjectConfig | symbol> {
    return p.group({
        name: () =>
            p.text({
                message: 'Project name',
                placeholder: 'my-billing',
                validate: (value) => {
                    if (!value) return 'Project name is required';
                    if (!/^[a-z][a-z0-9-]*$/.test(value)) {
                        return 'Use lowercase letters, numbers, and hyphens. Must start with a letter.';
                    }
                    return undefined;
                }
            }),
        outputDir: () =>
            p.text({
                message: 'Output directory',
                initialValue: defaultDir === '.' ? './billing' : defaultDir,
                placeholder: './billing'
            }),
        description: () =>
            p.text({
                message: 'Project description (optional)',
                placeholder: 'Billing system for my app'
            })
    }) as Promise<ProjectConfig | symbol>;
}
