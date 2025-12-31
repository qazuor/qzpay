---
name: help
type: meta
category: system
description: Interactive help system for commands, agents, skills, and workflows
---

# Help Command

## Purpose

Comprehensive, context-aware help system providing guidance on commands, agents, skills, workflow, and project structure.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `help_topics` | Available topics | `commands, agents, skills, workflow, quick-start` |
| `doc_locations.base` | Documentation root | `.claude/docs/` |
| `doc_locations.agents` | Agents directory | `.claude/agents/` |
| `doc_locations.commands` | Commands directory | `.claude/commands/` |
| `display_limits.list` | Max items in list | `20` |
| `search_enabled` | Enable search | `true` |

## Usage

```bash
/help [topic] [options]
```

### Topics

- `commands` - List and search commands
- `agents` - Browse agents by category
- `skills` - View available skills
- `workflow` - Understand workflow phases
- `quick-start` - Get started quickly
- `architecture` - Project structure overview
- `glossary` - Terminology and concepts

### Options

- `--search <query>`: Search across documentation
- `--category <cat>`: Filter by category
- `--details`: Show detailed information
- `--examples`: Show usage examples

## When to Use

- Getting started
- Command discovery
- Agent information
- Workflow guidance
- Troubleshooting

## Help System Structure

### Main Menu

```text
🎯 Help System

📚 Available Topics:
1. commands - Available slash commands
2. agents - Specialized AI agents
3. skills - Reusable workflows
4. workflow - Development workflow
5. quick-start - Getting started guide
6. architecture - Project structure
7. glossary - Terminology

🔍 Search: /help --search <query>
```

### Commands Help

```text
📜 Available Commands

🔧 Development & Workflow ({count})
{command_list}

📋 Planning ({count})
{command_list}

✅ Quality ({count})
{command_list}

[Additional categories...]

Use /help commands <name> for details
```

### Agents Help

```text
🤖 Available Agents

📦 Product & Planning ({count})
{agent_list}

🛠️ Backend Development ({count})
{agent_list}

[Additional categories...]

Use /help agents <name> for details
```

### Skills Help

```text
🎯 Available Skills

🧪 Testing ({count})
{skill_list}

🔧 Development ({count})
{skill_list}

[Additional categories...]

Use /help skills <name> for details
```

### Workflow Help

```text
🔄 Development Workflow

📋 Phase 1: Planning
Goal: {goal}
Steps: {steps}
Time: {estimate}
Deliverables: {deliverables}

🛠️ Phase 2: Implementation
[Similar structure...]

✅ Phase 3: Validation
[Similar structure...]

📝 Phase 4: Finalization
[Similar structure...]
```

## Detailed Help Output

### Command Details

```text
Command: /{command-name}

Type: {type}
Category: {category}

Description: {description}

When to Use:
{scenarios}

Usage: {syntax}

Options: {options}

Examples: {examples}

Related Commands: {related}

Documentation: {file_path}
```

### Agent Details

```text
Agent: {agent-name}

Category: {category}
Model: {model}

Description: {description}

Responsibilities: {responsibilities}

Tools: {tools}

Phases: {phases}

Invocation Examples: {examples}

Works With: {agents}

Documentation: {file_path}
```

## Search Functionality

```bash
/help --search "testing"
```

**Output**:

```text
🔍 Search Results for "testing"

📜 Commands ({count})
{matching_commands}

🤖 Agents ({count})
{matching_agents}

🎯 Skills ({count})
{matching_skills}

📚 Documentation ({count})
{matching_docs}
```

## Quick Start

```text
🚀 Quick Start Guide

Step 1: Understand Structure
{overview}

Step 2: Basic Commands
{essential_commands}

Step 3: Understand Workflow
{workflow_overview}

Next Steps:
{recommended_actions}
```

## Architecture Overview

```text
🏗️ Project Architecture

Monorepo Structure:
{directory_structure}

Tech Stack:
{technology_overview}

Architecture Patterns:
{patterns}

Documentation: {paths}
```

## Glossary

```text
📖 Glossary

Agent: {definition}
Command: {definition}
Skill: {definition}
[Additional terms...]

[View full glossary]: {path}
```

## Error Handling

### Topic Not Found

```text
❌ Help Topic Not Found

Topic "{topic}" not found.

Available topics: {list}

Try:
  /help - Main menu
  /help --search {topic}
```

## Integration

Available at all times for:

- Onboarding
- Discovery
- Troubleshooting
- Learning

## Best Practices

1. Start with quick-start
2. Use search feature
3. Explore by category
4. Read detailed help
5. Reference documentation

## Related Commands

- `/create-agent` - Create new agent
- `/create-command` - Create new command
- `/create-skill` - Create new skill

## Notes

- Context-aware output
- Full-text search capability
- Examples included
- Direct documentation links
- Interactive navigation
- Auto-generated from files
