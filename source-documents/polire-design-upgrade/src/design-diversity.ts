/**
 * Standalone proposal. No database, model, browser or network access.
 * A signature must be derived by trusted runtime code from a supported,
 * resolved renderer plan. Model-authored labels are not evidence of variety.
 * Results describe declared design differences, NOT visual quality.
 */
export const SCALAR_FEATURES = [
  'composition', 'hero_structure', 'mobile_structure', 'section_rhythm',
  'font_pair', 'image_strategy', 'service_layout', 'density',
] as const;
export const FEATURES = [...SCALAR_FEATURES, 'section_order'] as const;
export type ScalarFeature = (typeof SCALAR_FEATURES)[number];
export type Feature = (typeof FEATURES)[number];
export const STRUCTURAL_FEATURES: readonly Feature[] = [
  'hero_structure', 'mobile_structure', 'section_rhythm',
  'image_strategy', 'service_layout', 'section_order',
];
export const WEIGHTS: Readonly<Record<Feature, number>> = {
  composition: 2, hero_structure: 4, mobile_structure: 3,
  section_rhythm: 3, font_pair: 2, image_strategy: 3,
  service_layout: 3, density: 1, section_order: 4,
};
export interface CapabilityCatalog {
  version: string;
  features: Record<ScalarFeature, string[]>;
  components: string[];
}
export interface DesignSignature {
  version: 2;
  capabilities_version: string;
  features: Record<ScalarFeature, string> & { section_order: string[] };
}
export interface Comparison {
  matched: Feature[];
  different: Feature[];
  structural_differences: Feature[];
  declared_similarity: number;
  same_composition_and_order: boolean;
  interpretation: 'declared_features_not_visual_quality';
}
export interface Concept {
  concept_key: string;
  signature: DesignSignature;
}
export interface PortfolioRecord {
  design_key: string;
  project_key: string;
  brand_key: string | null;
  recorded_at: string;
  signature: unknown;
}
export interface PortfolioOptions {
  limit?: number;
  near_repeat_threshold?: number;
  /** Set only by an explicit studio policy, never inferred by the model. */
  ignore_same_brand?: boolean;
}

