---
name: quality-check
description: Master quality validation before merge - runs code checks, tests, and reviews
type: quality
category: validation
---

# Quality Check Command

## ⚙️ Configuration

Ensure your project has these commands configured in `package.json`:

| Setting | Description | Example |
|---------|-------------|---------|
| `test` | Run test suite with coverage | `vitest run --coverage` |
| `lint` | Run linter | `eslint .` or `biome check .` |
| `typecheck` | Run TypeScript compiler | `tsc --noEmit` |

---

## Purpose

Master quality validation command that runs all quality checks before code can be merged. This is a **required gate** before any PR merge.

---

## Usage

```bash
/quality-check
```

---

## Execution Flow

### Step 1: Code Quality (STOP on error)
```bash
pnpm typecheck  # e.g., pnpm typecheck
pnpm lint       # e.g., pnpm lint
```
**Behavior**: If either fails, STOP and report errors. Do not continue.

### Step 2: Tests & Coverage (STOP on failure)
```bash
pnpm test  # e.g., pnpm test:coverage
```
**Behavior**:
- If tests fail, STOP and report failures
- If coverage < {{COVERAGE_TARGET}}%, STOP and report

### Step 3: Code Review (REPORT findings)
Invoke tech-lead agent for code review:
- Architecture patterns
- Code quality standards
- Documentation completeness

**Behavior**: Report all findings, do not stop.

### Step 4: Security Review (REPORT findings)
Check for:
- Input validation
- Authentication/authorization
- Sensitive data handling
- Dependency vulnerabilities

**Behavior**: Report all findings, do not stop.

### Step 5: Performance Review (REPORT findings)
Check for:
- N+1 queries
- Missing indexes
- Inefficient algorithms
- Bundle size (frontend)

**Behavior**: Report all findings, do not stop.

---

## Output Format

### Success
```
✅ QUALITY CHECK PASSED

📋 Results:
✅ TypeScript: No errors
✅ Linting: No issues
✅ Tests: 142 passed, 0 failed
✅ Coverage: 94.2% (target: 90%)

📝 Review Notes:
- Code follows patterns ✓
- Documentation complete ✓
- No security issues ✓
- Performance acceptable ✓

🚀 Ready to merge
```

### Failure (Critical)
```
❌ QUALITY CHECK FAILED

📋 Results:
✅ TypeScript: No errors
❌ Tests: 140 passed, 2 failed
⚠️ Coverage: 87.3% (target: 90%)

🛑 BLOCKING ISSUES:

1. Test Failures:
   - src/services/user.test.ts:45 - "should validate email"
   - src/api/auth.test.ts:78 - "should reject expired tokens"

2. Coverage Below Target:
   - Current: 87.3%
   - Required: 90%
   - Missing: src/utils/date-helper.ts (45% coverage)

Fix these issues before merging.
```

### Partial Success (Warnings)
```
⚠️ QUALITY CHECK PASSED WITH WARNINGS

📋 Results:
✅ TypeScript: No errors
✅ Linting: No issues
✅ Tests: 142 passed
✅ Coverage: 91.5%

⚠️ ADVISORY ISSUES:

Code Review:
- Medium: Missing JSDoc on 3 exported functions
- Low: Consider extracting repeated logic in UserService

Security Review:
- Low: Consider adding rate limiting to /api/auth endpoints

Performance Review:
- Medium: Potential N+1 query in getOrdersWithItems()

These don't block merge but should be addressed.
```

---

## Behavior Rules

| Check | On Failure |
|-------|------------|
| TypeScript errors | **STOP** - Must fix |
| Lint errors | **STOP** - Must fix |
| Test failures | **STOP** - Must fix |
| Coverage below target | **STOP** - Must fix |
| Code review issues | **REPORT** - Advisory |
| Security issues | **REPORT** - Advisory (unless Critical) |
| Performance issues | **REPORT** - Advisory |

**Exception**: Critical security issues should block merge.

---

## Issue Severity

| Severity | Description | Action |
|----------|-------------|--------|
| **Critical** | Security vulnerabilities, data loss risk | Must fix before merge |
| **High** | Bugs, broken functionality | Must fix before merge |
| **Medium** | Code quality, patterns, performance | Should fix, can merge |
| **Low** | Style, minor improvements | Nice to have |

---

## Quick Reference

```bash
# Run individual checks
pnpm typecheck
pnpm lint
pnpm test

# Run full quality check
/quality-check
```

---

## Related Commands

- `/code-check` - Only lint + typecheck (faster)
- `/run-tests` - Only tests with coverage
- `/security-audit` - Deep security review
- `/performance-audit` - Deep performance review

---

## When to Use

- **Required**: Before every PR merge
- **Recommended**: Before pushing to main
- **Optional**: During development for early feedback
