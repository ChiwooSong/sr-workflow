# sr-workflow

A Claude Code skill for taking a service request from a GitHub issue to a reviewable pull request. It builds on [configure-subagents](https://github.com/ChiwooSong/configure-subagents) for agent configuration. The project supplies its own team rules, build commands and acceptance criteria.

## Install

Requires Node.js 22+ for the installer, Git, Claude Code and an authenticated GitHub integration for issue and PR operations. Setup uses the separately installed `configure-subagents` skill and its Claude validator (Python 3.10+ and PyYAML). Follow that skill's dependency instructions.

```sh
npx --yes @woody_s/configure-subagents@1.0.0 install --agent claude
npx --yes @woody_s/sr-workflow@0.1.0 install
```

The second command installs the skill under your Claude configuration directory (`~/.claude/skills/sr-workflow` by default). To share it in one repository, use `install --project .` from that repository instead. Reinstalling identical content preserves it. If the installed directory differs, install to a separate project and compare the files before upgrading. For manual installation, copy the repository's `sr-workflow/` directory to the same skills location.

## Use in Claude Code

```text
/sr-workflow setup
```

Run from the project root. Setup applies project roles, configures the project verifier and exercises one meaningful baseline. Once the baseline and failure-detection checks succeed, reply with the issue URL. For a fresh session, supply it directly:

```text
/sr-workflow https://github.com/OWNER/REPO/issues/123
```

Claude follows the human owner and acceptance criteria, implements the SR in its own worktree, verifies the resulting build and links issue and PR. Browser projects use Playwright. API, CLI, batch and library projects use their corresponding entry points. A partial result stays visible in the PR's acceptance-criteria table.

## Validation scope

The release checks installer behavior, worktree identification, package contents and an isolated CLI baseline. Skill discovery can be checked without running a model. End-to-end delivery by an authenticated Claude session, real browser or service integrations and organization-specific permissions require validation in the adopting project.

## 한국어 빠른 시작

위 두 설치 명령을 한 번 실행한 뒤, 대상 저장소에서 Claude Code를 열고 `/sr-workflow setup`을 입력합니다. 기준 테스트가 끝나면 작업할 GitHub Issue URL만 전달하세요. 다음 세션에서는 `/sr-workflow <Issue URL>`로 바로 시작할 수 있습니다.
