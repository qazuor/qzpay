import * as p from '@clack/prompts';
/**
 * Tests for provider prompts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectProviderSelection } from '../../src/prompts/provider.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
    select: vi.fn(),
    isCancel: vi.fn().mockReturnValue(false)
}));

describe('collectProviderSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(p.isCancel).mockReturnValue(false);
    });

    it('should return stripe config when stripe is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('stripe');

        const result = await collectProviderSelection();

        expect(result).toEqual({
            type: 'stripe',
            stripe: true,
            mercadopago: false
        });
    });

    it('should return mercadopago config when mercadopago is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('mercadopago');

        const result = await collectProviderSelection();

        expect(result).toEqual({
            type: 'mercadopago',
            stripe: false,
            mercadopago: true
        });
    });

    it('should return both config when both is selected', async () => {
        vi.mocked(p.select).mockResolvedValue('both');

        const result = await collectProviderSelection();

        expect(result).toEqual({
            type: 'both',
            stripe: true,
            mercadopago: true
        });
    });

    it('should return cancel symbol when user cancels', async () => {
        const cancelSymbol = Symbol('cancel');
        vi.mocked(p.select).mockResolvedValue(cancelSymbol);
        vi.mocked(p.isCancel).mockReturnValue(true);

        const result = await collectProviderSelection();

        expect(result).toBe(cancelSymbol);
    });

    it('should call select with correct options', async () => {
        vi.mocked(p.select).mockResolvedValue('stripe');

        await collectProviderSelection();

        expect(p.select).toHaveBeenCalledWith({
            message: 'Payment provider',
            options: expect.arrayContaining([
                expect.objectContaining({ value: 'stripe' }),
                expect.objectContaining({ value: 'mercadopago' }),
                expect.objectContaining({ value: 'both' })
            ])
        });
    });
});
