import type { JsonObject } from "./contracts.js";

const levelScore: Record<string, number> = {
  unusable: 0,
  major_friction: 25,
  usable_with_friction: 50,
  minor_friction: 75,
  no_material_issue: 100,
};
const assessmentScore: Record<string, number> = {
  none: 0,
  low: 25,
  moderate: 50,
  high: 75,
  very_high: 100,
};
const weights = {
  redesign_need: 0.25,
  company_value: 0.2,
  budget_capacity: 0.15,
  previous_agency_purchase_signal: 0.15,
  website_importance: 0.1,
  conversion_improvement: 0.1,
  contactability: 0.05,
} as const;

export function dimensionScore(
  dimension: JsonObject | undefined,
): number | null {
  return dimension?.level ? (levelScore[dimension.level] ?? null) : null;
}
export function assessmentValue(
  assessment: JsonObject | undefined,
): number | null {
  return assessment?.level ? (assessmentScore[assessment.level] ?? null) : null;
}
export function fitValue(fit: JsonObject | undefined): number | null {
  return fit?.assessment === "supported"
    ? 100
    : fit?.assessment === "adjacent"
      ? 50
      : fit?.assessment === "excluded"
        ? 0
        : null;
}

function contactability(profile: JsonObject): number | null {
  const contacts = profile.contacts ?? [];
  if (
    contacts.some(
      (c: JsonObject) =>
        c.kind === "email" ||
        c.kind === "contact_page" ||
        c.kind === "booking_page",
    )
  )
    return 100;
  if (contacts.some((c: JsonObject) => c.kind === "phone")) return 50;
  return null;
}
function priority(score: number): string {
  return score < 60
    ? "skip"
    : score < 75
      ? "database"
      : score < 85
        ? "research"
        : "demo_candidate";
}

export function scoreQualification(
  profile: JsonObject,
  audit: JsonObject,
  data: JsonObject,
  _campaign?: JsonObject,
  _offer?: JsonObject,
  _template?: JsonObject,
): JsonObject {
  const dims = audit.dimensions ?? {};
  const qualityRaw = audit.quality_score;
  const factors: Record<string, number | null> = {
    redesign_need:
      qualityRaw === null || qualityRaw === undefined ? null : 100 - qualityRaw,
    company_value: assessmentValue(data.company_value),
    budget_capacity: assessmentValue(data.budget_capacity),
    previous_agency_purchase_signal: profile.agency?.score ?? null,
    website_importance: assessmentValue(data.website_importance),
    conversion_improvement:
      dimensionScore(dims.conversion) === null
        ? null
        : 100 - (dimensionScore(dims.conversion) as number),
    contactability: contactability(profile),
  };
  let lower = 0,
    coverage = 0;
  for (const [name, weight] of Object.entries(weights)) {
    const value = factors[name];
    if (value !== null) {
      lower += value * weight;
      coverage += weight;
    }
  }
  const upper = lower + (1 - coverage) * 100;
  const offerFit = fitValue(data.offer_fit),
    implementationFit = fitValue(data.implementation_fit);
  const identity = (profile.facts ?? []).some(
    (f: JsonObject) =>
      f.field === "company_name" && f.value && f.verification !== "conflicting",
  );
  const ch = (profile.facts ?? []).some(
    (f: JsonObject) =>
      f.field === "country" &&
      f.value === "CH" &&
      f.verification !== "conflicting",
  );
  const major = (audit.issues ?? []).some(
    (issue: JsonObject) =>
      ["major", "blocker"].includes(issue.severity) &&
      issue.suggested_fix_target === "site_spec",
  );
  let decision: string;
  if (
    offerFit === 0 ||
    implementationFit === 0 ||
    (data.hard_exclusion_rule_ids ?? []).length
  )
    decision = "reject";
  else if (
    !identity ||
    !ch ||
    offerFit !== 100 ||
    implementationFit !== 100 ||
    audit.quality_score === null ||
    audit.quality_score === undefined ||
    (profile.contradictions ?? []).some(
      (g: JsonObject) => g.reason === "conflicting",
    )
  )
    decision = "manual_review";
  else if (coverage < 1 && priority(upper) !== priority(lower))
    decision = "manual_review";
  else if (lower >= 85 && major) decision = "proceed";
  else decision = "low_priority";
  return {
    offer_fit: offerFit,
    implementation_fit: implementationFit,
    opportunity_score: coverage === 1 ? lower : null,
    lower_bound: lower,
    upper_bound: upper,
    coverage,
    priority: identity && ch ? priority(lower) : null,
    decision,
    reason_codes:
      decision === "proceed" ? ["all_proceed_gates_met"] : [decision],
    supporting_issue_ids: data.supporting_issue_ids ?? [],
  };
}
