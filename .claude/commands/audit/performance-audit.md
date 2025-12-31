---
name: performance-audit
description: Comprehensive performance audit and optimization analysis
type: audit
category: quality
---

# Performance Audit Command

## Purpose

Performs comprehensive performance audit analyzing database queries, API response times, frontend rendering, bundle sizes, and identifying optimization opportunities.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| DATABASE_ORM | Database library | `Drizzle`, `Prisma` |
| FRONTEND_FRAMEWORK | Frontend framework | `React`, `Astro`, `Vue` |
| BUNDLER | Build tool | `Vite`, `Webpack` |
| API_FRAMEWORK | API framework | `Hono`, `Express` |
| REPORT_OUTPUT | Report file path | `.claude/reports/performance-audit-report.md` |

## Usage

```bash
/performance-audit [options]
```

### Options

- `--scope <area>`: Focus on specific area (database, api, frontend, all)
- `--profile`: Enable detailed profiling
- `--report`: Generate detailed report
- `--benchmarks`: Compare against baselines

## Audit Checklist

### 1. Database Performance

| Check | Target | Validation |
|-------|--------|------------|
| N+1 query detection | 0 found | Scan for missing eager loading |
| Query execution time | <100ms (p95) | Measure query performance |
| Missing indexes | None | Analyze query plans |
| Large result sets | Paginated | Check for missing pagination |
| Connection pooling | Optimized | Verify pool configuration |

### 2. API Performance

| Check | Target | Validation |
|-------|--------|------------|
| Response time | <200ms (p95) | Measure endpoint latency |
| Payload size | <100KB | Analyze response sizes |
| Response compression | Enabled | Verify compression |
| Caching headers | Present | Check cache configuration |
| Blocking operations | None | Identify sync operations |

### 3. Frontend Performance

| Check | Target | Validation |
|-------|--------|------------|
| Largest Contentful Paint | <2.5s | Core Web Vitals |
| First Input Delay | <100ms | Interaction responsiveness |
| Cumulative Layout Shift | <0.1 | Visual stability |
| Time to Interactive | <3.5s | Full interactivity |
| Unnecessary re-renders | Minimized | None profiling |

### 4. Bundle Size & Assets

| Check | Target | Validation |
|-------|--------|------------|
| Main bundle size | <200KB (gzipped) | Analyze None output |
| Total JS size | <500KB (gzipped) | Bundle size audit |
| Code splitting | Implemented | Route-based splitting |
| Tree shaking | Enabled | Dead code elimination |
| Image optimization | >80% | Compression analysis |

### 5. Rendering Performance

| Check | Target | Validation |
|-------|--------|------------|
| Component render time | <16ms (60fps) | None profiler |
| DOM tree size | <1500 nodes | DOM complexity |
| Virtual scrolling | For lists >100 items | List rendering |
| Animation performance | 60fps | Frame rate monitoring |
| Layout thrashing | None | Layout shift detection |

### 6. Network Performance

| Check | Target | Validation |
|-------|--------|------------|
| HTTP/2 usage | Enabled | Protocol verification |
| Resource preloading | Critical resources | Priority hints |
| CDN usage | Static assets | Distribution check |
| Cache hit rate | >80% | Cache effectiveness |
| Connection pooling | Optimized | Connection reuse |

### 7. Memory & Resources

| Check | Target | Validation |
|-------|--------|------------|
| Memory leaks | None detected | Heap snapshot analysis |
| GC pauses | <50ms | Garbage collection |
| Resource cleanup | Proper | Event listener cleanup |
| Heap size | <100MB (typical) | Memory profiling |
| Detached DOM nodes | None | DOM leak detection |

## Performance Benchmarks

```javascript
{
  "database": {
    "queryTime": "{{DB_QUERY_TARGET}}ms",
    "indexCoverage": "{{INDEX_COVERAGE_TARGET}}%"
  },
  "api": {
    "responseTime": "{{API_RESPONSE_TARGET}}ms",
    "payloadSize": "{{PAYLOAD_SIZE_TARGET}}KB"
  },
  "frontend": {
    "bundleSize": "{{BUNDLE_SIZE_TARGET}}KB",
    "lcp": "{{LCP_TARGET}}s",
    "fid": "{{FID_TARGET}}ms"
  }
}
```

