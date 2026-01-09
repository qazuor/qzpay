import * as p from '@clack/prompts';
/**
 * Tests for plans prompts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectPlanConfiguration } from '../../src/prompts/plans.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
    confirm: vi.fn(),
    select: vi.fn(),
    group: vi.fn(),
    text: vi.fn(),
    log: { info: vi.fn() },
    isCancel: vi.fn().mockReturnValue(false)
}));

describe('collectPlanConfiguration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(p.isCancel).mockReturnValue(false);
    });

    describe('predefined plans', () => {
        it('should return freemium plans when freemium structure is selected', async () => {
            vi.mocked(p.confirm).mockResolvedValue(true);
            vi.mocked(p.select).mockResolvedValue('freemium');

            const result = await collectPlanConfiguration();

            expect(result).toEqual({
                tiers: [
                    { name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 },
                    { name: 'pro', displayName: 'Pro', monthlyPrice: 1999, yearlyPrice: 19990 },
                    { name: 'enterprise', displayName: 'Enterprise', monthlyPrice: 9999, yearlyPrice: 99990 }
                ]
            });
        });

        it('should return tiered plans when tiered structure is selected', async () => {
            vi.mocked(p.confirm).mockResolvedValue(true);
            vi.mocked(p.select).mockResolvedValue('tiered');

            const result = await collectPlanConfiguration();

            expect(result).toEqual({
                tiers: [
                    { name: 'basic', displayName: 'Basic', monthlyPrice: 999, yearlyPrice: 9990 },
                    { name: 'professional', displayName: 'Professional', monthlyPrice: 2999, yearlyPrice: 29990 },
                    { name: 'agency', displayName: 'Agency', monthlyPrice: 9999, yearlyPrice: 99990 }
                ]
            });
        });

        it('should return usage plans when usage structure is selected', async () => {
            vi.mocked(p.confirm).mockResolvedValue(true);
            vi.mocked(p.select).mockResolvedValue('usage');

            const result = await collectPlanConfiguration();

            expect(result).toEqual({
                tiers: expect.arrayContaining([
                    expect.objectContaining({ name: 'starter' }),
                    expect.objectContaining({ name: 'growth' }),
                    expect.objectContaining({ name: 'business' }),
                    expect.objectContaining({ name: 'enterprise' })
                ])
            });
        });
    });

    describe('custom plans', () => {
        it('should collect custom plans when predefined is declined', async () => {
            vi.mocked(p.confirm)
                .mockResolvedValueOnce(false) // Don't use predefined
                .mockResolvedValueOnce(false); // Don't add more plans

            vi.mocked(p.group).mockResolvedValue({
                name: 'custom',
                displayName: 'Custom Plan',
                monthlyPrice: '4999',
                yearlyPrice: '49990'
            });

            const result = await collectPlanConfiguration();

            expect(result).toEqual({
                tiers: [{ name: 'custom', displayName: 'Custom Plan', monthlyPrice: 4999, yearlyPrice: 49990 }]
            });
        });

        it('should collect multiple custom plans', async () => {
            vi.mocked(p.confirm)
                .mockResolvedValueOnce(false) // Don't use predefined
                .mockResolvedValueOnce(true) // Add another plan
                .mockResolvedValueOnce(false); // Don't add more

            vi.mocked(p.group)
                .mockResolvedValueOnce({
                    name: 'basic',
                    displayName: 'Basic',
                    monthlyPrice: '999',
                    yearlyPrice: '9990'
                })
                .mockResolvedValueOnce({
                    name: 'premium',
                    displayName: 'Premium',
                    monthlyPrice: '2999',
                    yearlyPrice: '29990'
                });

            const result = await collectPlanConfiguration();

            expect(result).toEqual({
                tiers: [
                    { name: 'basic', displayName: 'Basic', monthlyPrice: 999, yearlyPrice: 9990 },
                    { name: 'premium', displayName: 'Premium', monthlyPrice: 2999, yearlyPrice: 29990 }
                ]
            });
        });

        it('should handle empty prices as 0', async () => {
            vi.mocked(p.confirm).mockResolvedValueOnce(false).mockResolvedValueOnce(false);

            vi.mocked(p.group).mockResolvedValue({
                name: 'free',
                displayName: 'Free',
                monthlyPrice: '',
                yearlyPrice: ''
            });

            const result = await collectPlanConfiguration();

            expect(result).toEqual({
                tiers: [{ name: 'free', displayName: 'Free', monthlyPrice: 0, yearlyPrice: 0 }]
            });
        });
    });

    describe('cancellation', () => {
        it('should return cancel when user cancels predefined confirm', async () => {
            const cancelSymbol = Symbol('cancel');
            vi.mocked(p.confirm).mockResolvedValue(cancelSymbol);
            vi.mocked(p.isCancel).mockReturnValue(true);

            const result = await collectPlanConfiguration();

            expect(result).toBe(cancelSymbol);
        });

        it('should return cancel when user cancels structure selection', async () => {
            const cancelSymbol = Symbol('cancel');
            vi.mocked(p.confirm).mockResolvedValue(true);
            vi.mocked(p.select).mockResolvedValue(cancelSymbol);
            vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

            const result = await collectPlanConfiguration();

            expect(result).toBe(cancelSymbol);
        });
    });
});
