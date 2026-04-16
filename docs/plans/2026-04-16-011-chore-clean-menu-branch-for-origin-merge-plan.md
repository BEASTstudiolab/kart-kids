---
title: "chore: clean menu branch for origin merge"
type: chore
status: active
date: 2026-04-16
origin: conversation-2026-04-16
related:
  - docs/plans/2026-04-16-007-chore-origin-master-merge-readiness-plan.md
  - docs/plans/2026-04-16-008-chore-isolate-menu-ui-and-drop-race-runtime-changes-plan.md
---

# chore: clean menu branch for origin merge

## Overview

Prepare the current menu-focused worktree for integration with `origin/master` by removing unrelated diff noise, aligning stale Playwright coverage with the current tab-shell architecture, and validating that the cleaned branch can absorb upstream cleanly.

## Problem Frame

The current branch has already been narrowed to menu-side work, but it still carries stale E2E coverage and generated artifacts that make review signal noisy and would increase merge friction. Local `master` is also behind `origin/master` by three commits, so cleanup needs to happen before upstream integration if we want a calm merge instead of a conflict-heavy one.

## Requirements Trace

- R1: Keep the diff focused on the intended menu/customizer/settings/lobby work
- R2: Remove generated or unrelated files that do not belong in the merge
- R3: Update stale Playwright specs to match the current shell, tab, and settings behavior
- R4: Re-run focused verification on the cleaned branch
- R5: Integrate `origin/master` locally and inspect the resulting merge state before pushing anything

## Scope Boundaries

- In scope:
  - E2E spec maintenance for the current shell architecture
  - diff cleanup for generated `test-results/` output and unrelated session logs
  - focused automated verification that is runnable in the local environment
  - local integration with `origin/master`
- Out of scope:
  - redesigning product behavior
  - broad refactors outside the kept menu surfaces
  - pushing directly to remote without first checking the local integrated state

## Local Research Summary

The current shell architecture in `js/ui/core/AppShell.js` uses persistent tab panels for `race`, `character`, `garage`, `tracks`, and `profile`. Only `characters`, `garage`, `karts`, `pause`, and `settings` remain registered routes; `profile` is now opened by a shell utility button instead of a dedicated route, and cut routes fall back to the active tab without preserving the old route expectations.

The current stale test surfaces are:

- `tests/e2e/navigation.spec.js`, which still asserts the removed title/home/top-nav shell
- `tests/e2e/profile-settings.spec.js`, which still treats `/#/profile` as a real route

The current diff also includes generated or unrelated churn in:

- `test-results/`
- `production/session-logs/session-log.md`

## External Research Decision

No external research is needed.

This work is fully determined by the local repository state, the current AppShell implementation, and the existing upstream git history already fetched into `origin/master`.

## Key Technical Decisions

- **Update tests to the current shell instead of preserving legacy route assumptions.**
  The code already moved to a tab-first architecture, so the tests need to follow the product, not the other way around.
- **Restore tracked artifacts instead of deleting historical fixtures blindly.**
  The cleanup should only remove generated branch noise from the diff, not rewrite repository history or guess at fixture intent.
- **Use local integration with `origin/master` as the final safety check.**
  Merge cleanliness depends on the actual upstream state, so the final confidence pass needs a real local integration step.

## Implementation Units

- [ ] **Unit 1: Write the merge-prep cleanup plan**

**Goal:** Capture the execution scope and cleanup decisions in a durable plan artifact before touching code.

**Requirements:** R1-R5

**Dependencies:** None

**Files:**
- Add: `docs/plans/2026-04-16-011-chore-clean-menu-branch-for-origin-merge-plan.md`

**Approach:**
- Record the current shell architecture, stale test assumptions, and artifact noise
- Define the cleanup and integration sequence that will be executed

**Patterns to follow:**
- existing plan frontmatter and checklist style in `docs/plans/`

**Test scenarios:**
- Happy path: a teammate can read the plan and understand exactly what needs to be cleaned before merge

**Verification:**
- The plan exists on disk with repo-relative paths and current-state context

---

- [ ] **Unit 2: Align Playwright coverage with the current shell**

**Goal:** Replace stale navigation/profile route expectations with assertions that match the current tab/profile/settings shell.

