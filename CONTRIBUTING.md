# Contributing to QZPay

Thank you for your interest in contributing to QZPay! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributions from everyone.

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm >= 9.15.0
- Docker (for running tests with PostgreSQL)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/qzpay.git
   cd qzpay
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build all packages:
   ```bash
   pnpm build
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm test --filter @qazuor/qzpay-core

# Run tests with coverage
pnpm test:coverage
```

### Linting and Formatting

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Type Checking

```bash
pnpm typecheck
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feat/add-new-feature` - New features
- `fix/issue-description` - Bug fixes
- `docs/update-readme` - Documentation changes
- `refactor/improve-something` - Code refactoring
- `test/add-tests` - Test additions

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(core): add metrics calculation service
fix(stripe): handle webhook signature verification
docs(readme): update installation instructions
```

### Pull Requests

1. Create a new branch from `main`
2. Make your changes
3. Ensure all tests pass: `pnpm test`
4. Ensure linting passes: `pnpm lint`
5. Commit your changes following conventional commits
6. Push to your fork
7. Open a Pull Request

#### PR Description

Please include:
- Summary of changes
- Related issue (if any)
- Test plan
- Screenshots (if UI changes)

## Project Structure

```
qzpay/
├── packages/
│   ├── core/           # Core types and utilities
│   ├── stripe/         # Stripe adapter
│   ├── mercadopago/    # MercadoPago adapter
│   ├── drizzle/        # Drizzle ORM storage
│   ├── hono/           # Hono middleware
│   ├── react/          # React hooks/components
│   └── nestjs/         # NestJS integration
├── docs/               # Documentation
└── e2e/                # E2E tests
```

## Code Guidelines

### TypeScript

- Use strict TypeScript
- Export types explicitly
- Use `type` imports for type-only imports
- Document public APIs with JSDoc

### Testing

- Write tests for all new features
- Maintain 90%+ coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Error Handling

- Use typed errors when possible
- Provide meaningful error messages
- Don't swallow errors silently

## Package-Specific Guidelines

### @qazuor/qzpay-core

- Keep types and constants separate
- No external dependencies (except zod for validation types)
- All utilities should be pure functions

### Provider Adapters (stripe, mercadopago)

- Implement all interfaces from core
- Handle provider-specific errors gracefully
- Include comprehensive webhook handling
- Document API version compatibility

### Storage Adapters (drizzle)

- Support transactions
- Handle migrations carefully
- Document schema changes

### Framework Integrations (hono, nestjs, react)

- Follow framework conventions
- Provide TypeScript types
- Include middleware/hooks for common operations

## Getting Help

- Open an issue for bugs or feature requests
- Use discussions for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
