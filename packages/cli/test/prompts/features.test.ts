import * as p from '@clack/prompts';
/**
 * Tests for features prompts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectFeatureSelection } from '../../src/prompts/features.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
    multiselect: vi.fn(),
    isCancel: vi.fn().mockReturnValue(false)
}));

describe('collectFeatureSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(p.isCancel).mockReturnValue(false);
    });

    it('should return config with only subscriptions', async () => {
        vi.mocked(p.multiselect).mockResolvedValue(['subscriptions']);

        const result = await collectFeatureSelection();

        expect(result).toEqual({
            subscriptions: true,
            oneTime: false,
            usageBased: false,
            marketplace: false,
            addons: false
        });
    });

    it('should return config with all features', async () => {
        vi.mocked(p.multiselect).mockResolvedValue(['subscriptions', 'one-time', 'usage-based', 'marketplace', 'addons']);

        const result = await collectFeatureSelection();

        expect(result).toEqual({
            subscriptions: true,
            oneTime: true,
            usageBased: true,
            marketplace: true,
            addons: true
        });
    });

    it('should return config with mixed features', async () => {
        vi.mocked(p.multiselect).mockResolvedValue(['subscriptions', 'addons']);

        const result = await collectFeatureSelection();

        expect(result).toEqual({
            subscriptions: true,
            oneTime: false,
            usageBased: false,
            marketplace: false,
            addons: true
        });
    });

    it('should return cancel symbol when user cancels', async () => {
        const cancelSymbol = Symbol('cancel');
        vi.mocked(p.multiselect).mockResolvedValue(cancelSymbol);
        vi.mocked(p.isCancel).mockReturnValue(true);

        const result = await collectFeatureSelection();

        expect(result).toBe(cancelSymbol);
    });

    it('should call multiselect with correct options', async () => {
        vi.mocked(p.multiselect).mockResolvedValue(['subscriptions']);

        await collectFeatureSelection();

        expect(p.multiselect).toHaveBeenCalledWith({
            message: 'Features to include',
            options: expect.arrayContaining([
                expect.objectContaining({ value: 'subscriptions' }),
                expect.objectContaining({ value: 'one-time' }),
                expect.objectContaining({ value: 'usage-based' }),
                expect.objectContaining({ value: 'marketplace' }),
                expect.objectContaining({ value: 'addons' })
            ]),
            required: true,
            initialValues: ['subscriptions']
        });
    });
});
