import * as p from '@clack/prompts';
/**
 * Tests for storage prompts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectStorageSelection } from '../../src/prompts/storage.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
    select: vi.fn(),
    isCancel: vi.fn().mockReturnValue(false)
}));

describe('collectStorageSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(p.isCancel).mockReturnValue(false);
    });

    it('should return drizzle config when drizzle is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('drizzle');

        const result = await collectStorageSelection();

        expect(result).toEqual({
            type: 'drizzle'
        });
    });

    it('should return in-memory config when in-memory is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('in-memory');

        const result = await collectStorageSelection();

        expect(result).toEqual({
            type: 'in-memory'
        });
    });

    it('should return cancel symbol when user cancels', async () => {
        const cancelSymbol = Symbol('cancel');
        vi.mocked(p.select).mockResolvedValue(cancelSymbol);
        vi.mocked(p.isCancel).mockReturnValue(true);

        const result = await collectStorageSelection();

        expect(result).toBe(cancelSymbol);
    });

    it('should call select with correct options', async () => {
        vi.mocked(p.select).mockResolvedValue('drizzle');

        await collectStorageSelection();

        expect(p.select).toHaveBeenCalledWith({
            message: 'Storage adapter',
            options: expect.arrayContaining([
                expect.objectContaining({ value: 'drizzle', label: 'Drizzle (PostgreSQL)' }),
                expect.objectContaining({ value: 'in-memory', label: 'In-memory' })
            ])
        });
    });
});
