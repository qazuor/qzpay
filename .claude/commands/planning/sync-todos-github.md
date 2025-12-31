---
name: sync-todos-github
description: Sync code TODO comments to GitHub Issues
type: planning
category: planning
  github_token_env: "GitHub token environment variable"
  github_owner_env: "Repository owner env variable"
  github_repo_env: "Repository name env variable"
  tracking_file: "GitHub tracking file path"
  todo_patterns: "Patterns to match (e.g., TODO, HACK, DEBUG)"
---

# Sync Code TODOs to GitHub

Scan codebase for TODO/HACK/DEBUG comments and sync to GitHub Issues.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `github_token_env` | GitHub token variable | `{{GITHUB_TOKEN}}` |
| `github_owner_env` | Owner variable | `{{GITHUB_OWNER}}` |
| `github_repo_env` | Repository variable | `{{GITHUB_REPO}}` |
| `tracking_file` | Tracking data file | `.claude/tracking/tasks.json` |
| `todo_patterns` | Comment patterns to match | `TODO, HACK, DEBUG` |

## Usage

```bash
/sync-todos-github [scan_path]
```

## When to Use

- Before committing code with new TODOs
- To convert technical debt markers to issues
- For team visibility on code tasks
- As part of pre-commit hook
- When reviewing technical debt

## Process

### Step 1: Identify Scope

Scan options:

- **Full codebase:** All files
- **Specific directory:** Single package/app
- **Changed files:** Git-modified only (recommended)

### Step 2: Get Configuration

Required:

- `{{GITHUB_TOKEN}}`
- `{{GITHUB_OWNER}}`
- `{{GITHUB_REPO}}`

### Step 3: Scan for TODOs

Match patterns:

```typescript
// TODO: Description
// TODO(username): Assigned task
// TODO[HIGH]: High priority
// TODO: #bug Task with label
// HACK: Temporary workaround
// DEBUG: Remove before production
```

### Step 4: Execute Sync

- Create issues for new TODOs
- Update existing issues
- Close issues for removed TODOs
- Add issue links to comments

### Step 5: Report Results

```text
✅ TODOs synced to GitHub!

Statistics:
   • {n} new issues created
   • {n} issues updated
   • {n} issues closed (TODOs removed)
   • {n} skipped

Created Issues:
   • #{n}: Description (file.ts:42)
   • #{n}: Description (file.ts:78)

Updated Comments:
   Comments now have issue links

Next Steps:
   1. Review issues in GitHub
   2. Commit updated files
   3. Use /check-completed when resolved
```

### Step 6: Update Comments

Automatically adds issue links:

**Before:**

```typescript
// TODO: Fix authentication error
```

**After:**

```typescript
// TODO: Fix authentication error
// GitHub: {issue_url}
```

## Error Handling

| Error | Solution |
|-------|----------|
| Missing config | Set environment variables |
| No TODOs found | Verify patterns and scan path |
| API errors | Check token and permissions |
| Parse errors | Fix syntax, re-run sync |

## Advanced Options

### Scan Specific Directory

```typescript
{ scanPath: 'packages/api' }
```

### Dry Run

```typescript
{ dryRun: true }
```

### Custom Patterns

```typescript
{
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['**/node_modules/**']
}
```

### Preserve Comments

```typescript
{ updateComments: false }
```

## Comment Format

### Basic

```typescript
// TODO: Add validation
```

### With Priority

```typescript
// TODO[HIGH]: Fix security issue
```

### With Assignment

```typescript
// TODO(john): Review query
```

### With Labels

```typescript
// TODO: #bug #security Fix injection
```

### Combined

```typescript
// TODO[HIGH](maria): #feature Add auth
```

## Important Notes

- **Labels:** Auto-generated from comment type
- **Priority:** [HIGH], [MEDIUM], [LOW] become labels
- **Assignment:** TODO(username) auto-assigns
- **Context:** Issues include code snippet and location
- **Auto-close:** Issues close when TODOs removed

## Related Commands

- `/sync-planning-github` - Sync planning sessions
- `/check-completed` - Auto-close completed
- `/cleanup-issues` - Clean stale issues
