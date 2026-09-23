import { hash, type JsonObject } from "./contracts.js";
import {
  DESIGN_CAPABILITIES_VERSION,
  DESIGN_PROFILES,
  resolveDesignProfile,
} from "./design-capabilities.js";
import {
  parseCatalog,
  parseSignature,
  compareSignatures,
} from "./design-diversity.js";

/** Adapter for the separately tested kit. All tokens come from real renderer capabilities. */
export function designCapabilityCatalog() {
  const profiles = Object.values(DESIGN_PROFILES);
  const values = (field: keyof (typeof profiles)[number]) => [
    ...new Set(profiles.map((p) => p[field])),
  ];
  return parseCatalog({
    version: DESIGN_CAPABILITIES_VERSION,
    features: {
      composition: values("composition"),
      hero_structure: values("hero_arrangement"),
      mobile_structure: values("mobile_arrangement"),
      section_rhythm: values("section_rhythm"),
      font_pair: values("font_pair"),
      image_strategy: [...values("image_treatment"), "type-only"],
      service_layout: values("service_layout"),
      density: ["compact", "comfortable", "generous"],
    },
    components: [
      "hero",
      "services",
      "process",
      "about",
      "contact",
      "faq",
      "testimonials",
    ],
  });
}

export const COMPOSITIONS = [
  "atelier",
  "editorial",
  "bold",
  "minimal",
] as const;

/** Colours and copy deliberately do not make an otherwise repeated layout original. */
export function designFingerprint(brief: JsonObject): JsonObject {
  const profile = resolveDesignProfile(brief.theme);
  const order = brief.pages.flatMap((page: JsonObject) =>
    page.sections.map((section: JsonObject) => section.component),
  );
  const hasImage = brief.pages.some((page: JsonObject) =>
    page.sections.some(
      (section: JsonObject) => typeof section.asset_id === "string",
    ),
  );
  return {
    composition: brief.theme.composition,
    font_pair: brief.theme.font_pair,
    section_order: order,
    ...(profile
      ? {
          signature: parseSignature(
            {
              version: 2,
              capabilities_version: DESIGN_CAPABILITIES_VERSION,
              features: {
                composition: profile.composition,
                font_pair: profile.font_pair,
                section_order: order,
                hero_structure: profile.hero_arrangement,
                mobile_structure: profile.mobile_arrangement,
                section_rhythm: profile.section_rhythm,
                image_strategy: hasImage
                  ? profile.image_treatment
                  : "type-only",
                service_layout: profile.service_layout,
                density: brief.theme.spacing,
              },
            },
            designCapabilityCatalog(),
          ),
        }
      : {
          signature_gap:
            "Altbestand ohne aufgelöstes Designprofil; nur Komposition, Schrift und Abschnittsfolge vergleichbar.",
        }),
  };
}

export function reviewDesignHistory(
  brief: JsonObject,
  history: JsonObject[],
): JsonObject {
  const current = designFingerprint(brief),
    warnings: JsonObject[] = [],
    gaps: JsonObject[] = [];
  let compared = 0;
  for (const [index, prior] of history.slice(0, 8).entries()) {
    if (
      prior.composition === current.composition &&
      hash(prior.section_order) === hash(current.section_order)
    )
      warnings.push({
        history_index: index,
        reason: "Gleiche Komposition und Abschnittsfolge im Portfolio.",
      });
    try {
      const a = parseSignature(current.signature, designCapabilityCatalog());
      const b = parseSignature(prior.signature, designCapabilityCatalog());
      if (
        prior.composition !== b.features.composition ||
        prior.font_pair !== b.features.font_pair ||
        hash(prior.section_order) !== hash(b.features.section_order)
      )
        throw new Error("Stored design summary does not match its signature");
      const comparison = compareSignatures(a, b);
      compared++;
      if (
        comparison.declared_similarity >= 0.8 &&
        !warnings.some((w) => w.history_index === index)
      )
        warnings.push({
          history_index: index,
          reason: "Viele übereinstimmende aufgelöste Gestaltungsmerkmale.",
          comparison,
        });
    } catch {
      gaps.push({
        history_index: index,
        reason:
          "Keine kompatible erweiterte Signatur; fehlende Felder belegen keine Neuheit.",
      });
    }
  }
  return {
    compared_count: compared,
    available_count: Math.min(history.length, 8),
    warnings,
    gaps,
    limitation:
      "Studio-Heuristik, kein visuelles Qualitätsurteil. Keine Fälle bedeuten keinen Originalitätsnachweis.",
  };
}

export function validateDesignPlan(data: JsonObject, input: JsonObject): void {
  resolveDesignProfile(data.theme ?? {});
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
  const hasDeliveredImages = Object.hasOwn(input, "images");
  const deliveredImages = new Set<string>(
    (Array.isArray(input.images) ? input.images : []).map(
      (image: JsonObject) => image.evidence_id,
    ),
  );
  const deliveredScreenshots = new Set<string>(
    (Array.isArray(input.evidence) ? input.evidence : [])
      .filter((item: JsonObject) => item.kind === "screenshot")
      .map((item: JsonObject) => item.evidence_id),
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
    if (observation.basis === "visual") {
      if (!ref.image_evidence_ids.length)
        throw new Error(
          "Visual design observation requires an inspected image",
        );
      if (
        hasDeliveredImages &&
        !ref.image_evidence_ids.some(
          (evidenceId: string) =>
            deliveredImages.has(evidenceId) &&
            deliveredScreenshots.has(evidenceId),
        )
      )
        throw new Error(
          "Visual design observation requires a delivered screenshot image with matching evidence",
        );
    }
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
