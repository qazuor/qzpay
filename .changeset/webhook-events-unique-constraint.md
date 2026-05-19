---
'@qazuor/qzpay-drizzle': patch
---

Mark `billing_webhook_events.provider_event_id` as `uniqueIndex` instead of a plain index. Webhook handlers in downstream consumers rely on an optimistic-insert idempotency pattern that depends on a UNIQUE violation surfacing when the same provider event arrives twice — without the constraint the duplicate INSERT silently succeeds and the downstream dispatcher runs twice. Consumers will pick up the constraint on their next `drizzle-kit push` (the index name is unchanged, so the migration is a CREATE UNIQUE INDEX replacement).
