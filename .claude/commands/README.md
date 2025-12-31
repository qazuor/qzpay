# Commands

This directory contains command definitions for automated workflows. Commands are invoked using the `/command-name` syntax.

## ⚙️ Configuration Required

All commands include a `config_required` section in their YAML frontmatter. Configure the required settings in your project before using a command.

**Example command frontmatter:**
```yaml
---
name: command-name
description: Brief description
type: planning|quality|development|meta|git|audit
category: specific-category
config_required:
  - setting_name: "Description of what to configure"
---
```

## Command Categories

### Planning Commands (8 commands)

| Command | Description | When to Use |
|---------|-------------|-------------|
| `/start-feature-plan` | Initialize feature planning (Phase 1) | Starting new features |
| `/start-refactor-plan` | Plan refactoring work safely | Before refactoring |
| `/sync-planning` | Sync planning to issue tracker | After planning approval |
| `/planning-cleanup` | Clean up planning artifacts | End of planning phase |
| `/sync-planning-github` | Sync planning to GitHub Issues | GitHub integration |
| `/sync-todos-github` | Sync TODOs to GitHub | Task tracking |
| `/check-completed-tasks` | Auto-detect completed tasks | Task management |
| `/cleanup-issues` | Clean up stale issues | Issue maintenance |

### Quality Commands (6 commands)

| Command | Description | When to Use |
|---------|-------------|-------------|
| `/quality-check` | Master quality validation | Before merge (required) |
| `/code-check` | Lint + typecheck only | Quick validation |
| `/run-tests` | Run tests with coverage | After implementation |
| `/security-audit` | Comprehensive security audit | Pre-deployment |
| `/performance-audit` | Performance analysis | Pre-deployment |
| `/accessibility-audit` | WCAG compliance audit | After UI changes |

### Development Commands (3 commands)

| Command | Description | When to Use |
|---------|-------------|-------------|
| `/add-new-entity` | Scaffold new entity/resource | Adding new data models |
| `/update-docs` | Update documentation | After implementation |
| `/five-why` | Root cause analysis | Debugging complex issues |

### Git Commands (1 command)

| Command | Description | When to Use |
|---------|-------------|-------------|
| `/commit` | Generate conventional commit | Creating commits |

### Formatting Commands (1 command)

| Command | Description | When to Use |
|---------|-------------|-------------|
| `/format-markdown` | Format markdown files | Before committing docs |

### Meta Commands (4 commands)

| Command | Description | When to Use |
|---------|-------------|-------------|
| `/create-agent` | Create new agent | Adding capabilities |
| `/create-command` | Create new command | Adding workflows |
| `/create-skill` | Create new skill | Adding knowledge |
| `/help` | Interactive help system | Getting guidance |

## Usage

```bash
/command-name [arguments]
```

**Examples:**
```bash
/start-feature-plan user-authentication
/quality-check
/commit
/help commands
```

## Command Behavior

### Stop vs Report

| Behavior | When | Example Commands |
|----------|------|------------------|
| **STOP on error** | Critical checks | `/quality-check` (tests, coverage) |
| **REPORT findings** | Advisory checks | `/quality-check` (code review) |

### Quality Gates

Commands like `/quality-check` enforce quality gates:
- TypeScript errors → STOP
- Lint errors → STOP
- Test failures → STOP
- Coverage below target → STOP
- Code review issues → REPORT
- Security findings → REPORT

## Directory Structure

```text
commands/
├── README.md
├── start-feature-plan.md
├── start-refactor-plan.md
├── sync-planning.md
├── quality-check.md
├── code-check.md
├── run-tests.md
├── add-new-entity.md
├── update-docs.md
├── five-why.md
├── audit/
│   ├── security-audit.md
│   ├── performance-audit.md
│   └── accessibility-audit.md
├── formatting/
│   └── format-markdown.md
├── git/
│   └── commit.md
├── meta/
│   ├── create-agent.md
│   ├── create-command.md
│   ├── create-skill.md
│   └── help.md
└── planning/
    ├── planning-cleanup.md
    ├── sync-planning-github.md
    ├── sync-todos-github.md
    ├── check-completed-tasks.md
    └── cleanup-issues.md
```

## Command File Format

Each command file includes:

1. **YAML Frontmatter**
   - `name`: Command identifier
   - `description`: Brief description
   - `type`: Command category
   - `config_required`: Configuration directives

2. **Configuration Section**
   - Table of required settings

3. **Command Content**
   - Purpose
   - Usage syntax
   - Execution flow
   - Output format
   - Related commands

## Adding New Commands

1. Create `.md` file in appropriate folder
2. Include YAML frontmatter with `config_required`
3. Add `⚙️ Configuration` section with settings table
4. Keep content concise (150-300 lines target)
5. Update this README

## Related

- [Agents](../agents/README.md)
- [Skills](../skills/README.md)
