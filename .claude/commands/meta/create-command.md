---
name: create-command
type: meta
category: system
description: Interactive wizard to create new slash commands
---

# Create Command

## Purpose

Interactive wizard for creating slash commands following project standards. Ensures proper integration with workflow and comprehensive documentation.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `command_types` | Available types | `development, planning, quality, audit, meta, git` |
| `category_mapping` | Type to directory map | `development: workflow, quality: validation` |
| `template_types` | Template options | `workflow, audit, utility` |
| `base_path` | Commands directory | `.claude/commands/` |
| `name_pattern` | Validation regex | `^[a-z][a-z0-9-]*[a-z0-9]$` |

## Usage

```bash
/create-command [options]
```

### Options

- `--name <name>`: Command name (without slash)
- `--type <type>`: Command type
- `--interactive`: Full interactive mode (default)
- `--template <type>`: Use template

## When to Use

- New workflow action needed
- System integration required
- Developer productivity shortcuts
- Quality gates needed

## Command Creation Process

### Step 1: Discovery & Planning

**Wizard Questions**:

1. Command name (without slash)
2. Command type
3. Category (subdirectory)
4. One-line description
5. Detailed purpose
6. When to use scenarios

### Step 2: Specification

**Define**:

1. Options/parameters
2. Usage examples
3. Process steps
4. Output format

### Step 3: File Generation

**File Created**: `{base_path}/{category}/{command-name}.md`

**YAML Frontmatter**:

```yaml
---
name: {command-name}
type: {type}
category: {category}
description: {description}
---
```

**Structure**:

```markdown
# {Command Name} Command

## Purpose
{detailed_purpose}

## When to Use
{scenarios}

## Usage
{syntax}

## Process
{steps}

## Output Format
{output}

## Integration
{workflow_integration}

## Best Practices
{practices}
```

### Step 4: Integration & Documentation

**Updates**:

- Commands README
- Main documentation (if major)
- Quick start (if user-facing)

### Step 5: Validation

**Checks**:

- Name follows conventions
- YAML valid
- All sections complete
- Examples clear
- Process actionable
- File in correct directory

**Test**: Verify command loads and works

### Step 6: Commit

**Format**:

```bash
feat(commands): add /{command-name} command

- {description}
- {key_features}

Usage: /{command-name} [options]

Examples:
  - {example}

Updates:
- {command_file} (new)
- README.md (updated)
```

## Interactive Wizard Flow

```text
⚙️ Create New Command Wizard

📝 Step 1: Command Identity
Command Name: {input}
Type: {selection}
Category: {input}
Description: {input}

📋 Step 2: Purpose & Usage
Purpose: {input}
When to use: {input}

🔧 Step 3: Options & Parameters
Options: {input}

📊 Step 4: Process Definition
Steps: {input}

📝 Step 5: Review & Confirm
{summary}
Proceed? (y/n)

✨ Creating Command
✓ Generated file
✓ Updated documentation
✓ Validation passed
```

## Command Templates

### Workflow Command

```markdown
---
name: {name}
type: development
category: workflow
description: {desc}
---

# {Name} Command

## Purpose
{purpose}

## Usage
/{name} [options]

## Process
### Step 1: {name}
{actions}

## Output Format
{format}
```

### Audit Command

```markdown
---
name: {name}
type: audit
category: quality
description: {desc}
---

# {Name} Command

## Audit Process
### 1. {Area}
**Checks**: {checks}
**Benchmarks**: {benchmarks}

## Output Format
{format}
```

## Validation Rules

### Command Name

- Format: kebab-case
- Length: 3-30 characters
- Pattern: Configured regex
- Must be unique
- No slash included

### YAML Frontmatter

**Required**: name, type, category, description

**Valid Types**: Configured command types

**Description**: One-line, under 120 chars

### Directory Structure

```text
{base_path}/
├── workflow/
├── planning/
├── quality/
├── audit/
├── meta/
└── git/
```

## Best Practices

### Design

- Single, clear responsibility
- Descriptive name
- Comprehensive docs
- Sensible defaults
- Clear feedback

### Integration

- Fit existing workflow
- Work with other commands
- Idempotent when possible

## Common Patterns

### Quality Check

```bash
/{check-name} [--scope <area>] [--fix] [--report]
```

### Workflow Automation

```bash
/{action-name} [--options]
```

### Audit

```bash
/{audit-name} [--scope <area>] [--depth <level>] [--report]
```

## Related Commands

- `/create-agent` - Create new agent
- `/create-skill` - Create new skill
- `/help` - System help

## Notes

- Use verb-noun pattern for names
- Full words in options
- Keep examples updated
- Test before committing
- Always update README
