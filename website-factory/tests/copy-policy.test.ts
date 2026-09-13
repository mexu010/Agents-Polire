import { describe, expect, it } from "vitest";
import {
  assertCopyPolicy,
  assertSubjectPolicy,
  EDITORIAL_COPY_TEMPLATES,
  SUBJECT_FACT_FRAMES,
  SUBJECT_TEMPLATES,
} from "../src/copy-policy.js";

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
});
