---
name: sync-planning-github
description: Synchronize planning session to GitHub Issues
type: planning
category: planning
  github_token_env: "Environment variable for GitHub token (e.g., GITHUB_TOKEN)"
  github_owner_env: "Environment variable for repository owner"
  github_repo_env: "Environment variable for repository name"
  planning_path: "Base path for planning sessions"
  tracking_file: "GitHub tracking file path"
---

# Sync Planning to GitHub

Synchronize planning session to GitHub Issues, creating parent and sub-issues for all tasks.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `github_token_env` | GitHub token environment variable | `{{GITHUB_TOKEN}}` |
| `github_owner_env` | Repository owner env variable | `{{GITHUB_OWNER}}` |
| `github_repo_env` | Repository name env variable | `{{GITHUB_REPO}}` |
| `planning_path` | Planning sessions directory | `.claude/sessions/planning` |
| `tracking_file` | GitHub tracking data file | `.claude/tracking/tasks.json` |

## Usage

```bash
/sync-planning-github [session_path]
```

## When to Use

- After completing planning phase with user approval
- To create trackable GitHub issues
- When working across multiple devices
- Before starting implementation

## Process

### Step 1: Identify Session

Auto-detect or ask user for session path.

**Expected:** `.claude/sessions/planning/{session-name}/`

### Step 2: Verify Files

Required files:

- PDR.md
- TODOs.md

### Step 3: Get Configuration

Required environment variables:

- `{{GITHUB_TOKEN}}` - Personal Access Token with repo permissions
- `{{GITHUB_OWNER}}` - Repository owner
- `{{GITHUB_REPO}}` - Repository name

### Step 4: Execute Sync

- Create parent issue
- Create sub-issues for tasks
- Update existing issues (idempotent)
- Add labels and metadata

### Step 5: Report Results

```text
✅ Planning synced to GitHub!

Parent Issue: {title}
   URL: {url}
   Number: #{number}

Statistics:
   • {n} tasks created
   • {n} tasks updated
   • {n} skipped
   • {n} failed

Next Steps:
   1. TODOs.md updated with issue links
   2. Commit changes (TODOs.md, .claude/tracking/tasks.json)
   3. View: {repo_url}/issues
   4. Use /check-completed when done
```

## Error Handling

| Error | Message | Solution |
|-------|---------|----------|
| Missing config | Configuration missing | Set environment variables |
| Files not found | Planning files not found | Run /start-feature-plan first |
| API error | Failed to sync | Check token, permissions, rate limits |

## Advanced Options

### Dry Run

```typescript
{ dryRun: true }
```

### Custom Tracking

```typescript
{ trackingPath: '.custom/tracking.json' }
```

### Skip Updates

```typescript
{ updateExisting: false }
```

## Important Notes

- **Idempotent:** Safe to run multiple times
- **Tracking:** .claude/tracking/tasks.json maps tasks to issues
- **Labels:** Auto-generated from task metadata
- **Enrichment:** Issues include planning context

## Related Commands

- `/start-feature-plan` - Create planning
- `/check-completed` - Auto-close completed
- `/sync-todos-github` - Sync code TODOs
- `/cleanup-issues` - Clean stale issues
