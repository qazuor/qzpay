---
name: sync-planning
description: Synchronize planning session to issue tracker
type: planning
category: planning
  issue_tracker: "Issue tracking system (e.g., GitHub, Linear, Jira)"
  issue_tracker_token_env: "Environment variable for auth token"
  issue_tracker_owner_env: "Environment variable for owner/org"
  issue_tracker_repo_env: "Environment variable for repository"
  planning_path: "Base path for planning sessions"
  tracking_file: "Path to tracking data file"
---

# Sync Planning to Issue Tracker

Synchronize planning session to issue tracker, creating parent and sub-issues for all tasks.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `issue_tracker` | Issue tracking system | `none` |
| `issue_tracker_token_env` | Auth token environment variable | `{{ISSUE_TRACKER_TOKEN}}` |
| `issue_tracker_owner_env` | Owner/org environment variable | `{{ISSUE_TRACKER_OWNER}}` |
| `issue_tracker_repo_env` | Repository environment variable | `{{ISSUE_TRACKER_REPO}}` |
| `planning_path` | Planning sessions directory | `.claude/sessions/planning` |
| `tracking_file` | Tracking data file path | `.claude/tracking/tasks.json` |

## Usage

```bash
/sync-planning [session_path]
```

## When to Use

- After completing planning phase and getting approval
- To create trackable issues for feature planning
- When working across multiple devices
- Before starting implementation

## Process

### Step 1: Identify Session

Ask user which planning session to sync if not obvious from context.

Auto-detect if currently in planning directory.

**Expected path:** `.claude/sessions/planning/{session-name}/`

### Step 2: Verify Required Files

Check that files exist:

- PDR.md (Product Requirements)
- TODOs.md (Task breakdown)

If missing, inform user and stop.

### Step 3: Get Configuration

Required environment variables:

- `{{ISSUE_TRACKER_TOKEN}}` - Authentication token
- `{{ISSUE_TRACKER_OWNER}}` - Owner/organization
- `{{ISSUE_TRACKER_REPO}}` - Repository name

If not available, ask user to provide them.

### Step 4: Execute Sync

Synchronize to none:

- Create parent issue for feature
- Create sub-issues for all tasks
- Update existing issues (idempotent)
- Enrich with planning context

### Step 5: Report Results

```text
✅ Planning synced to none successfully!

Parent Issue: {title}
   URL: {url}
   Number: #{number}

Statistics:
   • {n} tasks created
   • {n} tasks updated
   • {n} tasks skipped
   • {n} failures

Next Steps:
   1. TODOs.md updated with issue links
   2. Commit changes (TODOs.md, .claude/tracking/tasks.json)
   3. View issues in none
   4. Use /check-completed after task completion
```

### Step 6: Update TODOs.md

Automatically adds issue links to tasks:

```markdown
### T-003-012: Task name

**Status:** [ ] Pending
**Issue:** [#{number}]({url})
```

### Step 7: Suggest Next Actions

1. Commit changes to TODOs.md and .claude/tracking/tasks.json
2. Push to remote
3. View issues in none
4. Update status with /check-completed

## Error Handling

| Error | Solution |
|-------|----------|
| Missing config | Set environment variables |
| Files not found | Complete planning first with /start-feature-plan |
| API errors | Verify token, permissions, rate limits |
| Duplicates | Sync updates existing issues safely |

## Advanced Options

### Dry Run Mode

Preview changes without creating issues:

```typescript
{
  dryRun: true
}
```

### Custom Tracking Path

Use custom location for tracking data:

```typescript
{
  trackingPath: '.custom-tracking/data.json'
}
```

### Skip Existing

Only create new issues, don't update:

```typescript
{
  updateExisting: false
}
```

## Important Notes

- **Idempotent:** Safe to run multiple times - updates, not duplicates
- **Tracking:** .claude/tracking/tasks.json stores mapping between tasks and issues
- **Commit tracking:** Always commit tracking file for cross-device sync
- **Status sync:** Task status determines issue state (open/closed)
- **Enrichment:** Issues enriched with planning context
- **Labels:** Auto-generated based on task type and priority

## Related Commands

- `/start-feature-plan` - Create planning session
- `/check-completed` - Auto-close completed tasks
- `/sync-todos` - Sync code TODO comments
- `/cleanup-issues` - Clean up stale issues
