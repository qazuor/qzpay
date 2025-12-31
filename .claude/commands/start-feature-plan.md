---
name: start-feature-plan
description: Initialize comprehensive feature planning following the Four-Phase Workflow
type: planning
category: planning
  planning_path: "Base path for planning sessions (e.g., .claude/sessions/planning)"
  issue_tracker: "Issue tracking system name (e.g., GitHub, Linear, Jira)"
  pdr_template: "Path to PDR template file"
  tech_analysis_template: "Path to technical analysis template"
  todos_template: "Path to TODOs template file"
---

# Start Feature Plan Command

Initialize comprehensive planning for a new feature following the Four-Phase Workflow. Creates structured planning session with complete documentation and atomic task breakdown.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `planning_path` | Base directory for planning sessions | `.claude/sessions/planning` |
| `issue_tracker` | Issue tracking system | `none` |
| `pdr_template` | PDR template location | `{{PDR_TEMPLATE}}` |
| `tech_analysis_template` | Technical analysis template | `{{TECH_ANALYSIS_TEMPLATE}}` |
| `todos_template` | TODOs template location | `{{TODOS_TEMPLATE}}` |

## Usage

```bash
/start-feature-plan {feature_name}
```

## Agent Delegation Policy

**CRITICAL:** Coordinating agent must ALWAYS delegate to specialized agents using Task tool. Never create planning documents directly.

**Required Agents:**

| Agent | Purpose | Deliverable |
|-------|---------|-------------|
| `product-functional` | Requirements analysis | PDR.md |
| `ui-ux-designer` | Interface design (optional) | Wireframes |
| `product-technical` | Technical architecture | tech-analysis.md |
| `product-technical` | Task breakdown | TODOs.md |
| `tech-lead` | Final review | Approval |

## Execution Flow

### Step 1: Initialize Planning Context

**Duration:** 2-3 minutes

**Process:**

1. Create session directory: `.claude/sessions/planning/{feature_name}/`
2. Initialize files from templates:
   - PDR.md
   - tech-analysis.md
   - TODOs.md
   - wireframes/ (if UI-heavy)

### Step 2: Product Requirements (PDR)

**Agent:** `product-functional`

**Deliverable:** Complete PDR.md with:

- Feature overview and objectives
- Acceptance criteria (AC-001, AC-002, etc.)
- User stories and personas
- Business rules and constraints
- Success metrics

**USER CHECKPOINT:** Must obtain explicit approval before proceeding.

### Step 3: UI/UX Design (Optional)

**Agent:** `ui-ux-designer`

**Deliverable:**

- Wireframes in `wireframes/` directory
- UI component specifications
- Interaction flow diagrams

**Note:** Included in PDR approval process.

### Step 4: Technical Analysis

**Agent:** `product-technical`

**Prerequisites:** PDR approved

**Deliverable:** Complete tech-analysis.md with:

- Architecture overview
- Database schema changes
- API endpoint design
- Technology choices justification
- Risk assessment

**USER CHECKPOINT:** Must obtain explicit approval before proceeding.

### Step 5: Task Breakdown

**Agent:** `product-technical`

**Prerequisites:** Technical analysis approved

**Process:**

1. Break down into atomic tasks (1-2 hours each)
2. Identify dependencies
3. Prioritize implementation order
4. Estimate effort and complexity

**Deliverable:** Complete TODOs.md with prioritized task list.

### Step 6: Final Review

**Agent:** `tech-lead`

**Process:** Review all artifacts and approve planning phase.

## Planning Session Structure

```text
.claude/sessions/planning/{feature_name}/
├── PDR.md
├── tech-analysis.md
├── TODOs.md
├── wireframes/
└── notes/
```

## Quality Standards

### PDR Requirements

- Clear objectives and value proposition
- Specific, testable acceptance criteria
- Complete user stories with personas
- Edge cases and constraints documented
- Measurable success metrics

### Technical Analysis Requirements

- Architecture alignment with existing patterns
- Proper database design
- Type-safe API design
- Risk assessment with mitigation
- Technology choices justified

### Task Breakdown Requirements

- All tasks atomic (1-2 hours max)
- Clear dependencies mapped
- Testable completion criteria
- Priority ordering defined
- Realistic effort estimates

## Output Format

```text
✅ FEATURE PLANNING COMPLETE

Feature: {feature_name}
Planning Session: .claude/sessions/planning/{feature_name}/

Documents Created:
✅ PDR.md - {n} acceptance criteria
✅ tech-analysis.md - Architecture complete
✅ TODOs.md - {n} atomic tasks

Planning Summary:
- Estimated Effort: {hours}
- Implementation Phases: {n}
- Critical Dependencies: {n}
- Risk Level: {level}

Ready for Phase 2: Implementation
```

## Critical Checkpoints

| Checkpoint | Agent | User Approval | Blocks Next Step |
|------------|-------|---------------|------------------|
| PDR Complete | product-functional | REQUIRED | Tech Analysis |
| Tech Analysis Complete | product-technical | REQUIRED | Task Breakdown |
| TODOs Complete | product-technical | OPTIONAL | Implementation |

## Common Patterns

### Database-Heavy Features

- Schema design first
- Migration strategy defined
- Performance considerations documented

### API-Heavy Features

- Endpoint design prioritized
- Authentication requirements clarified
- Documentation strategy defined

### UI-Heavy Features

- Component hierarchy designed
- State management planned
- Accessibility requirements documented

## Related Commands

- `/start-refactor-plan` - Planning for refactoring
- `/quality-check` - Validation before implementation
- `/sync-planning` - Sync to issue tracker

## When to Use

- **Required:** Before implementing new features
- **Required:** When starting significant functionality
- **Optional:** For complex bug fixes requiring architecture changes
- **Recommended:** When multiple developers will collaborate

## Post-Command Actions

1. Present planning artifacts to user
2. Wait for explicit approval at each checkpoint
3. Iterate based on feedback
4. Offer to sync to none after final approval
5. Begin Phase 2 implementation only after user confirmation
