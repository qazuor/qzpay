---
name: cleanup-issues
description: Clean up stale, closed, or orphaned issues from workflow automation
type: planning
category: planning
  issue_tracker: "Issue tracking system name"
  issue_tracker_token_env: "Auth token environment variable"
  issue_tracker_owner_env: "Owner/org environment variable"
  issue_tracker_repo_env: "Repository environment variable"
  tracking_file: "Issue tracking data file"
  closed_days_default: "Default days for closed issue cleanup (e.g., 30)"
  stale_days_default: "Default days for stale issue detection (e.g., 90)"
---

# Cleanup Issues

Clean up stale, closed, or orphaned issues created by workflow automation.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `issue_tracker` | Issue tracking system | `none` |
| `issue_tracker_token_env` | Auth token variable | `{{ISSUE_TRACKER_TOKEN}}` |
| `issue_tracker_owner_env` | Owner variable | `{{ISSUE_TRACKER_OWNER}}` |
| `issue_tracker_repo_env` | Repository variable | `{{ISSUE_TRACKER_REPO}}` |
| `tracking_file` | Tracking data file | `.claude/tracking/tasks.json` |
| `closed_days_default` | Days for closed cleanup | `30` |
| `stale_days_default` | Days for stale detection | `14` |

## Usage

```bash
/cleanup-issues [--closed-days N] [--stale-days N]
```

## When to Use

- After completing major feature
- To remove stale/obsolete issues
- When cleaning up cancelled features
- During project maintenance
- Before milestones or releases

## Process

### Step 1: Identify Scope

Cleanup options:

- **Closed issues:** Closed > N days ago
- **Orphaned issues:** No planning session/TODO
- **Stale issues:** No activity for N days
- **Specific session:** Single planning session
- **All issues:** Full cleanup (requires confirmation)

### Step 2: Get Configuration

Required:

- `{{ISSUE_TRACKER_TOKEN}}`
- `{{ISSUE_TRACKER_OWNER}}`
- `{{ISSUE_TRACKER_REPO}}`

### Step 3: Scan Candidates

Scan for cleanup candidates:

- Closed issues older than threshold
- Stale issues with no activity
- Orphaned issues (no source)

### Step 4: Preview Cleanup

```text
🔍 Cleanup Preview

Issues to clean:
   • {n} closed (>{n} days ago)
   • {n} stale (no activity >{n} days)
   • {n} orphaned (no source)

Details:

Closed Issues:
   • #{n}: Task name (closed {n} days ago)

Stale Issues:
   • #{n}: TODO in old file (no updates {n} days)

Orphaned Issues:
   • #{n}: Task with deleted session
   • #{n}: TODO from removed code

⚠️ WARNING: Permanently removes issue references from tracking.
Issues remain in none (can be manually deleted).

Continue? (yes/no)
```

### Step 5: Execute Cleanup

If confirmed:

- Remove references from tracking
- Archive issue data
- Update tracking file

### Step 6: Report Results

```text
✅ Cleanup completed!

Statistics:
   • {n} references removed
   • {n} issues archived
   • {n} skipped
   • {n} failed

Updated Files:
   • .claude/tracking/tasks.json (updated)
   • .claude/tracking/tasks.json.archive (archived)

Next Steps:
   1. Review archived references
   2. Manually delete issues if needed
   3. Commit tracking files
```

## Error Handling

| Error | Solution |
|-------|----------|
| Missing config | Set environment variables |
| No issues found | Issue tracker is clean |
| Confirmation required | Type 'yes' to confirm |
| API errors | Check token and permissions |

## Advanced Options

### Specific Session

```typescript
{ sessionPath: '.claude/sessions/planning/{session}' }
```

### Archive Instead of Delete

```typescript
{ archiveIssues: true }
```

### Custom Thresholds

```typescript
{
  closedDays: 7,
  staleDays: 60
}
```

### Delete from Tracker

```typescript
{
  deleteFromTracker: true,
  requireConfirmation: true
}
```

## Cleanup Strategies

### Conservative

For important history:

```typescript
{
  closedDays: 180,    // 6 months
  staleDays: 365,     // 1 year
  includeOrphaned: false,
  archiveIssues: true
}
```

### Aggressive

For active projects:

```typescript
{
  closedDays: 14,     // 2 weeks
  staleDays: 30,      // 1 month
  includeOrphaned: true,
  deleteFromTracker: true
}
```

### Orphan-Only

```typescript
{ orphanedOnly: true }
```

## What Gets Cleaned

### Closed Issues

Must meet ALL:

- Issue closed
- Closed > N days ago
- No recent activity
- Not pinned/locked

### Stale Issues

Must meet ALL:

- Issue open
- No activity > N days
- Not labeled 'keep' or 'important'
- Not in active milestone

### Orphaned Issues

Must meet ANY:

- Planning session deleted
- TODO comment removed
- Tracking reference corrupted
- Source file deleted

## Important Notes

- **Dry run first:** Always preview before cleanup
- **Archive by default:** References archived, not deleted
- **Issues remain:** Tracker issues not deleted unless specified
- **Recoverable:** Archives can be restored
- **Safe:** Won't delete issues with recent activity
- **Backup:** Consider backing up tracking file first

## Related Commands

- `/sync-planning` - Sync planning to tracker
- `/sync-todos` - Sync code TODOs
- `/check-completed` - Auto-close completed
