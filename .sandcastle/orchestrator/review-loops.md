# Review Loops

Every review phase loops until clean. Clean = zero P0 and P1 findings.

## Document Review (after brainstorm or plan)

1. Run `/compound-engineering:document-review` on the document
2. If the review has P0 or P1 findings:
   - Apply all auto-fixes
   - Apply all batch fixes (select "yes" when asked)
   - For remaining P0/P1 findings, fix them manually in the document
   - Run `/compound-engineering:document-review` again
3. If the review has only P2/P3 or zero findings:
   - Select "Review complete"
   - Move to the next pipeline phase
4. Maximum 3 review rounds per document. If P0/P1 persist after 3 rounds, log the task as "needs-human" and move on.

## Code Review (after work)

1. Run `/compound-engineering:ce-review mode:autofix` on the code changes
2. ce-review in autofix mode will:
   - Apply safe_auto fixes automatically
   - Report remaining findings
3. If P0/P1 findings remain after autofix:
   - Fix them (edit the code)
   - Run `/compound-engineering:ce-review mode:autofix` again
4. If zero P0/P1 findings, proceed to ship
5. Maximum 3 review rounds per task. If P0/P1 persist after 3 rounds, log the task as "needs-human" and move on.
