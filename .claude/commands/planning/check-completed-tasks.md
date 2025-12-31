---
name: check-completed-tasks
description: Auto-detect completed tasks from commits and close issues
type: planning
category: planning
  issue_tracker: "Issue tracking system name"
  issue_tracker_token_env: "Auth token environment variable"
  issue_tracker_owner_env: "Owner/org environment variable"
  issue_tracker_repo_env: "Repository environment variable"
  tracking_file: "Issue tracking data file"
  task_code_pattern: "Pattern for task codes in commits (e.g., T-XXX-XXX)"
---

# Check Completed Tasks

Auto-detect completed tasks from git commits and close corresponding issues.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `issue_tracker` | Issue tracking system | `none` |
| `issue_tracker_token_env` | Auth token variable | `{{ISSUE_TRACKER_TOKEN}}` |
| `issue_tracker_owner_env` | Owner variable | `{{ISSUE_TRACKER_OWNER}}` |
| `issue_tracker_repo_env` | Repository variable | `{{ISSUE_TRACKER_REPO}}` |
| `tracking_file` | Tracking data file | `.claude/tracking/tasks.json` |
| `task_code_pattern` | Task code pattern | `TASK-` |

## Usage

```bash
/check-completed [commit_range]
```

## When to Use

- After committing code that completes tasks
- As part of post-commit hook (automated)
- To bulk-check recent commits
- Before status meetings
- When reviewing project progress

## Process

### Step 1: Determine Range

Scan options:

- **Last commit:** Most recent only
- **Last N commits:** Recent N commits
- **Since date:** All since specific date
- **Commit range:** Specific range (e.g., HEAD~5..HEAD)

### Step 2: Get Configuration

Required:

- `{{ISSUE_TRACKER_TOKEN}}`
- `{{ISSUE_TRACKER_OWNER}}`
- `{{ISSUE_TRACKER_REPO}}`

### Step 3: Parse Commits

Match task codes in commit messages:

**Supported formats:**

```text
feat(api): implement auth [T-003-012]
fix(db): resolve timeout T-005-003
refactor: optimize query (T-002-007)
```

Patterns:

- `[T-XXX-XXX]` - Bracketed
- `T-XXX-XXX` - Bare
- `(T-XXX-XXX)` - Parenthesized

### Step 4: Execute Detection

- Parse commit messages
- Identify completed tasks
- Update TODOs.md status
- Close corresponding issues

### Step 5: Report Results

```text
✅ Completed tasks detected!

Statistics:
   • {n} tasks detected
   • {n} tasks completed
   • {n} issues closed
   • {n} failed

Completed Tasks:
   • T-003-012: Task name
     Commit: {hash} - {message}
     Issue: #{n} (closed)

Updated Files:
   • TODOs.md
   • .claude/tracking/tasks.json

Next Steps:
   1. Review closed issues
   2. Commit updated TODOs.md
   3. Continue with next tasks
```

### Step 6: Update TODOs.md

**Before:**

```markdown
### T-003-012: Task name

**Status:** [ ] Pending
**Issue:** [#{n}]({url})
```

**After:**

```markdown
### T-003-012: Task name

**Status:** [x] Completed
**Completed:** {date}
**Issue:** [#{n}]({url}) ✓ Closed
```

### Step 7: Close Issues

Issues automatically closed with completion comment:

```text
Task completed!

Commit: {hash}
Message: {message}

Automatically detected and closed.
```

## Error Handling

| Error | Solution |
|-------|----------|
| Missing config | Set environment variables |
| No tasks detected | Include task codes in commits |
| API errors | Check token and permissions |
| File not found | Verify planning session exists |

## Advanced Options

### Scan Specific Session

```typescript
{ sessionPath: '.claude/sessions/planning/{session}' }
```

### Dry Run

```typescript
{ dryRun: true }
```

### Skip TODOs Update

```typescript
{ updateTodos: false }
```

### Skip Issue Closure

```typescript
{ closeIssues: false }
```

## Commit Best Practices

### Include Task Code

```bash
git commit -m "feat(api): implement auth [T-003-012]"
```

### Conventional Commits

```bash
git commit -m "feat(api): add endpoints [T-005-001]"
git commit -m "fix(db): resolve issue [T-005-002]"
```

### Multiple Tasks

```bash
git commit -m "feat(api): complete flow [T-003-012][T-003-013]"
```

### Partial Progress

```bash
git commit -m "wip(api): partial auth (T-003-012)"
# Using 'wip' or '(code)' won't trigger auto-completion
```

## Important Notes

- **Automatic:** Runs via post-commit hook if configured
- **Idempotent:** Safe to run multiple times
- **Validation:** Verifies files exist before marking complete
- **Tracking:** Updates .claude/tracking/tasks.json with completion data
- **Reversible:** Can manually reopen issues
- **Linking:** Issues link to completion commits

## Related Commands

- `/sync-planning` - Sync planning to tracker
- `/sync-todos` - Sync code TODOs
- `/cleanup-issues` - Clean stale issues
