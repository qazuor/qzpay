# ADR-008: Postinstall Message Only

## Status

Accepted

## Date

2024-12-26

## Context

After package installation, developers need guidance on next steps. Common approaches:

1. **Automatic setup wizard**: Interactive CLI that configures everything
2. **Auto-generated config files**: Create starter config on install
3. **Postinstall message**: Simple message pointing to documentation

Each has trade-offs:
- Wizards can be intrusive and fail in CI environments
- Auto-generated files may conflict with existing configurations
- Messages are non-invasive but require developer action

## Decision

Use a **simple postinstall message** that:

1. Welcomes the developer
2. Points to quick start documentation
3. Shows basic setup example
4. Lists helpful commands

### Implementation

```typescript
// packages/core/scripts/postinstall.ts
console.log(`
╭──────────────────────────────────────────────────────────────╮
│                                                              │
│   🎉 Thanks for installing @qazuor/qzpay!                    │
│                                                              │
│   📚 Quick Start:                                            │
│   https://github.com/qazuor/qzpay/blob/main/docs/README.md   │
│                                                              │
│   🚀 Basic Setup:                                            │
│                                                              │
│   import { createQZPayBilling } from '@qazuor/qzpay-core';   │
│   import { stripeAdapter } from '@qazuor/qzpay-stripe';      │
│   import { drizzleStorage } from '@qazuor/qzpay-drizzle';    │
│                                                              │
│   const billing = createQZPayBilling({                       │
│     payment: stripeAdapter({ apiKey: '...' }),               │
│     storage: drizzleStorage(db),                             │
│   });                                                        │
│                                                              │
╰──────────────────────────────────────────────────────────────╯
`);
```

### package.json Configuration

```json
{
  "scripts": {
    "postinstall": "node scripts/postinstall.js"
  }
}
```

## Consequences

### Positive

- Non-invasive, no side effects
- Works in all environments (local, CI, Docker)
- No file conflicts
- Clear call to action
- Easy to skip if needed (`--ignore-scripts`)
- Fast, doesn't block installation

### Negative

- Requires developer to read and follow instructions
- May be missed if output is suppressed
- No interactive configuration help
- Must keep documentation link up-to-date

## Alternatives Considered

### 1. Interactive CLI Wizard

Run interactive setup after install.

- **Rejected**: Breaks in CI environments
- **Rejected**: Some developers find it intrusive
- **Rejected**: Adds complexity to package

### 2. Auto-generate Configuration

Create default config file on install.

- **Rejected**: May overwrite existing files
- **Rejected**: Creates files in wrong locations
- **Rejected**: Unexpected side effects from npm install

### 3. Separate init Command

Require explicit `npx qzpay init` after install.

- **Rejected**: Extra step developers may forget
- **Rejected**: More friction than message + docs

### 4. No Postinstall Action

Just install silently.

- **Rejected**: Missed opportunity for guidance
- **Rejected**: Developers may not know where to start

## References

- [Quick Start Guide](../README.md)
- [Architecture Overview](../03-architecture/OVERVIEW.md)
