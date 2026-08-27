---
'@qazuor/qzpay-core': major
'@qazuor/qzpay-drizzle': major
---

Make `list()` filters, ordering and paging actually work

Three options on `QZPayListOptions` were accepted and then silently discarded by
the Drizzle storage adapter, which read only `limit` and `offset`.

**`filters` was ignored entirely.** `subscriptions.list({ filters: { status: 'active' } })`
returned every status. This was not theoretical: it shipped a bug that mailed
customers a "your subscription renews soon" reminder every day for subscriptions
that had already lapsed, because the calling job trusted a filter that was never
applied. Callers around the codebase had independently grown defensive JS
post-filters against it without anyone finding the cause.

**`orderBy` / `orderDirection` were ignored too** — every query hardcoded
`created_at DESC`.

**`limit` defaulted to 20**, so a caller writing `list()` and naming the result
`allSubscriptions` quietly got the first 20 rows. `hasMore` was right there in
the result and nothing read it. Code inside this library worked around it with
`{ limit: 10000 }`, which is the same defect with a higher ceiling.

### Breaking changes

- `limit` is now **required** on `list()`, and `options` itself is required.
  Deciding a page size is no longer optional.
- `filters` is **typed per entity** instead of `Record<string, unknown>`. A
  filter the library cannot honour now fails to compile rather than being
  discarded at runtime.
- `orderBy` is typed per entity. Note that `updatedAt` is not available
  everywhere: checkout sessions, payment methods and promo codes have no such
  column. `createdAt` is the only column present on every entity and remains the
  default ordering.

### New

- `listAll()` on every entity storage: paginates internally and returns a plain
  array. This is the honest answer to what `{ limit: 10000 }` was reaching for.
  Accepts `batchSize` (default 200) and an optional `maxItems` cap — exceeding
  the cap throws `QZPayListAllLimitExceededError` rather than returning a
  truncated array, since silently returning a short list is the failure this API
  exists to remove.
- `resolveOrderBy` / `orderableColumnsOf` helpers. An `orderBy` that does not
  resolve to a real column throws `QZPayInvalidOrderByError` instead of falling
  back to a default ordering. Column names are never interpolated into SQL — the
  name is looked up on the Drizzle table object, so a hostile string cannot
  reach the query.

### Fixed

- `vendors.search()` declared a `query` filter in its options type and never
  read it. It now filters, matching the behaviour of the equivalent option on
  customers, plans and add-ons.

### Migration

```ts
// before
const result = await storage.subscriptions.list();
const subs = result.data;

// after — one page, explicit size
const result = await storage.subscriptions.list({ limit: 50 });
const subs = result.data;

// after — every row
const subs = await storage.subscriptions.listAll();

// after — every row, filtered (and the filter is now applied)
const active = await storage.subscriptions.listAll({ filters: { status: 'active' } });
```
