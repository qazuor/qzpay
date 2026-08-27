/**
 * Typed list options for storage adapters.
 *
 * ## Why this file exists
 *
 * `QZPayListOptions` used to declare `filters?: Record<string, unknown>` — a
 * fully open bag. Every storage adapter accepted any filter that a caller could
 * imagine, the compiler never objected, and the Drizzle adapter then read only
 * `limit`/`offset` and dropped `filters` on the floor. A caller asking for
 * `list({ filters: { status: 'active' } })` silently received every status.
 *
 * That is not a hypothetical: it shipped a bug that mailed real customers a
 * "your subscription renews soon" reminder every day for subscriptions that had
 * already lapsed, because the job trusted a filter that was never applied.
 *
 * So filters are now declared per entity. A filter this library cannot honour
 * fails to compile instead of being discarded in silence.
 *
 * `orderBy` had the same shape of defect — declared on the options type, never
 * read by any adapter, every query hardcoded `created_at DESC`. It is typed per
 * entity here for the same reason.
 *
 * @module adapters/list-options
 */

import type {
    QZPayBillingInterval,
    QZPayCurrency,
    QZPayInvoiceStatus,
    QZPayPaymentProvider,
    QZPayPaymentStatus,
    QZPaySubscriptionStatus
} from '../constants/index.js';

/**
 * A filter value that accepts either one value or a set of them.
 *
 * Deliberately a mutable array rather than `readonly T[]`: this is an input the
 * adapter only reads, and `readonly` here buys nothing while making every array
 * a caller already holds unassignable.
 */
export type QZPayOneOrMany<T> = T | T[];

/** Sort direction for {@link QZPayListOptions.orderBy}. */
export type QZPayOrderDirection = 'asc' | 'desc';

/**
 * Options for a single page of results.
 *
 * @typeParam TFilters - Filters this entity actually supports.
 * @typeParam TOrderBy - Column keys this entity can be ordered by.
 */
export interface QZPayListOptions<TFilters = Record<string, never>, TOrderBy extends string = never> {
    /**
     * Maximum number of rows to return.
     *
     * REQUIRED on purpose. This used to default to 20, which meant a caller
     * writing `list()` and naming the result `allSubscriptions` quietly received
     * the first 20 rows and no indication that more existed — `hasMore` was
     * right there in the result and nobody read it. Callers inside this library
     * worked around it with `{ limit: 10000 }`, which is the same defect with a
     * higher ceiling.
     *
     * Deciding a page size is now unavoidable. To read an entire table, use
     * `listAll`, which paginates properly.
     */
    limit: number;

    /** Rows to skip. Defaults to 0. */
    offset?: number;

    /**
     * Column to order by. Defaults to `createdAt`, the only column present on
     * every entity.
     */
    orderBy?: TOrderBy;

    /** Order direction. Defaults to `desc`. */
    orderDirection?: QZPayOrderDirection;

    /** Filters to apply. Every declared filter IS applied by the adapter. */
    filters?: TFilters;
}

/**
 * Options for reading every matching row, paginating internally.
 *
 * There is deliberately no `limit`/`offset` here: this is the "I want all of
 * them" case that callers previously expressed as `{ limit: 10000 }`.
 *
 * @typeParam TFilters - Filters this entity actually supports.
 * @typeParam TOrderBy - Column keys this entity can be ordered by.
 */
export interface QZPayListAllOptions<TFilters = Record<string, never>, TOrderBy extends string = never> {
    /** Filters to apply. Every declared filter IS applied by the adapter. */
    filters?: TFilters;

    /** Column to order by. Defaults to `createdAt`. */
    orderBy?: TOrderBy;

    /** Order direction. Defaults to `desc`. */
    orderDirection?: QZPayOrderDirection;

    /** Rows fetched per internal page. Defaults to 200. */
    batchSize?: number;

    /**
     * Safety cap on total rows collected.
     *
     * When the result set exceeds this, the call THROWS rather than returning a
     * truncated array. Silently returning a short list is precisely the failure
     * this API exists to eliminate, so it is never the fallback behaviour.
     *
     * Unset means no cap — the caller is asking for everything and gets it.
     */
    maxItems?: number;
}

/* ------------------------------------------------------------------ *
 * Per-entity filters
 *
 * `livemode` is intentionally absent from all of these: it is fixed per
 * adapter instance at construction time, not chosen per query.
 * ------------------------------------------------------------------ */

/** Filters supported when listing customers. */
export interface QZPayCustomerFilters {
    /** Case-insensitive match across email, name and external id. */
    query?: string;
}

/** Filters supported when listing checkout sessions. */
export interface QZPayCheckoutFilters {
    customerId?: string;
    status?: QZPayOneOrMany<'open' | 'complete' | 'expired'>;
}

/** Filters supported when listing subscriptions. */
export interface QZPaySubscriptionFilters {
    customerId?: string;
    /**
     * Restricts to subscriptions on one plan.
     *
     * The admin HTTP route has advertised a `planId` query parameter all along
     * while the filter did not exist, so the endpoint returned every plan's
     * subscriptions regardless.
     */
    planId?: string;
    status?: QZPayOneOrMany<QZPaySubscriptionStatus>;
}

