---
name: qa-criteria-validator
category: qa
description: Validate implementation against acceptance criteria, UI/UX, accessibility, performance, and security
usage: Use before feature completion to ensure all quality standards are met
input: Acceptance criteria, implementation, design specifications, performance budgets
output: Validation report, issue list with priorities, sign-off documentation
---

# QA Criteria Validator

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| COVERAGE_TARGET | Minimum test coverage | `90%` |
| LCP_TARGET | Largest Contentful Paint | `2.5s` |
| FID_TARGET | First Input Delay | `100ms` |
| CLS_TARGET | Cumulative Layout Shift | `0.1` |
| BUNDLE_TARGET | Max bundle size | `300KB` |
| A11Y_STANDARD | Accessibility standard | `WCAG AA`, `WCAG AAA` |
| LIGHTHOUSE_MIN | Min Lighthouse score | `90` |

## Purpose

Validate implementation against acceptance criteria, ensuring functionality, UI/UX compliance, accessibility, performance, and security before release.

## Capabilities

- Validate functional requirements
- Check UI/UX compliance
- Verify accessibility standards
- Validate performance benchmarks
- Check security requirements
- Verify test coverage
- Generate validation reports

## Validation Process

### 1. Review Requirements

**Read acceptance criteria:**
1. Locate requirements document
2. Review functional requirements
3. Note non-functional requirements
4. Identify edge cases
5. Review UI/UX specifications

### 2. Functional Validation

**Test each criterion:**

| Criterion | Status | Evidence | Issues |
|-----------|--------|----------|--------|
| Feature works as expected | Pass/Fail | Test results | List issues |
| Edge cases handled | Pass/Fail | Edge case tests | List issues |
| Error states implemented | Pass/Fail | Error scenarios | List issues |

**Validation:**
- [ ] All acceptance criteria met
- [ ] Edge cases handled
- [ ] Error states tested
- [ ] Integration working

### 3. UI/UX Validation

**Visual compliance:**
- [ ] Matches design mockups
- [ ] Uses design system correctly
- [ ] Typography follows standards
- [ ] Spacing consistent
- [ ] Colors from palette
- [ ] Interactive states defined (hover, focus, active, disabled)

**Responsive design:**
- [ ] Works on mobile (320px+)
- [ ] Works on tablet (768px+)
- [ ] Works on desktop (1024px+)
- [ ] Touch targets >= 44x44px
- [ ] Text readable at all sizes

**Content:**
- [ ] All required fields displayed
- [ ] Text truncation appropriate
- [ ] Images have alt text
- [ ] Formatting correct
- [ ] Icons semantically appropriate

### 4. Accessibility Validation

**{{A11Y_STANDARD}} Checklist:**

**Perceivable:**
- [ ] All images have alt text
- [ ] Color contrast >= 4.5:1 (normal text)
- [ ] Color contrast >= 3:1 (large text)
- [ ] Color not sole indicator
- [ ] Text resizable to 200%

**Operable:**
- [ ] All functionality keyboard accessible
- [ ] Logical tab order
- [ ] Visible focus indicators
- [ ] No keyboard traps
- [ ] Skip to main content link

**Understandable:**
- [ ] Lang attribute set
- [ ] Form labels associated
- [ ] Error messages clear
- [ ] Consistent navigation
- [ ] Predictable behavior

**Robust:**
- [ ] Valid HTML
- [ ] ARIA used correctly
- [ ] Screen reader compatible
- [ ] No console errors

**Automated testing:**

```bash
# Run accessibility tests
{{A11Y_TEST_COMMAND}}

# Check specific page
npx pa11y {{URL}}
```

### 5. Performance Validation

**Core Web Vitals:**
- [ ] LCP < {{LCP_TARGET}}
- [ ] FID < {{FID_TARGET}}
- [ ] CLS < {{CLS_TARGET}}
- [ ] TTI < 3.5s

**Bundle Size:**
- [ ] Main bundle < {{BUNDLE_TARGET}}
- [ ] Route chunks optimized
- [ ] Images optimized
- [ ] Lazy loading implemented

**Runtime Performance:**
- [ ] API responses < 2s (p95)
- [ ] Database queries < 100ms
- [ ] No memory leaks
- [ ] No unnecessary re-renders

**Testing:**

```bash
# Lighthouse audit
npx lighthouse http://localhost:3000 --output=json

# Bundle analysis
pnpm build --analyze
```

### 6. Security Validation

**Security checklist:**

**Authentication & Authorization:**
- [ ] Protected endpoints require auth
- [ ] Users can only access own resources
- [ ] Admin functions protected
- [ ] Tokens validated
- [ ] Sessions secure

