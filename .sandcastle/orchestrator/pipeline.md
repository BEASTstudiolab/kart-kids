# Pipeline

The state machine in autonomy.md defines the phase sequence. Every task runs through these steps.

Each `/compound-engineering:*` step is a Skill tool invocation. Use the Skill tool to run them — do not implement their behavior yourself.

## Classification

Classify each task before starting. Use this decision tree:

1. Is it a single-file change under 20 lines? (rename, delete, config tweak, dead code removal) → **Trivial**
2. Does it touch 4+ files, add a new feature, or change architecture? → **Complex**
3. Everything else → **Standard**

When uncertain, classify UP (trivial→standard, standard→complex).

### Bug Detection

If the task came from Tier 1 (GitHub issues) and the issue has a "bug" label or its title contains "fix", "bug", "crash", "error", or "broken" — treat it as a bug.

## Conditional Steps

These run at specific points in every pipeline size when their condition is met:

- **REPRODUCE** (before WORK): If the task is a bug, run `/compound-engineering:reproduce-bug <issue-number>`
- **TEST** (after WORK, before CODE-REVIEW): Match the project type:
  - Xcode project (`.xcodeproj` or `project.yml` exists): Run `/compound-engineering:test-xcode`
  - Web project with browser tests: Run `/compound-engineering:test-browser`
  - Otherwise: Run the project's test command directly
- **DESIGN** (during WORK): If the task touches frontend UI, run `/compound-engineering:frontend-design` as part of ce:work

## Gates

STOP and verify at each gate. If the gate fails, log the task as failed and move on.

- **GATE before CLASSIFY (dedup)**: Before starting any task, check if an open PR already addresses it:
  ```
  gh pr list --state open --json title,headRefBranch --limit 30
  ```
  If any open PR title or branch name overlaps with this task's description, SKIP the task — log it as "skipped (duplicate of PR #N)" and move to the next task. Do not re-implement work that's already in an open PR.
- **GATE after PLAN**: Verify a plan file was created in `docs/plans/`. If no file exists, retry `/compound-engineering:ce-plan` once. Do not proceed to WORK without a written plan.
- **GATE after WORK**: Verify files were created or modified (beyond the plan). Run `git diff --stat`. If no code changes were made, log the task as failed — do not run CODE-REVIEW on nothing.

## Trivial

1. Run `/compound-engineering:ce-work` — implement the change
2. **GATE**: Verify code changes exist (`git diff --stat`)
3. Run `/compound-engineering:ce-review mode:autofix` — review and auto-fix (see review-loops.md)
4. Run `/compound-engineering:todo-resolve` — close any TODOs that were fixed
5. Run `/compound-engineering:git-commit-push-pr` — commit, push, and create PR
6. Run `/compound-engineering:ce-compound` — document what was learned (best-effort, skip if trivial or fails)

## Standard

1. Run `/compound-engineering:ce-plan` — create implementation plan
2. **GATE**: Verify plan file exists in `docs/plans/`
3. Run `/compound-engineering:document-review` — review the plan (see review-loops.md)
4. Run `/compound-engineering:ce-work` — implement the plan
5. **GATE**: Verify code changes exist (`git diff --stat`)
6. Run `/compound-engineering:ce-review mode:autofix` — review the code (see review-loops.md)
7. Run `/compound-engineering:todo-resolve` — close any TODOs that were fixed
8. Run `/compound-engineering:git-commit-push-pr` — commit, push, and create PR
9. Run `/compound-engineering:ce-compound` — document what was learned

## Complex

1. Run `/compound-engineering:ce-brainstorm` — explore requirements
2. Run `/compound-engineering:document-review` — review requirements (see review-loops.md)
3. Run `/compound-engineering:ce-plan` — create implementation plan
4. **GATE**: Verify plan file exists in `docs/plans/`
5. Run `/compound-engineering:document-review` — review the plan (see review-loops.md)
6. Run `/compound-engineering:ce-work` — implement the plan
7. **GATE**: Verify code changes exist (`git diff --stat`)
8. Run `/compound-engineering:ce-review mode:autofix` — review the code (see review-loops.md)
9. Run `/compound-engineering:todo-resolve` — close any TODOs that were fixed
10. Run `/compound-engineering:git-commit-push-pr` — commit, push, and create PR
11. Run `/compound-engineering:ce-compound` — document what was learned

## Domain Skills

These CE skills are available for specific project types. Invoke them during WORK when relevant:

| Skill                                             | When to use                                               |
| ------------------------------------------------- | --------------------------------------------------------- |
| `/compound-engineering:dhh-rails-style`           | Ruby/Rails projects — use during ce:work for Rails code   |
| `/compound-engineering:andrew-kane-gem-writer`    | Writing Ruby gems                                         |
| `/compound-engineering:dspy-ruby`                 | Ruby LLM applications using DSPy.rb                       |
| `/compound-engineering:frontend-design`           | Web UI work — landing pages, dashboards, components       |
| `/compound-engineering:test-browser`              | Web projects with browser-testable pages                  |
| `/compound-engineering:test-xcode`                | iOS/macOS/tvOS Xcode projects                             |
| `/compound-engineering:agent-native-architecture` | Building agent-facing tools or APIs                       |
| `/compound-engineering:agent-native-audit`        | Auditing agent-native patterns in existing code           |
| `/compound-engineering:feature-video`             | Record video walkthrough for PR (complex features)        |
| `/compound-engineering:git-clean-gone-branches`   | Session end — clean up merged/stale local branches        |
| `/compound-engineering:ce-compound-refresh`       | Overnight — refresh stale docs/solutions/ after refactors |
| `/compound-engineering:resolve-pr-feedback`       | Morning-after — auto-resolve PR review comment threads    |
