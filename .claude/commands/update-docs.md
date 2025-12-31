---
name: update-docs
description: Comprehensive documentation update and maintenance
type: development
category: documentation
---

# Update Docs Command

## Purpose

Orchestrates comprehensive documentation review and updates using specialized agents. Ensures all documentation remains current, accurate, and useful.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `doc_locations.api` | API documentation path | `docs/api/` |
| `doc_locations.components` | Component docs path | `docs/components/` |
| `doc_locations.architecture` | Architecture docs path | `docs/architecture/` |
| `doc_types` | Documentation categories | `api, components, architecture, development` |
| `validation.coverage_target` | Documentation coverage goal | `95%` |
| `validation.link_check` | Enable link validation | `true` |

## Usage

```bash
/update-docs
```

## Execution Flow

### Step 1: Documentation Analysis

**Agent**: `tech-writer`

- Audit existing documentation
- Identify outdated/missing sections
- Review code changes for doc impacts
- Assess quality and usability
- Plan updates

## Documentation Areas

### API Documentation

**Scope**:

- API specifications
- Endpoint documentation
- Authentication guides
- Error responses
- Rate limiting

**Update Requirements**:

- All endpoints documented
- Complete request/response schemas
- Current authentication flows
- Error codes explained

### Component Documentation

**Scope**:

- Component API references
- Usage examples and patterns
- Accessibility guidelines
- Styling options

**Update Requirements**:

- Props/attributes documented
- Interactive examples
- Accessibility compliance
- Performance considerations

### Architecture Documentation

**Scope**:

- System overview
- Layer architecture
- Data flow diagrams
- Technology decisions

**Update Requirements**:

- Current architecture reflection
- Clear diagrams
- Decision rationale
- Migration paths

### Development Documentation

**Scope**:

- Setup instructions
- Development workflow
- Testing guides
- Deployment procedures

**Update Requirements**:

- Tested setup steps
- Clear workflow explanations
- Comprehensive troubleshooting
- Tool-specific guidance

## Quality Standards

### Content Quality

| Metric | Requirement |
|--------|------------|
| Accuracy | 100% current and correct |
| Completeness | ≥ configured coverage target |
| Clarity | Easy to understand |
| Examples | Practical, working examples |

### Technical Standards

- Consistent markdown formatting
- Proper syntax highlighting
- Working links (internal/external)
- Optimized images
- Searchable content

## Output Format

### Success Case

```text
✅ DOCUMENTATION UPDATE COMPLETE

Files Reviewed: {count}
Updated: {count}
New: {count}
Fixed Links: {count}

API Documentation:
✅ Specification: {status}
✅ Endpoints: {count} documented
✅ Examples: {count} added

Component Documentation:
✅ Components: {count} documented
✅ Design System: {status}
✅ Accessibility: {compliance}

Architecture Documentation:
✅ Diagrams: {status}
✅ Patterns: {count} documented

Quality Metrics:
✅ Accuracy: {percentage}%
✅ Coverage: {percentage}%
✅ Link Health: {percentage}%
```

### Issues Identified Case

```text
⚠️ DOCUMENTATION UPDATE - ISSUES IDENTIFIED

Critical Issues: {count}
High Priority: {count}
Medium Priority: {count}

Coverage: {percentage}% (target: {target}%)

{Issue details with recommendations}
```

## Documentation Automation

### Automated Generation

- API specs from code
- Type definitions from schemas
- Examples from tests
- Metrics from tools

### Validation

- Link checking
- Spelling/grammar
- Code syntax validation
- Coverage reports

## Maintenance Schedule

**Code Changes**:

- API changes → Update API docs
- Component changes → Update component docs
- Architecture changes → Update architecture docs

**Regular Reviews**:

- Monthly: Quick review
- Quarterly: Comprehensive audit
- Release: Update for version

## Related Commands

- `/quality-check` - Includes documentation validation
- `/add-new-entity` - Requires documentation

## When to Use

- After major features
- Regular maintenance (monthly)
- Before releases
- Onboarding preparation

## Best Practices

### Writing

- Clear, concise language
- Practical examples
- Consistent tone
- Logical structure

### Technical

- Current code examples
- Proper markdown formatting
- Optimized media
- Consistent naming

### Maintenance

- Update with code changes
- Review during code reviews
- Collect user feedback
- Monitor usage metrics
