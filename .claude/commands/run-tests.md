---
name: run-tests
description: Execute test suite and validate coverage requirements
type: quality
category: validation
---

# Run Tests Command

## Purpose

Execute comprehensive test suite and validate coverage requirements. Stops at first failure.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| TEST_COMMAND | Test execution command | `pnpm test` |
| COVERAGE_COMMAND | Coverage command | `pnpm test:coverage` |
| COVERAGE_THRESHOLD | Minimum coverage % | `90` |
| PROJECT_ROOT | Project root directory | `/path/to/project` |
| STOP_ON_ERROR | Stop on first failure | `true` |

## Usage

```bash
/run-tests
```

## Execution Flow

### 1. Test Execution

**Process:**

| Step | Action |
|------|--------|
| 1 | Navigate to /home/qazuor/projects/PACKAGES/qzpay |
| 2 | Execute pnpm test |
| 3 | Run all test suites |
| 4 | Stop on first failure |

**Test Categories:**

- Unit tests
- Integration tests
- API/Endpoint tests
- Component tests

**Output on Failure:**

```text
❌ TESTS FAILED

Test: {{TEST_NAME}}
File: {{FILE_PATH}}:{{LINE}}

Expected: {{EXPECTED}}
Received: {{ACTUAL}}

Error: {{ERROR_MESSAGE}}

Fix required before proceeding.
```

### 2. Coverage Validation

**Process:**

| Step | Action |
|------|--------|
| 1 | Execute pnpm test --coverage |
| 2 | Validate coverage thresholds |
| 3 | Generate coverage report |
| 4 | Identify uncovered code |

**Coverage Metrics:**

| Metric | Threshold |
|--------|-----------|
| Statements | ≥ {{COVERAGE_THRESHOLD}}% |
| Branches | ≥ {{COVERAGE_THRESHOLD}}% |
| Functions | ≥ {{COVERAGE_THRESHOLD}}% |
| Lines | ≥ {{COVERAGE_THRESHOLD}}% |

**Output on Insufficient Coverage:**

```text
❌ INSUFFICIENT COVERAGE

Coverage Results:
❌ Statements: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)
❌ Branches: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)
❌ Functions: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)
❌ Lines: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)

Uncovered Files:
- {{FILE_PATH}} (Lines: {{UNCOVERED_LINES}})

Add tests for uncovered code paths.
```

## Quality Standards

| Category | Requirements |
|----------|--------------|
| **Test Structure** | AAA pattern (Arrange, Act, Assert) |
| **Coverage** | Minimum {{COVERAGE_THRESHOLD}}% across all metrics |
| **Test Isolation** | No dependencies between tests |
| **Assertions** | Clear, specific assertions |

## Output Format

### Success

```text
✅ TESTS PASSED

Test Results:
✅ Unit Tests: {{PASSED}}/{{TOTAL}} passed
✅ Integration Tests: {{PASSED}}/{{TOTAL}} passed
✅ All test suites passing

Coverage Results:
✅ Statements: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)
✅ Branches: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)
✅ Functions: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)
✅ Lines: {{ACTUAL}}% (target: ≥{{THRESHOLD}}%)

🚀 All quality standards met
```

### Failure

```text
❌ TESTS FAILED

{{ERROR_DETAILS}}

Fix failing tests or add missing coverage.
```

## Related Commands

- `/quality-check` - Full quality validation
- `/code-check` - Code quality validation
- `/review-code` - Code review

## When to Use

- Before every commit
- As part of `/quality-check`
- After significant changes
- In CI/CD pipeline
