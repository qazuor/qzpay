---
'@qazuor/qzpay-drizzle': minor
---

Add typed courtesy-window columns to `billing_subscriptions`

A complimentary ("courtesy") window — a subscriber who already pays being
gifted one or more cycles — needs three facts recorded: when the gift starts,
when it ends, and how many cycles it covers. `billing_subscriptions` declared
none of them, so the first adopter kept all three inside the `metadata` jsonb
and wrote an accessor module to hide that.

Three nullable columns now carry them as first class:

- `courtesy_starts_at` (timestamptz) — when the gift begins, which is normally
  the end of the period the subscriber already paid for rather than the instant
  it was granted;
- `courtesy_ends_at` (timestamptz) — when it expires;
- `courtesy_cycles_granted` (integer) — how many cycles it covers, for display
  and audit. The window's authority is the start/end pair, not this count.

This is the same promotion `product_domain` and `promo_effect_remaining_cycles`
went through: a column the first consumer had to fake in jsonb becomes one the
schema declares. QZPay stores them and has no opinion on when a window opens or
what it entitles — that stays with the consuming application, including the
pairing invariant, since a window with an end but no start is a half-written
record that must never read as live.

Ships with `migrations/0007_add_subscription_courtesy_columns.sql`, which adds
the columns and one PARTIAL index on `courtesy_ends_at WHERE courtesy_ends_at
IS NOT NULL`. Only rows inside a window can expire and they are a small
minority, so an expiry sweep costs the number of open gifts rather than the
size of the table — the same reasoning as the existing pending-plan-change
index.

Purely additive: all three columns are nullable with no DEFAULT, so existing
rows are untouched and every current query keeps its meaning. A consumer moving
windows out of its own jsonb owns that data migration.