## Output Format

### Terminal Output

```text
⚡ Performance Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overall Score: {{SCORE}}/100 ({{GRADE}})

🔴 Critical Issues ({{COUNT}})
  {{#each CRITICAL_ISSUES}}
  {{INDEX}}. {{TITLE}}
     Location: {{FILE}}:{{LINE}}
     Impact: {{IMPACT}}
     Fix: {{FIX_SUGGESTION}}
  {{/each}}

🟠 Performance Warnings ({{COUNT}})
  {{#each WARNINGS}}
  {{INDEX}}. {{TITLE}}
     Impact: {{IMPACT}}
     Fix: {{FIX_SUGGESTION}}
  {{/each}}

📈 Metrics

Database:
  {{STATUS}} Avg query time: {{ACTUAL}}ms (target: <{{TARGET}}ms)
  {{STATUS}} N+1 queries detected: {{COUNT}} locations
  {{STATUS}} Index coverage: {{ACTUAL}}%

API:
  {{STATUS}} Avg response time: {{ACTUAL}}ms (target: <{{TARGET}}ms)
  {{STATUS}} Throughput: {{ACTUAL}} req/s
  {{STATUS}} Compression: {{STATUS}}

Frontend:
  {{STATUS}} LCP: {{ACTUAL}}s (target: <{{TARGET}}s)
  {{STATUS}} FID: {{ACTUAL}}ms (target: <{{TARGET}}ms)
  {{STATUS}} Bundle size: {{ACTUAL}}KB (target: <{{TARGET}}KB)

💡 Top Recommendations
  {{#each RECOMMENDATIONS}}
  {{INDEX}}. {{RECOMMENDATION}} ({{IMPROVEMENT}})
  {{/each}}

📄 Detailed report: {{REPORT_OUTPUT}}
```

### Report File Structure

```markdown
# Performance Audit Report

**Date**: {{AUDIT_DATE}}
**Scope**: {{SCOPE}}
**Profile**: {{PROFILE_ENABLED}}

## Executive Summary

Overall Performance Score: {{SCORE}}/100 ({{GRADE}})

**Key Findings:**
- {{CRITICAL_COUNT}} critical performance issues
- {{OPTIMIZATION_COUNT}} optimization opportunities
- Estimated improvement potential: {{IMPROVEMENT_PERCENTAGE}}%

## Critical Issues

### PERF-{{ID}}: {{TITLE}}
- **Severity**: Critical
- **Location**: {{FILE}}:{{LINE}}
- **Impact**: {{IMPACT_DESCRIPTION}}
- **Current Performance**: {{CURRENT}}
- **Expected After Fix**: {{EXPECTED}}
- **Fix**: {{FIX_STEPS}}

## Performance Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| {{METRIC}} | {{CURRENT}} | {{TARGET}} | {{STATUS}} |

## Optimization Opportunities

### Database Optimizations
{{DATABASE_OPTIMIZATIONS}}

### API Optimizations
{{API_OPTIMIZATIONS}}

### Frontend Optimizations
{{FRONTEND_OPTIMIZATIONS}}

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
- name: Performance Audit
  run: {{CLI_TOOL}} /performance-audit --benchmarks --report
  schedule:
    - cron: '0 0 * * 1'  # Weekly
```

## Common Performance Issues

### Database
- N+1 query problems
- Missing indexes
- Inefficient queries
- Large result sets without pagination

### API
- Blocking operations
- Missing caching
- Large payloads
- Synchronous processing

### Frontend
- Large bundles
- Unnecessary re-renders
- Missing code splitting
- Unoptimized images

### Network
- Missing compression
- No resource prioritization
- Inefficient caching
- Too many requests

## Related Commands

- `/quality-check` - Comprehensive validation
- `/security-audit` - Security audits
- `/accessibility-audit` - Accessibility checks
- `/code-check` - Code quality validation
