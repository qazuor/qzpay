---
name: accessibility-audit
category: audit
description: Comprehensive accessibility audit validating WCAG 2.1 Level AA compliance, ARIA implementation, keyboard navigation, and assistive technology support
usage: Use for accessibility compliance validation before deployment, after UI changes, or as part of regular accessibility assessments
input: Application URLs, user flows, component library, design system, accessibility requirements
output: Accessibility audit report with WCAG compliance status, violations by severity, remediation steps, and testing results
---

# Accessibility Audit

## Purpose

Comprehensive accessibility audit ensuring WCAG 2.1 compliance and inclusive user experience for all users.

**Category**: Audit
**Primary Users**: tech-lead
**Coordinates**: Accessibility validation and compliance verification

## When to Use

- Before production deployment
- After major UI/UX changes
- When adding new components or pages
- Regular accessibility reviews (quarterly recommended)
- Before launching public campaigns
- When compliance requirements mandate audits
- After receiving accessibility feedback

## Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| target_environment | Environment to audit | `production`, `staging` |
| wcag_level | Target compliance level | `AA` (default), `A`, `AAA` |
| screen_readers | Available for testing | `NVDA, JAWS, VoiceOver, TalkBack` |
| test_devices | Testing matrix | `Desktop Chrome/Firefox, iOS Safari, Android Chrome` |
| audit_depth | Thoroughness level | `quick`, `standard`, `comprehensive` |
| previous_audit_date | Last audit for comparison | `2024-09-15` |

## Audit Areas

| Area | Key Checks | Target | Output |
|------|------------|--------|--------|
| **WCAG Compliance** | Perceivable, Operable, Understandable, Robust | Level AA | Compliance score, violations by principle |
| **Semantic HTML & ARIA** | Semantic elements, ARIA roles/properties/states, landmarks, headings | Proper structure | Semantic score, ARIA gaps, structure violations |
| **Keyboard Navigation** | Tab order, focus indicators, skip links, no traps, modal focus | 100% accessible | Navigation score, inaccessible elements |
| **Screen Reader** | Reading order, labels, announcements, alt text, dynamic updates | Compatible | Compatibility score, announcement issues |
| **Visual** | Color contrast (4.5:1 text, 3:1 UI), text size, focus indicators, reflow | WCAG AA | Contrast violations, sizing issues |
| **Forms** | Labels, required fields, error messages, autocomplete, validation | All labeled | Form score, unlabeled inputs, validation issues |
| **Mobile** | Touch targets (44x44px), spacing (8px), zoom, orientation | Touch-friendly | Mobile score, target violations |
| **Content** | Reading level, language attribute, abbreviations, timing, media controls | Clear & understandable | Readability metrics, clarity issues |

## Workflow

### 1. Preparation (10min)

- Install browser extensions (axe DevTools, WAVE, Lighthouse)
- Configure screen reader
- Prepare test scenarios
- Document baseline

### 2. Automated Testing (20min)

```bash
# Lighthouse accessibility audit
lighthouse https://app-url --only-categories=accessibility --view

# Pa11y CI (command line)
pa11y-ci --sitemap https://app-url/sitemap.xml
```

Run:
- axe DevTools on all critical pages
- WAVE evaluation
- Export and categorize results

### 3. Manual Testing (40min)

**Keyboard Navigation:**
- Navigate entire app with keyboard only (Tab, Shift+Tab, Enter, Space, Arrows)
- Test all interactive elements
- Verify focus indicators
- Check for keyboard traps

**Screen Reader Testing:**
- Test with NVDA (Windows) or VoiceOver (macOS/iOS)
- Verify reading order
- Check dynamic content announcements
- Test forms and navigation

**Visual Testing:**
- Contrast checker (Chrome DevTools)
- Text resize to 200%
- Zoom to 400% (verify reflow)
- Reduced motion (prefers-reduced-motion)

**Form Testing:**
- Submit with errors, verify announcements
- Check autocomplete and required indicators

### 4. Manual Review (20min)

**Code Review:**
- HTML semantics
- ARIA attributes correctness
- Heading hierarchy
- Alt text quality

**Content Review:**
- Language attribute
- Reading level
- Link/button text clarity

### 5. Reporting (15min)

**Categorize Findings:**
- **Critical:** Blocks access (missing alt, keyboard traps, no labels)
- **High:** Severe impact (low contrast, poor focus, confusing navigation)
- **Medium:** Moderate impact (missing ARIA, suboptimal alt text)
- **Low:** Best practices (semantic HTML, heading order)

## WCAG 2.1 Quick Reference

| Level | Requirements | Examples |
|-------|--------------|----------|
| **A (Minimum)** | Basic accessibility | Alt text, keyboard access, clear labels, no seizures |
| **AA (Target)** | Meaningful accessibility | Contrast 4.5:1 (text) / 3:1 (UI), resize 200%, consistent navigation, error suggestions |
| **AAA (Aspirational)** | Enhanced accessibility | Contrast 7:1 (text), no timing, no interruptions, enhanced errors |

## Report Template

