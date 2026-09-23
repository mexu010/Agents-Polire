#!/usr/bin/env node
/** Read explicit local JSON; report current three-field fingerprint repeats. */
import { readFileSync, statSync } from 'node:fs';
import { assessCurrentFingerprints } from '../dist/current-fingerprint.js';
const HELP = 'Usage: node scripts/check-current-fingerprints.mjs --input FILE.json [--strict]\n';
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); process.exit(0); }
  let input;
  let strict = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input' && input === undefined && args[index + 1] && !args[index + 1].startsWith('--')) input = args[++index];
    else if (arg === '--strict' && !strict) strict = true;
    else throw new Error(`Invalid or repeated argument: ${arg}`);
  }
  if (!input) throw new Error('Missing --input');
  const info = statSync(input);
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Input must be a regular JSON file no larger than 2 MiB');
  const raw = JSON.parse(readFileSync(input, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some((key) => !['candidate','history','options'].includes(key))) throw new Error('Invalid input object');
  const result = assessCurrentFingerprints(raw.candidate, raw.history, raw.options ?? {});
  const warning = result.warnings.length > 0 || result.skipped_history.length > 0 || result.compared_count === 0;
  process.stdout.write(JSON.stringify({toolkit_version:'0.1.0', status:warning ? 'review_required' : 'no_declared_repeat_found', ...result}, null, 2) + '\n');
  if (strict && warning) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Current fingerprint check failed: ${error instanceof Error ? error.message : 'unknown error'}\n` + HELP);
  process.exitCode = 2;
}
