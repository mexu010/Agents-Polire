import { hash, validate, type JsonObject } from "./contracts.js";
import {
  DESIGN_CAPABILITIES_VERSION,
  DESIGN_PROFILES,
  type DesignProfileId,
} from "./design-capabilities.js";
import { assessConceptSet } from "./design-diversity.js";
import { designFingerprint } from "./design-policy.js";
import { assertCopyPolicy } from "./copy-policy.js";

export type AgentTask = "design_exploration";
export function taskSchema(agent: string, task?: AgentTask): string {
  if (task !== undefined && task !== "design_exploration")
    throw new Error("Unknown agent task");
  if (task && agent !== "strategist")
    throw new Error("Exploration belongs to the existing Strategist role");
  return task
    ? "DesignExploration"
    : agent === "qa"
      ? "QA"
      : agent[0].toUpperCase() + agent.slice(1);
}

export function conceptTheme(profileId: string): JsonObject {
  const profile = DESIGN_PROFILES[profileId as DesignProfileId];
  if (!profile) throw new Error("Unknown concept capability");
  return {
    composition: profile.composition,
    font_pair: profile.font_pair,
    design_profile: profile.id,
    palette: "light",
    accent_hex: "#285c52",
    spacing: "comfortable",
    motion: "none",
  };
}

/** Shared factual content is constructed once. Concepts cannot add claims or choose different assets. */
export function comparisonContent(context: JsonObject): JsonObject {
  const facts = (context.profile.facts as JsonObject[]).filter(
    (f) =>
      typeof f.value === "string" &&
      f.value.trim() &&
      !["unknown", "conflicting"].includes(f.verification),
  );
  const name = facts.find((f) => f.field === "company_name");
  const services = facts.filter((f) => f.field === "service").slice(0, 4);
  if (!name || !services.length)
    throw new Error("Concept previews need accepted company and service facts");
  const factual = (fact: JsonObject) => {
    assertCopyPolicy(fact.value, "factual", [fact.value]);
    return { text: fact.value, kind: "factual", fact_ids: [fact.fact_id] };
  };
  const editorial = (text: string) => {
    assertCopyPolicy(text, "editorial", []);
    return { text, kind: "editorial", fact_ids: [] };
  };
  const asset =
    context.approvedAssets?.find((candidate: JsonObject) =>
      ["photo", "illustration"].includes(candidate.kind),
    )?.asset_id ?? null;
  const section = (
    component: string,
    heading: JsonObject,
    body: JsonObject[],
    items: JsonObject[] = [],
  ) => ({
    section_id: `concept-${component}`,
    component,
    variant: "stacked",
    heading,
    body,
    items,
    cta: null,
    asset_id: null,
    addressed_issue_ids: [],
  });
  const hero = {
    ...section("hero", factual(name), services.map(factual)),
    asset_id: asset,
    cta: {
      label: editorial("Kontakt ansehen"),
      target: "section",
      target_ref: "concept-contact",
    },
  };
  return validate("SiteSpec", {
    template_id: context.template.template_id,
    template_version: context.template.version,
    locale: context.campaign.locale,
    theme: conceptTheme("service-index"),
    navigation: [],
    pages: [
      {
        route: "/",
        title: factual(name),
        meta_description: factual(services[0]),
        sections: [
          hero,
          section(
            "services",
            editorial("Leistungen"),
            [],
            services.map((f) => ({
              title: factual(f),
              text: editorial("Mehr erfahren"),
            })),
          ),
          section("contact", editorial("Kontakt"), [
            editorial("Kontaktangaben ansehen."),
          ]),
        ],
      },
    ],
    asset_ids: asset ? [asset] : [],
    unresolved_requirements: [],
  });
}

export function miniSiteSpec(
  content: JsonObject,
  concept: JsonObject,
): JsonObject {
  return validate("SiteSpec", {
    ...structuredClone(content),
    theme: conceptTheme(concept.design_profile),
  });
}

/** Operator-facing descriptions come from implemented profiles, not unverified model prose. */
const CONCEPT_DESCRIPTIONS: Record<
  DesignProfileId,
  { title: string; rationale: string; tradeoff: string }