function fail(message: string): never { throw new Error(message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(`${label}: expected an object`);
  }
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${label}: unknown field ${key}`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) fail(`${label}: missing field ${key}`);
  }
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)) {
    return fail(`${label}: expected a stable identifier`);
  }
  return value;
}
function token(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value)) {
    return fail(`${label}: expected a canonical lower-case capability token`);
  }
  return value;
}
function tokens(value: unknown, label: string, allowDuplicates = false): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 128) {
    return fail(`${label}: expected 1 to 128 entries`);
  }
  const result = value.map((entry: unknown) => token(entry, label));
  if (!allowDuplicates && new Set(result).size !== result.length) fail(`${label}: duplicate entries`);
  return result;
}
function integer(value: unknown, minimum: number, maximum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    return fail(`${label}: expected an integer between ${minimum} and ${maximum}`);
  }
  return value;
}
function same(left: DesignSignature, right: DesignSignature, feature: Feature): boolean {
  if (feature !== 'section_order') return left.features[feature] === right.features[feature];
  const a = left.features.section_order;
  const b = right.features.section_order;
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
function sameCatalog(left: DesignSignature, right: DesignSignature): void {
  if (left.version !== 2 || right.version !== 2 || left.capabilities_version !== right.capabilities_version) {
    fail('Incompatible signature versions; migrate from verified plans or report a comparison gap');
  }
}

export function parseCatalog(raw: unknown): CapabilityCatalog {
  const root = object(raw, 'catalog');
  keys(root, ['version', 'features', 'components'], 'catalog');
  const entries = object(root.features, 'catalog.features');
  keys(entries, SCALAR_FEATURES, 'catalog.features');
  const features = {} as Record<ScalarFeature, string[]>;
  for (const feature of SCALAR_FEATURES) features[feature] = tokens(entries[feature], `catalog.${feature}`);
  return { version: id(root.version, 'catalog.version'), features, components: tokens(root.components, 'catalog.components') };
}

export function parseSignature(raw: unknown, catalog: CapabilityCatalog): DesignSignature {
  const root = object(raw, 'signature');
  keys(root, ['version', 'capabilities_version', 'features'], 'signature');
  if (root.version !== 2) fail('signature.version: unsupported version');
  if (root.capabilities_version !== catalog.version) fail('signature: capability version mismatch');
  const entries = object(root.features, 'signature.features');
  keys(entries, FEATURES, 'signature.features');
  const features = {} as DesignSignature['features'];
  for (const feature of SCALAR_FEATURES) {
    const value = token(entries[feature], `signature.${feature}`);
    if (!catalog.features[feature].includes(value)) fail(`signature.${feature}: unsupported capability ${value}`);
    features[feature] = value;
  }
  const order = tokens(entries.section_order, 'signature.section_order', true);
  for (const component of order) {
    if (!catalog.components.includes(component)) fail(`signature.section_order: unsupported component ${component}`);
  }
  features.section_order = order;
  return { version: 2, capabilities_version: catalog.version, features };
}

export function compareSignatures(left: DesignSignature, right: DesignSignature): Comparison {
  sameCatalog(left, right);
  const matched = FEATURES.filter((feature) => same(left, right, feature));
  const different = FEATURES.filter((feature) => !same(left, right, feature));
  const weight = (items: readonly Feature[]) => items.reduce((sum, feature) => sum + WEIGHTS[feature], 0);
  return {
    matched, different,
    structural_differences: different.filter((feature) => STRUCTURAL_FEATURES.includes(feature)),
    declared_similarity: weight(matched) / weight(FEATURES),
    same_composition_and_order: same(left, right, 'composition') && same(left, right, 'section_order'),
    interpretation: 'declared_features_not_visual_quality',
  };
}

export function parseConcepts(raw: unknown, catalog: CapabilityCatalog): Concept[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 6) fail('concepts: expected 2 to 6 concepts');
  const seen = new Set<string>();
  return raw.map((entry: unknown) => {
    const item = object(entry, 'concept');
    keys(item, ['concept_key', 'signature'], 'concept');
    const conceptKey = id(item.concept_key, 'concept.concept_key');
    if (seen.has(conceptKey)) fail('concepts: duplicate concept key');
    seen.add(conceptKey);
    return { concept_key: conceptKey, signature: parseSignature(item.signature, catalog) };
  });
}

export function assessConceptSet(
  concepts: readonly Concept[],
  options: { minimum_differences?: number; minimum_structural_differences?: number } = {},
) {
  integer(concepts.length, 2, 6, 'concept count');
  const minimum = integer(options.minimum_differences ?? 4, 1, FEATURES.length, 'minimum_differences');
  const structuralMinimum = integer(options.minimum_structural_differences ?? 2, 1, STRUCTURAL_FEATURES.length, 'minimum_structural_differences');
  const comparisons: Array<Comparison & { left: string; right: string; distinct_enough: boolean }> = [];
  for (let a = 0; a < concepts.length; a += 1) {
    for (let b = a + 1; b < concepts.length; b += 1) {
      const left = concepts[a]!;
      const right = concepts[b]!;
      const comparison = compareSignatures(left.signature, right.signature);
      comparisons.push({
        left: left.concept_key, right: right.concept_key, ...comparison,
        distinct_enough: comparison.different.length >= minimum && comparison.structural_differences.length >= structuralMinimum,
      });
    }
  }
  return {
    passed_declared_diversity_rule: comparisons.every((item) => item.distinct_enough),
    rule: { minimum_differences: minimum, minimum_structural_differences: structuralMinimum },
    comparisons,
    limitation: 'Studio heuristic on declarations. Requires independent review of actual renders.',
  };
}

export function parsePortfolioRecord(raw: unknown): PortfolioRecord {
  const root = object(raw, 'portfolio record');
  keys(root, ['design_key', 'project_key', 'brand_key', 'recorded_at', 'signature'], 'portfolio record');
  if (typeof root.recorded_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(root.recorded_at)) {
    fail('recorded_at: expected a canonical UTC ISO timestamp');
  }
  const time = new Date(root.recorded_at);
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== root.recorded_at) fail('recorded_at: invalid timestamp');
  return {
    design_key: id(root.design_key, 'design_key'),
    project_key: id(root.project_key, 'project_key'),
    brand_key: root.brand_key === null ? null : id(root.brand_key, 'brand_key'),
    recorded_at: root.recorded_at,
    signature: root.signature,
  };
}

export function parsePortfolioOptions(raw: unknown): PortfolioOptions {
  const root = object(raw, 'portfolio options');
  for (const key of Object.keys(root)) {
    if (!['limit', 'near_repeat_threshold', 'ignore_same_brand'].includes(key)) fail(`portfolio options: unknown field ${key}`);
  }
  const result: PortfolioOptions = {};
  if (root.limit !== undefined) result.limit = integer(root.limit, 1, 64, 'limit');
  if (root.near_repeat_threshold !== undefined) {
    const value = root.near_repeat_threshold;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) fail('near_repeat_threshold: expected 0 to 1');
    result.near_repeat_threshold = value;
  }
  if (root.ignore_same_brand !== undefined) {
    if (typeof root.ignore_same_brand !== 'boolean') fail('ignore_same_brand: expected boolean');
    result.ignore_same_brand = root.ignore_same_brand;
  }
  return result;
}

export function assessPortfolio(
  rawCandidate: unknown,
  rawHistory: unknown,
  catalog: CapabilityCatalog,
  rawOptions: unknown = {},
) {
  const candidate = parsePortfolioRecord(rawCandidate);
  const signature = parseSignature(candidate.signature, catalog);
  const options = parsePortfolioOptions(rawOptions);
  const limit = options.limit ?? 8;
  const threshold = options.near_repeat_threshold ?? 0.8;
  if (!Array.isArray(rawHistory) || rawHistory.length > 10000) fail('history: expected an array with at most 10000 entries');
  const history = rawHistory.map((item: unknown) => parsePortfolioRecord(item));
  const seen = new Set<string>();
  for (const record of history) {
    if (seen.has(record.design_key)) fail('history: duplicate design key');
    seen.add(record.design_key);
  }
  const eligible = history.filter((record) =>
    record.project_key !== candidate.project_key &&
    !(options.ignore_same_brand && candidate.brand_key !== null && record.brand_key === candidate.brand_key),
  ).sort((a, b) => {
    const timeDifference = Date.parse(b.recorded_at) - Date.parse(a.recorded_at);
    return timeDifference || (a.design_key < b.design_key ? -1 : a.design_key > b.design_key ? 1 : 0);
  });
  const selected = eligible.slice(0, limit);
  const skipped: Array<{ design_key: string; reason: 'incompatible_or_invalid_signature' }> = [];
  const comparisons: Array<Comparison & { design_key: string; repeat_warning: boolean }> = [];
  for (const record of selected) {
    let prior: DesignSignature;
    try { prior = parseSignature(record.signature, catalog); }
    catch {
      skipped.push({ design_key: record.design_key, reason: 'incompatible_or_invalid_signature' });
      continue;
    }
    const comparison = compareSignatures(signature, prior);
    comparisons.push({
      design_key: record.design_key, ...comparison,
      repeat_warning: comparison.declared_similarity >= threshold || comparison.same_composition_and_order,
    });
  }
  return {
    compared_count: comparisons.length,
    available_history_count: history.length,
    excluded_by_project_or_brand: history.length - eligible.length,
    selected_history_count: selected.length,
    comparison_coverage: selected.length === 0 ? null : comparisons.length / selected.length,
    skipped_history: skipped,
    warnings: comparisons.filter((item) => item.repeat_warning),
    comparisons,
    rule: { limit, near_repeat_threshold: threshold, ignore_same_brand: options.ignore_same_brand ?? false },
    preserves_existing_gate: 'Caller MUST retain current hard repetition validation. This helper emits advisory results only.',
    limitation: comparisons.length === 0
      ? 'No comparable evidence; this is NOT a finding of originality.'
      : 'Declared structural comparison only; not a screenshot similarity or quality measurement.',
  };
}
