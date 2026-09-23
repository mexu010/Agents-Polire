import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const kit = fileURLToPath(new URL('../', import.meta.url));
function run(script, args) {
  return spawnSync(process.execPath, [join(kit, 'scripts', script), ...args], {cwd:kit, encoding:'utf8', timeout:15000});
}
function temporary(runTest) {
  const root = mkdtempSync(join(tmpdir(), 'polire-kit-'));
  try { return runTest(root); } finally { rmSync(root, {recursive:true, force:true}); }
}
function factoryTree(root) {
  mkdirSync(join(root,'src'), {recursive:true}); mkdirSync(join(root,'spec'), {recursive:true});
  writeFileSync(join(root,'package.json'), JSON.stringify({scripts:{build:'tsc --noEmit'}}));
  writeFileSync(join(root,'src/orchestrator.ts'), 'export {};\n');
  writeFileSync(join(root,'src/fixtures.ts'), 'export {};\n');
  writeFileSync(join(root,'spec/contracts.schema.json'), '{}\n');
}
test('comparison CLI outputs its synthetic example and explicit limitations', () => {
  const result = run('evaluate-designs.mjs', ['--input','fixtures/synthetic-comparison.json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'review_required');
  assert.equal(report.quality_verdict, null);
});
test('strict comparison uses exit 1 for warnings, not a parsing error', () => {
  const result = run('evaluate-designs.mjs', ['--input','fixtures/synthetic-comparison.json','--strict']);
  assert.equal(result.status, 1, result.stderr);
});
test('strict comparison passes the distinct synthetic fixture', () => {
  const result = run('evaluate-designs.mjs', ['--input','fixtures/synthetic-distinct.json','--strict']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'declared_rules_passed');
});
test('comparison refuses missing inputs and unknown arguments', () => {
  assert.equal(run('evaluate-designs.mjs', []).status, 2);
  assert.equal(run('evaluate-designs.mjs', ['--unknown']).status, 2);
});
test('comparison rejects invalid JSON without an uncaught stack trace', () => temporary((root) => {
  const file = join(root,'bad.json'); writeFileSync(file, '{');
  const result = run('evaluate-designs.mjs', ['--input',file]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /comparison failed/);
  assert.equal(result.stderr.includes('\n    at '), false);
}));
test('preflight requires an explicit source directory', () => {
  assert.equal(run('source-preflight.mjs', []).status, 2);
});
test('preflight reports missing Factory sources instead of claiming compatibility', () => temporary((root) => {
  const result = run('source-preflight.mjs', ['--root',root]);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).recognised_factory_tree, false);
}));
test('preflight inventories synthetic sources without exposing secrets or executing scripts', () => temporary((root) => {
  factoryTree(root);
  writeFileSync(join(root,'.env'), 'API_KEY=SECRET_SENTINEL');
  writeFileSync(join(root,'package.json'), JSON.stringify({scripts:{build:'echo SECRET_SENTINEL'}}));
  const before = readFileSync(join(root,'src/orchestrator.ts'),'utf8');
  const result = run('source-preflight.mjs', ['--root',root]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.recognised_factory_tree, true);
  assert.equal(report.network_requested, false);
  assert.equal(report.read_only, true);
  assert.equal(result.stdout.includes('SECRET_SENTINEL'), false);
  assert.equal(readFileSync(join(root,'src/orchestrator.ts'),'utf8'), before);
}));
test('preflight does not follow source symlinks into excluded local data', (t) => temporary((root) => {
  factoryTree(root); mkdirSync(join(root,'data'));
  writeFileSync(join(root,'data/private.txt'), 'SECRET_SENTINEL');
  try { symlinkSync(join(root,'data/private.txt'), join(root,'src/config.ts')); }
  catch (error) {
    if (['EPERM','EACCES'].includes(error?.code)) { t.skip('This OS account cannot create symlinks'); return; }
    throw error;
  }
  const result = run('source-preflight.mjs', ['--root',root]);
  assert.equal(result.status, 0, result.stderr);
  const entry = JSON.parse(result.stdout).files.find((file) => file.path === 'src/config.ts');
  assert.equal(entry.status, 'symlink_not_read');
  assert.equal('sha256' in entry, false);
}));
test('CLI help has no effects and succeeds', () => {
  assert.equal(run('source-preflight.mjs', ['--help']).status, 0);
  assert.equal(run('evaluate-designs.mjs', ['--help']).status, 0);
});
