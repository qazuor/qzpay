---
name: format-markdown
description: Automatically detect and fix markdown formatting violations
type: formatting
category: quality
---

# Markdown Format Command

## Purpose

Automatically detect and fix markdown formatting violations in documentation files using comprehensive linting rules and context-aware corrections.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `rules_enabled` | Active markdown rules | `MD007, MD012, MD022, MD040, etc.` |
| `file_patterns.include` | Files to format | `**/*.md` |
| `file_patterns.exclude` | Files to skip | `node_modules/**, dist/**` |
| `list_indentation` | Nested list spacing | `2` |
| `max_blank_lines` | Consecutive blanks | `1` |
| `code_language_default` | Fallback language | `text` |

## Usage

```bash
/format-markdown [options]
```

### Options

- `--file <path>`: Format specific file
- `--validate-only`: Check without changes
- `--rules <list>`: Apply specific rules only
- `--report`: Show detailed report

### Examples

```bash
/format-markdown
/format-markdown --file path/to/file.md
/format-markdown --validate-only
/format-markdown --rules MD040,MD022
```

## Supported Rules

| Rule | Fix | Description |
|------|-----|-------------|
| MD007 | Indentation | Normalize list indentation |
| MD012 | Blank lines | Remove multiple consecutive blanks |
| MD022 | Spacing | Add blank lines around headings |
| MD024 | Duplicates | Resolve duplicate headings |
| MD026 | Punctuation | Remove trailing punctuation in headings |
| MD031 | Spacing | Add blank lines around code blocks |
| MD032 | Spacing | Add blank lines around lists |
| MD040 | Language | Add language to code blocks |
| MD051 | Links | Fix link fragments |
| MD058 | Spacing | Add blank lines around tables |

## Processing Phases

### Phase 1: Analysis

- Scan target files
- Parse markdown AST
- Apply rule checkers
- Collect violations
- Generate fix recommendations

### Phase 2: Planning

- Determine fix strategy
- Check for conflicts
- Prioritize by severity
- Generate atomic operations

### Phase 3: Execution

- Create backups
- Apply fixes in order
- Validate success
- Verify no regressions

### Phase 4: Validation

- Re-scan for violations
- Confirm semantic preservation
- Generate report
- Clean up temporary files

## Context-Aware Features

### Language Detection

**Algorithm**:

- Analyze preceding content for language hints
- Check file extension context
- Apply language mapping
- Default to configured fallback

**Mappings**:

```text
*.ts → typescript
*.js → javascript
*.py → python
*.sql → sql
*.yml, *.yaml → yaml
*.json → json
```

### Duplicate Heading Resolution

**Strategies**:

1. Contextual prefixes
2. Numbered suffixes
3. Semantic alternatives
4. Manual review flags

## Safety Guarantees

### Content Preservation

- Automatic backup creation
- Atomic operations
- Rollback support
- Encoding safety (UTF-8)

### Validation

- Semantic verification
- Link integrity
- Structure preservation
- Performance monitoring

## Output Format

### Summary Report

```text
📊 Markdown Formatting Report
Files Processed: {count}
Rules Applied: {count}
Violations Fixed: {count}
Processing Time: {time}

✅ Successfully formatted: {count}
⚠️  Warnings: {count}
❌ Errors: {count}
```

### Detailed Report

```text
📝 File-by-File Report
✅ {filename}
   - MD040: Added {count} language specifications
   - MD022: Added {count} heading blank lines
   - MD031: Added {count} code block blank lines
```

## Best Practices

### Usage

1. Run on committed changes
2. Review critical document changes
3. Start with specific rules
4. Ensure team alignment
5. Integrate into workflow

### Maintenance

- Regular rule effectiveness review
- Performance monitoring
- User feedback incorporation
- Documentation synchronization

## Related Commands

- `/quality-check` - Includes markdown validation
- `/update-docs` - Documentation maintenance

## When to Use

- Before committing documentation
- Regular maintenance
- Before releases
- CI/CD quality gates
