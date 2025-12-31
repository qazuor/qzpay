---
name: performance-audit
category: audit
description: Comprehensive performance audit for database queries, API endpoints, frontend rendering, bundle size, and Core Web Vitals
usage: Use for performance optimization analysis, bottleneck identification, and validation against performance budgets
input: Application (database, API, frontend), performance budgets, baseline metrics, user scenarios
output: Performance audit report with metrics, bottlenecks, optimization recommendations, and trend analysis
---

# Performance Audit

## Purpose

Comprehensive performance audit analyzing database, API, frontend performance, and identifying optimization opportunities.

**Category**: Audit
**Primary Users**: tech-lead
**Coordinates**: Performance optimization and monitoring

## When to Use

- Before production deployment
- After major feature additions
- When users report slowness
- Regular performance reviews (monthly recommended)
- After database schema changes
- When Core Web Vitals scores degrade
- Before scaling infrastructure

## Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| target_environment | Environment to audit | `production`, `staging` |
| performance_budgets | Performance targets | `LCP<2.5s, API<200ms, Bundle<500KB` |
| baseline_metrics | Previous audit data | `2024-09-15-audit.json` |
| expected_load | Anticipated traffic | `1000 concurrent users, 100 req/s` |
| audit_depth | Thoroughness level | `quick`, `standard`, `comprehensive` |
| monitoring_tools | Available APM tools | `Lighthouse, Sentry, DataDog` |

## Audit Areas

| Area | Key Metrics | Target | Output |
|------|-------------|--------|--------|
| **Database** | Query time (p95), N+1 queries, indexes, connection pool | <100ms | Slow queries, index recommendations |
| **API** | Response time (p95), throughput, payload size, cache hit ratio | <200ms | Slow endpoints, optimization suggestions |
| **Core Web Vitals** | LCP, FID, CLS, TTI, TBT, FCP | LCP<2.5s, FID<100ms, CLS<0.1 | Web Vitals status, rendering optimizations |
| **Bundle Size** | JS/CSS size, code splitting, tree shaking, unused code | JS<500KB, CSS<100KB | Bloat detection, splitting recommendations |
| **Rendering** | Re-renders, reconciliation, memo usage, list virtualization | Minimal re-renders | Inefficient components, optimization tips |
| **Network** | HTTP version, CDN, compression, TTFB, connection reuse | HTTP/2+, gzip/brotli | CDN effectiveness, connection optimizations |
| **Memory** | Heap size, GC frequency, memory leaks, DOM nodes | Stable over time | Leak detection, cleanup recommendations |
| **Third-party** | Script size, execution time, blocking time, request count | Minimize impact | Impact analysis, alternatives evaluation |

## Workflow

### 1. Preparation (5min)

- Configure Lighthouse and monitoring tools
- Gather baseline metrics (Core Web Vitals, API times, bundle sizes)
- Prepare test scenarios

### 2. Automated Analysis (15min)

```bash
# Lighthouse audit
lighthouse https://app-url --view --preset=desktop
lighthouse https://app-url --view --preset=mobile

# Bundle analysis
npm run build --analyze
pnpm run build --analyze

# Database analysis (example for PostgreSQL)
# SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
```

### 3. Manual Profiling (30min)

**Frontend Profiling:**
- React DevTools Profiler
- Chrome Performance tab
- Network waterfall analysis
- Memory profiler

**API Profiling:**
- Response time analysis
- Payload size review
- Cache effectiveness
- Database query breakdown

**User Flow Testing:**
- Critical user journeys
- Authentication flow
- Data-heavy operations

### 4. Load Testing (20min)

```bash
# Load testing (example with Artillery)
artillery run load-test.yml
```

Test:
- Concurrent query load
- Connection pool stress
- Simulated concurrent users
- Network/CPU throttling

### 5. Reporting (15min)

**Categorize Findings:**
- **Critical:** Budget violations (LCP>4s, API>1s)
- **High:** Needs improvement (LCP 2.5-4s, API 200-500ms)
- **Medium:** Optimization opportunities (bundle>300KB)
- **Low:** Best practice improvements

