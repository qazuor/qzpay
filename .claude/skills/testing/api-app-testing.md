---
name: api-app-testing
category: testing
description: Comprehensive testing workflow for API endpoints with integration, error handling, and validation
usage: Use when implementing or updating API routes to ensure complete test coverage
input: API route file path, service layer, database models, validation schemas
output: Integration test files, coverage reports, test documentation
---

# API Application Testing

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| TEST_FRAMEWORK | Test framework used | `Vitest`, `Jest` |
| TEST_COMMAND | Command to run tests | `pnpm test`, `npm test` |
| COVERAGE_COMMAND | Command to run coverage | `pnpm test:coverage` |
| COVERAGE_TARGET | Minimum coverage required | `90%` |
| API_FRAMEWORK | API framework | `Hono`, `Express`, `Fastify` |
| TEST_DB_SETUP | Database setup strategy | `Transactions`, `In-memory`, `Mocks` |
| ORM_TOOL | ORM/Query builder | `Drizzle`, `Prisma`, `TypeORM` |

## Purpose

Systematic testing approach for API endpoints ensuring functionality, error handling, validation, and documentation accuracy.

## Capabilities

- Test all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Validate request/response schemas
- Test error scenarios and edge cases
- Verify authentication and authorization
- Test database integration
- Measure test coverage
- Validate API documentation

## Workflow

### 1. Test Planning

**Actions:**
- List all endpoints and HTTP methods
- Review validation schemas
- Prepare test data fixtures
- Set up test database

**Validation:**
- [ ] All endpoints documented
- [ ] Test data covers happy path and edge cases
- [ ] Database/mocks configured

### 2. Happy Path Testing

**Test successful scenarios:**

**GET endpoints:**
- Fetch single resource
- Fetch collection with pagination
- Filter and sort operations

**POST endpoints:**
- Create resource with valid data
- Verify database record created
- Test idempotency if applicable

**PUT/PATCH endpoints:**
- Update resource (full/partial)
- Confirm database update

**DELETE endpoints:**
- Delete resource
- Verify cascade operations
- Confirm 404 on re-fetch

**Validation:**
- [ ] Correct status codes (200, 201, 204)
- [ ] Response bodies match schemas
- [ ] Database state reflects changes

### 3. Error Handling Testing

**Test error scenarios:**

**Validation Errors (400):**
- Missing required fields
- Invalid field types
- Out-of-range values

**Authentication Errors (401):**
- Unauthenticated requests
- Expired tokens
- Invalid credentials

**Authorization Errors (403):**
- Insufficient permissions
- Accessing other users' resources

**Not Found Errors (404):**
- Non-existent resource IDs
- Deleted resources

**Conflict Errors (409):**
- Duplicate creation
- Business logic violations

**Server Errors (500):**
- Database failures (mocked)
- Third-party service failures

**Validation:**
- [ ] Correct error status codes
- [ ] Descriptive error messages
- [ ] No sensitive data leaked
- [ ] Consistent error format

### 4. Request/Response Validation

**Test schema enforcement:**
- Request body validation
- Query parameter validation
- Path parameter validation
- Response schema compliance
- Content-type headers
- Request size limits

**Validation:**
- [ ] Invalid requests rejected
- [ ] Validation errors descriptive
- [ ] Response schemas enforced

### 5. Integration Testing

**Test full request-response cycle:**
- Database transactions
- Cascade operations
- Relationship loading
- Search and filtering
- Pagination
- Sorting

**Validation:**
- [ ] Database state correct
- [ ] Transactions rolled back on errors
- [ ] Performance acceptable

### 6. Coverage Analysis

**Actions:**
1. Run tests with coverage: `pnpm test --coverage`
2. Review coverage report
3. Identify untested code paths
4. Add tests for uncovered areas

**Validation:**
- [ ] Coverage >= {{COVERAGE_TARGET}}
- [ ] All endpoints tested
- [ ] All error paths tested

## Test Structure Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'None';
import { app } from '../src/index';
import { testDb } from '../helpers/test-db';

describe('/api/resources', () => {
  beforeAll(async () => {
    await testDb.seed();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('GET /api/resources', () => {
    it('should return paginated resources', async () => {
      const response = await app.request('/api/resources?page=1&limit=10');

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('items');
      expect(data.items).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/resources', () => {
    it('should create resource with valid data', async () => {
      const resource = {
        name: 'Test Resource',
        value: 100
      };

      const response = await app.request('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resource)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
    });

    it('should reject invalid data', async () => {
      const response = await app.request('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' })
      });

      expect(response.status).toBe(400);
    });
  });
});
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **AAA Pattern**: Arrange, Act, Assert
3. **Descriptive Names**: Test names explain behavior
4. **Mock External Dependencies**: Don't test third-party services
5. **Database Transactions**: Rollback after tests
6. **Fast Tests**: Keep total time under 5 seconds
7. **Realistic Data**: Use production-like test data

## Output

**Produces:**
- Integration test files
- Test coverage reports (>= {{COVERAGE_TARGET}})
- Documentation validation results
- Test data fixtures

**Success Criteria:**
- All tests passing
- Coverage meets target
- No console warnings
- Error handling comprehensive

## Related Skills

- `tdd-methodology` - Test-Driven Development approach
- `security-testing` - API security testing
- `performance-testing` - API performance testing
