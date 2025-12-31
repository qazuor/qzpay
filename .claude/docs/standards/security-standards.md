# Security Standards

This document defines the security standards and practices for the project.

---

## Table of Contents

<!-- markdownlint-disable MD051 -->

1. [Security Philosophy](#security-philosophy)
2. [Authentication](#authentication)
3. [Authorization](#authorization)
4. [Input Validation](#input-validation)
5. [CSRF Protection](#csrf-protection)
6. [Rate Limiting](#rate-limiting)
7. [Data Protection](#data-protection)
8. [API Security](#api-security)
9. [Dependency Security](#dependency-security)
10. [Security Headers](#security-headers)

<!-- markdownlint-enable MD051 -->

---

## Configuration

<!-- AUTO-GENERATED: Configured values -->
| Setting | Value |
|---------|-------|
| **Authentication Pattern** | None |
| **Input Validation Library** | {{INPUT_VALIDATION}} |
| **CSRF Protection** | {{CSRF_PROTECTION}} |
| **Rate Limiting** | {{RATE_LIMITING}} |
<!-- END AUTO-GENERATED -->

---

## Security Philosophy

### Core Principles

**Defense in Depth:**

- Multiple layers of security
- No single point of failure
- Fail securely (deny by default)

**Principle of Least Privilege:**

- Users get minimum necessary permissions
- Services run with minimal privileges
- API tokens are scoped appropriately

**Secure by Default:**

- Security enabled out of the box
- Opt-out, not opt-in
- Safe defaults everywhere

---

## Authentication

### Authentication Pattern: None

**Supported patterns:**

- **JWT** - Stateless JSON Web Tokens
- **Session** - Server-side session management
- **OAuth** - OAuth 2.0 / OpenID Connect

### JWT Implementation (if using JWT)

```typescript
// Token structure
interface JWTPayload {
  sub: string;        // User ID
  email: string;      // User email
  role: UserRole;     // User role
  iat: number;        // Issued at
  exp: number;        // Expiration
}

// Token configuration
const JWT_CONFIG = {
  algorithm: 'HS256',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'your-app-name',
};

// Token generation
const generateToken = (user: User): string => {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_CONFIG.accessTokenExpiry }
  );
};
```

### Session Implementation (if using sessions)

```typescript
// Session configuration
const SESSION_CONFIG = {
  name: 'session_id',
  secret: process.env.SESSION_SECRET,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};
```

### Password Security

```typescript
// Password requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

// Password hashing
import { hash, verify } from '@node-rs/bcrypt';

const hashPassword = async (password: string): Promise<string> => {
  return hash(password, 12); // Cost factor of 12
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return verify(password, hash);
};
```

### Authentication Best Practices

**DO:**

- Use secure, httpOnly cookies for tokens
- Implement token refresh mechanism
- Hash passwords with bcrypt (cost 12+)
- Use constant-time comparison for secrets
- Log authentication failures

**DON'T:**

- Store passwords in plain text
- Use MD5 or SHA1 for passwords
- Include sensitive data in JWT payload
- Use predictable session IDs
- Expose authentication errors

---

## Authorization

### Role-Based Access Control (RBAC)

```typescript
// Define roles
type UserRole = 'admin' | 'host' | 'guest';

// Define permissions
type Permission =
  | 'user:read' | 'user:write' | 'user:delete'
  | 'entity:read' | 'entity:write' | 'entity:delete'
  | 'booking:read' | 'booking:write' | 'booking:delete';

// Role-permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['user:read', 'user:write', 'user:delete', 'entity:read', 'entity:write', 'entity:delete'],
  host: ['entity:read', 'entity:write', 'booking:read'],
  guest: ['entity:read', 'booking:read', 'booking:write'],
};

// Authorization check
const hasPermission = (user: User, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
};
```

### Resource-Level Authorization

```typescript
// Check ownership
const canModifyEntity = async (user: User, entityId: string): Promise<boolean> => {
  if (user.role === 'admin') return true;

  const entity = await db.query.entities.findFirst({
    where: eq(entities.id, entityId),
  });

  return entity?.hostId === user.id;
};
```

---

## Input Validation

### Validation Library: {{INPUT_VALIDATION}}

**Using None for all input validation:**

```typescript
import { z } from 'zod';

// Define schemas
const createUserSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name too long')
    .trim(),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  role: z.enum(['admin', 'host', 'guest']),
});

// Validate in route
app.post('/users', zValidator('json', createUserSchema), async (c) => {
  const input = c.req.valid('json'); // Type-safe and validated
  // ...
});
```

### Validation Rules

**Always validate:**

- All user input (forms, query params, headers)
- File uploads (type, size, content)
- API request bodies
- URL parameters
- Webhook payloads

**Sanitization:**

```typescript
// Sanitize HTML content
import DOMPurify from 'isomorphic-dompurify';

const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  });
};

// Sanitize for SQL (use parameterized queries instead)
// NEVER do this:
// const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ALWAYS use parameterized queries:
const result = await db.query.users.findFirst({
  where: eq(users.id, userId),
});
```

---

## CSRF Protection

### CSRF Protection: {{CSRF_PROTECTION}}

**Implementation:**

```typescript
// Generate CSRF token
import { randomBytes } from 'crypto';

const generateCsrfToken = (): string => {
  return randomBytes(32).toString('hex');
};

// Middleware
const csrfMiddleware = async (c: Context, next: Next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method)) {
    const token = c.req.header('X-CSRF-Token');
    const sessionToken = getCookie(c, 'csrf_token');

    if (!token || token !== sessionToken) {
      return c.json({ error: 'Invalid CSRF token' }, 403);
    }
  }
  await next();
};

// Set token in response
const setCsrfToken = (c: Context, token: string) => {
  setCookie(c, 'csrf_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });
};
```

**Frontend integration:**

```typescript
// Include token in requests
const api = axios.create({
  headers: {
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content,
  },
});
```

---

## Rate Limiting

### Rate Limiting: {{RATE_LIMITING}}

**Implementation:**

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

// Middleware
const rateLimitMiddleware = async (c: Context, next: Next) => {
  const ip = c.req.header('x-forwarded-for') ?? 'unknown';
  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  c.header('X-RateLimit-Limit', limit.toString());
  c.header('X-RateLimit-Remaining', remaining.toString());
  c.header('X-RateLimit-Reset', reset.toString());

  if (!success) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  await next();
};
```

**Rate limits by endpoint type:**

| Endpoint Type | Authenticated | Anonymous |
|---------------|---------------|-----------|
| Read (GET) | 200/min | 50/min |
| Write (POST/PUT/DELETE) | 100/min | 20/min |
| Auth (login/register) | 10/min | 5/min |
| Upload | 10/min | 2/min |

---

## Data Protection

### Sensitive Data Handling

```typescript
// Never log sensitive data
const sanitizeForLogging = (data: unknown): unknown => {
  if (typeof data !== 'object' || data === null) return data;

  const sensitive = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
};

// Encrypt sensitive data at rest
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const encrypt = (text: string, key: Buffer): string => {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};
```

### PII Protection

- Minimize collection of personal data
- Encrypt sensitive data at rest
- Implement data retention policies
- Support user data deletion requests
- Log access to sensitive data

---

## API Security

### Security Headers

```typescript
// Security headers middleware
const securityHeaders = async (c: Context, next: Next) => {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  if (process.env.NODE_ENV === 'production') {
    c.header(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    );
  }
};
```

### CORS Configuration

```typescript
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
  maxAge: 86400,
}));
```

---

## Dependency Security

### Security Scanning

```bash
# Run security audit
pnpm audit

# Fix vulnerabilities
pnpm audit fix

# Check for outdated dependencies
pnpm outdated
```

### Dependency Management

- Review all new dependencies before adding
- Use lockfiles (pnpm-lock.yaml)
- Pin major versions
- Run security audits in CI/CD
- Subscribe to security advisories

---

## Security Checklist

Before deploying:

- [ ] All inputs validated and sanitized
- [ ] Authentication implemented correctly
- [ ] Authorization checks on all endpoints
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Security headers set
- [ ] Sensitive data encrypted
- [ ] No secrets in code/logs
- [ ] Dependencies audited
- [ ] Error messages don't leak information

---

**Security is not optional. All code must follow these standards.**
