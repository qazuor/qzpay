---
name: commit
description: Generate conventional commit messages following project standards
type: git
category: version-control
---

# Commit Command

## Purpose

Generate conventional commit messages following project standards, analyze changed files, group changes logically, and provide copy-paste ready git commands.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `commit_types` | Allowed commit types | `feat, fix, refactor, docs, style, test, build, ci, chore` |
| `scopes.backend` | Backend scopes | `api, db, services, auth` |
| `scopes.frontend` | Frontend scopes | `web, admin, components, hooks` |
| `scopes.shared` | Shared scopes | `types, schemas, config, deps` |
| `subject_max_length` | Subject line limit | `72` |
| `body_wrap_length` | Body line wrap | `72` |

## Usage

```bash
/commit
```

## Execution Flow

### Step 1: Analyze Git Status

**Actions**:

- Run `git status` for changed files
- Run `git diff` for unstaged changes
- Run `git diff --staged` for staged changes
- Run `git log` for recent commit style

### Step 2: Invoke Commit Helper

**Process**:

- Analyze changed files
- Group by logical units
- Identify commit types and scopes
- Generate conventional messages
- Format git commands

### Step 3: Present Commit Strategy

**Analysis**:

1. Changed areas identification
2. Commit grouping strategy
3. Conventional format application

### Step 4: Generate Commands

**Output**: Copy-paste ready git commands

## Commit Standards

### Format

```text
{type}({scope}): {subject}

{body}

{footer}
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactoring |
| `docs` | Documentation |
| `style` | Code style (no logic change) |
| `test` | Tests |
| `build` | Build system |
| `ci` | CI/CD |
| `chore` | Other changes |

### Scopes

Configure based on project structure:

- Backend: API, database, services
- Frontend: Apps, components, pages
- Shared: Types, config, dependencies

## Examples

### Single Feature

```bash
git add {files}
git commit -m "feat({scope}): {subject}

{body}

Closes #{issue}"
```

### Multi-Layer Feature

```bash
# Commit 1: Schema
git add {schema_files}
git commit -m "feat(schemas): add {entity} schemas"

# Commit 2: Database
git add {db_files}
git commit -m "feat(db): implement {entity} model"

# Commit 3: Service
git add {service_files}
git commit -m "feat(services): implement {entity} service"
```

## Best Practices

### Subject Line

**DO**:

- Use imperative mood
- Keep under configured max length
- Be specific and descriptive
- Use lowercase for type/scope

**DON'T**:

- Use past tense
- Capitalize first letter
- End with period
- Be vague

### Body

**DO**:

- Explain why, not what
- Use bullet points
- Wrap at configured length
- Include context

**DON'T**:

- Describe code (code shows that)
- Skip for complex changes
- Mix unrelated changes

### Footer

**Use for**:

- Breaking changes
- Issue references
- PR references

## Commit Strategy

### Decision Tree

```text
1. One logical unit?
   YES → Single commit
   NO → Multiple commits

2. Group by:
   - Layer (if cross-layer)
   - Feature (if independent)
   - Type (if mixed types)

3. Commit order:
   1. Schemas
   2. Database
   3. Services
   4. API
   5. Frontend
   6. Documentation
   7. Configuration
```

## Output Deliverables

1. Git status analysis
2. Changed files grouped
3. Commit strategy
4. Conventional messages
5. Copy-paste commands
6. Issue references

## Important Notes

### Execution

**CRITICAL**: Command generates suggestions but DOES NOT execute `git add` automatically.

**User must**:

1. Review suggestions
2. Stage files with `git add`
3. Execute `git commit` commands
4. Verify with `git log`

### When to Run

- After feature completion
- After bugfixes
- Before pull requests
- As part of quality workflow

## Related Commands

- `/quality-check` - Pre-commit validation
- `/code-check` - Lint/typecheck before commit
- `/run-tests` - Verify tests pass

## Error Prevention

### Avoid Committing

- Unrelated changes together
- Debug statements
- Broken code
- Secrets/credentials
- Commented-out code

### Always

- Run quality checks first
- Group related changes
- Write descriptive messages
- Reference issues