## Performance Budgets

| Category | Good | Needs Improvement | Poor |
|----------|------|-------------------|------|
| **LCP** | <2.5s | 2.5-4s | >4s |
| **FID** | <100ms | 100-300ms | >300ms |
| **CLS** | <0.1 | 0.1-0.25 | >0.25 |
| **API (p95)** | <200ms | 200-500ms | >500ms |
| **DB Query (p95)** | <100ms | 100-300ms | >300ms |
| **JS Bundle** | <500KB | 500-1MB | >1MB |
| **CSS Bundle** | <100KB | 100-200KB | >200KB |
| **Total Page Weight** | <2MB | 2-5MB | >5MB |

## Report Template

```markdown
# Performance Audit Report

**Date:** YYYY-MM-DD
**Environment:** [environment]
**Performance Budget:** [Within/Exceeded]

## Executive Summary

- Overall Performance Score: X/100
- Core Web Vitals: [Pass/Fail]
- Critical Issues: X
- Optimization Opportunities: X

## Core Web Vitals

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | X.Xs | <2.5s | ✅/❌ |
| FID | Xms | <100ms | ✅/❌ |
| CLS | X.XX | <0.1 | ✅/❌ |

## Performance Metrics

### Database
- Average Query Time (p95): Xms (target: <100ms)
- Slow Queries: X queries >100ms
- N+1 Queries: X detected
- Missing Indexes: X tables

### API
- Average Response Time (p95): Xms (target: <200ms)
- Slowest Endpoints: [list]
- Payload Size (avg): XKB
- Error Rate: X%

### Frontend
- Bundle Size: XKB gzipped (target: <500KB)
- First Contentful Paint: X.Xs
- Time to Interactive: X.Xs
- Total Blocking Time: Xms

## Findings by Priority

### Critical (Immediate Action)

1. **[Issue Title]**
   - Impact: [User experience impact]
   - Current: [Metric value]
   - Target: [Goal value]
   - Location: [File/Endpoint]
   - Recommendation: [Specific fix]
   - Effort: [Low/Medium/High]
   - Expected Improvement: [Metric improvement]

## Top 5 Bottlenecks

1. **[Bottleneck Name]** - [Impact]
   - Time/Size: [Metric]
   - Root Cause: [Analysis]
   - Fix: [Solution]
   - Priority: [Critical/High/Medium]

## Optimization Recommendations

### Database
1. Add indexes to [tables/columns]
2. Optimize queries: [specific queries]
3. Fix N+1 queries: [locations]

### API
1. Enable caching for [endpoints]
2. Reduce payload size: pagination, field selection, compression
3. Optimize [specific endpoints]

### Frontend
1. Code splitting for [routes/components]
2. Image optimization: WebP/AVIF, lazy loading, responsive images
3. Component optimization: memoization, virtualization, Suspense

## Trend Analysis

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| LCP | X.Xs | X.Xs | ±X% |
| API (p95) | Xms | Xms | ±X% |
| Bundle Size | XKB | XKB | ±X% |

## Next Steps

1. **Immediate Actions** (Critical) - [with owners/deadlines]
2. **Short-term** (High, this sprint)
3. **Medium-term** (Medium, next sprint)
4. **Long-term** (Low, backlog)
5. **Monitoring** - Setup continuous monitoring, track budgets in CI/CD
```

## Success Criteria

- All critical performance issues identified
- Core Web Vitals meet "Good" thresholds
- Performance budgets validated
- Optimization recommendations prioritized
- Trend analysis completed
- Report delivered with actionable items

## Best Practices

1. Monitor continuously, don't wait for audits
2. Track budgets in CI/CD, fail builds on violations
3. Prioritize user impact, fix critical flows first
4. Measure real users (RUM) over synthetic tests
5. Test on real devices, not just dev machines
6. Compare trends, track improvements over time
7. Document baselines for comparison

## Related Skills

- [performance-testing](../testing/performance-testing.md) - Development testing
- [qa-criteria-validator](../qa/qa-criteria-validator.md) - Acceptance validation
