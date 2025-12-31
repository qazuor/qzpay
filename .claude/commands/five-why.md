---
name: five-why
description: Root cause analysis using Five Whys technique
type: development
category: analysis
---

# Five Why Command

## Purpose

Systematic root cause analysis using Five Whys technique to identify underlying causes of problems, bugs, or architectural decisions.

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `problem_categories` | Problem classification types | `technical, process, system` |
| `analysis_depth` | Number of why iterations | `5` (default) |
| `solution_types` | Solution categories | `immediate, process, architectural` |
| `evaluation_criteria` | Solution assessment factors | `effort, risk, benefit` |

## Usage

```bash
/five-why {problem_description}
```

## Execution Flow

### Step 1: Problem Analysis

**Agent**: `debugger`

- Analyze presented problem
- Gather context and information
- Identify symptoms vs causes
- Prepare for systematic questioning

### Step 2: Five Whys Analysis

**Process**:

1. Problem Statement: Clear issue definition
2. Why #1: Immediate cause
3. Why #2: Underlying cause
4. Why #3: Deeper cause
5. Why #4: Systemic cause
6. Why #5: Root cause

### Step 3: Root Cause Identification

- Identify fundamental cause
- Validate logic
- Assess impact and scope
- Categorize problem type

### Step 4: Solution Development

- Generate solution options
- Analyze tradeoffs
- Assess complexity
- Present recommendations

## Problem Categories

### Technical Problems

**Areas**: Bugs, performance, architecture, integration, deployment

**Focus**: Code-level issues, system design, configuration, dependencies

### Process Problems

**Areas**: Workflow, communication, quality gaps, deployment failures

**Focus**: Process design, tools, knowledge gaps, resource allocation

### System Problems

**Areas**: Scalability, reliability, security, maintenance

**Focus**: Architecture design, infrastructure, operational procedures

## Output Format

```text
🔍 FIVE WHYS ANALYSIS COMPLETE

Problem: {problem_statement}

📋 Analysis:

❓ Why #1: {question}
💡 Answer: {immediate_cause}
   Evidence: {supporting_data}

❓ Why #2: {question}
💡 Answer: {underlying_cause}
   Evidence: {supporting_data}

[... continues through Why #5]

🎯 ROOT CAUSE: {root_cause}

📊 Impact:
- Severity: {level}
- Scope: {affected_areas}
- Users Affected: {count}

🔧 Solution Options:

Option 1: {name}
✅ Pros: {benefits}
❌ Cons: {tradeoffs}
Implementation: {steps}

Option 2: {name}
[Similar structure...]

🎯 RECOMMENDED: {option} ({rationale})
```

## Analysis Techniques

### Systematic Questioning

**Question Types**:

- Open-ended (avoid yes/no)
- Evidence-based
- Context-gathering
- Assumption-challenging

### Evidence Collection

**Data Sources**:

- Logs and metrics
- Performance data
- User reports
- Code history
- Configuration changes

## Common Use Cases

### Bug Investigation

```text
Problem: {symptom}
Why chain → Root cause: {technical_gap}
Solution: {fix} + {process_improvement}
```

### Performance Issues

```text
Problem: {slow_response}
Why chain → Root cause: {design_limitation}
Solution: {optimization} + {monitoring}
```

### Architecture Decisions

```text
Problem: {complexity}
Why chain → Root cause: {planning_gap}
Solution: {refactor} + {standards}
```

## Solution Development

### Solution Categories

| Category | Characteristics | When to Use |
|----------|----------------|-------------|
| Immediate | Quick fixes, low risk | Critical issues, time-sensitive |
| Process | Systematic improvements | Recurring problems, quality needs |
| Architectural | Fundamental changes | Scalability, strategic requirements |

### Tradeoff Analysis

**Assessment Factors**:

- Implementation effort
- Technical risk
- User impact
- Long-term maintenance
- Business value

## Related Commands

- `/start-refactor-plan` - Architectural solutions
- `/review-code` - Code quality analysis
- `/quality-check` - Systematic quality problems

## When to Use

- Bug investigation
- Performance analysis
- Process problems
- Architecture decisions
- Incident post-mortems

## Best Practices

### Analysis Quality

- Focus on process, not blame
- Use evidence-based reasoning
- Challenge assumptions
- Validate each level
- Stop at actionable root cause

### Solution Development

- Generate multiple options
- Consider short and long-term
- Assess effort realistically
- Include process improvements
- Present clear tradeoffs
