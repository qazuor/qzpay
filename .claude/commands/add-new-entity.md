---
name: add-new-entity
description: Structured workflow for adding new domain entities following architecture patterns
type: development
category: workflow
---

# Add New Entity Command

## Purpose

Orchestrates complete implementation of new domain entities following established architecture patterns. Creates necessary files across all layers, ensures pattern consistency, and maintains comprehensive testing.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `layer_structure` | Define application layers | `Database → Service → API → Frontend` |
| `entity_patterns` | Entity naming conventions | `PascalCase entities, snake_case tables` |
| `test_framework` | Testing setup | `Vitest, Jest, etc.` |
| `coverage_minimum` | Minimum test coverage | `90%` |
| `base_paths.schemas` | Schema file location | `packages/schemas/src/` |
| `base_paths.models` | Model file location | `packages/db/src/models/` |
| `base_paths.services` | Service file location | `packages/services/src/` |
| `base_paths.routes` | Route file location | `apps/api/src/routes/` |

## Usage

```bash
/add-new-entity {entity_name}
```

## Execution Flow

### Phase 1: Planning

**Agent**: `product-technical`

1. Analyze entity requirements and relationships
2. Design database schema
3. Plan API endpoints and service methods
4. Define validation rules and business logic

**Deliverables**: Entity design document

### Phase 2: Implementation (TDD)

**Layer 1: Database**

- Agent: `db-engineer`
- Files: Schema definition, model class, migration
- Tests: Model CRUD operations

**Layer 2: Service**

- Agent: Backend specialist
- Files: Validation schemas, service class
- Tests: Business logic, edge cases

**Layer 3: API**

- Agent: API specialist
- Files: Route definitions, endpoint handlers
- Tests: API endpoints, authentication

**Layer 4: Frontend**

- Agent: Frontend specialist
- Files: Components, hooks, pages
- Tests: Component behavior, integration

### Phase 3: Validation

**Quality Checks**:

- Code quality: `/quality-check`
- Test coverage: ≥ configured minimum
- Security review
- Performance analysis

**Integration Testing**:

- End-to-end workflows
- Error scenarios
- Acceptance criteria

### Phase 4: Finalization

**Documentation**:

- API endpoint documentation
- Component usage examples
- Integration guides

**Review**:

- Architecture consistency
- Pattern compliance
- Code quality approval

## Entity Implementation Pattern

### Required Files Structure

```text
{base_paths.schemas}/{entity}/
├── create.schema.ts
├── update.schema.ts
└── index.ts

{base_paths.models}/
└── {entity}.model.ts

{base_paths.services}/{entity}/
├── {entity}.service.ts
└── index.ts

{base_paths.routes}/{entity}/
└── index.ts
```

### Pattern Requirements

- Extend base classes where available
- Follow project naming conventions
- Implement proper error handling
- Include comprehensive validation

## Quality Standards

### Code Quality

- Type safety: Strict TypeScript
- Testing: ≥ configured coverage minimum
- Patterns: Consistent with existing code
- Documentation: Complete API docs

### Architecture

- Clear layer separation
- Proper error handling patterns
- Comprehensive input validation
- Authentication/authorization implemented

## Output Format

```text
✅ NEW ENTITY IMPLEMENTATION COMPLETE

Entity: {EntityName}
Layers: {count} implemented

📊 Summary:
✅ Database: Schema, model, migration
✅ Service: Business logic, {coverage}% coverage
✅ API: {count} endpoints
✅ Frontend: {count} components

📋 Files Created: {count}
Database: {list}
Service: {list}
API: {list}
Frontend: {list}

📈 Quality Metrics:
✅ Coverage: {percentage}%
✅ Type Safety: 100%
✅ Performance: {metrics}
```

## Related Commands

- `/start-feature-plan` - Complex entity planning
- `/quality-check` - Entity validation
- `/update-docs` - Documentation updates

## When to Use

- Adding new domain concepts
- Extending data model
- Implementing entity-centric features
- Adding new data structures

## Prerequisites

- Entity requirements defined
- Relationships identified
- Business rules documented
- Design completed

## Best Practices

### Implementation Order

1. Database schema (foundation)
2. Model layer (data access)
3. Service layer (business logic)
4. API layer (external interface)
5. Frontend layer (user interface)

### Testing Strategy

- Unit tests: Each layer independently
- Integration tests: Layer interactions
- API tests: Endpoint behavior
- E2E tests: Complete workflows