/** Filters supported when listing payments. */
export interface QZPayPaymentFilters {
    customerId?: string;
    subscriptionId?: string;
    status?: QZPayOneOrMany<QZPayPaymentStatus>;
    provider?: QZPayPaymentProvider;
    /** Lower bound on `createdAt`, inclusive. */
    startDate?: Date;
    /** Upper bound on `createdAt`, inclusive. */
    endDate?: Date;
    /**
     * Lower bound on `amount`, inclusive, in the currency's minor unit.
     *
     * Like `planId` on subscriptions, the admin HTTP route advertised
     * `minAmount`/`maxAmount` while no such filter existed, so the amount range
     * was silently ignored.
     */
    minAmount?: number;
    /** Upper bound on `amount`, inclusive, in the currency's minor unit. */
    maxAmount?: number;
}

/** Filters supported when listing payment methods. */
export interface QZPayPaymentMethodFilters {
    customerId?: string;
    type?: string;
    provider?: QZPayPaymentProvider;
}

/** Filters supported when listing invoices. */
export interface QZPayInvoiceFilters {
    customerId?: string;
    subscriptionId?: string;
    status?: QZPayOneOrMany<QZPayInvoiceStatus>;
    /** Lower bound on `createdAt`, inclusive. */
    startDate?: Date;
    /** Upper bound on `createdAt`, inclusive. */
    endDate?: Date;
}

/** Filters supported when listing plans. */
export interface QZPayPlanFilters {
    /** Case-insensitive match across name and description. */
    query?: string;
    active?: boolean;
}

/** Filters supported when listing prices. */
export interface QZPayPriceFilters {
    planId?: string;
    currency?: QZPayCurrency;
    billingInterval?: QZPayBillingInterval;
    active?: boolean;
}

/** Filters supported when listing promo codes. */
export interface QZPayPromoCodeFilters {
    active?: boolean;
    type?: string;
}

/**
 * Onboarding progress of a vendor, as stored in `vendors.onboarding_status`.
 *
 * NOT `QZPayVendorStatus`, which is a different vocabulary describing the
 * vendor account itself (`pending | active | suspended | rejected`). The two
 * overlap only on `pending` and `rejected`, so using the account statuses here
 * would reject the valid `completed` and accept a meaningless `active` —
 * exactly the class of silently-wrong filter this module exists to prevent.
 */
export type QZPayVendorOnboardingStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

/** Filters supported when listing vendors. */
export interface QZPayVendorFilters {
    /** Case-insensitive match across vendor name and external id. */
    query?: string;
    onboardingStatus?: QZPayVendorOnboardingStatus;
    canReceivePayments?: boolean;
}

/** Filters supported when listing add-ons. */
export interface QZPayAddOnFilters {
    /** Case-insensitive match across name and description. */
    query?: string;
    active?: boolean;
    billingInterval?: QZPayBillingInterval;
}

/* ------------------------------------------------------------------ *
 * Per-entity orderable columns
 *
 * Only columns that genuinely exist on the entity appear here. `createdAt` is
 * the sole column present on all eleven tables; `updatedAt` is absent from
 * checkouts, payment methods and promo codes, so those unions are narrower.
 *
 * These unions are deliberately conservative — widening one later is a
 * non-breaking change, narrowing one is not.
 * ------------------------------------------------------------------ */

/** Columns customers can be ordered by. */
export type QZPayCustomerOrderBy = 'createdAt' | 'updatedAt';

/** Columns checkout sessions can be ordered by. This table has no `updatedAt`. */
export type QZPayCheckoutOrderBy = 'createdAt';

/** Columns subscriptions can be ordered by. */
export type QZPaySubscriptionOrderBy = 'createdAt' | 'updatedAt' | 'currentPeriodEnd';

/** Columns payments can be ordered by. */
export type QZPayPaymentOrderBy = 'createdAt' | 'updatedAt' | 'amount';

/** Columns payment methods can be ordered by. This table has no `updatedAt`. */
export type QZPayPaymentMethodOrderBy = 'createdAt';

/** Columns invoices can be ordered by. */
export type QZPayInvoiceOrderBy = 'createdAt' | 'updatedAt';

/** Columns plans can be ordered by. */
export type QZPayPlanOrderBy = 'createdAt' | 'updatedAt';

/** Columns prices can be ordered by. */
export type QZPayPriceOrderBy = 'createdAt' | 'updatedAt';

/** Columns promo codes can be ordered by. This table has no `updatedAt`. */
export type QZPayPromoCodeOrderBy = 'createdAt';

/** Columns vendors can be ordered by. */
export type QZPayVendorOrderBy = 'createdAt' | 'updatedAt';

/** Columns add-ons can be ordered by. */
export type QZPayAddOnOrderBy = 'createdAt' | 'updatedAt';
