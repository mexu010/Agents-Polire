#!/usr/bin/env node
/** Offline comparison of explicit JSON input. Does not modify POLIRE. */
import { readFileSync, statSync } from 'node:fs';
import { parseCatalog, parseConcepts, assessConceptSet, assessPortfolio } from '../dist/design-diversity.js';

const HELP = 'Usage: node scripts/evaluate-designs.mjs --input FILE.json [--strict]\n' +
  'Prints JSON to stdout. No network or model calls. --strict exits 1 for warnings/gaps.\n';
try {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { process.stdout.write(HELP); process.exit(0); }
  let input;
  let strict = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input' && input === undefined && args[index + 1] && !args[index + 1].startsWith('--')) input = args[++index];
    else if (arg === '--strict' && !strict) strict = true;
    else throw new Error(`Invalid or repeated argument: ${arg}`);
  }
  if (!input) throw new Error('Missing --input FILE.json');
  if (!statSync(input).isFile() || statSync(input).size > 2 * 1024 * 1024) throw new Error('Input must be a regular JSON file no larger than 2 MiB');
  const raw = JSON.parse(readFileSync(input, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Input must be an object');
  for (const key of Object.keys(raw)) if (!['catalog', 'concepts', 'portfolio'].includes(key)) throw new Error(`Unknown input field: ${key}`);
  if (raw.concepts === undefined && raw.portfolio === undefined) throw new Error('Input requires concepts or portfolio');
  const catalog = parseCatalog(raw.catalog);
  const concepts = raw.concepts === undefined ? null : assessConceptSet(parseConcepts(raw.concepts, catalog));
  let portfolio = null;
  if (raw.portfolio !== undefined) {
    if (!raw.portfolio || typeof raw.portfolio !== 'object' || Array.isArray(raw.portfolio)) throw new Error('portfolio must be an object');
    for (const key of Object.keys(raw.portfolio)) if (!['candidate', 'history', 'options'].includes(key)) throw new Error(`Unknown portfolio field: ${key}`);
    portfolio = assessPortfolio(raw.portfolio.candidate, raw.portfolio.history, catalog, raw.portfolio.options ?? {});
  }
  const hasWarnings = (concepts !== null && !concepts.passed_declared_diversity_rule) ||
    (portfolio !== null && (portfolio.warnings.length > 0 || portfolio.skipped_history.length > 0 || portfolio.compared_count === 0));
  process.stdout.write(JSON.stringify({
    toolkit_version: '0.1.0', synthetic_or_user_supplied_input: true,
    status: hasWarnings ? 'review_required' : 'declared_rules_passed',
    quality_verdict: null, concepts, portfolio,
  }, null, 2) + '\n');
  if (strict && hasWarnings) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Design comparison failed: ${error instanceof Error ? error.message : 'unknown error'}\n` + HELP);
  process.exitCode = 2;
}
