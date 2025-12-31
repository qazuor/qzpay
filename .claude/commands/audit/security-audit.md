---
name: security-audit
description: Comprehensive security audit and vulnerability assessment
type: audit
category: quality
---

# Security Audit Command

## Purpose

Performs comprehensive security audit validating authentication, authorization, input validation, data protection, and security best practices.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| SECURITY_SCAN_COMMAND | Dependency security scan | `pnpm audit` |
| AUTH_PATTERN | Authentication method | `JWT`, `OAuth`, `Clerk` |
| DATABASE_ORM | Database ORM used | `Drizzle`, `Prisma` |
| VALIDATION_LIBRARY | Input validation | `Zod`, `Joi` |
| REPORT_OUTPUT | Report file path | `.claude/reports/security-audit-report.md` |

## Usage

```bash
/security-audit [options]
```

### Options

- `--scope <area>`: Focus on specific area (auth, api, database, frontend, all)
- `--depth <level>`: Analysis depth (quick, standard, thorough)
- `--report`: Generate detailed report
- `--fix-suggestions`: Include automated fix suggestions

## Audit Checklist

### 1. Authentication & Authorization

| Check | Validation |
|-------|------------|
| Authentication implementation | None properly configured |
| Token validation | Expiry and signature verification |
| Session management | Secure session handling |
| Authorization checks | RBAC/permissions on protected routes |
| Password policies | Strong password requirements |

### 2. Input Validation & Sanitization

| Check | Validation |
|-------|------------|
| Input validation | All inputs validated with None |
| SQL injection prevention | None parameterized queries |
| XSS prevention | Output encoding/escaping |
| CSRF protection | Token validation on state changes |
| Path traversal | File access validation |

### 3. Data Protection

| Check | Validation |
|-------|------------|
| Encryption at rest | Sensitive data encrypted |
| Encryption in transit | HTTPS enforced |
| Secret management | No hardcoded secrets |
| Environment variables | Proper configuration |
| Logging | No sensitive data logged |

### 4. API Security

| Check | Validation |
|-------|------------|
| Rate limiting | Implemented on public endpoints |
| Authentication | Required where needed |
| Error handling | No information leakage |
| CORS configuration | Properly configured |
| Request validation | Size limits enforced |

### 5. Infrastructure & Configuration

| Check | Validation |
|-------|------------|
| Security headers | CSP, HSTS, X-Frame-Options |
| Dependency vulnerabilities | pnpm audit passing |
| Debug mode | Disabled in production |
| Error stack traces | Hidden in production |
| Admin interfaces | Protected |

### 6. Code Security Patterns

| Check | Validation |
|-------|------------|
| Dangerous functions | No eval, Function constructor |
| Secure randomness | Cryptographically secure RNG |
| Error handling | No information disclosure |
| File operations | Safe file handling |
| Cookie security | HttpOnly, Secure, SameSite |

## Output Format

### Terminal Output

```text
🔒 Security Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Summary
  Total Checks: {{TOTAL}}
  Passed: {{PASSED}} ({{PERCENTAGE}}%)
  Failed: {{FAILED}} ({{PERCENTAGE}}%)
  Warnings: {{WARNINGS}} ({{PERCENTAGE}}%)

🔴 Critical Issues ({{COUNT}})
  {{#each CRITICAL_ISSUES}}
  {{INDEX}}. {{TITLE}}
     Location: {{FILE}}:{{LINE}}
     Fix: {{FIX_SUGGESTION}}
  {{/each}}

🟠 High Priority Issues ({{COUNT}})
  {{#each HIGH_ISSUES}}
  {{INDEX}}. {{TITLE}}
     Location: {{FILE}}:{{LINE}}
     Fix: {{FIX_SUGGESTION}}
  {{/each}}

🟡 Medium Priority Issues ({{COUNT}})
  {{#each MEDIUM_ISSUES}}
  {{INDEX}}. {{TITLE}}
  {{/each}}

🟢 Passed Checks
  {{#each PASSED_CHECKS}}
  ✓ {{CHECK_NAME}}
  {{/each}}

💡 Recommendations
  {{#each RECOMMENDATIONS}}
  {{INDEX}}. {{RECOMMENDATION}}
  {{/each}}

📄 Detailed report: {{REPORT_OUTPUT}}
```

### Report File Structure

```markdown
# Security Audit Report

**Date**: {{AUDIT_DATE}}
**Scope**: {{SCOPE}}
**Depth**: {{DEPTH}}

## Executive Summary

{{SUMMARY}}

## Critical Issues

### CRIT-{{ID}}: {{TITLE}}
- **Severity**: Critical
- **Location**: {{FILE}}:{{LINE}}
- **Description**: {{DESCRIPTION}}
- **Impact**: {{IMPACT}}
- **Fix**: {{FIX_STEPS}}
- **References**: {{LINKS}}

## High Priority Issues

{{#each HIGH_ISSUES}}
### HIGH-{{ID}}: {{TITLE}}
{{DETAILS}}
{{/each}}

## Passed Checks

{{PASSED_CHECKS_LIST}}

## Recommendations

{{RECOMMENDATIONS_LIST}}
```

## Integration with Workflow

### Phase 3 - Validation

Run during validation phase:
- After implementation complete
- Before deployment
- As part of `/quality-check`

### CI/CD Integration

```yaml
- name: Security Audit
  run: {{CLI_TOOL}} /security-audit --report
```

## Common Vulnerabilities Detected

### Critical
- Missing authentication checks
- SQL injection vulnerabilities
- XSS vulnerabilities
- Hardcoded secrets
- Insecure data exposure

### High
- Missing authorization checks
- Insufficient input validation
- Weak session management
- Missing rate limiting

### Medium
- Missing security headers
- Outdated dependencies
- Information disclosure
- Insecure cookie configuration

## Related Commands

- `/quality-check` - Comprehensive validation (includes security)
- `/performance-audit` - Performance audits
- `/accessibility-audit` - Accessibility checks
- `/code-check` - Code quality validation
