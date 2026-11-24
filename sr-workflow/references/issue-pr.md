# Issue to pull request

Use the team's templates, assignment field, project board or labels. Inspect existing automation before changing any shared template. Use these fields in the body where the team has no equivalent.

## Issue

- Current behavior, expected behavior and affected component
- Human owner in Assignees and an observable status
- Numbered acceptance criteria with input, user role and observable outcome
- Existing behavior to preserve, required verification modes and data

Keep one progress entry current with the branch, PR and outstanding decisions. Create a remote issue only when intake was requested.

## Pull request

Link the issue, identify its owner and target branch, and explain the user-visible change. Carry the exact AC identifiers and wording across. Document the tested commit, worktree-to-runtime evidence and reproduction command.

| Acceptance criterion | Required mode/profile | Test and observed result | Status |
| --- | --- | --- | --- |
| AC-1. Readers can view a saved report | Browser / reader fixture | Reopen the report and compare the stored title | Pass, fail or unrun |

Use separate rows for each required mode or profile. State missing environment, owner and next step for unrun checks. Keep the issue open and use the team's draft or blocked state while required checks remain. Use a closing keyword only for a complete issue when merging to the default branch is the team's closing event. Otherwise link the issue directly. Revisit evidence, closing keywords and review status when later commits change the result.
