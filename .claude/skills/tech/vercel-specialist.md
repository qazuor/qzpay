---
name: deployment-platform-specialist
category: tech
description: Configure and optimize deployment platform settings for optimal performance and reliability
usage: When deploying applications, configuring environments, optimizing builds, or troubleshooting deployments
input: Deployment configuration, environment variables, build settings, platform type
output: Platform configuration files, deployment strategy, optimization recommendations
---

# Deployment Platform Specialist

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `platform_name` | Deployment platform | `Vercel`, `Netlify`, `AWS Amplify` |
| `project_framework` | Framework | `Astro`, `Next.js`, `TanStack Start` |
| `build_command` | Build command | `pnpm build`, `npm run build` |
| `output_directory` | Output folder | `dist`, `.next`, `build` |
| `install_command` | Install command | `pnpm install`, `npm install` |
| `node_version` | Node version | `18.x`, `20.x` |
| `environment` | Target environment | `production`, `preview`, `development` |

## Purpose

Expert guidance on deployment platform configuration, environment management, build optimization, and production best practices.

## Capabilities

- Platform configuration and setup
- Environment variable management
- Build performance optimization
- Preview and production deployments
- Custom domain configuration
- Edge function implementation
- Monitoring and analytics setup

## Project Configuration

### Platform Config File

```json
{
  "framework": "astro",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "devCommand": "pnpm dev",
  "nodeVersion": "20.x",
  "regions": ["iad1"],
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

## Environment Variables

### Setup

Configure via platform dashboard or CLI:

```bash
# Add variable
platform-cli env add DATABASE_URL production

# Pull variables locally
platform-cli env pull .env.local

# Set variable for all environments
platform-cli env add API_KEY
```

### Organization

| Environment | Purpose | Examples |
|-------------|---------|----------|
| `production` | Live site | Production DB, live API keys |
| `preview` | PR previews | Staging DB, test API keys |
| `development` | Local dev | Local DB, dev API keys |

### Security

- Never commit secrets to git
- Use platform secret storage
- Rotate keys regularly
- Scope variables appropriately

## Build Optimization

### Caching Strategy

```json
{
  "caching": {
    "dependencies": true,
    "buildOutputs": true,
    "staticAssets": "max-age=31536000, immutable"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1",
      "NODE_ENV": "production"
    }
  }
}
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Build time | < 3 minutes |
| Cache hit rate | > 80% |
| Bundle size | Optimized and analyzed |
| Build success rate | > 99% |

## Deployment Workflow

### Git Integration

```yaml
# Auto-deploy configuration
production_branch: main
preview_branches:
  - develop
  - feature/*
  - fix/*

ignore_paths:
  - "docs/**"
  - "*.md"
  - ".github/**"
```

### Preview Deployments

- Automatic on PRs
- Unique URL per deployment
- Comment on PR with preview link
- Run deployment checks

## Edge Functions

### Middleware Example

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Authentication check
  const token = request.cookies.get('auth-token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

## Custom Domains

### DNS Configuration

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | Platform IP | 3600 |
| CNAME | www | Platform domain | 3600 |

### SSL/TLS

- Automatic SSL certificate
- Force HTTPS redirect
- HTTP/2 enabled
- Certificate auto-renewal

## Monitoring

### Analytics Setup

```typescript
// Enable platform analytics
export const config = {
  runtime: 'edge',
  analytics: true,
};
```

### Metrics to Track

- Page load time
- Core Web Vitals (LCP, FID, CLS)
- Error rate
- Build success rate
- Bandwidth usage

## Performance Optimization

### Headers Configuration

```json
{
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-DNS-Prefetch-Control", "value": "on" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000" }
      ]
    }
  ]
}
```

### Redirects

```json
{
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    },
    {
      "source": "/blog/:slug",
      "destination": "/articles/:slug",
      "permanent": false
    }
  ]
}
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Preview First** | Test in preview before production |
| **Environment Separation** | Different variables per environment |
| **Build Caching** | Enable for faster builds |
| **Security Headers** | Set proper security headers |
| **Analytics** | Monitor real user performance |
| **Edge Functions** | Use for auth and routing |
| **Automatic Deployments** | CI/CD with git integration |
| **Domain Management** | Configure DNS and SSL properly |

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Build timeout | Optimize dependencies, enable caching |
| Environment variable missing | Check scope (production/preview) |
| Function timeout | Optimize code or upgrade plan |
| Cache not working | Verify cache headers configuration |

## Checklist

- [ ] Build command configured
- [ ] Output directory correct
- [ ] Environment variables set
- [ ] Git integration active
- [ ] Preview deployments enabled
- [ ] Security headers configured
- [ ] Custom domain configured (if needed)
- [ ] SSL certificate active
- [ ] Analytics enabled
- [ ] Build time < 3 minutes
