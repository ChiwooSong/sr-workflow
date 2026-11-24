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
  const args = ['install', '--project', root];
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
  assert.equal(run(['install'], { ...process.env, CLAUDE_CONFIG_DIR: root }).status, 0);
  assert.ok((await stat(path.join(root, 'skills/sr-workflow/scripts/check_worktree.py'))).isFile());
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