```markdown
# Accessibility Audit Report

**Date:** YYYY-MM-DD
**Environment:** [environment]
**WCAG Target:** Level AA

## Executive Summary

- WCAG Compliance: [Pass/Fail] Level AA
- Overall Score: X/100
- Critical Issues: X (blocking)
- High Issues: X (severe)
- Medium Issues: X (moderate)
- Low Issues: X (best practices)

## WCAG 2.1 Compliance

### Principle 1: Perceivable

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 1.1.1 Non-text Content | A | ✅/❌ | X |
| 1.3.1 Info and Relationships | A | ✅/❌ | X |
| 1.4.3 Contrast (Minimum) | AA | ✅/❌ | X |
| 1.4.11 Non-text Contrast | AA | ✅/❌ | X |

### Principle 2: Operable

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 2.1.1 Keyboard | A | ✅/❌ | X |
| 2.1.2 No Keyboard Trap | A | ✅/❌ | X |
| 2.4.3 Focus Order | A | ✅/❌ | X |
| 2.4.7 Focus Visible | AA | ✅/❌ | X |

### Principle 3: Understandable

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 3.1.1 Language of Page | A | ✅/❌ | X |
| 3.3.1 Error Identification | A | ✅/❌ | X |
| 3.3.2 Labels or Instructions | A | ✅/❌ | X |

### Principle 4: Robust

| Success Criterion | Level | Status | Issues |
|-------------------|-------|--------|--------|
| 4.1.2 Name, Role, Value | A | ✅/❌ | X |
| 4.1.3 Status Messages | AA | ✅/❌ | X |

## Audit Scores by Area

| Area | Score | Critical | High | Medium | Low |
|------|-------|----------|------|--------|-----|
| Semantic HTML & ARIA | X/100 | X | X | X | X |
| Keyboard Navigation | X/100 | X | X | X | X |
| Screen Reader | X/100 | X | X | X | X |
| Visual | X/100 | X | X | X | X |
| Forms | X/100 | X | X | X | X |
| Mobile | X/100 | X | X | X | X |
| Content | X/100 | X | X | X | X |

## Findings by Severity

### Critical (Immediate Action)

1. **[Issue Title]**
   - WCAG: 1.1.1 Non-text Content (Level A)
   - Severity: Critical
   - Location: [Page/Component]
   - Description: [Details]
   - User Impact: [Impact description]
   - Remediation: [Fix steps]
   - Effort: [Low/Medium/High]

## Testing Results

### Automated
- Lighthouse: X/100
- axe DevTools: X critical, X serious, X moderate
- WAVE: X errors, X contrast errors

### Manual
- ✅/❌ Keyboard navigation functional
- ✅/❌ Screen reader compatible
- ✅/❌ Color contrast meets AA (4.5:1)
- ✅/❌ Text scalable to 200%

## Remediation Recommendations

### Priority 1: Critical (Immediate)
1. **[Recommendation]**
   - Pages: [affected pages]
   - Fix: [specific action]
   - Effort: [hours]
   - Impact: [user benefit]

### Priority 2: High (This Sprint)
### Priority 3: Medium (Next Sprint)
### Priority 4: Low (Backlog)

## Component-Specific Issues

**Navigation:** [issues]
**Forms:** [issues]
**Modals:** [issues]
**Tables:** [issues]

## Browser/Screen Reader Testing

| Browser | Screen Reader | Status | Issues |
|---------|--------------|--------|--------|
| Chrome | NVDA | ✅/❌ | X |
| Firefox | NVDA | ✅/❌ | X |
| Safari | VoiceOver | ✅/❌ | X |
| iOS Safari | VoiceOver | ✅/❌ | X |

## Trend Analysis

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Compliance Level | AA | AA | ➡️ |
| Critical Issues | X | X | ⬇️ X% |
| Score | X/100 | X/100 | ⬆️ X% |

## Next Steps

1. **Immediate** (Critical) - [with owners/deadlines]
2. **Short-term** (High, this sprint)
3. **Medium-term** (Medium, next sprint)
4. **Long-term** (Low, backlog)
5. **Monitoring** - Add accessibility tests to CI/CD, quarterly audits
```

## Success Criteria

- WCAG 2.1 Level AA compliance validated
- All critical issues identified
- Screen reader compatibility verified
- Keyboard navigation fully functional
- Visual standards met
- Remediation prioritized and documented

## Best Practices

1. Test early and often, don't wait for final audit
2. Use semantic HTML first, ARIA is supplemental
3. Test with real users with disabilities
4. Automate where possible (CI/CD checks)
5. Train the team - accessibility is everyone's responsibility
6. Document patterns in component library
7. Track compliance regularly, not one-time

## Common Violations

| Violation | Fix | Priority |
|-----------|-----|----------|
| Missing alt text | Add descriptive alt to all images | Critical |
| Keyboard trap | Add Esc handler, manage focus | Critical |
| No labels | Associate labels with inputs (for/id) | Critical |
| Low contrast | Increase to 4.5:1 (text) / 3:1 (UI) | High |
| Poor focus indicators | Add visible 3:1 contrast focus styles | High |
| Missing skip link | Add skip-to-main navigation link | Medium |
| Improper ARIA | Remove unnecessary ARIA, fix attributes | Medium |
| Non-semantic HTML | Use proper semantic elements | Low |

## Related Skills

- [web-app-testing](../testing/web-app-testing.md) - Development testing
- [qa-criteria-validator](../qa/qa-criteria-validator.md) - Acceptance validation