**Requirements:** R1, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `tests/e2e/navigation.spec.js`
- Modify: `tests/e2e/profile-settings.spec.js`

**Approach:**
- Validate startup against the shell tab bar, profile utility button, and settings entrypoint
- Assert route behavior only for currently registered routes
- Cover profile through the shell button and settings through the fullscreen route

**Patterns to follow:**
- current AppShell selectors and panel roots in `js/ui/core/AppShell.js`
- existing E2E setup helpers in `tests/e2e/`

**Test scenarios:**
- Startup lands in the shell with the main tab bar visible
- Clicking shell tabs activates the expected panel
- Clicking the profile utility button activates the profile panel
- Clicking the settings utility button opens the fullscreen settings route and closing it returns to the previous tab
- Direct `/#/characters` and `/#/garage` routes resolve to the correct tab panels
- Cut routes such as `/#/party`, `/#/events`, and `/#/ranked` fall back to a valid shell tab

**Verification:**
- The updated specs only target active selectors and supported routes

---

- [ ] **Unit 3: Remove merge-noise artifacts from the diff**

**Goal:** Strip generated test output and unrelated operational log churn from the branch so review and merge stay focused.

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Modify: `production/session-logs/session-log.md`
- Modify: `test-results/.last-run.json`
- Modify: tracked files under `test-results/`

**Approach:**
- Restore tracked artifact/log files to `HEAD`
- Remove untracked generated Playwright output that resulted from local environment failures

**Patterns to follow:**
- non-destructive git cleanup that preserves intended source changes

**Test scenarios:**
- Happy path: `git status` no longer shows generated test artifacts or unrelated session log churn
- Edge case: tracked repository fixtures under `test-results/` remain intact after cleanup

**Verification:**
- The remaining diff is limited to intended source/test changes

---

- [ ] **Unit 4: Verify the cleaned menu branch**

**Goal:** Reconfirm that the kept menu surfaces and their local tests still pass after cleanup.

**Requirements:** R4

**Dependencies:** Units 2-3

**Files:**
- Modify: verification is read-only for source files

**Approach:**
- Run the focused Node test suite covering menu/customizer/loading/lobby surfaces
- If Playwright remains blocked by missing browser binaries, document that explicitly instead of hiding it
- Use browser smoke checks on key routes if needed for additional confidence

**Patterns to follow:**
- existing focused verification coverage in `tests/`

**Test scenarios:**
- Menu-focused Node suite passes
- Current settings and characters routes render without obvious console/runtime issues in smoke checks

**Verification:**
- We have a current verification summary tied to the cleaned diff

---

- [ ] **Unit 5: Integrate upstream locally**

**Goal:** Absorb `origin/master` into the cleaned local worktree and inspect whether the merge is ready for remote publication.

**Requirements:** R5

**Dependencies:** Units 2-4

**Files:**
- Modify: depends on merge results

**Approach:**
- Fetch current remote state if needed
- Integrate `origin/master` locally on the cleaned branch
- Inspect conflicts, resolve if any are confined to the intended menu surface, and summarize the resulting state before any push

**Patterns to follow:**
- minimal-conflict sequencing guided by the earlier merge-readiness review

**Test scenarios:**
- Happy path: merge or rebase applies cleanly after cleanup
- Edge case: any remaining conflicts are isolated to known hotspot files and can be summarized clearly

**Verification:**
- Local branch is no longer behind `origin/master`, or any remaining blockers are explicitly called out

## Risks and Mitigations

- **Risk:** Updating only one stale E2E file leaves a second broken suite behind.
  - **Mitigation:** Clean both `navigation` and `profile-settings` while the current shell model is in view.

- **Risk:** Artifact cleanup accidentally removes tracked fixtures.
  - **Mitigation:** Restore tracked files from `HEAD` and only delete obviously generated untracked output.

- **Risk:** Upstream integration still conflicts in core shell files.
  - **Mitigation:** Do cleanup first, then integrate and inspect the actual merge state before any push decision.

## Verification Strategy

- Confirm the plan file exists and matches the current task scope
- Run focused Node-based menu tests after edits
- Run whatever browser smoke verification is locally available
- Inspect git status and upstream integration state before deciding whether remote merge is safe
