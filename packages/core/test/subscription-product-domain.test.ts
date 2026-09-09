/**
 * `productDomain` on subscription creation.
 *
 * The field is REQUIRED on `QZPayCreateSubscriptionInput` rather than
 * optional, and these tests pin the three properties that requirement is
 * meant to buy:
 *
 * 1. whatever the caller states reaches storage verbatim,
 * 2. two callers stating two domains get two rows, not one value for both,
 * 3. a domain that is present but empty is refused BEFORE anything is
 *    persisted — an unstated domain must never become a row.
 *
 * Every assertion reads the value written, never merely that a value was
 * written: "not null" is exactly what a column default already gives, so an
 * assertion of that shape would pass against the very failure this field
 * exists to end.
 */
import { describe, expect, it, type vi } from 'vitest';
import type { QZPayStorageAdapter } from '../src/adapters/storage.adapter.js';
import { createQZPayBilling } from '../src/billing.js';
import { QZPayValidationError } from '../src/errors/index.js';
import type { QZPayPlan, QZPayPrice } from '../src/types/plan.types.js';
import { createMockStorageAdapter } from './mocks/mock-storage.adapter.js';

/**
 * Plans carry an in-line price so `subscriptions.create` resolves it from
 * config; the mock storage adapter exposes no `prices` store to fall back to.
 */
function priceFor(planId: string): QZPayPrice {
    return {
        id: `price_${planId}`,
        planId,
        nickname: null,
        currency: 'ars',
        unitAmount: 1000,
        billingInterval: 'month',
        intervalCount: 1,
        trialDays: null,
        active: true,
        providerPriceIds: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

const PLANS: QZPayPlan[] = [
    {
        id: 'plan_host',
        name: 'Host Plan',
        description: 'A plan in one product line',
        active: true,
        prices: [priceFor('plan_host')],
        metadata: {}
    },
    {
        id: 'plan_diner',
        name: 'Diner Plan',
        description: 'A plan in a different product line',
        active: true,
        prices: [priceFor('plan_diner')],
        metadata: {}
    }
];

/**
 * Read back the `productDomain` the billing layer handed to storage for the
 * n-th `subscriptions.create` call.
 *
 * Reads the recorded argument directly instead of matching it with
 * `expect.objectContaining`, which is blind to a field that is absent
 * altogether — the exact shape this suite has to be able to fail on.
 */
function domainPassedToStorage(storage: QZPayStorageAdapter, callIndex = 0): unknown {
    const create = storage.subscriptions.create as ReturnType<typeof vi.fn>;
    const call = create.mock.calls[callIndex];
    expect(call, `storage.subscriptions.create was not called ${callIndex + 1} time(s)`).toBeDefined();
    return (call?.[0] as { productDomain?: unknown } | undefined)?.productDomain;
}

describe('subscriptions.create productDomain', () => {
    it('hands the stated domain to storage verbatim', async () => {
        const storage = createMockStorageAdapter();
        const billing = createQZPayBilling({ storage, plans: PLANS });

        await billing.subscriptions.create({
            customerId: 'cus_1',
            planId: 'plan_diner',
            productDomain: 'gastronomy'
        });

        expect(domainPassedToStorage(storage)).toBe('gastronomy');
    });

    it('keeps two callers in two domains apart', async () => {
        // A forward that hardcodes one value satisfies the test above and
        // fails this one: the two rows must differ, and neither may be the
        // value a storage default would have supplied.
        const storage = createMockStorageAdapter();
        const billing = createQZPayBilling({ storage, plans: PLANS });

        await billing.subscriptions.create({
            customerId: 'cus_1',
            planId: 'plan_host',
            productDomain: 'accommodation'
        });
        await billing.subscriptions.create({
            customerId: 'cus_2',
            planId: 'plan_diner',
            productDomain: 'tourist'
        });

        expect(domainPassedToStorage(storage, 0)).toBe('accommodation');
        expect(domainPassedToStorage(storage, 1)).toBe('tourist');
    });

    it('trims surrounding whitespace rather than storing it', async () => {
        const storage = createMockStorageAdapter();
        const billing = createQZPayBilling({ storage, plans: PLANS });

        await billing.subscriptions.create({
            customerId: 'cus_1',
            planId: 'plan_host',
            productDomain: '  accommodation  '
        });

        expect(domainPassedToStorage(storage)).toBe('accommodation');
    });

    it.each([
        ['an empty string', ''],
        ['whitespace only', '   ']
    ])('refuses %s and persists nothing', async (_label, value) => {
        const storage = createMockStorageAdapter();
        const billing = createQZPayBilling({ storage, plans: PLANS });

        await expect(
            billing.subscriptions.create({
                customerId: 'cus_1',
                planId: 'plan_host',
                productDomain: value
            })
        ).rejects.toBeInstanceOf(QZPayValidationError);

        // The row is the thing that matters: a blank domain that still
        // produced a subscription would be an unstated domain wearing a
        // value, which is the failure mode this field was made required to
        // end.
        expect(storage.subscriptions.create).not.toHaveBeenCalled();
    });

    it('refuses a missing domain from a caller that skipped the type check', async () => {
        const storage = createMockStorageAdapter();
        const billing = createQZPayBilling({ storage, plans: PLANS });

        // TypeScript rejects this shape; JavaScript callers, JSON bodies and
        // `as` casts do not, and those are the ones that produced the
        // original defect.
        const input = { customerId: 'cus_1', planId: 'plan_host' } as unknown as Parameters<typeof billing.subscriptions.create>[0];

        await expect(billing.subscriptions.create(input)).rejects.toBeInstanceOf(QZPayValidationError);
        expect(storage.subscriptions.create).not.toHaveBeenCalled();
    });
});
