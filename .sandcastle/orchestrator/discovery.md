# Discovery

## First Run: Repo Onboarding

If no `ONBOARDING.md` exists in the repo root, run `/compound-engineering:onboarding` before starting discovery. This generates repo context that makes all subsequent discovery and work smarter.

## Dedup: Check Existing PRs

Before starting discovery, fetch all open PRs once:

```
gh pr list --state open --json title,headRefBranch,number --limit 50
```

Keep this list in memory. When evaluating any discovered item (from any tier), check if an open PR already addresses it — match on title keywords or branch name. If a match exists, skip the item. Do not rediscover work that's already in progress or awaiting review.

## Discovery Tiers

Find work in this order. Exhaust each tier before the next.

### Tier 1: GitHub Issues

Run `gh issue list --label ready-for-agent --json number,title,body --limit 10`. Pick issues with the label. Skip issues assigned to others.

### Tier 2: Backlog

Check `.sandcastle/orchestrator/backlog.md` for accumulated work items. If items exist, run `/compound-engineering:todo-triage` on the backlog to prioritize them.

### Tier 3: TODOs & FIXMEs

Search the codebase for TODO and FIXME comments, then run `/compound-engineering:todo-triage` to classify and prioritize them. Skip aspirational items — only pick TODOs that describe a concrete bug, missing validation, or incomplete implementation.

### Tier 4: Optimizations

Scan for dead code, unused imports, missing error handling, code duplication, performance bottlenecks. Rank by impact, pick the top 3-5. Skip micro-optimizations that don't affect correctness or UX.

### Tier 5: Ideation

When all other tiers are empty, run `/compound-engineering:ce-ideate` to generate new improvement ideas. After ideation generates items:

1. Check each against the open PR list — skip items that already have a matching PR
2. Check each against `.sandcastle/orchestrator/ideation-log.md` — skip items already ideated in previous sessions
3. Append new ideas to `.sandcastle/orchestrator/ideation-log.md` so future sessions don't regenerate them:
   ```
   - [date] [status: pending/completed/skipped] Idea description
   ```

## Backlog Enrichment

While working on a task, if you notice a TODO, bug, or tech debt — run `/compound-engineering:todo-create` to log it as a structured work item. Don't fix it now.
