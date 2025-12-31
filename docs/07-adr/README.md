# Architecture Decision Records

## Overview

This directory contains Architecture Decision Records (ADRs) for @qazuor/qzpay. ADRs document significant architectural decisions made during the project, including context, options considered, and rationale.

---

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [001](./001-adapter-pattern.md) | Adapter Pattern for Extensibility | Accepted | 2024-12-26 |
| [002](./002-no-magic-strings.md) | No Magic Strings - Exported Constants | Accepted | 2024-12-26 |
| [003](./003-entitlements-and-limits.md) | Separate Entitlements and Limits | Accepted | 2024-12-26 |
| [004](./004-subscription-helpers.md) | Rich Subscription Objects with Helpers | Accepted | 2024-12-26 |
| [005](./005-email-suppress-system.md) | Email Suppress System | Accepted | 2024-12-26 |
| [006](./006-trial-without-payment.md) | Trial Without Payment Method | Accepted | 2024-12-26 |
| [007](./007-promo-vs-automatic-discounts.md) | Promo Codes vs Automatic Discounts | Accepted | 2024-12-26 |
| [008](./008-postinstall-message.md) | Postinstall Message Only | Accepted | 2024-12-26 |

---

## ADR Status

| Status | Description |
|--------|-------------|
| **Proposed** | Under discussion |
| **Accepted** | Decision made and in effect |
| **Deprecated** | No longer applicable |
| **Superseded** | Replaced by another ADR |

---

## ADR Template

```markdown
# ADR-XXX: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-YYY

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?

## Alternatives Considered
What other options were evaluated?
```

---

## Related Documents

- [Architecture Overview](../03-architecture/OVERVIEW.md)
- [Design Patterns](../03-architecture/PATTERNS.md)