> = {
  "editorial-spread": {
    title: "Redaktionelle Doppelseite",
    rationale:
      "Serifentitel über einer asymmetrischen Textfläche; nummerierte Leistungen. Mobil folgen Titel, Text und ein optionales freigegebenes Bild untereinander.",
    tradeoff:
      "Mehr Fläche für Typografie und Abstände; der Inhalt benötigt mehr Scrollstrecke als im Leistungsindex.",
  },
  "service-index": {
    title: "Kompakter Leistungsindex",
    rationale:
      "Sans-Serif-Typografie, kompakter Einstieg und nummeriertes Leistungsverzeichnis. Die Spalten werden mobil als einzelne Zeilen angeordnet.",
    tradeoff:
      "Informationen stehen im Vordergrund. Die Gestaltung hat weniger grosse typografische Flächen als das Plakat.",
  },
  "type-poster": {
    title: "Typografisches Plakat",
    rationale:
      "Grosse Versaltitel, Farbflächen und kontrastreiche Leistungsblöcke. Mobil werden Titel und Inhalt in vertikalen Blöcken angeordnet.",
    tradeoff:
      "Lange Titel brauchen mehrere Zeilen. Die tatsächliche Lesbarkeit ist in den Mobilbildern zu prüfen.",
  },
};

export function processConceptOutput(
  output: JsonObject,
  input: JsonObject,
): JsonObject {
  validate("DesignExplorationInput", input);
  validate("DesignExplorationOutput", output);
  if (!output.data)
    throw new Error(
      "Concept exploration needs input: " +
        output.gaps.map((g: JsonObject) => g.description ?? g.code).join(", "),
    );
  const refs = new Set(
    input.design_research.references.map((r: JsonObject) => r.reference_id),
  );
  const allowed = input.template.design_profiles ?? [];
  const concepts = output.data.concepts as JsonObject[];
  for (const concept of concepts) {
    if (!allowed.includes(concept.design_profile))
      throw new Error("Unsupported concept profile in template");
    if (
      new Set(concept.reference_ids).size !== concept.reference_ids.length ||
      concept.reference_ids.some((r: string) => !refs.has(r))
    )
      throw new Error("Concept has an invented reference");
    if (refs.size && !concept.reference_ids.length)
      throw new Error("Concept must identify an inspected reference");
  }
  const report = assessConceptSet(
    concepts.map((concept, i) => ({
      concept_key: `concept-${i + 1}`,
      signature: designFingerprint(
        miniSiteSpec(input.comparison_content, concept),
      ).signature,
    })),
  );
  if (!report.passed_declared_diversity_rule)
    throw new Error(
      "Concepts need four differences including two structural differences",
    );
  // Raw reasoning remains in agent_raw_outputs. It must not masquerade as observed
  // visual evidence or promise renderer capabilities in the approval gallery.
  return validate("ConceptSet", {
    concepts: concepts.map((concept) => ({
      ...concept,
      ...CONCEPT_DESCRIPTIONS[concept.design_profile as DesignProfileId],
    })),
  });
}

export function fixtureConceptOutput(input: JsonObject): JsonObject {
  return {
    data: {
      concepts: Object.keys(DESIGN_PROFILES).map((design_profile, i) => ({
        design_profile,
        title: [
          "Redaktionelles Atelier",
          "Klarer Leistungsindex",
          "Typografisches Plakat",
        ][i],
        rationale:
          "SIMULATED: unterschiedliche unterstützte Anordnung derselben bestätigten Informationen.",
        reference_ids: input.design_research.references.map(
          (r: JsonObject) => r.reference_id,
        ),
        tradeoff:
          "SIMULATED: Die sichtbare Eignung muss ein Mensch anhand der gerenderten Ansichten beurteilen.",
      })),
    },
    gaps: [],
    notices: [],
  };
}

export function conceptDependencies(
  context: JsonObject,
  rendererVersion: string,
): string {
  return hash({
    profile: context.profile,
    assets: context.approvedAssets ?? [],
    campaign: context.campaign,
    offer: context.offer,
    template: context.template,
    research: context.designResearch,
    rendererVersion,
    capabilitiesVersion: DESIGN_CAPABILITIES_VERSION,
    capabilities: DESIGN_PROFILES,
    presentation: CONCEPT_DESCRIPTIONS,
  });
}
