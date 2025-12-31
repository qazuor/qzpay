---
name: performance-testing
category: testing
description: Performance testing methodology for database, API, and frontend with benchmarks and optimization
usage: Use to identify bottlenecks, validate performance targets, and optimize operations
input: Application components, performance budgets, baseline metrics
output: Performance reports, bottleneck analysis, optimization recommendations
---

# Performance Testing

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| DB_QUERY_TARGET | Max query time (p95) | `100ms` |
| API_RESPONSE_TARGET | Max API response (p95) | `200ms` |
| FRONTEND_LCP_TARGET | Largest Contentful Paint | `2.5s` |
| FRONTEND_FID_TARGET | First Input Delay | `100ms` |
| FRONTEND_CLS_TARGET | Cumulative Layout Shift | `0.1` |
| BUNDLE_SIZE_TARGET | Max bundle size (gzipped) | `500KB` |
| THROUGHPUT_TARGET | Min requests/second | `1000 req/s` |
| ERROR_RATE_TARGET | Max error rate | `0.1%` |

## Purpose

Systematic performance testing and optimization across database, API, and frontend layers.

## Capabilities

- Identify slow database queries
- Test API response times under load
- Measure Core Web Vitals
- Analyze bundle sizes
- Detect N+1 query problems
- Test rendering performance
- Generate performance reports

## Workflow

### 1. Database Performance Testing

**Actions:**
1. Enable query logging
2. Identify slow queries (> {{DB_QUERY_TARGET}})
3. Run EXPLAIN on slow queries
4. Check for:
   - N+1 query problems
   - Missing indexes
   - Full table scans
   - Unnecessary SELECT *
5. Optimize:
   - Add indexes
   - Use eager loading
   - Implement pagination
   - Select specific columns

**Validation:**
- [ ] All queries < {{DB_QUERY_TARGET}} (p95)
- [ ] No N+1 patterns
- [ ] Indexes used effectively
- [ ] Pagination on large datasets

**Example Test:**

```typescript
import { describe, it, expect } from 'your-test-framework';
import { db } from '@/db';

describe('Database Performance', () => {
  it('should fetch items in < {{DB_QUERY_TARGET}}', async () => {
    const startTime = performance.now();

    await db.items.findMany({
      limit: 100,
      with: { relations: true }
    });

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100);
  });
});
```

### 2. API Performance Testing

**Actions:**
1. Test API response times
2. Test under load:
   - Concurrent requests
   - Sustained load
   - Spike testing
3. Monitor:
   - Response time (p50, p95, p99)
   - Throughput (req/s)
   - Error rate
   - Resource usage

**Validation:**
- [ ] API response < {{API_RESPONSE_TARGET}} (p95)
- [ ] Throughput > {{THROUGHPUT_TARGET}}
- [ ] Error rate < {{ERROR_RATE_TARGET}}
- [ ] No memory leaks

**Load Test Example:**

```yaml
# Using Artillery
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 20
    - duration: 120
      arrivalRate: 50
  ensure:
    p95: {{API_RESPONSE_TARGET}}
```

### 3. Frontend Performance Testing

**Core Web Vitals:**
- LCP (Largest Contentful Paint) < {{FRONTEND_LCP_TARGET}}
- FID (First Input Delay) < {{FRONTEND_FID_TARGET}}
- CLS (Cumulative Layout Shift) < {{FRONTEND_CLS_TARGET}}
- INP (Interaction to Next Paint) < 200ms

**Page Load Metrics:**
- TTFB (Time to First Byte) < 600ms
- FCP (First Contentful Paint) < 1.8s
- TTI (Time to Interactive) < 3.5s

**Bundle Analysis:**
- Main bundle < {{BUNDLE_SIZE_TARGET}}
- Code splitting implemented
- Lazy loading for routes

**Validation:**
- [ ] Core Web Vitals met
- [ ] Bundle sizes within budget
- [ ] Component render < 16ms (60fps)

### 4. Bottleneck Identification

**Categories:**
- **Database**: Slow queries, N+1 problems
- **API**: Blocking operations, inefficient algorithms
- **Frontend**: Large bundles, unnecessary re-renders
- **Network**: Large payloads, missing caching

**Prioritization:**
- High: Affects >50% users, >1s delay
- Medium: Affects 20-50% users, 500ms-1s delay
- Low: <20% users, <500ms delay

**Validation:**
- [ ] All bottlenecks identified
- [ ] Impact assessed
- [ ] Priority assigned

### 5. Optimization Implementation

**Database Optimizations:**
- Add indexes
- Optimize queries
- Implement caching
- Add pagination

**API Optimizations:**
- Enable compression
- Implement caching
- Use async operations
- Optimize algorithms

**Frontend Optimizations:**
- Code splitting
- Lazy loading
- Image optimization
- Tree shaking
- Memoization

**Validation:**
- [ ] Optimizations implemented
- [ ] Tests passing
- [ ] Performance improved

### 6. Regression Testing

**Actions:**
1. Run full test suite
2. Re-measure performance
3. Compare before/after metrics
4. Document improvements

**Validation:**
- [ ] All tests passing
- [ ] Performance improved
- [ ] No regressions
- [ ] Gains documented

## Performance Budgets

```json
{
  "database": {
    "queryTime": { "p95": "{{DB_QUERY_TARGET}}", "unit": "ms" },
    "n1Queries": 0
  },
  "api": {
    "responseTime": { "p95": "{{API_RESPONSE_TARGET}}", "unit": "ms" },
    "throughput": { "min": "{{THROUGHPUT_TARGET}}", "unit": "req/s" }
  },
  "frontend": {
    "lcp": { "max": "{{FRONTEND_LCP_TARGET}}", "unit": "ms" },
    "fid": { "max": "{{FRONTEND_FID_TARGET}}", "unit": "ms" },
    "cls": { "max": "{{FRONTEND_CLS_TARGET}}" },
    "bundleSize": { "max": "{{BUNDLE_SIZE_TARGET}}", "unit": "KB" }
  }
}
```

## Tools

**Database:**
- Query logging
- EXPLAIN / EXPLAIN ANALYZE
- Database profiling tools

**API:**
- Artillery (load testing)
- K6 (performance testing)
- autocannon (HTTP benchmarking)

**Frontend:**
- Lighthouse
- Chrome DevTools Performance
- WebPageTest
- Bundle Analyzer

## Best Practices

1. **Establish Baselines**: Measure before optimizing
2. **Set Budgets**: Define acceptable performance levels
3. **Test Regularly**: Include in CI/CD pipeline
4. **Optimize Strategically**: Focus on high-impact areas
5. **Measure Impact**: Quantify improvements
6. **Avoid Premature Optimization**: Profile first
7. **Test Realistically**: Use production-like data
8. **Monitor Trends**: Track over time

## Output

**Produces:**
- Performance test reports
- Bottleneck analysis with priorities
- Optimization recommendations
- Before/after comparisons
- Performance budget validation

**Success Criteria:**
- All performance targets met
- Bottlenecks identified and prioritized
- Optimizations validated
- Performance budgets enforced

## Related Skills

- `api-app-testing` - API integration testing
- `security-testing` - Security performance impact
