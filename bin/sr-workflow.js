#!/usr/bin/env node
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../sr-workflow/', import.meta.url));
const catalog = fileURLToPath(new URL('../mod-marketplace/', import.meta.url));
const usage = 'sr-workflow install [--project <existing-directory>] [--skill-only]';
const marketplace = 'sr-workflow-local';

async function sameTree(left, right) {
  const a = await readdir(left, { withFileTypes: true });
  const b = await readdir(right, { withFileTypes: true });
  if (a.length !== b.length) return false;
  for (const entry of a) {
    const other = b.find(item => item.name === entry.name);
    if (!other) return false;
    const src = path.join(left, entry.name);
    const dst = path.join(right, entry.name);
    if (entry.isDirectory() && other.isDirectory()) {
      if (!(await sameTree(src, dst))) return false;
    } else if (entry.isFile() && other.isFile()) {
      if (!(await readFile(src)).equals(await readFile(dst))) return false;
    } else return false;
  }
  return true;
}

async function existing(source, target, component) {
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  if (info.isDirectory() && await sameTree(source, target)) return true;
  throw new Error('Existing ' + component + ' differs from this package. Compare it before upgrading: ' + target);
}

async function ensureTree(source, target, component) {
  if (await existing(source, target, component)) return false;
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  const stage = await mkdtemp(path.join(path.dirname(parent), '.sr-install-'));
  try {
    const candidate = path.join(stage, 'candidate');
    await cp(source, candidate, { recursive: true });
    try {
      await rename(candidate, target);
    } catch (error) {
      if (!(await existing(source, target, component))) throw error;
      return false;
    }
    return true;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

function runClaude(args, cwd) {
  const run = spawnSync('claude', args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (run.error?.code === 'ENOENT') {
    throw new Error('Claude Code CLI is missing from PATH. Install it for the Mod, or run ' + usage + ' with --skill-only.');
  }
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error((run.stderr || run.stdout || 'Claude Code failed: ' + args.join(' ')).trim());
  return run.stdout;
}

async function install({ project, skillOnly }) {
  const root = project ? await realpath(project) : homedir();
  if (!(await stat(root)).isDirectory()) throw new Error('Expected a directory: ' + root);
  const personalConfig = path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'));
  const config = project ? path.join(root, '.claude') : personalConfig;
  const target = path.join(config, 'skills', 'sr-workflow');
  const scope = project ? 'local' : 'user';
  await existing(source, target, 'skill');

  if (!skillOnly) {
    const version = runClaude(['--version'], root).match(/\b(\d+)\.(\d+)\.(\d+)\b/);
    const [major, minor, patch] = version ? version.slice(1).map(Number) : [0, 0, 0];
    if (major < 2 || (major === 2 && (minor < 1 || (minor === 1 && patch < 299)))) {
      throw new Error('Agent Map needs Claude Code 2.1.299 or newer. Use --skill-only if Mods are unavailable.');
    }
    const localCatalog = path.join(personalConfig, 'sr-workflow-distributions', 'agent-map');
    const marketplaces = JSON.parse(runClaude(['plugin', 'marketplace', 'list', '--json'], root));
    const registered = marketplaces.find(item => item.name === marketplace);
    if (registered && (registered.source !== 'directory' || registered.path !== localCatalog)) {
      throw new Error('The ' + marketplace + ' marketplace points to a different location. Review it before installing.');
    }
    await ensureTree(catalog, localCatalog, 'Mod distribution');
    if (!registered) {
      runClaude(['plugin', 'marketplace', 'add', localCatalog, '--scope', scope], root);
    }
    runClaude(['plugin', 'install', 'sr-agent-map@' + marketplace, '--scope', scope], root);
  }
  const installed = await ensureTree(source, target, 'skill');
  console.log((installed ? 'Installed: ' : 'Already installed: ') + target);
  if (!skillOnly) {
    console.log('Registered /agent-map companion (' + scope + ' scope).');
    console.log(project ? 'In each open Claude Code session for ' + root + ':' : 'In each open Claude Code session using this user configuration:');
    console.log('  1. When the current turn finishes, run /reload-plugins at the Claude Code prompt.');
    console.log('  2. Run /agent-map to open and verify the workflow pane.');
    console.log('If /sr-workflow is missing, run /reload-skills where available.');
    console.log('If the Mod is still missing, check /plugin. Once work finishes, reopen the same conversation with claude --resume.');
  }
}

function parseInstall(args) {
  let project;
  let skillOnly = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--project' && !project && args[index + 1] && !args[index + 1].startsWith('--')) {
      project = args[++index];
    } else if (arg === '--skill-only' && !skillOnly) {
      skillOnly = true;
    } else {
      throw new Error(usage);
    }
  }
  return { project, skillOnly };
}

const args = process.argv.slice(2);
try {
  if (args.length === 1 && args[0] === '--version') {
    console.log(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
  } else if (!args.length || (args.length === 1 && args[0] === '--help')) {
    console.log(usage);
  } else if (args[0] === 'install') {
    await install(parseInstall(args.slice(1)));
  } else throw new Error(usage);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
