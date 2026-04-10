# Limits

Check your initial prompt for mode and limit settings.

- **Default**: Complete up to 5 tasks, then stop
- **"limit: N"**: Complete up to N tasks
- **"mode: overnight"**: No limit. Keep discovering and working until all tiers including ideation are exhausted. Only stop if the circuit breaker triggers.

## Discovery Exhaustion

You MUST attempt Tier 5 (ideation) before stopping. If ideation produces new work, process it. Only stop when all tiers are truly empty OR the task limit is reached.

## Circuit Breaker

3 consecutive task failures → stop and report what went wrong.

## Review Limits

Max 3 review rounds per phase. If P0/P1 persist after 3 rounds, mark "needs-human" and move on.

## Per-Phase Iteration Budgets

These are soft limits — if a skill is making progress, continue. If stuck, move on.

- **ce:plan**: Up to 10 tool calls per planning attempt
- **ce:work**: Up to 100 tool calls per implementation
- **ce:review**: Up to 10 tool calls per review round

## Per-Task Budget

When multiple tasks remain, distribute effort evenly. Formula: `total_iterations / tasks_remaining` per task. If you have 5 tasks and a session limit of 5, don't spend 80% of context on the first task.

## Configurable via Environment Variables

All limits are configurable in `.sandcastle/.env`. The env var is authoritative; this file is the human-readable reference.

| Env Var                     | Default | Description                          |
| --------------------------- | ------- | ------------------------------------ |
| `MAX_ITERATIONS`            | 50      | Total sandbox runs before halting    |
| `CIRCUIT_BREAKER_THRESHOLD` | 3       | Consecutive failures before stopping |
| `MIN_TASK_BUDGET`           | 8       | Skip task if fewer iterations remain |
| `TIMEOUT_PLAN`              | 900     | Plan phase timeout (seconds)         |
| `TIMEOUT_WORK`              | 1200    | Work phase timeout (seconds)         |
| `TIMEOUT_REVIEW`            | 600     | Review phase timeout (seconds)       |
| `MAX_ITERATIONS_PLAN`       | 10      | Max tool calls per plan attempt      |
| `MAX_ITERATIONS_WORK`       | 100     | Max tool calls per implementation    |
| `MAX_ITERATIONS_REVIEW`     | 10      | Max tool calls per review round      |
| `MAX_REVIEW_ROUNDS`         | 3       | Max review rounds before stuck       |
| `MAX_XML_RETRIES`           | 5       | XML parsing retry cap                |
| `GIT_TIMEOUT`               | 60000   | Git operation timeout (ms)           |
| `MIN_DISK_MB`               | 2000    | Minimum disk space (MB)              |

## When Done

When you reach your task limit or all tiers are exhausted:

1. Run `/compound-engineering:git-clean-gone-branches` — clean up merged/stale local branches
2. Run `/compound-engineering:changelog` — generate a changelog of all PRs created this session (best-effort, skip if fails)
3. Output the session summary
4. Write "done" to `.sandcastle/control`:

```
echo "done" > .sandcastle/control
```

This signals the runner to restart or stop. Do not wait at the prompt after this.
