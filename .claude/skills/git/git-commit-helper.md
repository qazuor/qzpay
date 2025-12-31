---
name: git-commit-helper
category: git
description: Generate conventional commit messages and group changes logically for clean git history
usage: When preparing commits, analyzing changes, or creating commit messages
input: Changed files, git status, commit context
output: Conventional commit messages and copy-paste ready git commands
---

# Git Commit Helper

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `commit_convention` | Message format | `conventional-commits`, `gitmoji` |
| `allowed_types` | Commit types | `feat`, `fix`, `docs`, `refactor`, etc. |
| `allowed_scopes` | Scope options | `api`, `db`, `web`, `admin`, `components` |
| `subject_max_length` | Max subject chars | `72` |
| `require_body` | Body required | `false` for simple changes |
| `breaking_change_prefix` | Breaking change format | `BREAKING CHANGE:` |

## Purpose

Generate conventional commit messages that follow standards, analyze changed files, group changes logically, and provide copy-paste ready commands.

## Commit Format

```text
{type}({scope}): {subject}

{body}

{footer}
```

**Components:**
- **type**: Category (required)
- **scope**: Area affected (optional)
- **subject**: Short summary (required, ≤ 72 chars)
- **body**: Details (optional)
- **footer**: Breaking changes, issues (optional)

## Commit Types

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature | `feat(api): add user search endpoint` |
| `fix` | Bug fix | `fix(auth): correct token expiration` |
| `docs` | Documentation | `docs(api): update endpoint docs` |
| `style` | Formatting | `style: format with prettier` |
| `refactor` | Code refactor | `refactor(service): extract validation` |
| `perf` | Performance | `perf(query): add database indexes` |
| `test` | Tests | `test(api): add integration tests` |
| `build` | Build system | `build: update dependencies` |
| `ci` | CI/CD | `ci: add E2E test workflow` |
| `chore` | Maintenance | `chore: update eslint config` |

## Scopes

### Backend

```text
api          - API routes
db           - Database/schemas
services     - Business logic
auth         - Authentication
validation   - Input validation
```

### Frontend

```text
web          - Web application
admin        - Admin dashboard
components   - React components
hooks        - Custom hooks
ui           - UI components
```

### Cross-cutting

```text
types        - TypeScript types
schemas      - Validation schemas
config       - Configuration
deps         - Dependencies
docs         - Documentation
```

## Message Guidelines

### Subject Line

✅ **Good:**
```text
feat(search): add full-text search
fix(pricing): handle zero price edge case
refactor(models): simplify base interface
```

❌ **Bad:**
```text
feat: added some stuff
FIX - bug
Refactoring things
```

**Rules:**
- Imperative mood ("add" not "added")
- Lowercase first letter
- No period at end
- Max configured length
- Specific and descriptive

### Body

✅ **Good:**
```text
fix(booking): prevent double booking

Check availability before creating booking by:
- Querying existing bookings for date range
- Ensuring no overlap with dates
- Adding unique constraint
- Returning clear error message

Prevents race conditions.

Fixes #156
```

**Rules:**
- Explain **why**, not just **what**
- Use bullet points for multiple changes
- Wrap at 72 characters
- Separate paragraphs with blank lines

## Grouping Changes

### Strategy

Group by logical units:
- One feature per commit
- One bug fix per commit
- Related changes together

### Example: Feature Development

Instead of one large commit:

```bash
# ❌ Bad: Everything together
git add .
git commit -m "feat: add booking feature"
```

Split logically:

```bash
# ✅ Good: Separate commits

# 1. Database schema
git add packages/db/src/schemas/booking/
git commit -m "feat(db): add booking schema

- Define table structure
- Add relationships
- Create indexes"

# 2. Service layer
git add packages/services/src/booking/
git commit -m "feat(services): implement booking service

- Add CRUD operations
- Implement validation
- Add tests (95% coverage)"

# 3. API routes
git add apps/api/src/routes/bookings/
git commit -m "feat(api): add booking endpoints

- POST /bookings - Create
- GET /bookings/:id - Details
- Add authentication"
```

## Workflow

### 1. Check Status

```bash
git status
git diff --stat
```

### 2. Analyze Changes

Identify changed areas:
- Backend: API, services, models
- Frontend: components, pages
- Shared: schemas, types
- Infrastructure: CI, config

### 3. Group Related

Group by:
- Same feature
- Same bug fix
- Same refactoring

### 4. Stage & Commit

```bash
# Stage specific files
git add path/to/file1 path/to/file2

# Create commit
git commit -m "feat(scope): subject

Body explaining changes

Closes #123"
```

## Copy-Paste Template

```bash
# === Commit 1: Database Schema ===
git add packages/db/src/schemas/resource/
git commit -m "feat(db): add resource schema

- Define table with required fields
- Add foreign key relationships
- Create indexes for queries"

# === Commit 2: Service Layer ===
git add packages/services/src/resource/
git commit -m "feat(services): implement resource service

- Add CRUD operations
- Implement validation logic
- Add 95% test coverage"

# === Commit 3: API Endpoints ===
git add apps/api/src/routes/resources/
git commit -m "feat(api): add resource endpoints

- POST /resources - Create
- GET /resources - List
- GET /resources/:id - Details
- Add authentication"
```

## Common Scenarios

### Bug Fix

```bash
git add src/utils/calculator.ts src/utils/calculator.test.ts
git commit -m "fix(pricing): correct weekend surcharge

Weekend check was using incorrect day values.
Changed to check day === 0 (Sunday) or day === 6 (Saturday).

Added tests for all weekdays to prevent regression.

Fixes #123"
```

### Refactoring

```bash
git add src/services/*/validation.ts
git commit -m "refactor(services): extract validation logic

- Create shared ValidationService
- Remove duplicate validation code
- Update services to use shared validator
- No behavior changes"
```

### Breaking Change

```bash
git commit -m "feat(api): change response format

BREAKING CHANGE: API now returns ISO 8601 dates.
Clients must update date parsing logic.

Migration guide: docs/migrations/v2.md"
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Atomic** | One logical change per commit |
| **Present Tense** | "add" not "added" |
| **Explain Why** | Body explains reasoning |
| **Reference Issues** | Use "Fixes #123", "Closes #456" |
| **Verify** | Check `git log -1` before push |
| **Test** | Ensure tests pass before commit |

## Checklist

- [ ] Changes grouped logically
- [ ] Commit type appropriate
- [ ] Scope accurate
- [ ] Subject clear and concise
- [ ] Body explains why (if needed)
- [ ] Issues referenced
- [ ] Tests passing
- [ ] No debug code or TODOs
- [ ] Breaking changes documented
