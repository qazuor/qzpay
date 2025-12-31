---
name: security-audit
category: audit
description: Comprehensive security audit covering OWASP Top 10, authentication, authorization, data protection, and penetration testing
usage: Use for comprehensive security review before deployment, after major changes, or as part of regular security assessments
input: Codebase, API endpoints, authentication system, database schema, infrastructure configuration
output: Security audit report with severity-categorized findings, remediation steps, and compliance status
---

# Security Audit

## Purpose

Comprehensive security audit combining vulnerability assessment, code review, and penetration testing simulation.

**Category**: Audit
**Primary Users**: tech-lead
**Coordinates**: Security reviews and vulnerability assessments

## When to Use

- Before production deployment
- After implementing security-critical features
- Regular security assessments (quarterly recommended)
- After security incidents or breaches
- Before handling sensitive data (PII, payments)
- When compliance requirements mandate audits

## Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| target_environment | Environment to audit | `production`, `staging` |
| compliance_requirements | Required compliance standards | `GDPR, PCI-DSS, HIPAA` |
| security_tools | Tools available for scanning | `npm audit, Snyk, OWASP ZAP` |
| authentication_system | Auth implementation type | `JWT, OAuth2, session-based` |
| scan_depth | Audit thoroughness level | `quick`, `standard`, `comprehensive` |
| previous_audit_date | Last audit date for comparison | `2024-09-15` |

## Audit Areas

| Area | Key Checks | Output |
|------|------------|--------|
| **Authentication & Authorization** | Password hashing, session management, token security, RBAC, MFA, brute-force protection | Auth security score, vulnerabilities, recommendations |
| **Input Validation** | Schema validation, SQL injection prevention, XSS prevention, CSRF protection, file upload validation | Coverage %, vulnerabilities, gaps |
| **Data Protection** | Encryption at rest/transit, secrets management, PII handling, GDPR compliance, secure deletion | Compliance %, privacy issues, encryption gaps |
| **API Security** | Rate limiting, authentication, CORS, versioning, error messages, security headers | API security score, exposed endpoints |
| **Infrastructure** | Environment variables, secrets management, container security, dependency vulnerabilities, TLS/SSL | Configuration issues, dependencies audit |
| **Code Security** | Error handling, hardcoded secrets, secure patterns, type safety, safe deserialization | Code security score, pattern violations |
| **Frontend Security** | XSS prevention, CSP, SRI, third-party scripts, cookie security, clickjacking protection | Frontend security score, browser vulnerabilities |
| **Penetration Testing** | Auth bypass, privilege escalation, injection probes, CSRF simulation, session hijacking | Exploitable vulnerabilities, risk assessment |

## Workflow

### 1. Preparation (10min)

- Review codebase structure and critical endpoints
- Map authentication flows
- List third-party integrations
- Configure security scanners

### 2. Automated Scanning (15min)

```bash
# Dependency audit
npm audit --audit-level moderate
pnpm audit --audit-level moderate

# Code scanning
# Run ESLint security rules
# Check for hardcoded secrets
# Analyze dependencies
```

### 3. Manual Review (30min)

**Authentication Review:**
- Inspect password hashing
- Review session management
- Validate RBAC implementation

**API Security Review:**
- Check rate limiting and CORS
- Validate input validation
- Test error handling

**Data Protection Review:**
- Verify encryption usage
- Check secrets management
- Review logging practices

### 4. Penetration Testing (20min)

**Authentication Tests:**
- Try common passwords, session fixation, token manipulation

**Injection Tests:**
- SQL injection, XSS payloads, command injection

**Authorization Tests:**
- Privilege escalation, direct object reference, path traversal

### 5. Reporting (15min)

**Categorize Findings:**
- **Critical:** Immediate fix required (RCE, SQLi, auth bypass)
- **High:** Fix before deployment (XSS, sensitive data leak)
- **Medium:** Fix soon (weak encryption, missing headers)
- **Low:** Best practice improvements

## Report Template

```markdown
# Security Audit Report

**Date:** YYYY-MM-DD
**Environment:** [environment]
**OWASP Compliance Target:** Top 10 2021

## Executive Summary

- Overall Security Score: X/100
- Critical Issues: X
- High Issues: X
- Medium Issues: X
- Low Issues: X

## Findings by Severity

### Critical (Immediate Action Required)

1. **[Finding Title]**
   - Severity: Critical
   - Location: [File/Endpoint]
   - Description: [Details]
   - Impact: [Security risk]
   - Remediation: [Fix steps]
   - References: [OWASP/CVE links]

## OWASP Top 10 Compliance

- [ ] A01:2021 - Broken Access Control
- [ ] A02:2021 - Cryptographic Failures
- [ ] A03:2021 - Injection
- [ ] A04:2021 - Insecure Design
- [ ] A05:2021 - Security Misconfiguration
- [ ] A06:2021 - Vulnerable Components
- [ ] A07:2021 - Identification & Authentication Failures
- [ ] A08:2021 - Software & Data Integrity Failures
- [ ] A09:2021 - Security Logging & Monitoring Failures
- [ ] A10:2021 - Server-Side Request Forgery

## Recommendations

1. **Immediate Actions** (Critical/High)
2. **Short-term Improvements** (Medium)
3. **Long-term Enhancements** (Low)

## Next Steps

1. Address critical issues immediately
2. Schedule high-priority fixes
3. Create issues for medium/low items
4. Re-audit after fixes
5. Schedule next audit (quarterly)
```

## Severity Definitions

| Severity | Definition | Examples | Timeframe |
|----------|------------|----------|-----------|
| **Critical** | Allows unauthorized access or data breach | RCE, SQL injection, auth bypass | Immediate |
| **High** | Significant security impact | XSS, sensitive data leak, broken access control | Before deployment |
| **Medium** | Moderate security risk | Weak encryption, missing headers, info disclosure | Next sprint |
| **Low** | Best practice violation | Logging issues, monitoring gaps, hardening | Backlog |

## OWASP Top 10 Checklist

1. **Broken Access Control** - RBAC enforcement, direct object references
2. **Cryptographic Failures** - Strong encryption, secure key management
3. **Injection** - Input validation, parameterized queries, output encoding
4. **Insecure Design** - Threat modeling, secure architecture patterns
5. **Security Misconfiguration** - Secure defaults, minimal features enabled
6. **Vulnerable Components** - Dependency updates, CVE monitoring
7. **Authentication Failures** - Strong passwords, session security, MFA
8. **Data Integrity Failures** - Secure deserialization, signed updates
9. **Logging Failures** - Comprehensive logging, tamper-proof logs
10. **SSRF** - URL validation, network segmentation

## Success Criteria

- All critical and high-severity issues identified
- OWASP Top 10 compliance validated
- Remediation steps provided for all findings
- Security score calculated and documented
- Report delivered in actionable format

## Best Practices

1. Run audits regularly, not just before deployment
2. Track remediation with issues/tickets
3. Compare with previous audits for trend analysis
4. Automate security scans in CI/CD
5. Document accepted risks and exceptions
6. Re-audit after fixes to verify effectiveness

## Related Skills

- [security-testing](../testing/security-testing.md) - Development testing
- [qa-criteria-validator](../qa/qa-criteria-validator.md) - Acceptance validation
- [tdd-methodology](../patterns/tdd-methodology.md) - Secure development
