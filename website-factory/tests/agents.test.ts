import { describe, expect, it } from "vitest";
import {
  buildAgentInput,
  fixtureInput,
  fixtureOutput,
} from "../src/fixtures.js";
import { processAgentOutput, promptFor } from "../src/agents.js";
import {
  COPY_POLICY_PROMPT,
  EDITORIAL_COPY_TEMPLATES,
  SUBJECT_FACT_FRAMES,
  SUBJECT_TEMPLATES,
} from "../src/copy-policy.js";

describe("agent contracts", () => {
  it("keeps all seven specialised prompts behind one lookup", () => {
    for (const agent of [
      "scout",
      "audit",
      "qualifier",
      "strategist",
      "builder",
      "qa",
      "sales",
    ] as const) {
      expect(promptFor(agent)).toContain("JSON-Schema");
    }
  });

  it("registers grounded Scout facts and rejects evidence laundering", () => {
    const input = fixtureInput();
    const scoutInput = buildAgentInput("scout", input);
    const result = processAgentOutput(
      "scout",
      fixtureOutput("scout", scoutInput),
      scoutInput,
    );
    expect(result.facts).toHaveLength(7);
    expect(
      result.facts.every(
        (fact: { evidence_ids: string[] }) => fact.evidence_ids.length > 0,
      ),
    ).toBe(true);

    const forged = fixtureOutput("scout", scoutInput);
    forged.data.facts[0].evidence_ids = ["e-absent"];
    expect(() => processAgentOutput("scout", forged, scoutInput)).toThrow(
      /evidence/i,
    );
  });

  it("grounds exact address tokens across punctuation and whitespace only", () => {
    const input = buildAgentInput("scout", fixtureInput());
    input.evidence.push({
      ...input.evidence[0],
      evidence_id: "e-address",
      excerpt:
        "Malerei H.P. Blättler GmbH - Sendlistrasse 4 -\nCH-3800 Interlaken - Telefon: 033 822 72 70",
    });
    const output = fixtureOutput("scout", input);
    output.data.facts.push({
      field: "address",
      value: "Sendlistrasse 4, CH-3800 Interlaken",
      evidence_ids: ["e-address"],
      interpretation: "source_reported",
    });
    expect(() => processAgentOutput("scout", output, input)).not.toThrow();
    const changedDigits = structuredClone(output);
    changedDigits.data.facts.at(-1).value =
      "Sendlistrasse 4, CH-3801 Interlaken";
    expect(() => processAgentOutput("scout", changedDigits, input)).toThrow(
      /evidence does not support claim/i,
    );
    const truncated = structuredClone(output);
    truncated.data.facts.at(-1).value = "Sendlistrasse 4, CH-3800 Inter";
    expect(() => processAgentOutput("scout", truncated, input)).toThrow(
      /evidence does not support claim/i,
    );
  });

  it("revalidates stored entity-encoded evidence without accepting different claims", () => {
    const input = buildAgentInput("scout", fixtureInput());
    input.evidence.push({
      ...input.evidence[0],
      evidence_id: "e-encoded",
      excerpt: "Grabbepflanzung &amp; G&auml;rtnerei",
    });
    const output = fixtureOutput("scout", input);
    output.data.facts.push({
      field: "service",
      value: "Grabbepflanzung & Gärtnerei",
      evidence_ids: ["e-encoded"],
      interpretation: "source_reported",
    });
    expect(() => processAgentOutput("scout", output, input)).not.toThrow();
    output.data.facts.at(-1).value = "Grabbepflanzung & Schreinerei";
    expect(() => processAgentOutput("scout", output, input)).toThrow(
      /evidence/,
    );
  });

  it("accepts an explicit Swiss postal prefix but not arbitrary CH text as country evidence", () => {
    const input = buildAgentInput("scout", fixtureInput());
    const proof = {
      ...input.evidence[0],
      evidence_id: "e-postal",
      excerpt: "im Hof 3, CH-9467 Frümsen",
    };
    input.evidence.push(proof);
    const output = fixtureOutput("scout", input);
    output.data.facts.push({
      field: "country",
      value: "CH",
      evidence_ids: ["e-postal"],
      interpretation: "source_reported",
    });
    expect(() => processAgentOutput("scout", output, input)).not.toThrow();
    for (const excerpt of [
      "CH Tools, DE-9467 Beispiel",
      "CH-94678",
      "CH-123",
    ]) {
      proof.excerpt = excerpt;
      expect(() => processAgentOutput("scout", output, input)).toThrow(
        /country CH/,
      );
    }
  });

  it("accepts a contact page URL from its fetched source, not an invented sibling URL", () => {
    const input = buildAgentInput("scout", fixtureInput());
    input.evidence.push({
      ...input.evidence[0],
      evidence_id: "e-contact-url",
      source_url: "https://example.ch/kontakt",
      excerpt: "Kontakt: Rufen Sie uns an.",
    });
    const output = fixtureOutput("scout", input);
    output.data.contacts.push({
      kind: "contact_page",
      value: "https://example.ch/kontakt",
      evidence_ids: ["e-contact-url"],
    });
    expect(() => processAgentOutput("scout", output, input)).not.toThrow();
    output.data.contacts.at(-1).value = "https://example.ch/other-contact";
    expect(() => processAgentOutput("scout", output, input)).toThrow(
      /evidence/,
    );
  });

  it("accepts an official same-site Webdesign by credit and rejects off-site or generic mentions", () => {
    const input = buildAgentInput("scout", fixtureInput());
    const credit = input.evidence.find(
      (item: any) => item.evidence_id === "e-credit",
    );
    credit.excerpt = "Copyright Alpina Sanitär GmbH | Webdesign by SperiLogic";
    credit.source_url = input.seed.website;
    const output = fixtureOutput("scout", input);
    output.data.agency = {
      agency_name: "SperiLogic",
      relationship: "explicit_website_implementation",
      evidence_ids: ["e-credit"],
    };
    expect(processAgentOutput("scout", output, input).agency.status).toBe(
      "evidenced_implementation",
    );

    const offSite = structuredClone(input);
    offSite.evidence.find(
      (item: any) => item.evidence_id === "e-credit",
    ).source_url = "https://directory.example/credits";
    expect(() => processAgentOutput("scout", output, offSite)).toThrow(
      /agency evidence/i,
    );

    const generic = structuredClone(input);
    generic.evidence.find(
      (item: any) => item.evidence_id === "e-credit",
    ).excerpt = "Alpina Sanitär GmbH | Partnerlink SperiLogic";
    expect(() => processAgentOutput("scout", output, generic)).toThrow(
      /agency evidence/i,
    );
  });

  it("calculates a complete high-fit qualification deterministically", () => {
    const input = fixtureInput();
    const scoutInput = buildAgentInput("scout", input);
    const scout = processAgentOutput(
      "scout",
      fixtureOutput("scout", scoutInput),
      scoutInput,
    );
    const auditInput = buildAgentInput("audit", { ...input, profile: scout });
    const audit = processAgentOutput(
      "audit",
      fixtureOutput("audit", auditInput),
      auditInput,
    );
    const qualifierInput = buildAgentInput("qualifier", {
      ...input,
      profile: scout,
      audit,
    });
    const qualification = processAgentOutput(
      "qualifier",
      fixtureOutput("qualifier", qualifierInput),
      qualifierInput,
    );
    expect(qualification.decision).toBe("proceed");
    expect(qualification.opportunity_score).toBeGreaterThanOrEqual(85);
    expect(qualification.coverage).toBe(1);
  });

  it("returns only a draft from Sales and validates its references", () => {
    const input = fixtureInput();
    const scoutInput = buildAgentInput("scout", input);
    const profile = processAgentOutput(
      "scout",
      fixtureOutput("scout", scoutInput),
      scoutInput,
    );
    const salesInput = fixtureOutput("sales-input", { ...input, profile });
    const draft = processAgentOutput(
      "sales",
      fixtureOutput("sales", salesInput),
      salesInput,
    );
    expect(draft.draft_only).toBe(true);
    expect(draft.can_send).toBe(false);
    expect(draft.recipient).toBeUndefined();
    const companyName = salesInput.facts.find(
      (fact: any) => fact.field === "company_name",
    ).value;
    for (const subject of [
      ...SUBJECT_TEMPLATES,
      ...SUBJECT_FACT_FRAMES.map((frame) =>
        frame.replace("{company_name}", companyName),
      ),
    ]) {
      const permitted = fixtureOutput("sales", salesInput);
      permitted.data.subject_options = [
        subject,
        subject === SUBJECT_TEMPLATES[0]
          ? SUBJECT_FACT_FRAMES[0].replace("{company_name}", companyName)
          : SUBJECT_TEMPLATES[0],
      ];
      expect(() =>
        processAgentOutput("sales", permitted, salesInput),
      ).not.toThrow();
    }
    for (const subject of ["ISO 9001 zertifiziert", "500 Mitarbeitende"]) {
      const forged = fixtureOutput("sales", salesInput);
      forged.data.subject_options[0] = subject;
      expect(() => processAgentOutput("sales", forged, salesInput)).toThrow(
        /unsupported claim in Sales subject/i,
      );
    }
  });

  it("registers Strategist section ids and Builder preserves the approved brief structure", () => {
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
    const strategistInput = buildAgentInput("strategist", {
      ...root,
      profile,
      audit,
      qualification,
    });
    const brief = processAgentOutput(
      "strategist",
      fixtureOutput("strategist", strategistInput),
      strategistInput,
    );
    expect(
      brief.pages
        .flatMap((page: any) => page.sections)
        .every((section: any) => section.section_id),
    ).toBe(true);

    const builderInput = buildAgentInput("builder", {
      ...root,
      profile,
      brief,
    });
    const site = processAgentOutput(
      "builder",
      fixtureOutput("builder", builderInput),
      builderInput,
    );
    expect(site.pages.map((page: any) => page.route)).toEqual(
      brief.pages.map((page: any) => page.route),
    );
    expect(
      site.pages
        .flatMap((page: any) => page.sections)
        .map((section: any) => section.section_id),
    ).toEqual(
      brief.pages
        .flatMap((page: any) => page.sections)
        .map((section: any) => section.section_id),
    );
    const repairTask = {
      issue_id: "qa-repair-1",
      allowed_paths: ["/pages/0/sections/0/cta"],
      expected_effect: "CTA klarer beschriften.",
    };
    const repairInput = buildAgentInput("builder", {
      ...root,
      profile,
      brief,
      previousSiteSpec: site,
      repairTasks: [repairTask],
    });
    expect(() =>
      processAgentOutput(
        "builder",
        fixtureOutput("builder", repairInput),
        repairInput,
      ),
    ).not.toThrow();
    const escaped = fixtureOutput("builder", repairInput);
    escaped.data.site_spec.pages[0].sections[1].heading = {
      text: "Kontakt",
      kind: "editorial",
      fact_ids: [],
    };
    expect(() => processAgentOutput("builder", escaped, repairInput)).toThrow(
      /outside allowed repair path/i,
    );
  });

  it("derives QA pass only when every runtime and visual check passes", () => {
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
    const briefInput = buildAgentInput("strategist", {
      ...root,
      profile,
      audit,
      qualification,
    });
    const brief = processAgentOutput(
      "strategist",
      fixtureOutput("strategist", briefInput),
      briefInput,
    );
    const builderInput = buildAgentInput("builder", {
      ...root,
      profile,
      brief,
    });
    const siteSpec = processAgentOutput(
      "builder",
      fixtureOutput("builder", builderInput),
      builderInput,
    );
    const browser = fixtureOutput("browser", { ...root, siteSpec });
    const qaInput = buildAgentInput("qa", {
      ...root,
      profile,
      audit,
      brief,
      siteSpec,
      browser,
    });
    const qa = processAgentOutput("qa", fixtureOutput("qa", qaInput), qaInput);
    expect(qa.decision).toBe("pass");
    expect(qa.checks).toHaveLength(2);

    const forged = fixtureOutput("qa", qaInput);
    forged.data.checks[0].check_id = qaInput.required_checks[0].check_id;
    expect(() => processAgentOutput("qa", forged, qaInput)).toThrow(
      /runtime check/i,
    );

    const missingRuntime = structuredClone(qaInput);
    missingRuntime.test_results = [];
    expect(() =>
      processAgentOutput(
        "qa",
        fixtureOutput("qa", missingRuntime),
        missingRuntime,
      ),
    ).toThrow(/runtime check/i);

    const major = fixtureOutput("qa", qaInput);
    major.data.issues.push({
      category: "conversion",
      severity: "major",
      observation: "CTA is obscured",
      evidence_ids: [qaInput.images[0].evidence_id],
      page_ref: "/",
      viewport: { width: 375, height: 800 },
      impact_hypothesis: "Contact path is unclear",
      recommendation: "Move CTA",
      suggested_fix_target: "site_spec",
      reproduction: ["Open home"],
    });
    expect(processAgentOutput("qa", major, qaInput).decision).toBe("fail");
  });

  it("does not score visual audit dimensions without a bound image", () => {
    const root = fixtureInput();
    root.images = [];
    const scoutInput = buildAgentInput("scout", root);
    const profile = processAgentOutput(
      "scout",
      fixtureOutput("scout", scoutInput),
      scoutInput,
    );
    const auditInput = buildAgentInput("audit", { ...root, profile });
    expect(() =>
      processAgentOutput(
        "audit",
        fixtureOutput("audit", auditInput),
        auditInput,
      ),
    ).toThrow(/image/i);
  });

  it("rejects unrelated corporate claims even with a valid fact id or editorial label", () => {
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
    const strategistInput = buildAgentInput("strategist", {
      ...root,
      profile,
      audit,
      qualification,
    });
    expect(promptFor("strategist")).toContain(COPY_POLICY_PROMPT);
    for (const template of EDITORIAL_COPY_TEMPLATES) {
      const neutral = fixtureOutput("strategist", strategistInput);
      neutral.data.pages[0].sections[0].heading = {
        text: template,
        kind: "editorial",
        fact_ids: [],
      };
      expect(() =>
        processAgentOutput("strategist", neutral, strategistInput),
      ).not.toThrow();
    }
    const neutral = fixtureOutput("strategist", strategistInput);
    neutral.data.pages[0].sections[0].heading = {
      text: "Eine klare Grundlage für Ihre nächste Website-Anfrage.",
      kind: "editorial",
      fact_ids: [],
    };
    const tainted = structuredClone(neutral);
    tainted.data.pages[0].sections[0].heading.text =
      "Eine klare Grundlage für Ihre nächste Website-Anfrage. ISO 9001 zertifiziert.";
    expect(() =>
      processAgentOutput("strategist", tainted, strategistInput),
    ).toThrow(/unsupported editorial claim/i);
    const forged = fixtureOutput("strategist", strategistInput);
    forged.data.pages[0].sections[0].heading = {
      text: "ISO 9001 zertifiziert, 500 Mitarbeitende",
      kind: "factual",
      fact_ids: [profile.facts.find((x: any) => x.field === "service").fact_id],
    };
    expect(() =>
      processAgentOutput("strategist", forged, strategistInput),
    ).toThrow(/unsupported claim/i);
    forged.data.pages[0].sections[0].heading = {
      text: "Wir bauen Solaranlagen in Basel",
      kind: "factual",
      fact_ids: [profile.facts.find((x: any) => x.field === "service").fact_id],
    };
    expect(() =>
      processAgentOutput("strategist", forged, strategistInput),
    ).toThrow(/unsupported claim/i);
    forged.data.pages[0].sections[0].heading = {
      text: "Wir bauen Solaranlagen in Basel",
      kind: "editorial",
      fact_ids: [],
    };
    expect(() =>
      processAgentOutput("strategist", forged, strategistInput),
    ).toThrow(/unsupported editorial claim/i);
  });
});
