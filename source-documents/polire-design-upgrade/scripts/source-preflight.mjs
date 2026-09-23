#!/usr/bin/env node
/**
 * Read-only inventory of an explicitly supplied Factory source tree.
 * Does not load Factory code, run package scripts, install dependencies,
 * read .env/data/work/client data, contact remotes or start model turns.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const SOURCES = [
  'package.json', 'pnpm-lock.yaml', 'README.md',
  'src/config.ts', 'src/orchestrator.ts', 'src/store.ts', 'src/fixtures.ts',
  'src/contracts.ts', 'src/model-contracts.ts', 'src/agents.ts',
  'src/design-research.ts', 'src/design-policy.ts', 'src/copy-policy.ts',
  'src/renderer.tsx', 'src/design-styles.ts', 'src/browser-tests.ts',
  'src/evaluation.ts', 'prompts/common.ts', 'prompts/strategist.ts',
  'prompts/builder.ts', 'prompts/qa.ts', 'spec/contracts.schema.json',
];
const REQUIRED = ['src/orchestrator.ts', 'src/fixtures.ts', 'spec/contracts.schema.json', 'package.json'];
const HELP = 'Usage: node scripts/source-preflight.mjs --root "C:\\...\\website-factory"\n' +
  'Read-only report to stdout. Does not execute Factory commands or contact the network.\n';
function within(root, file) {
  const rel = relative(root, file);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}
function inspect(root, name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return { path: name, status: 'missing' };
  const resolved = realpathSync(path);
  if (!within(root, resolved)) return { path: name, status: 'outside_root_not_read' };
  if (resolved !== path) return { path: name, status: 'symlink_not_read' };
  const info = statSync(resolved);
  if (!info.isFile()) return { path: name, status: 'not_regular_file' };
  if (info.size > 8 * 1024 * 1024) return { path: name, status: 'oversized_not_read' };
  const bytes = readFileSync(resolved);
  return { path: name, status: 'read', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
function git(root, args) {
  const result = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', root, ...args], {
    encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024, shell: false,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  });
  return result.status === 0 ? result.stdout.trimEnd() : null;
}
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); process.exit(0); }
  if (args.length !== 2 || args[0] !== '--root' || !args[1] || args[1].startsWith('--')) throw new Error('An explicit --root is required');
  const root = realpathSync(resolve(args[1]));
  if (!statSync(root).isDirectory()) throw new Error('--root must identify a directory');
  const files = SOURCES.map((name) => inspect(root, name));
  const recognised = REQUIRED.every((name) => files.some((file) => file.path === name && file.status === 'read'));
  let scriptsPresent = {};
  const packageEntry = files.find((file) => file.path === 'package.json');
  if (packageEntry?.status === 'read') {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    scriptsPresent = Object.fromEntries(['build', 'lint', 'test', 'demo', 'designs:check'].map((name) => [name, typeof manifest.scripts?.[name] === 'string']));
  }
  const status = recognised ? git(root, ['status', '--porcelain=v1', '--untracked-files=no']) : null;
  process.stdout.write(JSON.stringify({
    toolkit_version: '0.1.0', root, read_only: true, network_requested: false,
    recognised_factory_tree: recognised,
    git: {
      branch: recognised ? git(root, ['branch', '--show-current']) : null,
      head: recognised ? git(root, ['rev-parse', 'HEAD']) : null,
      modified_tracked_entries: status === null ? null : status === '' ? 0 : status.split('\n').length,
      untracked_files: 'not_enumerated',
    },
    expected_local_scripts_present: scriptsPresent,
    files,
    source_of_expectations: 'TECHNISCHE-UEBERGABE-2026-09-22.md, sections 2, 6, 7, 12, 13',
    warning: 'Inventory only. Does not verify schema compatibility, a clean tree, test success or current runtime behaviour.',
  }, null, 2) + '\n');
  if (!recognised) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Preflight failed: ${error instanceof Error ? error.message : 'unknown error'}\n` + HELP);
  process.exitCode = 2;
}
