---
name: code-check
description: Run linting and type checking validation
type: quality
category: validation
---

# Code Check Command

## Purpose

Run linting and type checking validation across the codebase. Stops at first error for immediate fixing.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| TYPECHECK_COMMAND | Type checking command | `pnpm typecheck` |
| LINT_COMMAND | Linting command | `pnpm lint` |
| PROJECT_ROOT | Project root directory | `/path/to/project` |
| STOP_ON_ERROR | Stop on first error | `true` |

## Usage

```bash
/code-check
```

## Execution Flow

### 1. Type Checking

**Process:**

| Step | Action |
|------|--------|
| 1 | Navigate to /home/qazuor/projects/PACKAGES/qzpay |
| 2 | Execute pnpm typecheck |
| 3 | Validate type compilation |
| 4 | Stop on first error |

**Output on Error:**

```text
❌ Type Check Failed

File: {{FILE_PATH}}:{{LINE}}:{{COL}}
Error: {{ERROR_MESSAGE}}

Fix required before proceeding.
```

### 2. Lint Validation

**Process:**

| Step | Action |
|------|--------|
| 1 | Execute pnpm lint |
| 2 | Apply linting rules |
| 3 | Check code style |
| 4 | Stop on first error |

**Output on Error:**

```text
❌ Lint Failed

File: {{FILE_PATH}}:{{LINE}}:{{COL}}
Rule: {{RULE_NAME}}
Error: {{ERROR_MESSAGE}}

Fix required before proceeding.
```

## Quality Standards

| Category | Checks |
|----------|--------|
| **Type Safety** | Strict mode, no implicit any, import resolution |
| **Code Style** | Formatting, import organization, best practices |
| **Code Quality** | No unused code, proper error handling |

## Output Format

### Success

```text
✅ CODE CHECK PASSED

Type Check:
✅ All files compile successfully
✅ No type errors found

Lint:
✅ All linting rules passed
✅ Code style consistent

🚀 Ready to proceed
```

### Failure

```text
❌ CODE CHECK FAILED

{{ERROR_DETAILS}}

Fix required before proceeding.
```

## Related Commands

- `/quality-check` - Full quality validation
- `/run-tests` - Test execution
- `/review-code` - Code review

## When to Use

- Before committing changes
- Before code reviews
- As part of CI/CD pipeline
- Required by `/quality-check`
