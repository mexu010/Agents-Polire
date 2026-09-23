import { describe, expect, it } from "vitest";
import { fixtureOutput } from "../src/fixtures.js";

describe("QA fixture screenshot selection", () => {
  it("binds rendered-views/2 checks to both route and viewport locator", () => {
    const input: any = {
      visual_contract_version: "rendered-views/2",
      required_checks: [
        {
          check_id: "visual-contact",
          category: "visual",
          executor: "qa_model",
          page_ref: "/kontakt",
          viewport: { width: 375, height: 812 },
        },
      ],
      audit_issues: [],
      images: [
        { evidence_id: "home", width: 375, height: 900 },
        { evidence_id: "contact", width: 375, height: 900 },
      ],
      evidence: [
        {
          evidence_id: "home",
          kind: "screenshot",
          locator: JSON.stringify({
            route: "/",
            viewport: { width: 375, height: 812 },
            full_page: true,
          }),
        },
        {
          evidence_id: "contact",
          kind: "screenshot",
          locator: JSON.stringify({
            route: "/kontakt",
            viewport: { width: 375, height: 812 },
            full_page: true,
          }),
        },
      ],
    };
    const output = fixtureOutput("qa", input);
    expect(output.data.checks[0].evidence_ids).toEqual(["contact"]);
  });

  it("keeps the width-only fallback for legacy fixture inputs", () => {
    const input: any = {
      required_checks: [
        {
          check_id: "visual-contact",
          category: "visual",
          executor: "qa_model",
          page_ref: "/kontakt",
          viewport: { width: 375, height: 812 },
        },
      ],
      audit_issues: [],
      evidence: [],
      images: [{ evidence_id: "legacy", width: 375, height: 900 }],
    };
    expect(fixtureOutput("qa", input).data.checks[0].evidence_ids).toEqual([
      "legacy",
    ]);
  });
});
