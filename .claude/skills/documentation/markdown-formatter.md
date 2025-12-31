---
name: markdown-formatter
category: documentation
description: Automatically format and lint markdown files to ensure consistent documentation standards
usage: When formatting documentation, fixing markdown violations, or maintaining doc quality
input: Markdown files, formatting rules, quality criteria
output: Formatted markdown files, lint reports, quality metrics
---

# Markdown Formatter

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `rules_enabled` | Active lint rules | `['MD007', 'MD040', 'MD022']` |
| `indentation_spaces` | List indent | `2` |
| `max_blank_lines` | Max consecutive blanks | `1` |
| `code_language_default` | Default code language | `text` |
| `line_length` | Max line length | `100` |
| `heading_style` | Heading format | `atx` (#) or `setext` (===) |

## Purpose

Comprehensive markdown formatting and linting to ensure consistent, clean, and standards-compliant documentation.

## Capabilities

- Fix list indentation (MD007)
- Remove excessive blank lines (MD012)
- Add heading blank lines (MD022)
- Resolve duplicate headings (MD024)
- Remove heading punctuation (MD026)
- Fix ordered list numbering (MD029)
- Add code block blank lines (MD031)
- Add list blank lines (MD032)
- Convert emphasis to headings (MD036)
- Add code block languages (MD040)
- Validate link fragments (MD051)
- Add table blank lines (MD058)

## Key Rules

### MD007 - List Indentation

Ensures consistent indentation for nested lists.

**Before:**
```markdown
- Item 1
    - Nested (4 spaces)
      - Deep nested (6 spaces)
```

**After:**
```markdown
- Item 1
  - Nested (2 spaces)
    - Deep nested (4 spaces)
```

### MD040 - Code Block Language

Adds language specification to code blocks.

**Before:**
````markdown
```
function hello() {
  console.log('hello');
}
```
````

**After:**
````markdown
```typescript
function hello() {
  console.log('hello');
}
```
````

### MD022 - Heading Blank Lines

Adds blank lines around headings.

**Before:**
```markdown
Some text
## Heading
More text
```

**After:**
```markdown
Some text

## Heading

More text
```

### MD012 - Multiple Blank Lines

Removes excessive blank lines.

**Before:**
```markdown
Text


Too many blanks
```

**After:**
```markdown
Text

One blank line
```

## Usage

### Format Single File

```bash
# Format file
pnpm format:md path/to/file.md

# Validate only
pnpm lint:md path/to/file.md
```

### Format Directory

```bash
# Format all markdown
pnpm format:md "**/*.md"

# Exclude patterns
pnpm format:md "**/*.md" --ignore "node_modules/**"
```

### Integration

#### Pre-commit Hook

```yaml
# .husky/pre-commit
#!/bin/sh
pnpm lint:md --staged
```

#### CI/CD

```yaml
# .github/workflows/docs.yml
- name: Lint Markdown
  run: pnpm lint:md "**/*.md"
```

## Configuration File

```yaml
# .markdownlint.json
{
  "MD007": { "indent": 2 },
  "MD012": { "maximum": 1 },
  "MD013": false,
  "MD024": { "siblings_only": true },
  "MD040": { "allowed_languages": ["typescript", "bash", "json"] },
  "MD041": false
}
```

## Common Patterns

### Documentation Structure

```markdown
# Title

Brief introduction.

## Section 1

Content with proper spacing.

### Subsection

- List item 1
  - Nested item
  - Another nested
- List item 2

### Code Example

```typescript
const example = 'with language';
```

## Section 2

More content.
```

### Tables

```markdown
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
| Data 3   | Data 4   |
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Consistent Indentation** | Use configured spaces for lists |
| **Language Specification** | Always add language to code blocks |
| **Blank Lines** | Surround headings, tables, code |
| **No Trailing Punctuation** | Remove from headings |
| **Unique Headings** | Avoid duplicate heading text |
| **Link Validation** | Ensure fragment links work |

## Automation

### Watch Mode

```bash
# Auto-format on change
pnpm format:md --watch
```

### Editor Integration

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "[markdown]": {
    "editor.defaultFormatter": "markdownlint"
  }
}
```

## Error Handling

### Graceful Degradation

- Continue on individual rule failures
- Create backups before modifications
- Detailed error reporting
- Rollback capabilities

### Edge Cases

- Malformed markdown handling
- Binary file detection
- Large file optimization
- Unicode support

## Reporting

### Fix Summary

```text
Processed: 45 files
Fixed: 127 violations
  - MD007: 23 (list indentation)
  - MD040: 56 (code languages)
  - MD022: 48 (heading blanks)
Manual review: 3 files
```

### Detailed Report

```text
file.md
  ✓ MD007 Fixed list indentation (5 instances)
  ✓ MD040 Added code languages (2 instances)
  ✗ MD024 Duplicate headings require manual review
```

## Checklist

- [ ] Rules configured for project
- [ ] Integration with workflow
- [ ] CI/CD validation enabled
- [ ] Editor integration setup
- [ ] Pre-commit hook active
- [ ] All violations fixed
- [ ] Documentation tested
- [ ] Team guidelines updated
