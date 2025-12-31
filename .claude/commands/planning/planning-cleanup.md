---
name: planning-cleanup
description: Archive completed planning sessions to keep workspace organized
type: planning
category: planning
  planning_path: "Base path for planning sessions"
  archive_path: "Path for archived sessions (organized by year/month)"
  registry_file: "Code registry file path"
---

# Planning Cleanup Command

Archive completed planning sessions to keep workspace organized.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `planning_path` | Active planning sessions directory | `.claude/sessions/planning` |
| `archive_path` | Archive directory | `.claude/sessions/archive` |
| `registry_file` | Code registry file | `.claude/tracking/registry.json` |

## Usage

### Interactive Mode (Default)

```bash
/planning-cleanup
```

**Flow:** Scan → Show list → User selects → Confirm → Archive → Report

### Auto Mode

```bash
/planning-cleanup --auto
```

**Flow:** Scan → Archive ALL → Report

### Dry-Run Mode

```bash
/planning-cleanup --dry-run
```

**Flow:** Show what WOULD be archived → No changes

## Process

### 1. Detection

**Completed session criteria:**

- Status in .claude/tracking/registry.json is "completed"
- OR all tasks in TODOs.md marked completed
- OR checkpoint shows final phase completed

### 2. Selection (Interactive)

```text
Found 2 completed planning sessions:

[ ] P-001-feature-name (completed: 2024-10-28)
    - 15 tasks completed
    - Duration: 45 hours

Select sessions to archive (space to toggle, enter to confirm):
```

### 3. Archive

For each session:

1. Create archive directory: `.claude/sessions/archive/{year}/{month}/{session}/`
2. Move all files
3. Generate COMPLETION-REPORT.md
4. Update .claude/tracking/registry.json

### 4. Report

```text
✅ Archive Complete

Archived Sessions: {n}
- {session-1} → archived/{year}/{month}/
- {session-2} → archived/{year}/{month}/

Updated:
- .claude/tracking/registry.json ({n} sessions marked archived)
- Active sessions: {n} remaining

Location: .claude/sessions/archive/{year}/{month}/
```

## File Structure

**Before:**

```text
.claude/sessions/planning/
├── .claude/tracking/registry.json
├── P-001-feature-name/
├── P-002-other-feature/
└── P-003-active-feature/
```

**After:**

```text
.claude/sessions/planning/
├── .claude/tracking/registry.json (updated)
├── P-003-active-feature/
└── archived/
    └── {year}/
        └── {month}/
            ├── P-001-feature-name/
            │   ├── PDR.md
            │   ├── TODOs.md
            │   └── COMPLETION-REPORT.md (new)
            └── P-002-other-feature/
                └── ...
```

## Completion Report

Generated for each archived session:

```markdown
# Completion Report: {Code} - {Title}

**Completed:** {date}
**Duration:** {actual}h (estimated: {estimated}h)
**Tasks:** {completed}/{total} completed
**Coverage:** {coverage}%

## Summary
Brief overview of deliverables.

## Deliverables
- ✅ Deliverable 1
- ✅ Deliverable 2

## Metrics
- Total commits: {n}
- Files changed: {n}
- Test coverage: {n}%

## Lessons Learned
### What Went Well
- Point 1

### What Could Be Improved
- Point 1
```

## Safety

**Protections:**

- Cannot archive active/in-progress sessions
- Cannot archive with uncommitted changes
- Cannot overwrite existing archives
- All operations logged
- Can be undone manually (files moved, not deleted)

## Undo Archive

Manual recovery:

```bash
mv .claude/sessions/archive/{year}/{month}/{session} .claude/sessions/planning/

# Update registry: change status back to "completed"
```

## Execution Modes

| Mode | Trigger | Interaction | Best For |
|------|---------|-------------|----------|
| Interactive | `/planning-cleanup` | User selects | Selective cleanup |
| Auto | Script/command | None | Quick cleanup |
| CI/CD | Scheduled action | None | Maintenance-free |

## When to Run

- After completing Phase 4 (Finalization)
- Before starting new planning sessions
- Monthly manual cleanup (interactive)
- Weekly automatic cleanup (CI/CD)

## Examples

### Interactive

```bash
/planning-cleanup

Found 1 completed session:
[x] P-001-feature-name (completed: 2024-10-28)

Archive? (y/n): y

✅ Archived P-001 → archived/2024/10/
```

### Auto

```bash
/planning-cleanup --auto

Found 2 completed sessions:
- P-001-feature-name
- P-002-other-feature

Archiving...
✅ Complete: 2 sessions archived
```

### Dry Run

```bash
/planning-cleanup --dry-run

Would archive:
- P-001-feature-name → archived/2024/10/

No changes made (dry run)
```

## Best Practices

1. **Regular Cleanup:** Weekly review, monthly archive
2. **Before Archiving:** All criteria met, commits pushed, tests passing
3. **Completion Reports:** Include lessons learned and metrics
4. **Recovery:** Archives can be unarchived manually

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Uncommitted changes | Commit or stash before archiving |
| Archive exists | Rename or remove old archive |
| Registry out of sync | Regenerate registry |

## Related Commands

- `/start-feature-plan` - Create planning session
- `/sync-planning` - Sync to issue tracker
- `/quality-check` - Validate before completion
