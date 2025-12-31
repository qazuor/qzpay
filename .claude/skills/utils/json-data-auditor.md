---
name: json-data-auditor
category: utils
description: Validate, transform, and audit JSON data for quality, consistency, and schema compliance
usage: When validating API data, auditing database exports, transforming formats, or ensuring data quality
input: JSON data, validation schemas, transformation rules, quality criteria
output: Validation results, transformed data, quality reports, anomaly detection
---

# JSON Data Auditor

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `validation_library` | Schema validator | `zod`, `joi`, `ajv` |
| `quality_threshold` | Min quality score | `90` (0-100) |
| `completeness_target` | Min completeness % | `95` |
| `anomaly_z_score` | Outlier threshold | `3` (standard deviations) |
| `max_duplicates` | Max allowed duplicates | `0` |
| `required_fields` | Must-have fields | `['id', 'email', 'createdAt']` |

## Purpose

Validate, transform, and audit JSON data for quality, consistency, and schema compliance across APIs and databases.

## Capabilities

- Schema validation with detailed errors
- Data quality metrics and scoring
- Anomaly detection (outliers, nulls)
- Data transformation and normalization
- Comprehensive audit reporting
- Format validation (email, UUID, dates)

## Data Analysis

### Structure Detection

```typescript
interface DataAnalysis {
  totalRecords: number;
  fields: Record<string, {
    type: string;
    nullable: boolean;
    unique: boolean;
    pattern: string;
  }>;
}

function analyzeJSON(data: unknown[]): DataAnalysis {
  // Detect types, patterns, uniqueness
  // Return structure analysis
}
```

### Pattern Recognition

| Pattern | Detection |
|---------|-----------|
| Email | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| UUID | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| Date | `!isNaN(Date.parse(value))` |
| Phone | Country-specific patterns |

## Schema Validation

### With Zod

```typescript
import { z } from 'zod';

const schema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  status: z.enum(['active', 'inactive']),
});

interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  validRecords: number;
  invalidRecords: number;
}

function validate(data: unknown[], schema: z.ZodSchema): ValidationResult {
  // Validate each record
  // Collect errors with paths
  // Return summary
}
```

## Quality Metrics

### Completeness

```typescript
// Percentage of complete records (all required fields present)
completeness = (completeRecords / totalRecords) * 100
```

### Uniqueness

```typescript
// Percentage of unique values per field
uniqueness[field] = (uniqueValues / totalValues) * 100
```

### Validity

```typescript
// Percentage of values matching expected format
validity[field] = (validValues / totalValues) * 100
```

### Quality Score

```typescript
score = 100
  - (100 - completeness) * 0.4
  - (100 - validity) * 0.4
  - min(duplicates / 10, 10)
  - min(anomalies / 5, 10)
```

## Anomaly Detection

### Statistical Outliers

```typescript
// Z-score method for numeric fields
const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
const stdDev = Math.sqrt(variance);
const zScore = Math.abs((value - mean) / stdDev);

// Flag if z-score > configured threshold (default: 3)
if (zScore > config.anomaly_z_score) {
  flagAsAnomaly();
}
```

### Null Anomalies

```typescript
// Flag unexpected nulls (field usually not null but <10% nulls)
const nullPercentage = (nullCount / totalRecords) * 100;
if (nullPercentage > 0 && nullPercentage < 10) {
  flagAsAnomaly();
}
```

## Data Transformation

### Field Mapping

```typescript
interface TransformRule {
  source: string;
  target: string;
  transform?: (value: unknown) => unknown;
}

const rules: TransformRule[] = [
  { source: 'user_id', target: 'userId' },
  {
    source: 'price',
    target: 'priceInCents',
    transform: (v) => Math.round((v as number) * 100)
  },
  {
    source: 'created_at',
    target: 'createdAt',
    transform: (v) => new Date(v as string).toISOString()
  }
];
```

### Common Transformations

```typescript
// Snake case to camel case
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value
    ])
  );
}

// Flatten nested objects
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { ...acc, ...flatten(value as Record<string, unknown>, newKey) };
    }
    return { ...acc, [newKey]: value };
  }, {});
}
```

## Audit Report

```typescript
interface AuditReport {
  summary: {
    totalRecords: number;
    validRecords: number;
    qualityScore: number;
  };
  validation: {
    errors: ValidationError[];
  };
  quality: {
    completeness: number;
    uniqueness: Record<string, number>;
    validity: Record<string, number>;
  };
  anomalies: Anomaly[];
  recommendations: string[];
}
```

### Recommendations

Generated based on findings:

- Completeness < 95%: "Improve data completeness"
- Duplicates found: "Remove N duplicate records"
- Validation errors: "Fix N validation errors"
- High-severity anomalies: "Investigate N critical anomalies"

## Best Practices

| Practice | Description |
|----------|-------------|
| **Schema First** | Define schemas for all data structures |
| **Boundary Validation** | Validate at system boundaries (API, DB) |
| **Track Metrics** | Monitor quality trends over time |
| **Tune Thresholds** | Adjust anomaly detection for your data |
| **Preserve Originals** | Never modify source data |
| **Automate** | Run audits in CI/CD pipeline |
| **Fix Root Cause** | Address quality at data source |

## Usage Example

```typescript
import { auditJSON } from './json-auditor';

const data = await fetchData();
const schema = z.array(recordSchema);

const report = await auditJSON(data, {
  schema,
  qualityThreshold: 90,
  requiredFields: ['id', 'email', 'status'],
  anomalyZScore: 3,
});

if (report.summary.qualityScore < 90) {
  console.log('Quality issues found:');
  report.recommendations.forEach(r => console.log(`- ${r}`));
}
```

## Checklist

- [ ] Schema defined for validation
- [ ] Required fields configured
- [ ] Quality thresholds set
- [ ] Anomaly detection tuned
- [ ] Validation errors addressed
- [ ] Quality score above threshold
- [ ] No critical anomalies
- [ ] Recommendations reviewed