**Input Validation:**
- [ ] All inputs validated server-side
- [ ] SQL injection prevented
- [ ] XSS prevention implemented
- [ ] CSRF protection enabled

**Data Protection:**
- [ ] Sensitive data encrypted
- [ ] No secrets in code
- [ ] HTTPS enforced
- [ ] Security headers configured

**Error Handling:**
- [ ] No sensitive data in errors
- [ ] Errors logged securely
- [ ] Generic messages to users
- [ ] Stack traces hidden

**Testing:**

```bash
# Dependency audit
{{AUDIT_COMMAND}}
```

### 7. Test Coverage Validation

**Coverage requirements:**
- [ ] Lines >= {{COVERAGE_TARGET}}
- [ ] Functions >= {{COVERAGE_TARGET}}
- [ ] Branches >= {{COVERAGE_TARGET}}
- [ ] Statements >= {{COVERAGE_TARGET}}

**Test types:**
- [ ] Unit tests for business logic
- [ ] Integration tests for services
- [ ] Component tests for UI
- [ ] E2E tests for critical paths
- [ ] Accessibility tests automated

**Check coverage:**

```bash
# Run tests with coverage
pnpm test --coverage

# View report
open coverage/index.html
```

### 8. Error Handling Validation

**Error scenarios:**

**Network Errors:**
- [ ] API timeout handled
- [ ] Network offline detected
- [ ] Retry mechanism available
- [ ] User notified clearly

**Validation Errors:**
- [ ] Form errors displayed inline
- [ ] Messages helpful and specific
- [ ] Fields highlighted
- [ ] Summary at top

**Server Errors:**
- [ ] 500 errors handled gracefully
- [ ] Generic message shown
- [ ] Error logged
- [ ] Retry or support option

**Not Found Errors:**
- [ ] 404 page exists
- [ ] Helpful navigation provided
- [ ] Search or home link available

## Validation Report Template

```markdown
# QA Validation Report: [Feature Name]

**Date:** YYYY-MM-DD
**Validator:** QA Engineer
**Feature:** [Feature Name]
**Requirements:** [Document Reference]

## Executive Summary

**Overall Status:** PASS / FAIL / PASS WITH ISSUES

**Summary:**
[Brief summary of validation results]

**Recommendation:**
- [ ] Ready for production
- [ ] Minor fixes needed
- [ ] Major fixes required

## Functional Validation

| Criterion | Status | Evidence | Issues |
|-----------|--------|----------|--------|
| Criterion 1 | PASS | Details | None |
| Criterion 2 | FAIL | Details | Issue description |

## UI/UX Validation

- Visual compliance: PASS/FAIL
- Responsive design: PASS/FAIL
- Interactive states: PASS/FAIL

**Issues:**
[List issues with severity and recommendations]

## Accessibility Validation

- {{A11Y_STANDARD}} compliance: PASS/FAIL
- Automated tests: X violations
- Screen reader: PASS/FAIL

## Performance Validation

- LCP: Xs (target: {{LCP_TARGET}})
- Bundle: XKB (target: {{BUNDLE_TARGET}})
- Lighthouse: X/100

## Security Validation

- Authentication: PASS/FAIL
- Input validation: PASS/FAIL
- Data protection: PASS/FAIL

## Test Coverage

- Lines: X% (target: {{COVERAGE_TARGET}})
- Functions: X%
- Branches: X%

## Recommendations

### Must Fix (Before Release)
1. [Critical issue]

### Should Fix (Nice to Have)
1. [Minor issue]

### Future Improvements
1. [Enhancement]

## Sign-off

**QA Engineer:** ________ **Date:** ________
**Tech Lead:** ________ **Date:** ________
**Product Owner:** ________ **Date:** ________
```

## Quick Validation Checklist

```markdown
## Quick QA Checklist

### Functional
- [ ] Feature works as described
- [ ] No console errors
- [ ] Error states handled

### Visual
- [ ] Matches design
- [ ] Responsive
- [ ] Brand compliant

### Accessibility
- [ ] Keyboard accessible
- [ ] Screen reader friendly
- [ ] Color contrast OK

### Performance
- [ ] Loads quickly
- [ ] No lag

### Tests
- [ ] Tests exist and pass
- [ ] Coverage >= {{COVERAGE_TARGET}}
```

## Output

**Produces:**
1. Validation report with pass/fail status
2. Issue list with severity and recommendations
3. Evidence (screenshots, metrics, test results)
4. Coverage report
5. Release readiness recommendation
6. Sign-off documentation

**Success Criteria:**
- All critical criteria met
- No critical/high bugs
- Performance targets met
- Accessibility compliant
- Coverage >= {{COVERAGE_TARGET}}

## Related Skills

- `web-app-testing` - Testing methodology
- `security-testing` - Security validation
- `performance-testing` - Performance validation
