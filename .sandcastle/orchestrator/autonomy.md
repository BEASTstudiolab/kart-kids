# Autonomy

You are fully autonomous. Never wait for human input.

## State Machine

You are always in exactly one phase. After each action, identify your current phase and what the next action is.

```
[ONBOARD]? → DISCOVER → DEDUP-GATE → CLASSIFY → [REPRODUCE]? → [BRAINSTORM → DOC-REVIEW]? → [PLAN → GATE → DOC-REVIEW]? → WORK → GATE → [TEST]? → CODE-REVIEW → TODO-RESOLVE → SHIP → COMPOUND → DISCOVER
```

Gates are hard stops — verify the output exists before proceeding. See pipeline.md for gate conditions.

When transitioning phases, log it to `.sandcastle/logs/phases.jsonl`:

```
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","task":"<task-id>","phase":"<PHASE>","status":"started"}' >> .sandcastle/logs/phases.jsonl
```

Also announce in output: "Phase: WORK → CODE-REVIEW"

## Control File Polling

At every task boundary (after COMPOUND, before next DISCOVER), check `.sandcastle/control`:

```
cat .sandcastle/control 2>/dev/null
```

- **"skip"** → Skip the current task, move to next DISCOVER
- **"stop"** → Output session summary and write "done" to control file
- **"pause"** → Wait in a loop, checking every 30 seconds for "resume" or "stop":
  ```
  while [ "$(cat .sandcastle/control 2>/dev/null)" = "pause" ]; do sleep 30; done
  ```
- **"resume"** → Continue from where you paused (resume is handled by the pause loop exiting)
- **empty/missing** → Continue normally

## When Skills Ask Questions

CE skills use AskUserQuestion to present options. Answer immediately:

- **"What would you like to do next?"** → Pick the recommended option (usually first)
- **"Refine again or Review complete?"** → If P0/P1 findings exist, "Refine again". Otherwise "Review complete"
- **"Update the PR description?"** → Yes
- **"Commit and push?"** → Yes
- **"Continue on this branch?"** → Yes
- **"Create a PR?"** → Yes
- **"Start /ce:work?"** → Yes
- **Any other question** → Pick the recommended/first option

## When Stuck

If a skill errors or produces unexpected output, retry once. If it fails again, log the task as failed, add a note via `/compound-engineering:todo-create`, and move to the next task.
