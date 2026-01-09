import * as p from '@clack/prompts';
/**
 * Tests for framework prompts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectFrameworkSelection } from '../../src/prompts/framework.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
    select: vi.fn(),
    isCancel: vi.fn().mockReturnValue(false)
}));

describe('collectFrameworkSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(p.isCancel).mockReturnValue(false);
    });

    it('should return hono config when hono is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('hono');

        const result = await collectFrameworkSelection();

        expect(result).toEqual({
            type: 'hono'
        });
    });

    it('should return nestjs config when nestjs is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('nestjs');

        const result = await collectFrameworkSelection();

        expect(result).toEqual({
            type: 'nestjs'
        });
    });

    it('should return none config when none is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('none');

        const result = await collectFrameworkSelection();

        expect(result).toEqual({
            type: 'none'
        });
    });

    it('should return cancel symbol when user cancels', async () => {
        const cancelSymbol = Symbol('cancel');
        vi.mocked(p.select).mockResolvedValue(cancelSymbol);
        vi.mocked(p.isCancel).mockReturnValue(true);

        const result = await collectFrameworkSelection();

        expect(result).toBe(cancelSymbol);
    });

    it('should call select with correct options', async () => {
        vi.mocked(p.select).mockResolvedValue('hono');

        await collectFrameworkSelection();

        expect(p.select).toHaveBeenCalledWith({
            message: 'Framework integration',
            options: expect.arrayContaining([
                expect.objectContaining({ value: 'hono', label: 'Hono' }),
                expect.objectContaining({ value: 'nestjs', label: 'NestJS' }),
                expect.objectContaining({ value: 'none', label: 'Library only' })
            ])
        });
    });
});
