---
name: accessibility-audit
description: Comprehensive accessibility audit and WCAG compliance validation
type: audit
category: quality
---

# Accessibility Audit Command

## Purpose

Performs comprehensive accessibility audit validating WCAG compliance, ARIA implementation, keyboard navigation, and assistive technology support.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| WCAG_LEVEL | Target WCAG level | `A`, `AA`, `AAA` |
| FRONTEND_FRAMEWORK | Frontend framework | `React`, `Astro`, `Vue` |
| A11Y_TESTING_TOOL | Testing tool | `axe`, `pa11y`, `lighthouse` |
| REPORT_OUTPUT | Report file path | `.claude/reports/accessibility-audit-report.md` |

## Usage

```bash
/accessibility-audit [options]
```

### Options

- `--scope <area>`: Focus on specific area (navigation, forms, content, all)
- `--level <wcag>`: WCAG level (A, AA, AAA) - default: AA
- `--report`: Generate detailed report
- `--automated-only`: Run only automated tests

## WCAG 2.1 Audit Checklist

### 1. Perceivable - Information must be presentable

#### Text Alternatives (1.1)

| Check | Validation |
|-------|------------|
| Image alt text | All images have meaningful alt attributes |
| Form labels | All inputs have associated labels |
| Button text | Descriptive button text or ARIA labels |
| Link text | Links have descriptive text (not "click here") |
| Icon accessibility | Icons have accessible names |

#### Adaptable (1.3)

| Check | Validation |
|-------|------------|
| Semantic HTML | Proper HTML5 elements used |
| Heading hierarchy | Logical h1-h6 structure (no skipped levels) |
| Landmarks | header, nav, main, aside, footer defined |
| ARIA usage | Valid and necessary ARIA attributes |
| Reading order | Logical order when CSS disabled |

#### Distinguishable (1.4)

| Check | Validation |
|-------|------------|
| Color contrast | Normal text: ≥4.5:1, Large text: ≥3:1 |
| Color usage | Information not by color alone |
| Text resizing | Resizable to 200% without content loss |
| Focus indicators | Visible with ≥3:1 contrast |
| No horizontal scroll | At 320px width |

### 2. Operable - UI must be operable

#### Keyboard Accessible (2.1)

| Check | Validation |
|-------|------------|
| Keyboard navigation | All interactive elements accessible |
| Tab order | Logical and intuitive |
| No keyboard traps | Can tab out of all elements |
| Skip links | Skip navigation present |
| Focus visible | Always visible during navigation |

#### Navigable (2.4)

| Check | Validation |
|-------|------------|
| Page titles | Unique and descriptive |
| Focus order | Follows logical sequence |
| Link purpose | Clear from text or context |
| Headings | Describe content sections |
| Current location | Indicated (breadcrumbs, active state) |

#### Input Modalities (2.5)

| Check | Validation |
|-------|------------|
| Touch targets | Minimum 44x44 pixels |
| Pointer gestures | Keyboard alternatives available |
| Click activation | On up event (can cancel) |
| Label matching | Label text matches accessible name |

### 3. Understandable - Information must be understandable

#### Readable (3.1)

| Check | Validation |
|-------|------------|
| Page language | lang attribute declared |
| Language changes | Marked with lang on elements |

#### Predictable (3.2)

| Check | Validation |
|-------|------------|
| Focus behavior | No unexpected changes on focus |
| Input behavior | No unexpected changes on input |
| Consistent navigation | Navigation consistent across pages |
| Consistent naming | Components identified consistently |

#### Input Assistance (3.3)

| Check | Validation |
|-------|------------|
| Error messages | Clear and specific |
| Form labels | Labels and instructions provided |
| Error suggestions | Suggestions when possible |
| Error prevention | Confirmation for destructive actions |
| Help text | Available for complex inputs |

### 4. Robust - Content must be robust

#### Compatible (4.1)

| Check | Validation |
|-------|------------|
| Valid HTML | No parsing errors |
| Unique IDs | IDs unique within page |
| Valid ARIA | Roles, states, properties valid |
| Status messages | Appropriate ARIA for updates |
| Component roles | Name, role, value available |

## Testing Categories

### Automated Testing

- Run {{A11Y_TESTING_TOOL}} automated checks
- Validate color contrast
- Check HTML validity
- Verify ARIA usage

### Keyboard Testing

- Tab through entire application
- Test all interactive elements
- Verify focus indicators
- Test keyboard shortcuts

### Screen Reader Testing

- Test with NVDA (Windows)
- Test with VoiceOver (macOS/iOS)
- Test with JAWS (Windows)
- Test with TalkBack (Android)

### Mobile Testing

- Test touch target sizes
- Verify zoom functionality
- Test screen reader compatibility
- Check orientation support

## Output Format

### Terminal Output

