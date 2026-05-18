---
'@qazuor/qzpay-core': patch
---

fix(core): use global crypto.randomUUID for checkout session IDs

The previous fix (use UUID for checkout session IDs) imported `randomUUID`
from `node:crypto`. That broke the browser-bound playground build because
Vite externalizes `node:crypto` for browser compatibility, and the
externalized shim does not export `randomUUID`:

```
../../packages/core/dist/index.js (1:9):
  "randomUUID" is not exported by "__vite-browser-external"
```

Switch to the global `crypto.randomUUID()` (Web Crypto API, available in
Node 19+ and all modern browsers). This matches the existing pattern
already used throughout `billing.ts` for every other UUID-generated entity
(subscriptions, payments, invoices, customers, …), so the import was the
outlier — removing it brings the file in line with the rest of qzpay-core.

No behavior change: tests still produce UUIDv4-shaped session IDs.
