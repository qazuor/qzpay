---
name: create-agent
type: meta
category: system
description: Interactive wizard to create specialized AI agents
---

# Create Agent Command

## Purpose

Interactive wizard for creating specialized AI agents following project standards. Ensures proper integration with workflow system and comprehensive documentation.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `agent_categories` | Available categories | `product, engineering, quality, design, specialized` |
| `model_options` | Available models | `sonnet, opus, haiku, inherit` |
| `tool_sets.basic` | Basic tool set | `Read, Write, Edit` |
| `tool_sets.advanced` | Advanced tool set | `Read, Write, Edit, Bash, Task, Skill` |
| `template_types` | Agent templates | `technical, product, quality, design` |
| `base_path` | Agent directory | `.claude/agents/` |

## Usage

```bash
/create-agent [options]
```

### Options

- `--name <kebab-case>`: Agent name
- `--category <category>`: Category
- `--interactive`: Full interactive mode (default)
- `--template <type>`: Use template

## When to Use

- New specialized role needed
- Responsibility gaps identified
- Separation of concerns required
- Team expansion

## Agent Creation Process

### Step 1: Discovery & Planning

**Wizard Questions**:

1. Agent Name (kebab-case)
2. Category selection
3. Primary responsibilities (3-5)
4. Phase involvement
5. Required tools
6. Model preference
7. Related agents

### Step 2: File Generation

**File Created**: `{base_path}/{category}/{agent-name}.md`

**YAML Frontmatter**:

```yaml
---
name: {agent-name}
description: {description}
tools: {tools}
model: {model}
responsibilities:
  - {responsibility}
---
```

**Structure Sections**:

1. Role & Identity
2. Core Responsibilities
3. Working Context
4. Best Practices
5. Workflow Integration
6. Quality Standards
7. Tools & Resources
8. Examples

### Step 3: Integration & Documentation

**Updates Required**:

- Agent README
- Main documentation
- Glossary (if new pattern)
- Template files (if applicable)

### Step 4: Validation

**Checks**:

- Name follows conventions
- YAML valid
- All sections complete
- Responsibilities clear
- Tools appropriate
- No overlap with existing
- Documentation updated

**Test Invocation**: Verify agent loads and functions

### Step 5: Commit

**Format**:

```bash
feat(agents): add {agent-name} agent

- Core responsibilities: {list}
- Integrates with: {agents}
- Tools: {tools}
- Model: {model}

Updates:
- {agent_file} (new)
- README.md (updated)
```

## Interactive Wizard Flow

```text
🤖 Create New Agent Wizard

📝 Step 1: Agent Identity
Agent Name: {input}
Category: {selection}
Description: {input}

📋 Step 2: Responsibilities
Enter 3-5 primary responsibilities

🔧 Step 3: Configuration
Tools needed: {selection}
Model preference: {selection}
Phase involvement: {selection}

🔗 Step 4: Relationships
Related agents: {input}

📝 Step 5: Review & Confirm
{summary}
Proceed? (y/n)

✨ Creating Agent
✓ Generated agent file
✓ Updated documentation
✓ Validation passed
```

## Agent Templates

### Technical Agent

```markdown
---
name: {agent-name}
description: {description}
tools: Read, Write, Edit, Bash
model: sonnet
---

# {Agent Name}

## Role & Identity
{role_definition}

## Core Responsibilities
{responsibilities}

## Working Context
{context}

## Best Practices
{practices}

[Additional sections...]
```

## Validation Rules

### Agent Name

- Format: kebab-case
- Length: 3-30 characters
- Pattern: `^[a-z][a-z0-9-]*[a-z0-9]$`
- Must be unique

### YAML Frontmatter

**Required**: name, description, tools, model, responsibilities

**Valid Tools**: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, mcp__*

**Valid Models**: sonnet, opus, haiku, inherit

### Directory Structure

```text
{base_path}/
├── product/
├── engineering/
├── quality/
├── design/
└── specialized/
```

## Best Practices

### Design

- Clear scope definition
- No overlap with existing
- Focused responsibilities
- Comprehensive documentation
- Multiple examples
- Actionable checklists

### Integration

- Clear workflow integration
- Defined collaboration patterns
- Explicit input/output protocols

## Common Patterns

| Type | Category | Tools | Model | Phases |
|------|----------|-------|-------|--------|
| Backend | engineering | Read, Write, Edit, Bash | sonnet | Phase 2 |
| QA | quality | Read, Bash, Skill | sonnet | Phase 3, All |
| Product | product | Read, Write, Edit | sonnet | Phase 1 |

## Related Commands

- `/create-command` - Create new command
- `/create-skill` - Create new skill
- `/help` - System help

## Notes

- Consider consolidation before creating new
- Prefer specialized for deep expertise
- Only grant needed tools
- Use sonnet for most cases
- Test before committing
