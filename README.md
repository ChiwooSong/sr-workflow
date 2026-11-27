# sr-workflow

A Claude Code skill for taking a service request from a GitHub issue to a reviewable pull request. The package also installs Agent Map, a Claude Code Mod that shows live subagent activity. The workflow uses [configure-subagents](https://github.com/ChiwooSong/configure-subagents) for agent configuration. The project supplies its own team rules, build commands and acceptance criteria.

## Install

Requires Node.js 22+ for the installer and Claude Code CLI 2.1.299+ on `PATH` for Agent Map. Issue and PR operations require Git and an authenticated GitHub integration. Setup uses the separately installed `configure-subagents` skill and its Claude validator (Python 3.10+ and PyYAML). Follow that skill's dependency instructions.

```sh
npx --yes @woody_s/configure-subagents@1.0.0 install --agent claude
npx --yes sr-workflow@0.2.2 install
```

The second command installs `/sr-workflow` in your Claude configuration directory (`~/.claude/skills/sr-workflow` by default) and registers the bundled Mod through the Claude plugin CLI. With `install --project .`, it puts the skill in the current repository and enables the Mod for your local sessions in that repository. Use `install --skill-only` if your organization only allows standalone skills. Reinstalling identical content preserves it. When upgrading from 0.2.1, the installer also detects the previous release as differing content. If it reports “Existing skill differs”, back up the indicated sr-workflow directory outside the skills directory, move that installed copy aside, rerun the same install command and merge any team edits from the backup. For manual skill-only installation, copy the repository's `sr-workflow/` directory to the same skills location.

For a direct installation from the GitHub release, download the tarball and run `npx --yes --package=./sr-workflow-0.2.2.tgz -- sr-workflow install` from its folder. The npm package is version **0.2.2** and its bundled **Agent Map plugin is version 0.2.0**. Check registration with `claude plugin list` and look for `sr-agent-map@sr-workflow-local`.

## Use in Claude Code

```text
/sr-workflow setup
```

Run from the project root. Setup applies project roles, configures the project verifier and exercises one meaningful baseline. The main session invokes the worktree’s `/sr-workflow-verify` skill. For projects prepared with 0.2.1, preserve the old project verifier and use its commands in the new skill when applying this revision. Once the baseline and failure-detection checks succeed, reply with the issue URL. For a fresh session, supply it directly:

```text
/sr-workflow https://github.com/OWNER/REPO/issues/123
```

Claude follows the human owner and acceptance criteria, implements the SR in its own worktree, verifies the resulting build and links issue and PR. Browser projects use Playwright. API, CLI, batch and library projects use their corresponding entry points. A partial result stays visible in the PR's acceptance-criteria table.

## Agent Map

Run `/agent-map` to open the workflow pane, or `/agent-map text` to get the tree with agent IDs. A user-scope install works in local sessions that load the Mod, including sessions that never invoke `/sr-workflow`. The pane follows the subagents Claude exposes for the current session and shows parent-child calls, running and waiting work, parallel execution, and observed terminal states. Agent Map keeps observed state in session memory.

### Enable Agent Map in an already open session

1. After installation, return to each eligible Claude Code session and wait for its current turn to finish. User-scope installation applies to local sessions that use the same Claude configuration. With `--project`, follow these steps in sessions for the installed project.
2. Enter `/reload-plugins` directly at the Claude Code prompt. Then enter `/agent-map` to confirm the pane opens. The map picks up the subagents Claude currently exposes in that session. [Claude Code Mods](https://code.claude.com/docs/en/plugins/mods/overview#install-or-update-a-mod)
3. If `/sr-workflow` is missing, run `/reload-skills` where available. If `/agent-map` is missing, check `/plugin` for `sr-agent-map@sr-workflow-local` and any load errors. If you need to restart, let active work finish and run `claude --resume` from the same directory to select the existing conversation. [Claude Code command reference](https://code.claude.com/docs/en/commands)

To include upcoming steps, register them explicitly in the same session. `dependsOn` contains plan IDs, and an optional `agentId` links a step to an ID reported by `/agent-map text`. Run `/agent-map plan []` to clear the plan.

```text
/agent-map plan [{"id":"review","title":"Review changes"},{"id":"verify","title":"Verify the change","dependsOn":["review"]}]
```

Mod loading and pane availability follow the Claude Code surface and your organization's settings. [Claude Code Mods](https://code.claude.com/docs/en/plugins/mods/overview)

## Validation scope

Package checks cover skill installation, worktree identification and package contents. The Mod fixtures run with `claude plugin test` from `mod-marketplace/plugins/sr-agent-map`. To smoke-test bundled installation through the real Claude CLI, set `SR_WORKFLOW_CLAUDE_SMOKE=1` and run `npm test`. These checks use disposable settings and simulated subagent states. An authenticated SR run and your organization's Mod policy require verification in the adopting environment.

## 한국어 빠른 시작

1. 개발 PC 터미널에서 위의 두 설치 명령을 실행합니다. 이미 `configure-subagents`가 설치된 PC는 두 번째 명령만 실행하세요. Mod 사용이 제한된 환경에서는 두 번째 명령 끝에 `--skill-only`를 붙여 SR Skill만 설치합니다.
2. 대상 저장소 루트에서 Claude Code를 열고 `/sr-workflow setup`을 입력합니다. 기준 테스트가 끝나면 작업할 사내 GitHub Issue URL만 답하세요. 준비된 저장소의 새 세션이라면 `/sr-workflow <실제 Issue URL>`로 바로 시작합니다.
3. 현재 세션의 에이전트 호출 관계와 상태는 `/agent-map`, 에이전트 ID가 포함된 텍스트 트리는 `/agent-map text`로 확인합니다. 준비된 에이전트가 아직 호출되지 않았다면 작업을 시작한 뒤 다시 확인하세요. 완료 조건별 테스트 결과는 PR에서 확인합니다.

**첫 Issue 예시** — ‘신청 목록에 완료 상태 필터 추가’를 제목으로 쓰고 Assignees에 담당 개발자를 지정합니다. AC-1은 ‘완료를 선택하면 완료 건만 보인다’, AC-2는 ‘초기화하면 완료 건과 진행 중인 건이 다시 보인다’로 적습니다. 개발자는 이 Issue의 URL을 전달하고, 리뷰어는 PR에서 두 조건의 Playwright 결과를 확인합니다.

이미 열려 있는 세션은 현재 작업이 끝난 뒤 각 Claude Code 입력창에서 `/reload-plugins` → `/agent-map` 순서로 입력하세요. `--project`로 설치했다면 해당 저장소의 세션에서 실행하세요. `/sr-workflow`가 목록에 없으면 지원되는 버전에서 `/reload-skills`를 실행하세요. Mod를 다시 불러와도 표시되지 않으면 `/plugin`에서 로드 오류를 확인하세요. 세션을 다시 열어야 한다면 같은 폴더에서 `claude --resume`으로 기존 대화를 선택할 수 있습니다.
