/**
 * Adapter-free offline comparison for the three-field fingerprint described
 * in the 22.09.2026 handover. Not imported by or connected to the Factory.
 * It cannot see typography beyond font_pair, image choices, or actual pixels.
 */
import { parsePortfolioOptions, parsePortfolioRecord } from './design-diversity.js';
export interface CurrentFingerprint {
  composition: 'atelier' | 'editorial' | 'bold' | 'minimal';
  font_pair: 'sans' | 'editorial';
  section_order: string[];
}
const COMPOSITIONS = ['atelier', 'editorial', 'bold', 'minimal'] as const;
const FONTS = ['sans', 'editorial'] as const;
const COMPONENTS = ['hero', 'services', 'process', 'about', 'contact', 'faq', 'testimonials'];
export function parseCurrentFingerprint(raw: unknown): CurrentFingerprint {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Current fingerprint must be an object');
  const obj = raw as Record<string, unknown>;
  const allowed = ['composition', 'font_pair', 'section_order'];
  if (Object.keys(obj).some((key) => !allowed.includes(key)) || allowed.some((key) => !Object.hasOwn(obj, key))) {
    throw new Error('Current fingerprint requires exactly composition, font_pair and section_order');
  }
  if (typeof obj.composition !== 'string' || !(COMPOSITIONS as readonly string[]).includes(obj.composition)) {
    throw new Error('Unsupported composition for handover fingerprint');
  }
  if (typeof obj.font_pair !== 'string' || !(FONTS as readonly string[]).includes(obj.font_pair)) {
    throw new Error('Unsupported font_pair for handover fingerprint');
  }
  if (!Array.isArray(obj.section_order) || obj.section_order.length < 1 || obj.section_order.length > 128 ||
      obj.section_order.some((entry: unknown) => typeof entry !== 'string' || !COMPONENTS.includes(entry))) {
    throw new Error('Unsupported section_order for handover fingerprint');
  }
  return {
    composition: obj.composition as CurrentFingerprint['composition'],
    font_pair: obj.font_pair as CurrentFingerprint['font_pair'],
    section_order: [...obj.section_order] as string[],
  };
}
export function assessCurrentFingerprints(rawCandidate: unknown, rawHistory: unknown, rawOptions: unknown = {}) {
  const candidate = parsePortfolioRecord(rawCandidate);
  const fingerprint = parseCurrentFingerprint(candidate.signature);
  const options = parsePortfolioOptions(rawOptions);
  if (options.near_repeat_threshold !== undefined) throw new Error('Current fingerprint comparison has no similarity threshold');
  if (!Array.isArray(rawHistory) || rawHistory.length > 10000) throw new Error('Expected a history array with at most 10000 entries');
  const history = rawHistory.map((entry: unknown) => parsePortfolioRecord(entry));
  if (new Set(history.map((record) => record.design_key)).size !== history.length) throw new Error('Duplicate historical design key');
  const selected = history.filter((record) => record.project_key !== candidate.project_key &&
    !(options.ignore_same_brand && candidate.brand_key !== null && record.brand_key === candidate.brand_key)
  ).sort((left, right) => Date.parse(right.recorded_at) - Date.parse(left.recorded_at) ||
    (left.design_key < right.design_key ? -1 : left.design_key > right.design_key ? 1 : 0)
  ).slice(0, options.limit ?? 8);
  const comparisons: Array<{
    design_key: string; same_composition: boolean; same_section_order: boolean;
    same_font_pair: boolean; same_all_fields: boolean; repetition_warning: boolean;
  }> = [];
  const skipped: Array<{ design_key: string; reason: 'incompatible_or_invalid_fingerprint' }> = [];
  for (const record of selected) {
    let previous: CurrentFingerprint;
    try { previous = parseCurrentFingerprint(record.signature); }
    catch { skipped.push({ design_key: record.design_key, reason: 'incompatible_or_invalid_fingerprint' }); continue; }
    const sameComposition = fingerprint.composition === previous.composition;
    const sameOrder = fingerprint.section_order.length === previous.section_order.length &&
      fingerprint.section_order.every((item, index) => item === previous.section_order[index]);
    const sameFont = fingerprint.font_pair === previous.font_pair;
    comparisons.push({
      design_key: record.design_key, same_composition: sameComposition,
      same_section_order: sameOrder, same_font_pair: sameFont,
      same_all_fields: sameComposition && sameOrder && sameFont,
      repetition_warning: sameComposition && sameOrder,
    });
  }
  return {
    fingerprint_contract: 'three-fields-as-described-in-2026-09-22-handover',
    selected_history_count: selected.length, compared_count: comparisons.length,
    skipped_history: skipped,
    warnings: comparisons.filter((item) => item.repetition_warning), comparisons,
    quality_verdict: null,
    limitation: 'Only declared composition, font_pair and component order. Not visual similarity. Caller must retain the existing hard gate.',
  };
}
