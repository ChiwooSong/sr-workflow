# Verify the project's actual build

Create or reuse `.claude/skills/sr-workflow-verify/SKILL.md` in the target checkout with `name: sr-workflow-verify`, a description and model invocation enabled. If the project has a legacy `.claude/skills/verify/SKILL.md`, preserve it and reuse its project commands, fixtures and scripts. Resolve relative resource paths from the new skill directory. Update SR-owned agent instructions, templates and setup records that invoke the old name. Apply this check on setup and when resuming with an issue URL.

From the main session invoke the Skill tool with `skill: sr-workflow-verify`. Confirm that the loaded directory belongs to the target worktree and record the baseline result separately. The bundled `/verify` is a different command. If the tool rejects the call or loads another definition, record the error and resolved path if available. Resume from the target worktree after loading the corrected skill; direct test output alone leaves the invocation unverified.

## Select a representative boundary

| Project | Baseline |
| --- | --- |
| Browser app | Exercise a real user journey with Playwright and assert a business result beyond navigation or login. |
| HTTP service | Start this build and check an endpoint's status and business value. For writes, use isolated data and read the persisted result. |
| CLI or batch | Execute this checkout's entry point with a small fixture. Check the output or durable effect and exit code. |
| Library | Call its public interface from a test or consumer and verify representative inputs and results. |

Derive tools, versions, launch commands and data setup from CI, lockfiles and team guidance. For multi-component changes, cover the boundaries required by the ACs.

1. From the shell that will run the tests, compare its Git root and branch with the expected worktree and record HEAD and dirty state. With Python 3, run `python "${CLAUDE_SKILL_DIR}/scripts/check_worktree.py" "<expected-absolute-root>" "<expected-branch>"` using the **sr-workflow installation directory**. When generating a separate project verifier, resolve the helper's actual path or use native Git commands. The helper exits 0 for a match, 1 for a mismatch, 2 for an unavailable check. Alternatively use `git rev-parse --show-toplevel`, `git branch --show-current`, `git rev-parse HEAD` and `git status --short`.
2. Build from that root. Establish the link from build output to the live process, binding and test URL, or to the actual executable or loaded module. Check deployed hashes when needed. Isolate ports, outputs and fixtures across worktrees or serialize tests. An unrelated process responding at a familiar URL cannot establish this link.
3. At initial setup, use a disposable test copy and change just an expected business value. Run it through the usual test command. Confirm the specific assertion fails and the command exits unsuccessfully. Remove the disposable file and rerun the original baseline. Record zero tests, skips, setup errors and retry-only passes distinctly.
4. Choose checks per AC. For persistence, observe post-failure state; for access rules, exercise server-side allowance and denial; for retries, verify duplicate effects; for query changes, compare the old and new results on equivalent data. Review removed tests, relaxed assertions and new skips against the team's base rules.
5. For simulated users or external services, use local-only fixtures and test adapters. Establish before startup that a simulated run cannot fall back to real external systems, and verify the observed calls afterward. Track UI simulation, server logic and live identity or service integration separately. Use actual integration environments only within the user's authorization.
6. Record command, worktree, commit, target, exit code, assertion results, counts, skips, retries and limitations. Rerun affected checks and the baseline after relevant changes. If three repair-and-test attempts reproduce the same failure, hand off the reproducible symptom, attempted fixes and resumption conditions. Surface missing human authentication or permissions as soon as identified.
