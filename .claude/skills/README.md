# Skills

This directory contains **reusable skill modules** that provide specialized knowledge and workflows. Skills can be used by multiple agents and are invoked when specific expertise is needed.

## Architecture

Skills provide **framework-specific patterns** that complement **generic agents**:

```text
Skills (specific patterns)         Used By
──────────────────────────        ────────────────────
api-frameworks/
├── hono-patterns          ──────> api-engineer
├── express-patterns       ──────> api-engineer
├── fastify-patterns       ──────> api-engineer
└── nestjs-patterns        ──────> api-engineer

database/
├── drizzle-patterns       ──────> database-engineer
├── prisma-patterns        ──────> database-engineer
└── mongoose-patterns      ──────> database-engineer

frontend-frameworks/
├── react-patterns         ──────> frontend-engineer
├── nextjs-patterns        ──────> frontend-engineer
├── astro-patterns         ──────> frontend-engineer
└── tanstack-start-patterns ─────> frontend-engineer
```

## Configuration Required

All skills include a `config_required` section in their YAML frontmatter. Configure the required settings in your project before using a skill.

## Skill Categories

### API Framework Skills (4 skills)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| [hono-patterns](api-frameworks/hono-patterns.md) | Hono framework patterns | Building APIs with Hono |
| [express-patterns](api-frameworks/express-patterns.md) | Express.js patterns | Building APIs with Express |
| [fastify-patterns](api-frameworks/fastify-patterns.md) | Fastify patterns | Building APIs with Fastify |
| [nestjs-patterns](api-frameworks/nestjs-patterns.md) | NestJS patterns | Building APIs with NestJS |

### Database Skills (3 skills)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| [drizzle-patterns](database/drizzle-patterns.md) | Drizzle ORM patterns | Using Drizzle for database |
| [prisma-patterns](database/prisma-patterns.md) | Prisma ORM patterns | Using Prisma for database |
| [mongoose-patterns](database/mongoose-patterns.md) | Mongoose ODM patterns | Using MongoDB with Mongoose |

### Frontend Framework Skills (4 skills)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| [react-patterns](frontend-frameworks/react-patterns.md) | React component patterns | Building React components |
| [nextjs-patterns](frontend-frameworks/nextjs-patterns.md) | Next.js App Router patterns | Building Next.js apps |
| [astro-patterns](frontend-frameworks/astro-patterns.md) | Astro patterns | Building Astro sites |
| [tanstack-start-patterns](frontend-frameworks/tanstack-start-patterns.md) | TanStack Start patterns | Building TanStack Start apps |

### State Management Skills (3 skills)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| [redux-toolkit-patterns](state/redux-toolkit-patterns.md) | Redux Toolkit patterns | Using Redux for state |
| [tanstack-query-patterns](state/tanstack-query-patterns.md) | TanStack Query patterns | Server state management |
| [zustand-patterns](state/zustand-patterns.md) | Zustand patterns | Simple client state |

### Testing Skills (4 skills)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| [api-app-testing](testing/api-app-testing.md) | API endpoint testing | Testing APIs |
| [performance-testing](testing/performance-testing.md) | Performance benchmarks | Validating performance |
| [security-testing](testing/security-testing.md) | Security testing patterns | Testing security |
| [web-app-testing](qa/web-app-testing.md) | E2E web application testing | Testing web UI flows |

### Audit Skills (3 skills)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| [security-audit](audit/security-audit.md) | OWASP compliance | Pre-deployment |
| [performance-audit](audit/performance-audit.md) | Core Web Vitals | Pre-deployment |
| [accessibility-audit](audit/accessibility-audit.md) | WCAG 2.1 Level AA | Pre-deployment |

### Pattern Skills (3 skills)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| [error-handling-patterns](patterns/error-handling-patterns.md) | Error handling | Implementing error handling |
| [tdd-methodology](patterns/tdd-methodology.md) | Test-Driven Development | During implementation |
| [auth-patterns](auth/nextauth-patterns.md) | Authentication patterns | Implementing auth |

### Other Skills

| Category | Skill | Description |
|----------|-------|-------------|
| React | [react-hook-form-patterns](react/react-hook-form-patterns.md) | Form handling |
| i18n | [i18n-patterns](i18n/i18n-patterns.md) | Internationalization |
| QA | [qa-criteria-validator](qa/qa-criteria-validator.md) | PDR validation |
| Tech | [mermaid-diagram-specialist](tech/mermaid-diagram-specialist.md) | Mermaid diagrams |
| Tech | [component-library-specialist](tech/shadcn-specialist.md) | Component libraries |
| Tech | [deployment-platform-specialist](tech/vercel-specialist.md) | Deployment config |
| Git | [git-commit-helper](git/git-commit-helper.md) | Commit messages |
| Docs | [markdown-formatter](documentation/markdown-formatter.md) | Markdown formatting |
| Design | [brand-guidelines](brand-guidelines.md) | Brand consistency |
| Utils | [add-memory](utils/add-memory.md) | Capture learnings |
| Utils | [json-data-auditor](utils/json-data-auditor.md) | JSON validation |
| Utils | [pdf-generator](utils/pdf-creator-editor.md) | PDF generation |

## Usage

Skills are invoked within agent workflows or directly:

```text
"Apply the hono-patterns skill for API implementation"
"Use drizzle-patterns for database schema"
"Reference nextjs-patterns for the page component"
```

## Skill File Format

Each skill file includes:

1. **Header**
   - Skill name and overview
   - When to use

2. **Content**
   - Framework-specific code examples
   - Common patterns
   - Best practices
   - Testing examples
   - Project structure

## Directory Structure

```text
skills/
├── README.md
├── brand-guidelines.md
├── api-frameworks/           # NEW: API framework patterns
│   ├── hono-patterns.md
│   ├── express-patterns.md
│   ├── fastify-patterns.md
│   └── nestjs-patterns.md
├── database/                 # NEW: Database ORM patterns
│   ├── drizzle-patterns.md
│   ├── prisma-patterns.md
│   └── mongoose-patterns.md
├── frontend-frameworks/      # NEW: Frontend framework patterns
│   ├── react-patterns.md
│   ├── nextjs-patterns.md
│   ├── astro-patterns.md
│   └── tanstack-start-patterns.md
├── audit/
│   ├── security-audit.md
│   ├── performance-audit.md
│   └── accessibility-audit.md
├── auth/
│   └── nextauth-patterns.md
├── documentation/
│   └── markdown-formatter.md
├── git/
│   └── git-commit-helper.md
├── i18n/
│   └── i18n-patterns.md
├── patterns/
│   ├── error-handling-patterns.md
│   └── tdd-methodology.md
├── qa/
│   ├── qa-criteria-validator.md
│   └── web-app-testing.md
├── react/
│   └── react-hook-form-patterns.md
├── state/
│   ├── redux-toolkit-patterns.md
│   ├── tanstack-query-patterns.md
│   └── zustand-patterns.md
├── tech/
│   ├── mermaid-diagram-specialist.md
│   ├── shadcn-specialist.md
│   └── vercel-specialist.md
├── testing/
│   ├── api-app-testing.md
│   ├── performance-testing.md
│   └── security-testing.md
└── utils/
    ├── add-memory.md
    ├── json-data-auditor.md
    └── pdf-creator-editor.md
```

## Adding New Skills

1. Create `.md` file in appropriate category folder
2. Include framework-specific code examples
3. Keep content focused on one framework/library
4. Include testing examples
5. Update this README

## Related

- [Agents](../agents/README.md) - Generic role-based agents
- [Commands](../commands/README.md)
