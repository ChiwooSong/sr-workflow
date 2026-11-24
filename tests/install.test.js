import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sr-workflow.js', import.meta.url));
const run = (args, env = process.env) => spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8' });

test('project install, repeat, and conflict preserve user files', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'sr-project-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const args = ['install', '--project', root, '--skill-only'];
  const target = path.join(root, '.claude', 'skills', 'sr-workflow');
  const entry = path.join(target, 'SKILL.md');
  assert.equal(run(args).status, 0);
  const before = await stat(entry);
  assert.match(await readFile(entry, 'utf8'), /name: sr-workflow/);
  assert.equal(run(args).status, 0);
  assert.equal((await stat(entry)).mtimeMs, before.mtimeMs);
  await writeFile(entry, 'local customization');
  assert.equal(run(args).status, 1);
  assert.equal(await readFile(entry, 'utf8'), 'local customization');
});

test('personal installation honors CLAUDE_CONFIG_DIR', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'sr-personal-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = run(['install', '--skill-only'], { ...process.env, CLAUDE_CONFIG_DIR: root });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /\/reload-plugins|\/agent-map/);
  assert.ok((await stat(path.join(root, 'skills/sr-workflow/scripts/check_worktree.py'))).isFile());
  await assert.rejects(stat(path.join(root, 'sr-workflow-distributions')), { code: 'ENOENT' });
});

test('unexpected arguments and missing project do not trigger a personal install', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'sr-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: root };
  assert.equal(run(['install', '--project'], env).status, 1);
  assert.equal(run(['install', '--project', path.join(root, 'missing')], env).status, 1);
  await assert.rejects(stat(path.join(root, 'skills')), { code: 'ENOENT' });
});

test('an existing empty skill folder is preserved', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'sr-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dest = path.join(root, '.claude/skills/sr-workflow');
  await mkdir(dest, { recursive: true });
  assert.equal(run(['install', '--project', root]).status, 1);
  await assert.rejects(stat(path.join(dest, 'SKILL.md')), { code: 'ENOENT' });
});

test('bundled install registers the Mod in the selected scope and supports retry', {
  skip: process.env.SR_WORKFLOW_CLAUDE_SMOKE !== '1', timeout: 120_000,
}, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'sr-claude-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = path.join(root, 'config');
  const project = path.join(root, 'project');
  await mkdir(config);
  await mkdir(project);
  const env = { ...process.env, CLAUDE_CONFIG_DIR: config, NO_COLOR: '1' };
  function installedPlugin(cwd) {
    const result = spawnSync('claude', ['plugin', 'list', '--json'], { cwd, env, encoding: 'utf8', timeout: 20_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    return JSON.parse(result.stdout).filter(plugin => plugin.id === 'sr-agent-map@sr-workflow-local');
  }

  const local = ['install', '--project', project];
  for (const args of [local, local]) {
    const result = run(args, env);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('In each open Claude Code session for ' + project + ':'));
    assert.match(result.stdout, /1\..*\/reload-plugins[^\r\n]*\r?\n\s+2\..*\/agent-map/);
  }
  assert.ok((await stat(path.join(project, '.claude/skills/sr-workflow/SKILL.md'))).isFile());
  const [localMod] = installedPlugin(project).filter(plugin => plugin.scope === 'local');
  assert.equal(localMod.enabled, true);
  assert.equal(installedPlugin(root).some(plugin => plugin.scope === 'user'), false);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = run(['install'], env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /In each open Claude Code session using this user configuration/);
    assert.match(result.stdout, /1\..*\/reload-plugins[^\r\n]*\r?\n\s+2\..*\/agent-map/);
  }
  assert.ok((await stat(path.join(config, 'skills/sr-workflow/SKILL.md'))).isFile());
  const [userMod] = installedPlugin(root).filter(plugin => plugin.scope === 'user');
  assert.equal(userMod.enabled, true);
  assert.equal(userMod.version, '0.2.0');
});
