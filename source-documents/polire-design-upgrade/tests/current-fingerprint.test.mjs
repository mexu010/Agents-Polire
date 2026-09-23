import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCurrentFingerprint, assessCurrentFingerprints } from '../dist/current-fingerprint.js';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/current-fingerprints.json', import.meta.url), 'utf8'));
const {candidate, history} = fixture;

test('current three-field structure matches the documented fingerprint', () => {
  assert.deepEqual(parseCurrentFingerprint(candidate.signature), candidate.signature);
});
test('current fingerprint detects an older repeat across the provided history', () => {
  const result = assessCurrentFingerprints(candidate, history);
  assert.equal(result.warnings.some((item) => item.design_key === 'older-repeat'), true);
  assert.equal(result.warnings.some((item) => item.design_key === 'recent-different'), false);
});
test('current fingerprint excludes repairs/revisions of the same project', () => {
  const result = assessCurrentFingerprints(candidate, history);
  assert.equal(result.comparisons.some((item) => item.design_key === 'same-project-revision'), false);
});
test('a font-only change does not defeat the composition/order warning', () => {
  const copy = structuredClone(history[1]); copy.signature.font_pair = 'editorial';
  const result = assessCurrentFingerprints(candidate, [copy]);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].same_all_fields, false);
});
test('current fingerprint rejects unknown labels, extra fields and unbound components', () => {
  assert.throws(() => parseCurrentFingerprint({...candidate.signature, composition:'luxury'}));
  assert.throws(() => parseCurrentFingerprint({...candidate.signature, color:'blue'}));
  assert.throws(() => parseCurrentFingerprint({...candidate.signature, section_order:['invented']}));
});
test('incompatible fingerprints are gaps rather than evidence of variety', () => {
  const copy = structuredClone(history[0]); copy.signature = {version:2};
  const result = assessCurrentFingerprints(candidate, [copy]);
  assert.equal(result.compared_count, 0);
  assert.equal(result.skipped_history.length, 1);
  assert.equal(result.quality_verdict, null);
});
test('current fingerprint has no guessed similarity score', () => {
  assert.throws(() => assessCurrentFingerprints(candidate, history, {near_repeat_threshold:0.9}), /no similarity threshold/);
});
test('current fingerprint CLI reports repeats and has a strict warning exit code', () => {
  const result = spawnSync(process.execPath, ['scripts/check-current-fingerprints.mjs','--input','fixtures/current-fingerprints.json','--strict'], {
    cwd:fileURLToPath(new URL('../', import.meta.url)), encoding:'utf8', timeout:15000,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'review_required');
});
