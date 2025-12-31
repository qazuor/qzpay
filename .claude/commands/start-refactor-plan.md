---
name: start-refactor-plan
description: Plan comprehensive refactoring with risk assessment and incremental steps
type: planning
category: planning
  refactor_path: "Base path for refactor sessions (e.g., .claude/sessions/refactor)"
  test_coverage_min: "Minimum test coverage percentage (e.g., 90)"
  issue_tracker: "Issue tracking system name"
---

# Start Refactor Plan Command

Plan comprehensive refactoring work safely with risk assessment, incremental steps, and test validation strategy.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `refactor_path` | Base directory for refactor sessions | `.claude/sessions/refactor` |
| `test_coverage_min` | Minimum test coverage required | `{{TEST_COVERAGE_MIN}}%` |
| `issue_tracker` | Issue tracking system | `none` |

## Usage

```bash
/start-refactor-plan {refactor_scope}
```

## Execution Flow

### Step 1: Current Code Analysis

**Agent:** `debugger`

**Deliverable:** Current state analysis with:

- Code smells and technical debt
- Architecture and dependency mapping
- Existing behavior documentation
- Potential breaking points

**Analysis Areas:**

| Area | Focus |
|------|-------|
| Code Quality | Complexity, maintainability |
| Performance | Bottlenecks, inefficiencies |
| Security | Vulnerabilities, exposures |
| Architecture | Pattern violations, inconsistencies |
| Testing | Coverage gaps, test quality |

### Step 2: Architecture Validation

**Agent:** `architecture-validator`

**Deliverable:** Architecture assessment with:

- Pattern compliance review
- Layering violations
- Dependency management issues
- SOLID principles adherence

### Step 3: Refactor Strategy

**Agent:** `product-technical`

**Deliverable:** Complete strategy document with:

- Refactoring objectives and success criteria
- Safe refactoring boundaries
- Backwards compatibility strategy
- Rollback procedures

### Step 4: Incremental Steps

**Agent:** `product-technical`

**Requirements:** Each step must:

- Be ≤ 2 hours of work
- Preserve functionality
- Pass all tests
- Allow rollback
- Have clear validation criteria

**Deliverable:** Step-by-step plan with validation points.

### Step 5: Test Strategy

**Agent:** `qa-engineer` with `web-app-testing` skill

**Deliverable:** Testing strategy with:

- Pre-refactor baseline
- Step-by-step validation plan
- Regression test enhancements
- Performance benchmarks

### Step 6: Risk Assessment

**Agent:** `tech-lead`

**Deliverable:** Risk assessment and approval covering:

- Business continuity impact
- Technical complexity
- Resource requirements
- Timeline feasibility
- Rollback strategy validation

## Refactor Session Structure

```text
.claude/sessions/refactor/{refactor_scope}/
├── current-analysis.md
├── architecture-issues.md
├── refactor-strategy.md
├── refactor-steps.md
├── test-strategy.md
├── risk-assessment.md
└── checkpoints/
```

## Quality Standards

### Analysis Requirements

- Comprehensive coverage of all code in scope
- Issues categorized by type and severity
- All dependencies mapped
- Current behavior documented
- Risk points identified

### Planning Requirements

- Atomic steps (≤ 2 hours each)
- Test validation for every step
- Clear rollback strategy
- Dependency-aware ordering
- Risk mitigation for each risk

### Safety Requirements

- No breaking changes for users
- No performance degradation
- ≥ {{TEST_COVERAGE_MIN}}% coverage maintained
- All steps pass CI/CD
- All changes documented

## Output Format

```text
✅ REFACTOR PLANNING COMPLETE

Refactor Scope: {refactor_scope}
Planning Session: .claude/sessions/refactor/{refactor_scope}/

Analysis Summary:
- Files Analyzed: {n}
- Issues Identified: {n} (high/medium/low)
- Architecture Violations: {n}
- Test Coverage Gaps: {n}%

Refactor Plan:
- Total Steps: {n} atomic steps
- Estimated Duration: {hours}
- Checkpoints: {n} validation points
- Risk Level: {level}

Test Strategy:
- Tests to Add: {n}
- Regression Tests: {n} enhanced
- Performance Tests: {n} benchmarks

Ready for safe, incremental refactoring
```

## Refactor Categories

### Architecture Refactoring

**Patterns:**

- Layer separation improvements
- Dependency injection
- Interface abstraction
- Error handling standardization

**Safety:** Gradual migration, adapter patterns, step-by-step updates

### Performance Refactoring

**Patterns:**

- Database optimization
- Caching implementation
- Algorithm efficiency
- Memory optimization

**Safety:** Performance benchmarks, load testing, automatic rollback

### Code Quality Refactoring

**Patterns:**

- Code smell elimination
- Technical debt reduction
- Test coverage improvements
- Documentation enhancement

**Safety:** Behavior preservation testing, regression validation

## Step Validation

All steps must pass:

| Validation Type | Criteria |
|----------------|----------|
| Functional | Tests pass, no regressions, API contracts maintained |
| Performance | Response times maintained, memory acceptable, queries stable |
| Quality | ≥{{TEST_COVERAGE_MIN}}% coverage, linting passes, patterns followed |

## Related Commands

- `/start-feature-plan` - Planning for new features
- `/quality-check` - Validation after steps
- `/review-code` - Code quality analysis
- `/review-performance` - Performance assessment

## When to Use

- **Required:** Before major architectural changes
- **Required:** When technical debt impacts development
- **Recommended:** Before performance optimization
- **Required:** When refactoring affects multiple packages

## Post-Command Actions

1. Review refactor plan with user
2. Ensure team alignment on scope
3. Set up monitoring and rollback mechanisms
4. Execute step-by-step with validation after each
5. Offer to sync to none
