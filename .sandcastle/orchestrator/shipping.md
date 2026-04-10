# Shipping

## Branch Naming

All task branches use the prefix `ce-auto-coder/`:

```
ce-auto-coder/<task-id>
```

Examples: `ce-auto-coder/fix-force-unwraps`, `ce-auto-coder/recipe-engine-cache`

## Per Task

1. Start from main: `git checkout main && git pull origin main`
2. Create task branch: `git checkout -b ce-auto-coder/<task-id>`
3. Do all work on the task branch
4. Run `/compound-engineering:git-commit-push-pr` — commits, pushes, and creates the PR in one step
5. Return to main for the next task

## Merge Conflicts

If conflicts arise when returning to main, resolve them:

1. Try direct merge first
2. If that fails, rebase onto main and retry
3. If still failing, log the task as "conflicted" and move on
