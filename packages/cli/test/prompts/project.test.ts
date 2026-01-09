import * as p from '@clack/prompts';
/**
 * Tests for project prompts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectProjectInfo } from '../../src/prompts/project.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
    group: vi.fn(),
    text: vi.fn(),
    isCancel: vi.fn()
}));

describe('collectProjectInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should collect project name, output dir and description', async () => {
        const mockResult = {
            name: 'my-billing',
            outputDir: './billing',
            description: 'My billing system'
        };

        vi.mocked(p.group).mockResolvedValue(mockResult);

        const result = await collectProjectInfo('.');

        expect(p.group).toHaveBeenCalled();
        expect(result).toEqual(mockResult);
    });

    it('should use provided default directory', async () => {
        const mockResult = {
            name: 'test',
            outputDir: './custom-dir',
            description: ''
        };

        vi.mocked(p.group).mockResolvedValue(mockResult);

        await collectProjectInfo('./custom-dir');

        expect(p.group).toHaveBeenCalled();
    });

    it('should return cancel symbol when user cancels', async () => {
        const cancelSymbol = Symbol('cancel');
        vi.mocked(p.group).mockResolvedValue(cancelSymbol);

        const result = await collectProjectInfo('.');

        expect(result).toBe(cancelSymbol);
    });
});
