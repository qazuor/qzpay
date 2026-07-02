---
"@qazuor/qzpay-drizzle": minor
---

Add generic `productDomain`, `promoEffectRemainingCycles`, and typed promo-code effect columns (`effectKind`, `valueKind`, `durationCycles`, `extraDays`).

- `billingSubscriptions.productDomain` and `billingPlans.productDomain`: free-form discriminator for the product/business line a subscription or plan belongs to. QZPay has no opinion on the value set; consumers with a single product line can ignore it.
- `billingSubscriptions.promoEffectRemainingCycles`: countdown of remaining billing cycles for a multi-cycle promo effect.
- `billingPromoCodes.effectKind`/`valueKind`/`durationCycles`/`extraDays`: typed promo-code effect columns supporting discount, trial-extension, and comp (permanently complimentary) effects, alongside the existing `type` (`QZPayDiscountType`) column.

Includes migration `0004_add_billing_generic_extension_columns.sql` (additive, existing rows get placeholder defaults — same pattern as `0003_add_plan_typed_attribute_columns.sql`).

These promote columns the first adopter (Hospeda) had added via its own app-level migration carril because qzpay-drizzle didn't declare them, which made `drizzle-kit push` treat them as extraneous and block on an unanswerable data-loss confirmation prompt in any non-interactive environment.
