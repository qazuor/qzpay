# AI Agents

This directory contains **specialized AI agents** that can be configured for any project. Each agent is an expert in specific areas and can be invoked during development workflow.

## Architecture

Agents are **generic by role** and use **skills for framework-specific patterns**:

```text
Agent (generic role)           Skills (specific frameworks)
─────────────────────         ─────────────────────────────
api-engineer          ───────> hono-patterns, express-patterns,
                               fastify-patterns, nestjs-patterns

database-engineer     ───────> drizzle-patterns, prisma-patterns,
                               mongoose-patterns

frontend-engineer     ───────> react-patterns, nextjs-patterns,
                               astro-patterns, tanstack-start-patterns
```

## Configuration Required

All agents include a `config_required` section in their YAML frontmatter. Before using an agent, ensure you've configured the required settings in your project's `CLAUDE.md` or configuration files.

**Example agent frontmatter:**

```yaml
---
name: agent-name
description: Brief description
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
config_required:
  - setting_name: "Description of what to configure"
related_skills:
  - skill-category/skill-name (if using X)
---
```

## Agent Categories

### Product & Planning (2 agents)

| Agent | Description | Phase |
|-------|-------------|-------|
| [product-functional](product/product-functional.md) | Creates PDRs with user stories and acceptance criteria | Phase 1 |
| [product-technical](product/product-technical.md) | Technical analysis, architecture design, task breakdown | Phase 1 |

### Technical Leadership (1 agent)

| Agent | Description | Phase |
|-------|-------------|-------|
| [tech-lead](engineering/tech-lead.md) | Architectural oversight, code quality, security/performance validation | All |

### Engineering (4 agents)

| Agent | Description | Related Skills |
|-------|-------------|----------------|
| [api-engineer](engineering/api-engineer.md) | API routes, middleware, server logic | `api-frameworks/*` |
| [database-engineer](engineering/database-engineer.md) | Database schemas, migrations, models | `database/*` |
| [frontend-engineer](engineering/frontend-engineer.md) | Components, state management, UI | `frontend-frameworks/*` |
| [node-typescript-engineer](engineering/node-typescript-engineer.md) | Shared packages, utilities, Node.js/TypeScript | - |

### Design & UX (2 agents)

| Agent | Description | Phase |
|-------|-------------|-------|
| [ux-ui-designer](design/ux-ui-designer.md) | UI design, user flows, accessibility | Phase 1, 3 |
| [content-writer](design/content-writer.md) | Web content, copywriting, tone of voice | All |

### Quality Assurance (2 agents)

| Agent | Description | Phase |
|-------|-------------|-------|
| [qa-engineer](quality/qa-engineer.md) | Testing strategy, quality validation | Phase 3 |
| [debugger](quality/debugger.md) | Bug investigation, root cause analysis | Phase 3 |

### Specialized (4 agents)

| Agent | Description | Phase |
|-------|-------------|-------|
| [tech-writer](specialized/tech-writer.md) | Documentation, API docs, changelogs | Phase 4 |
| [i18n-specialist](specialized/i18n-specialist.md) | Internationalization, translations | All |
| [enrichment-agent](specialized/enrichment-agent.md) | Issue enrichment, planning context | Planning |
| [seo-ai-specialist](specialized/seo-ai-specialist.md) | SEO, Core Web Vitals, structured data | All |

## Usage

Invoke agents using the Task tool:

```text
Use the Task tool with subagent_type="agent-name"
```

**Examples:**

```text
"Invoke product-functional to create the PDR"
"Use tech-lead to review architecture"
"Call database-engineer to design the schema"
"Use api-engineer to implement the routes"
```

## Agent + Skill Pattern

When using engineering agents, they reference skills for framework-specific patterns:

1. **Agent provides**: Generic responsibilities, best practices, testing strategy
2. **Skill provides**: Framework-specific code examples, patterns, configurations

**Example workflow:**

```text
1. User configures: API_FRAMEWORK=hono, ORM=drizzle
2. api-engineer is invoked
3. Agent references hono-patterns skill for Hono-specific code
4. database-engineer references drizzle-patterns skill for Drizzle-specific code
```

## Agent File Format

Each agent file includes:

1. **YAML Frontmatter**
   - `name`: Unique identifier (kebab-case)
   - `description`: When to invoke the agent
   - `tools`: Allowed tools (comma-separated)
   - `model`: sonnet/opus/haiku (optional)
   - `config_required`: Configuration directives
   - `related_skills`: Skills for specific frameworks

2. **Configuration Section**
   - Table of required settings
   - Examples for each setting

3. **Agent Content**
   - Role and responsibilities
   - Core workflow (universal patterns)
   - Best practices
   - Quality checklist

## Directory Structure

```text
agents/
├── README.md
├── product/
│   ├── product-functional.md
│   └── product-technical.md
├── engineering/
│   ├── tech-lead.md
│   ├── api-engineer.md          # Generic API agent
│   ├── database-engineer.md     # Generic database agent
│   ├── frontend-engineer.md     # Generic frontend agent
│   └── node-typescript-engineer.md
├── quality/
│   ├── qa-engineer.md
│   └── debugger.md
├── design/
│   ├── ux-ui-designer.md
│   └── content-writer.md
└── specialized/
    ├── tech-writer.md
    ├── i18n-specialist.md
    ├── enrichment-agent.md
    └── seo-ai-specialist.md
```

## Adding New Agents

1. Create `.md` file in appropriate category folder
2. Use naming convention: `kebab-case-name.md`
3. Include YAML frontmatter with `config_required`
4. Add `related_skills` if agent uses framework-specific skills
5. Add `⚙️ Configuration` section with settings table
6. Keep content generic (no framework-specific code)
7. Update this README

## Related

- [Skills](../skills/README.md) - Framework-specific patterns
- [Commands](../commands/README.md)
