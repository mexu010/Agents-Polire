import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseCatalog, parseSignature, parseConcepts, compareSignatures, assessConceptSet,
  parsePortfolioRecord, parsePortfolioOptions, assessPortfolio,
} from '../dist/design-diversity.js';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/synthetic-comparison.json', import.meta.url), 'utf8'));
const clone = (value) => structuredClone(value);
const catalog = parseCatalog(fixture.catalog);
const [a, b, c] = parseConcepts(fixture.concepts, catalog);
const { candidate, history } = fixture.portfolio;

test('valid canonical signature roundtrips without mutating its input', () => {
  const original = clone(fixture.concepts[0].signature);
  const parsed = parseSignature(original, catalog);
  parsed.features.section_order.push('faq');
  assert.equal(original.features.section_order.includes('faq'), false);
});
test('unknown or synonym capability tokens are rejected', () => {
  const altered = clone(a.signature); altered.features.composition = 'modern-atelier';
  assert.throws(() => parseSignature(altered, catalog), /unsupported capability/);
});
test('extra signature fields cannot fabricate diversity', () => {
  const altered = clone(a.signature); altered.features.background_color = 'orange';
  assert.throws(() => parseSignature(altered, catalog), /unknown field/);
});
test('missing data cannot be counted as novelty', () => {
  const altered = clone(a.signature); delete altered.features.hero_structure;
  assert.throws(() => parseSignature(altered, catalog), /missing field/);
});
test('old signature versions are not silently upgraded', () => {
  const altered = clone(a.signature); altered.version = 1;
  assert.throws(() => parseSignature(altered, catalog), /unsupported version/);
});
test('capabilities version must match the supplied catalog', () => {
  const altered = clone(a.signature); altered.capabilities_version = 'other';
  assert.throws(() => parseSignature(altered, catalog), /version mismatch/);
});
test('unknown section components are rejected', () => {
  const altered = clone(a.signature); altered.features.section_order.push('invented-widget');
  assert.throws(() => parseSignature(altered, catalog), /unsupported component/);
});
test('catalog disallows duplicate tokens and missing feature lists', () => {
  const altered = clone(fixture.catalog); altered.features.composition.push('atelier');
  assert.throws(() => parseCatalog(altered), /duplicate/);
  delete altered.features.composition;
  assert.throws(() => parseCatalog(altered), /missing field/);
});
test('an exact repeat has no declared difference', () => {
  const result = compareSignatures(a.signature, a.signature);
  assert.equal(result.declared_similarity, 1);
  assert.deepEqual(result.different, []);
  assert.equal(result.same_composition_and_order, true);
});
test('comparison does not report a visual quality score', () => {
  const result = compareSignatures(a.signature, b.signature);
  assert.equal(result.interpretation, 'declared_features_not_visual_quality');
  assert.equal('quality_score' in result, false);
});
test('typography and density alone are insufficient alternatives', () => {
  const altered = clone(a.signature);
  altered.features.font_pair = 'editorial'; altered.features.density = 'compact';
  const result = assessConceptSet([a, { concept_key: 'limited-change', signature: parseSignature(altered, catalog) }]);
  assert.equal(result.passed_declared_diversity_rule, false);
  assert.equal(result.comparisons[0].structural_differences.length, 0);
});
test('three structurally different synthetic directions pass the declared rule', () => {
  const result = assessConceptSet([a, b, c]);
  assert.equal(result.comparisons.length, 3);
  assert.equal(result.passed_declared_diversity_rule, true);
});
test('all concept pairs are checked, including the first and third', () => {
  const result = assessConceptSet([a, b, { concept_key: 'copy-of-a', signature: a.signature }]);
  assert.equal(result.passed_declared_diversity_rule, false);
  assert.equal(result.comparisons.find((p) => p.right === 'copy-of-a' && p.left === a.concept_key).distinct_enough, false);
});
test('duplicate concept identifiers are rejected', () => {
  assert.throws(() => parseConcepts([fixture.concepts[0], fixture.concepts[0]], catalog), /duplicate/);
});
test('invalid thresholds and policies are rejected', () => {
  for (const options of [{limit:0}, {limit:1.5}, {near_repeat_threshold:NaN}, {ignore_same_brand:'yes'}, {invented:true}]) {
    assert.throws(() => parsePortfolioOptions(options));
  }
  assert.throws(() => assessConceptSet([a,b], {minimum_structural_differences:0}));
});
test('an older matching design is detected even when the latest differs', () => {
  const result = assessPortfolio(candidate, history, catalog);
  assert.deepEqual(result.warnings.map((item) => item.design_key), ['older-repeat']);
  assert.equal(result.comparisons[0].design_key, 'recent-different');
});
test('same project revisions do not trigger the portfolio repetition warning', () => {
  const result = assessPortfolio(candidate, history, catalog);
  assert.equal(result.excluded_by_project_or_brand, 1);
  assert.equal(result.comparisons.some((item) => item.design_key === 'same-project-revision'), false);
});
test('same-brand exceptions require explicit policy and a known brand', () => {
  const prior = clone(history[1]); prior.brand_key = candidate.brand_key;
  assert.equal(assessPortfolio(candidate, [prior], catalog).warnings.length, 1);
  assert.equal(assessPortfolio(candidate, [prior], catalog, {ignore_same_brand:true}).compared_count, 0);
  const unknownCandidate = clone(candidate); unknownCandidate.brand_key = null;
  prior.brand_key = null;
  assert.equal(assessPortfolio(unknownCandidate, [prior], catalog, {ignore_same_brand:true}).compared_count, 1);
});
test('legacy/incompatible data remains a visible comparison gap', () => {
  const result = assessPortfolio(candidate, history, catalog);
  assert.equal(result.skipped_history.length, 1);
  assert.equal(result.skipped_history[0].design_key, 'legacy-record');
  assert.equal(result.comparison_coverage, 2 / 3);
});
test('empty history is not declared original', () => {
  const result = assessPortfolio(candidate, [], catalog);
  assert.equal(result.compared_count, 0);
  assert.equal(result.comparison_coverage, null);
  assert.match(result.limitation, /NOT a finding of originality/);
});
test('lookback is applied after filtering and sorting, not source array order', () => {
  const result = assessPortfolio(candidate, [...history].reverse(), catalog, {limit:1});
  assert.equal(result.compared_count, 1);
  assert.equal(result.comparisons[0].design_key, 'recent-different');
});
test('repeated history IDs are rejected instead of affecting counts', () => {
  assert.throws(() => assessPortfolio(candidate, [history[0], history[0]], catalog), /duplicate design key/);
});
test('ambiguous or invalid timestamps are rejected', () => {
  for (const recorded_at of ['yesterday', '2026-02-30T10:00:00.000Z', '2026-09-22T11:00:00+02:00']) {
    assert.throws(() => parsePortfolioRecord({...candidate, recorded_at}), /timestamp/);
  }
});
test('input objects are not mutated by history sorting', () => {
  const before = JSON.stringify(history);
  assessPortfolio(candidate, history, catalog);
  assert.equal(JSON.stringify(history), before);
});
test('section order is significant and repeated supported sections remain representable', () => {
  const changed = clone(a.signature); changed.features.section_order = ['hero','services','about','contact'];
  const result = compareSignatures(a.signature, parseSignature(changed, catalog));
  assert.deepEqual(result.different, ['section_order']);
  changed.features.section_order = ['hero','services','services','contact'];
  assert.doesNotThrow(() => parseSignature(changed, catalog));
});
test('direct comparison rejects mismatched capability versions', () => {
  const changed = clone(a.signature); changed.capabilities_version = 'different-version';
  assert.throws(() => compareSignatures(a.signature, changed), /Incompatible/);
});