```text
♿ Accessibility Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overall Score: {{SCORE}}/100 ({{GRADE}})
WCAG AA Compliance: {{COMPLIANCE_PERCENTAGE}}%

🔴 Critical Issues ({{COUNT}})
  {{#each CRITICAL_ISSUES}}
  {{INDEX}}. {{TITLE}}
     Location: {{FILE}}:{{LINE}}
     WCAG: {{CRITERION}} (Level {{LEVEL}})
     Impact: {{IMPACT}}
     Fix: {{FIX_SUGGESTION}}
  {{/each}}

🟠 Serious Issues ({{COUNT}})
  {{#each SERIOUS_ISSUES}}
  {{INDEX}}. {{TITLE}}
     Location: {{FILE}}:{{LINE}}
     WCAG: {{CRITERION}}
     Fix: {{FIX_SUGGESTION}}
  {{/each}}

🟡 Warnings ({{COUNT}})
  {{#each WARNINGS}}
  {{INDEX}}. {{TITLE}}
  {{/each}}

📈 WCAG 2.1 Compliance

Level A (Required):
  {{STATUS}} Text Alternatives: {{PERCENTAGE}}%
  {{STATUS}} Keyboard Accessible: {{PERCENTAGE}}%
  {{STATUS}} Distinguishable: {{PERCENTAGE}}%
  {{STATUS}} Readable: {{PERCENTAGE}}%

Level AA (Target):
  {{STATUS}} Contrast: {{PERCENTAGE}}%
  {{STATUS}} Resize Text: {{PERCENTAGE}}%
  {{STATUS}} Input Assistance: {{PERCENTAGE}}%
  {{STATUS}} Compatible: {{PERCENTAGE}}%

📊 Component Scores

{{#each COMPONENT_SCORES}}
{{COMPONENT}}: {{SCORE}}/100 {{STATUS}}
  - Keyboard: {{PERCENTAGE}}% {{STATUS}}
  - Screen Reader: {{PERCENTAGE}}% {{STATUS}}
  - Mobile: {{PERCENTAGE}}% {{STATUS}}
{{/each}}

💡 Top Recommendations
  {{#each RECOMMENDATIONS}}
  {{INDEX}}. {{RECOMMENDATION}} ({{IMPROVEMENT}})
  {{/each}}

🧪 Testing Summary
  Automated Tests: {{COUNT}} checks
  Manual Tests: {{COUNT}} checks
  Screen Reader: {{TOOLS_TESTED}}
  Keyboard: Full navigation tested

📄 Detailed report: {{REPORT_OUTPUT}}
```

### Report File Structure

```markdown
# Accessibility Audit Report

**Date**: {{AUDIT_DATE}}
**WCAG Version**: 2.1
**Conformance Level**: AA
**Scope**: {{SCOPE}}

## Executive Summary

Overall Accessibility Score: {{SCORE}}/100

**Compliance Status:**
- WCAG 2.1 Level A: {{PERCENTAGE}}% compliant
- WCAG 2.1 Level AA: {{PERCENTAGE}}% compliant
- WCAG 2.1 Level AAA: {{PERCENTAGE}}% compliant

## Critical Issues

### A11Y-{{ID}}: {{TITLE}}
- **Severity**: Critical
- **WCAG**: {{CRITERION}} (Level {{LEVEL}})
- **Location**: {{FILE}}:{{LINE}}
- **Impact**: {{IMPACT}}
- **Fix**: {{FIX_STEPS}}
- **Testing**: {{TESTING_INSTRUCTIONS}}

## WCAG 2.1 Compliance Report

| Guideline | Criterion | Status | Issues |
|-----------|-----------|--------|--------|
| {{GUIDELINE}} | {{CRITERION}} | {{STATUS}} | {{COUNT}} |

## Component Analysis

{{#each COMPONENTS}}
### {{COMPONENT_NAME}}

**Score**: {{SCORE}}/100

**Strengths**: {{STRENGTHS}}
**Issues**: {{ISSUES}}
**Recommendations**: {{RECOMMENDATIONS}}
{{/each}}

## Testing Results

### Screen Reader Testing
{{SCREEN_READER_RESULTS}}

### Keyboard Testing
{{KEYBOARD_RESULTS}}

### Mobile Testing
{{MOBILE_RESULTS}}

## Recommendations

### Immediate Actions
{{IMMEDIATE_ACTIONS}}

### Short Term
{{SHORT_TERM_ACTIONS}}

### Long Term
{{LONG_TERM_ACTIONS}}
```

## Integration with Workflow

### Phase 3 - Validation

Run during validation phase:
- After implementation complete
- Before deployment
- As part of `/quality-check`

### Continuous Monitoring

```yaml
- name: Accessibility Audit
  run: {{CLI_TOOL}} /accessibility-audit --automated-only --report
  schedule:
    - cron: '0 0 * * 1'  # Weekly
```

## Common Accessibility Issues

### Critical
- Missing alt text on images
- Insufficient color contrast
- Keyboard traps
- Missing form labels
- Inaccessible custom controls

### Serious
- Poor heading structure
- Missing landmarks
- Unclear error messages
- Insufficient touch targets
- No focus indicators

### Minor
- Redundant ARIA
- Missing page titles
- Inconsistent navigation
- Missing skip links

## Related Commands

- `/quality-check` - Comprehensive validation (includes accessibility)
- `/security-audit` - Security audits
- `/performance-audit` - Performance optimization
- `/code-check` - Code quality validation
