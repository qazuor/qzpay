# ADR-005: Email Suppress System

## Status

Accepted

## Date

2024-12-26

## Context

Problem: Some projects want to send their own branded emails, not use package defaults. Without coordination:
- Duplicate emails sent to customers
- Missing notifications when both assume the other handles it
- No way to customize specific notifications

## Decision

Implement a suppress system with `emailSentByPackage` indicator:

### Configuration

```typescript
const billing = createQZPayBilling({
  notifications: {
    suppress: [
      QZPayBillingEvent.TRIAL_EXPIRING,
      QZPayBillingEvent.SUBSCRIPTION_EXPIRING,
    ],
  },
});
```

### Event Indicator

Every event includes `emailSentByPackage` boolean:

```typescript
billing.on(QZPayBillingEvent.TRIAL_EXPIRING, async (event) => {
  if (!event.emailSentByPackage) {
    // Package didn't send email, project handles it
    await sendCustomEmail(event.customer, event.daysLeft);
  }
});
```

### Behavior

| Event | Suppressed? | emailSentByPackage | Project Action |
|-------|-------------|-------------------|----------------|
| TRIAL_EXPIRING | No | true | Optional custom handling |
| TRIAL_EXPIRING | Yes | false | Must send own email |
| PAYMENT_SUCCEEDED | No | true | Optional custom handling |

## Consequences

### Positive

- No duplicate emails
- Clear responsibility
- Projects can mix package and custom emails
- Full flexibility for branding
- Easy to implement custom notifications

### Negative

- Projects must check `emailSentByPackage`
- Configuration required for custom emails
- Must document which events send emails by default

## Alternatives Considered

### 1. All-or-Nothing

Either package sends all emails or none.

- **Rejected**: Projects often want to customize only some emails

### 2. Template Customization

Allow customizing email templates in package.

- **Rejected**: Too complex, limits project flexibility

### 3. Webhook-Only

Never send emails, only emit events.

- **Rejected**: Would require every project to implement email sending

## References

- [Events Reference](../05-api/EVENTS.md)
- [Architecture Patterns](../03-architecture/PATTERNS.md)
