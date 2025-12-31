---
name: add-memory
category: utils
description: Capture and document learnings, decisions, patterns, and best practices for knowledge continuity
usage: After making decisions, discovering patterns, solving problems, or establishing conventions
input: Learning topic, decision rationale, pattern description, context
output: Structured memory file in configured memory directory
---

# Add Memory

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `memory_path` | Memory storage directory | `.claude/memory/`, `docs/decisions/` |
| `categories` | Memory categories | `arch`, `patterns`, `gotchas`, `config` |
| `index_file` | Index file location | `memory/INDEX.md` |
| `date_format` | File naming date format | `YYYY-MM-DD` |
| `auto_index` | Auto-update index | `true` |

## Purpose

Capture architectural decisions, patterns, gotchas, and best practices for future reference and knowledge continuity across the team.

## Capabilities

- Document architectural decisions with rationale
- Record reusable code patterns
- Capture configuration learnings
- Track gotchas and solutions
- Build searchable knowledge base

## Memory Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `arch/` | Architecture decisions | Tech stack, system design, integrations |
| `patterns/` | Code patterns | RO-RO, base classes, factory patterns |
| `config/` | Configuration | Environment setup, tool config |
| `gotchas/` | Issues & solutions | Platform quirks, error fixes |
| `performance/` | Optimizations | Caching, query optimization |
| `security/` | Security patterns | Auth patterns, data protection |

## Memory Template

```markdown
---
topic: Brief topic name
category: arch|patterns|config|gotchas|performance|security
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
related: [file1.md, file2.md]
---

# Topic Title

## Context

When this is relevant and why it matters.

## Decision/Learning

What was decided or learned.

## Rationale

Why this approach was chosen over alternatives.

## Alternatives Considered

- **Option 1**: Description, pros/cons
- **Option 2**: Description, pros/cons

## Implementation

How to implement this decision/pattern.

### Example

\`\`\`typescript
// Code example demonstrating the pattern
\`\`\`

## Implications

- Impact on system
- Trade-offs accepted
- Future considerations

## References

- Related documentation
- External resources
```

## Example: Architectural Decision

```markdown
---
topic: Monorepo with TurboRepo
category: arch
date: 2024-01-15
tags: [monorepo, turborepo, build-system]
---

# Monorepo Structure with TurboRepo

## Context

Need to organize multiple apps and shared packages with code reuse.

## Decision

Adopt TurboRepo monorepo with apps/ and packages/ structure.

## Rationale

- Superior build caching (3x faster builds)
- Parallel task execution
- Simple configuration
- Atomic commits across changes
- Shared dependencies

## Alternatives Considered

- **Nx**: More features but steeper learning curve
- **Lerna**: Less active development
- **Separate repos**: Complex versioning

## Implementation

\`\`\`
project/
├── apps/          # Applications
├── packages/      # Shared packages
└── turbo.json     # Build pipeline
\`\`\`

## References

- [TurboRepo Docs](https://turbo.build)
```

## Example: Pattern

```markdown
---
topic: RO-RO Pattern
category: patterns
date: 2024-01-20
tags: [pattern, function-design, maintainability]
---

# RO-RO Pattern (Receive Object, Return Object)

## Context

Functions with multiple parameters become hard to maintain.

## Learning

Always use object parameters and return objects.

## Rationale

- Easy to add parameters without breaking changes
- Named parameters improve readability
- Better TypeScript autocomplete
- Easier to mock in tests

## Implementation

\`\`\`typescript
// ❌ Bad
function create(userId, itemId, quantity, notes) { }

// ✅ Good
interface CreateInput {
  userId: string;
  itemId: string;
  quantity: number;
  notes?: string;
}

interface CreateOutput {
  item: Item;
  success: boolean;
}

function create(input: CreateInput): CreateOutput { }
\`\`\`
```

## Example: Gotcha

```markdown
---
topic: Shell For Loop Limitation
category: gotchas
date: 2024-02-01
tags: [shell, bash, fish]
---

# Fish Shell For Loop Limitation

## Issue

Fish shell hangs on bash-style for loops with no error message.

## Solution

Use alternatives:

\`\`\`bash
# ❌ Don't (hangs in Fish)
for file in *.md; do echo $file; done

# ✅ Do (works everywhere)
find . -name "*.md" -exec echo {} \;
\`\`\`

## Prevention

- Use find -exec for file operations
- Create bash scripts for complex loops
- Check shell type before commands
```

## Workflow

### 1. Identify Type

Choose appropriate category for the learning.

### 2. Create File

Use configured naming: `{memory_path}/{category}/{date}-{topic-slug}.md`

### 3. Write Content

Follow template structure with all sections.

### 4. Update Index

If `auto_index` enabled, index updates automatically. Otherwise:

```markdown
# Memory Index

## Architectural Decisions

| Date | Topic | Tags |
|------|-------|------|
| 2024-01-15 | [Monorepo Structure](arch/2024-01-15-monorepo.md) | monorepo, turborepo |

## Patterns

| Date | Topic | Tags |
|------|-------|------|
| 2024-01-20 | [RO-RO Pattern](patterns/2024-01-20-ro-ro.md) | pattern, functions |
```

### 5. Link Related

Add cross-references to related memories.

## Best Practices

| Practice | Description |
|----------|-------------|
| **Be Specific** | Capture concrete decisions, not vague thoughts |
| **Include Context** | Explain when and why this matters |
| **Provide Examples** | Code examples are invaluable |
| **Explain Rationale** | Why this over alternatives |
| **Link Related** | Create knowledge graph |
| **Use Tags** | Make memories searchable |
| **Date Everything** | Track when decisions made |
| **Review Regularly** | Update or archive outdated |

## Checklist

- [ ] Appropriate category selected
- [ ] File named correctly with date
- [ ] All template sections filled
- [ ] Code examples provided
- [ ] Rationale clearly explained
- [ ] Tags added for searchability
- [ ] Index updated
- [ ] Related memories linked
