import { describe, expect, it } from "vitest";
import {
  assertCopyPolicy,
  assertSubjectPolicy,
  EDITORIAL_COPY_TEMPLATES,
  SUBJECT_FACT_FRAMES,
  SUBJECT_TEMPLATES,
} from "../src/copy-policy.js";
import { processAgentOutput } from "../src/agents.js";
import {
  buildAgentInput,
  fixtureInput,
  fixtureOutput,
} from "../src/fixtures.js";

const strategistFixture = () => {
  const root = fixtureInput();
  const scoutInput = buildAgentInput("scout", root);
  const profile = processAgentOutput(
    "scout",
    fixtureOutput("scout", scoutInput),
    scoutInput,
  );
  const auditInput = buildAgentInput("audit", { ...root, profile });
  const audit = processAgentOutput(
    "audit",
    fixtureOutput("audit", auditInput),
    auditInput,
  );
  const qualifierInput = buildAgentInput("qualifier", {
    ...root,
    profile,
    audit,
  });
  const qualification = processAgentOutput(
    "qualifier",
    fixtureOutput("qualifier", qualifierInput),
    qualifierInput,
  );
  return {
    profile,
    input: buildAgentInput("strategist", {
      ...root,
      profile,
      audit,
      qualification,
    }),
  };
};

describe("shared copy policy", () => {
  it("accepts every published editorial and subject template", () => {
    for (const template of EDITORIAL_COPY_TEMPLATES)
      expect(() => assertCopyPolicy(template, "editorial", [])).not.toThrow();
    for (const template of SUBJECT_TEMPLATES)
      expect(() => assertSubjectPolicy(template, [])).not.toThrow();
    for (const frame of SUBJECT_FACT_FRAMES)
      expect(() =>
        assertSubjectPolicy(
          frame.replace("{company_name}", "Alpina Sanitär GmbH"),
          ["Alpina Sanitär GmbH"],
        ),
      ).not.toThrow();
  });

  it("allows factual projection with connectors but rejects unrelated claims", () => {
    expect(() =>
      assertCopyPolicy(
        "Alpina Sanitär GmbH und Sanitärinstallationen in Zürich",
        "factual",
        ["Alpina Sanitär GmbH", "Sanitärinstallationen", "Zürich"],
      ),
    ).not.toThrow();
    for (const claim of [
      "Wir bauen Solaranlagen in Basel",
      "ISO 9001 zertifiziert",
      "500 Mitarbeitende",
    ])
      expect(() =>
        assertCopyPolicy(claim, "factual", ["Sanitärinstallationen"]),
      ).toThrow(/unsupported claim/i);
  });

  it("rejects additions to otherwise permitted editorial and subject templates", () => {
    expect(() =>
      assertSubjectPolicy("Gestaltungsvorschlag für Alpina Sanitär GmbH", []),
    ).toThrow(/unsupported claim in Sales subject/i);
    for (const suffix of [
      " ISO 9001 zertifiziert",
      " mit 500 Mitarbeitenden",
      " für Solaranlagen in Basel",
    ]) {
      expect(() =>
        assertCopyPolicy(
          `${EDITORIAL_COPY_TEMPLATES[0]}${suffix}`,
          "editorial",
          [],
        ),
      ).toThrow(/unsupported editorial claim/i);
      expect(() =>
        assertSubjectPolicy(`${SUBJECT_TEMPLATES[0]}${suffix}`, []),
      ).toThrow(/unsupported claim in Sales subject/i);
    }
  });

  it("permits neutral page labels and actions without turning claims into editorial copy", () => {
    for (const label of [
      "Ihr Besuch",
      "Auf einen Blick",
      "Zum Kontakt",
      "Angebot ansehen",
      "Zur Übersicht",
    ])
      expect(() => assertCopyPolicy(label, "editorial", [])).not.toThrow();
    for (const claim of [
      "20 Jahre Erfahrung",
      "4,9 Sterne",
      "Individuelle Beratung",
      "Bestes Team",
      "Schnitt und Farbe",
    ])
      expect(() => assertCopyPolicy(claim, "editorial", [])).toThrow(
        /unsupported editorial claim/i,
      );
  });

  it("permits bounded factual orientation while rejecting added promises", () => {
    for (const text of [
      "Sanitärinstallationen im Überblick",
      "Mehr über Sanitärinstallationen erfahren",
      "Sanitärinstallationen entdecken",
    ])
      expect(() =>
        assertCopyPolicy(text, "factual", ["Sanitärinstallationen"]),
      ).not.toThrow();
    for (const text of [
      "Sanitärinstallationen mit Garantie",
      "Sanitärinstallationen seit 20 Jahren",
      "Sanitärinstallationen für jedes Budget",
    ])
      expect(() =>
        assertCopyPolicy(text, "factual", ["Sanitärinstallationen"]),
      ).toThrow(/unsupported claim/i);
  });

  it("rejects invented business claims and a real fact ID for the wrong statement during agent processing", () => {
    const { input, profile } = strategistFixture();
    const service = profile.facts.find((fact: any) => fact.field === "service");
    const locality = profile.facts.find(
      (fact: any) => fact.field === "locality",
    );
    const cases = [
      {
        text: "4,9 Sterne aus 120 Bewertungen",
        kind: "editorial",
        fact_ids: [],
      },
      {
        text: "Faire Preise ab CHF 99",
        kind: "factual",
        fact_ids: [service.fact_id],
      },
      {
        text: "20 Jahre Erfahrung",
        kind: "factual",
        fact_ids: [service.fact_id],
      },
      {
        text: "Solaranlagen und Sanitärinstallationen",
        kind: "factual",
        fact_ids: [service.fact_id],
      },
      {
        text: "ISO 9001 zertifiziert",
        kind: "factual",
        fact_ids: [service.fact_id],
      },
      {
        text: "Sanitärinstallationen",
        kind: "factual",
        fact_ids: [locality.fact_id],
      },
    ];
    for (const copy of cases) {
      const output = fixtureOutput("strategist", input);
      output.data.pages[0].sections[0].heading = copy;
      expect(() => processAgentOutput("strategist", output, input)).toThrow(
        /unsupported/i,
      );
    }
  });
});
