#!/usr/bin/env node
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../sr-workflow/', import.meta.url));
const usage = 'sr-workflow install [--project <existing-directory>]';

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

async function existing(target) {
  try {
    const info = await lstat(target);
    if (info.isDirectory() && await sameTree(source, target)) return true;
    throw new Error('Existing skill differs from this package. Compare a separate installation before upgrading: ' + target);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function install(project) {
  const root = project ? await realpath(project) : homedir();
  if (!(await stat(root)).isDirectory()) throw new Error('Expected a directory: ' + root);
  const config = project ? path.join(root, '.claude') : path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(root, '.claude'));
  const parent = path.join(config, 'skills');
  const target = path.join(parent, 'sr-workflow');
  if (await existing(target)) return console.log('Already installed: ' + target);
  await mkdir(parent, { recursive: true });
  // Stage outside skill discovery, on the same filesystem as the destination.
  const stage = await mkdtemp(path.join(config, '.sr-install-'));
  try {
    const candidate = path.join(stage, 'sr-workflow');
    await cp(source, candidate, { recursive: true });
    try {
      await rename(candidate, target);
    } catch (error) {
      if (!(await existing(target))) throw error;
    }
    console.log('Installed: ' + target);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
try {
  if (args.length === 1 && args[0] === '--version') {
    console.log(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
  } else if (!args.length || (args.length === 1 && args[0] === '--help')) {
    console.log(usage);
  } else if (args[0] === 'install' && (args.length === 1 || (args.length === 3 && args[1] === '--project' && args[2] && !args[2].startsWith('--')))) {
    await install(args[2]);
  } else throw new Error(usage);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
