---
name: security-testing
category: testing
description: Security testing covering authentication, authorization, input validation, and OWASP Top 10
usage: Use to validate security measures and identify vulnerabilities before deployment
input: Application components, authentication system, validation logic
output: Security test suite, vulnerability report, remediation recommendations
---

# Security Testing

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| AUTH_MECHANISM | Authentication method | `JWT`, `OAuth`, `Session-based` |
| VALIDATION_LIBRARY | Input validation library | `Zod`, `Joi`, `Yup` |
| ORM_TOOL | Database access method | `Drizzle`, `Prisma`, `TypeORM` |
| PASSWORD_POLICY | Password requirements | `8+ chars, uppercase, number` |
| RATE_LIMIT | Request rate limit | `100 req/15min` |
| SESSION_TIMEOUT | Session expiration | `30 minutes` |
| MFA_ENABLED | Multi-factor auth enabled | `true`, `false` |

## Purpose

Comprehensive security testing to identify and prevent vulnerabilities across the application stack.

## Capabilities

- Test authentication mechanisms
- Validate authorization controls
- Prevent injection attacks
- Test data protection
- Validate API security
- Check dependency vulnerabilities
- Test error handling security

## Workflow

### 1. Authentication Testing

**Test scenarios:**
- Valid/invalid credentials
- Brute force protection
- Session management
- Token expiration
- Password policies
- MFA (if applicable)
- OAuth flows
- Logout functionality

**Validation:**
- [ ] Strong passwords enforced
- [ ] Failed login attempts limited
- [ ] Sessions expire appropriately
- [ ] Tokens validated properly
- [ ] Logout invalidates sessions

**Example Test:**

```typescript
import { describe, it, expect } from 'test-framework';

describe('Authentication Security', () => {
  it('should reject invalid credentials', async () => {
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'wrongpassword'
      })
    });

    expect(response.status).toBe(401);
  });

  it('should rate limit failed attempts', async () => {
    // Attempt multiple failed logins
    for (let i = 0; i < 10; i++) {
      await app.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'wrong'
        })
      });
    }

    const response = await app.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'wrong'
      })
    });

    expect(response.status).toBe(429);
  });
});
```

### 2. Authorization Testing

**Test scenarios:**
- Role-based access control (RBAC)
- Resource ownership validation
- Privilege escalation attempts
- Horizontal access control
- Vertical access control
- Admin vs user permissions

**Validation:**
- [ ] Users can only access own resources
- [ ] Admin-only endpoints protected
- [ ] No privilege escalation possible
- [ ] Permissions checked on all operations

**Example Test:**

```typescript
describe('Authorization Security', () => {
  it('should prevent access to other users resources', async () => {
    const userAToken = await getUserToken('user-a');

    const response = await app.request('/api/resources/user-b-id', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    expect(response.status).toBe(403);
  });
});
```

### 3. Input Validation Testing

**Test injection attacks:**

**SQL Injection:**
- Test with SQL injection payloads
- Verify parameterized queries/ORM used

**XSS (Cross-Site Scripting):**
- Test with XSS payloads
- Verify output encoding
- Test reflected and stored XSS

**Command Injection:**
- Test system command inputs
- Verify safe execution

**Path Traversal:**
- Test file path inputs
- Verify path sanitization

**Validation Bypass:**
- Test client-side only validation
- Test type confusion
- Test boundary values

**Validation:**
- [ ] All inputs validated server-side
- [ ] SQL injection prevented (ORM usage)
- [ ] XSS prevented (output escaping)
- [ ] No command injection possible
- [ ] Path traversal blocked

**Example Test:**

```typescript
describe('Input Validation Security', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const response = await app.request(
      `/api/search?q=${encodeURIComponent(maliciousInput)}`
    );

    expect(response.status).toBe(200);

    // Verify database intact
    const usersCount = await db.users.count();
    expect(usersCount).toBeGreaterThan(0);
  });

  it('should prevent XSS attacks', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await app.request('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ content: xssPayload })
    });

    const comment = await response.json();
    expect(comment.content).not.toContain('<script>');
  });
});
```

### 4. Data Protection Testing

**Test scenarios:**
- Encryption at rest
- Encryption in transit (HTTPS)
- Sensitive data exposure
- Logging (no secrets)
- Error messages (no data leakage)
- Data deletion (proper cleanup)

**Validation:**
- [ ] HTTPS enforced
- [ ] Sensitive fields encrypted
- [ ] No secrets in logs
- [ ] No PII in error messages
- [ ] Secure data deletion

**Example Test:**

```typescript
describe('Data Protection Security', () => {
  it('should not expose sensitive data', async () => {
    const response = await app.request('/api/users/profile');
    const user = await response.json();

    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('should not leak data in errors', async () => {
    const response = await app.request('/api/users/invalid-id');
    const error = await response.json();

    expect(error.message).not.toContain('database');
    expect(error).not.toHaveProperty('stack');
  });
});
```

### 5. API Security Testing

**Test scenarios:**
- Rate limiting
- CORS configuration
- Request size limits
- Content-type validation
- Security headers

**Validation:**
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] Request size limited
- [ ] Security headers set

**Example Test:**

```typescript
describe('API Security', () => {
  it('should have security headers', async () => {
    const response = await app.request('/api/users');

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('should enforce CORS policy', async () => {
    const response = await app.request('/api/users', {
      headers: { Origin: 'https://untrusted-site.com' }
    });

    expect(response.headers.get('Access-Control-Allow-Origin'))
      .not.toBe('*');
  });
});
```

### 6. Dependency Security Testing

**Actions:**
1. Run dependency audit
2. Check for outdated packages
3. Review security advisories
4. Monitor for new vulnerabilities

**Validation:**
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] Medium vulnerabilities documented
- [ ] Dependencies up to date

**Command:**

```bash
# Run dependency audit
{{PACKAGE_MANAGER}} audit --audit-level moderate
```

## OWASP Top 10 Coverage

| Risk | Covered |
|------|---------|
| Broken Access Control | Authorization tests |
| Cryptographic Failures | HTTPS, encryption tests |
| Injection | SQL, XSS, command injection tests |
| Insecure Design | Security by design validation |
| Security Misconfiguration | Headers, defaults tests |
| Vulnerable Components | Dependency scanning |
| Authentication Failures | Auth mechanism tests |
| Data Integrity Failures | Input validation tests |
| Logging Failures | Log security validation |
| SSRF | URL validation |

## Best Practices

1. **Defense in Depth**: Multiple security layers
2. **Fail Securely**: Default to deny access
3. **Least Privilege**: Minimal required permissions
4. **Input Validation**: Validate all inputs server-side
5. **Output Encoding**: Prevent XSS
6. **Parameterized Queries**: Prevent SQL injection
7. **Security Headers**: Set all recommended headers
8. **Regular Audits**: Continuous security testing
9. **Update Dependencies**: Keep packages current
10. **Log Security Events**: Monitor for attacks

## Output

**Produces:**
- Security test suite
- Vulnerability report
- Remediation recommendations
- OWASP Top 10 compliance checklist

**Success Criteria:**
- All security tests passing
- No critical vulnerabilities
- Authentication/authorization secure
- Input validation comprehensive
- Data protection adequate

## Related Skills

- `api-app-testing` - API functionality testing
- `performance-testing` - Security performance impact
