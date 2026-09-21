import { hash, type JsonObject } from "./contracts.js";

export const COMPOSITIONS = [
  "atelier",
  "editorial",
  "bold",
  "minimal",
] as const;

/** Colours and copy deliberately do not make an otherwise repeated layout original. */
export function designFingerprint(brief: JsonObject): JsonObject {
  return {
    composition: brief.theme.composition,
    font_pair: brief.theme.font_pair,
    section_order: brief.pages.flatMap((page: JsonObject) =>
      page.sections.map((section: JsonObject) => section.component),
    ),
  };
}

export function validateDesignPlan(data: JsonObject, input: JsonObject): void {
  const research = input.design_research;
  if (!research) return; // Legacy jobs retain their original contract.
  const plan = data.design_plan;
  if (!plan || !COMPOSITIONS.includes(data.theme?.composition))
    throw new Error(
      "Design research requires a design_plan and supported composition",
    );
  const references = new Map<string, JsonObject>(
    research.references.map((ref: JsonObject) => [ref.reference_id, ref]),
  );
  if (research.status === "unavailable")
    throw new Error(
      "Design research missing: supply readable references before designing",
    );
  if (references.size && !plan.reference_ids.length)
    throw new Error("Design plan must use at least one inspected reference");
  const used = new Set<string>(plan.reference_ids);
  if (used.size !== plan.reference_ids.length)
    throw new Error("Duplicate design reference");
  for (const ref of used) {
    if (!references.has(ref))
      throw new Error(`Design reference does not exist: ${ref}`);
    if (
      !plan.observations.some((item: JsonObject) => item.reference_id === ref)
    )
      throw new Error(
        "Every design reference needs an observation and application",
      );
  }
  for (const observation of plan.observations) {
    const ref = references.get(observation.reference_id);
    if (!ref || !used.has(observation.reference_id))
      throw new Error("Observation has an unselected design reference");
    if (observation.basis === "visual" && !ref.image_evidence_ids.length)
      throw new Error("Visual design observation requires an inspected image");
    if (observation.basis === "text" && !ref.evidence_ids.length)
      throw new Error("Text design observation requires source evidence");
  }
  const alternatives = new Set(
    plan.alternatives.map((item: JsonObject) => item.composition),
  );
  if (alternatives.size < 2 || alternatives.has(data.theme.composition))
    throw new Error("Design alternatives must contain two other compositions");
  const previous = research.recent_designs[0];
  const current = designFingerprint(data);
  if (
    previous &&
    previous.composition === current.composition &&
    hash(previous.section_order) === hash(current.section_order)
  )
    throw new Error(
      "Design repeats the previous composition and section order; change the structure, not just colour or typography",
    );
}
