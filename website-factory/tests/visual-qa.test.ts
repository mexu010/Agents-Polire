import { describe, expect, it } from "vitest";
import { validateVisualQA } from "../src/visual-qa.js";

const current = (): any => ({
  input: {
    visual_contract_version: "rendered-views/2",
    build: { result: "pass", artifact_hash: "build-current" },
    required_checks: [
      {
        check_id: "visual-home-mobile",
        category: "visual",
        executor: "qa_model",
        page_ref: "/",
        viewport: { width: 375, height: 812 },
      },
    ],
    evidence: [
      {
        evidence_id: "shot-home-mobile",
        kind: "screenshot",
        source_url: "http://127.0.0.1:4173/",
        artifact_hash: "build-current",
        locator: JSON.stringify({
          route: "/",
          viewport: { width: 375, height: 812 },
          full_page: true,
        }),
        excerpt: "sha-current",
      },
    ],
    images: [
      {
        evidence_id: "shot-home-mobile",
        attachment_ref: "home.png",
        sha256: "sha-current",
        width: 375,
        height: 1240,
      },
    ],
  },
  data: {
    checks: [
      {
        check_id: "visual-home-mobile",
        result: "pass",
        evidence_ids: ["shot-home-mobile"],
        detail: "Hierarchy and CTA are visible in the current mobile render.",
      },
    ],
    issues: [],
  },
});

describe("versioned visual QA", () => {
  it("accepts a current screenshot bound to the required route and viewport", () => {
    const { data, input } = current();
    expect(() => validateVisualQA(data, input)).not.toThrow();
  });

  it.each([
    [
      "stale artifact",
      (fixture: any) => (fixture.input.evidence[0].artifact_hash = "build-old"),
    ],
    [
      "different bytes",
      (fixture: any) => (fixture.input.images[0].sha256 = "sha-other"),
    ],
    [
      "wrong route",
      (fixture: any) =>
        (fixture.input.evidence[0].locator = JSON.stringify({
          route: "/kontakt",
          viewport: { width: 375, height: 812 },
          full_page: true,
        })),
    ],
    [
      "wrong viewport",
      (fixture: any) =>
        (fixture.input.evidence[0].locator = JSON.stringify({
          route: "/",
          viewport: { width: 768, height: 1024 },
          full_page: true,
        })),
    ],
  ])("rejects visual decisions backed by a %s screenshot", (_name, mutate) => {
    const fixture = current();
    mutate(fixture);
    expect(() => validateVisualQA(fixture.data, fixture.input)).toThrow(
      /current matching screenshot/i,
    );
  });

  it("requires a concrete image-bound finding for every visual failure", () => {
    const fixture = current();
    fixture.data.checks[0].result = "fail";
    expect(() => validateVisualQA(fixture.data, fixture.input)).toThrow(
      /visual failure needs a corresponding finding/i,
    );

    fixture.data.issues.push({
      category: "content_clarity",
      severity: "major",
      observation:
        "The current mobile screenshot shows the heading wrapping into four uneven lines.",
      evidence_ids: ["shot-home-mobile"],
      page_ref: "/",
      viewport: { width: 375, height: 812 },
      recommendation:
        "Reduce the mobile heading size so the full heading uses at most three lines.",
      acceptance_criterion:
        "A new 375 x 812 screenshot shows the heading on no more than three lines.",
    });
    expect(() => validateVisualQA(fixture.data, fixture.input)).not.toThrow();
  });

  it("requires every new visual finding to state an acceptance criterion", () => {
    const fixture = current();
    fixture.data.issues.push({
      category: "content_clarity",
      severity: "minor",
      observation:
        "The current mobile screenshot shows an isolated heading word.",
      evidence_ids: ["shot-home-mobile"],
      page_ref: "/",
      viewport: { width: 375, height: 812 },
      recommendation: "Adjust the heading measure for a balanced wrap.",
      acceptance_criterion: "",
    });
    expect(() => validateVisualQA(fixture.data, fixture.input)).toThrow(
      /acceptance criterion/i,
    );
  });

  it("rejects a viewport finding that cites only browser-test evidence", () => {
    const fixture = current();
    fixture.input.evidence.push({
      evidence_id: "runtime-overflow",
      kind: "browser_test",
      source_url: "http://127.0.0.1:4173/",
      artifact_hash: "build-current",
      locator: JSON.stringify({
        route: "/",
        viewport: { width: 375, height: 812 },
        category: "overflow",
      }),
      excerpt: "Overflow check failed.",
    });
    fixture.data.issues.push({
      category: "mobile_usability",
      severity: "major",
      observation:
        "The runtime overflow check reports clipped content on the mobile route.",
      evidence_ids: ["runtime-overflow"],
      page_ref: "/",
      viewport: { width: 375, height: 812 },
      recommendation: "Keep the affected content inside the mobile viewport.",
      acceptance_criterion:
        "A new 375 x 812 screenshot shows the full content without horizontal clipping.",
    });
    expect(() => validateVisualQA(fixture.data, fixture.input)).toThrow(
      /finding needs a current matching screenshot/i,
    );
    fixture.data.issues[0].evidence_ids.push("shot-home-mobile");
    expect(() => validateVisualQA(fixture.data, fixture.input)).not.toThrow();
  });

  it.each([
    ["wrong route", "/kontakt", "build-current"],
    ["stale artifact", "/", "build-old"],
  ])(
    "rejects a finding backed by a %s screenshot even when its visual check has current proof",
    (_name, route, artifactHash) => {
      const fixture = current();
      fixture.input.evidence.push({
        ...fixture.input.evidence[0],
        evidence_id: "shot-issue",
        artifact_hash: artifactHash,
        source_url: `http://127.0.0.1:4173${route}`,
        locator: JSON.stringify({
          route,
          viewport: { width: 375, height: 812 },
          full_page: true,
        }),
        excerpt: "sha-issue",
      });
      fixture.input.images.push({
        ...fixture.input.images[0],
        evidence_id: "shot-issue",
        sha256: "sha-issue",
      });
      fixture.data.issues.push({
        category: "content_clarity",
        severity: "minor",
        observation:
          "The cited mobile screenshot shows an isolated heading word.",
        evidence_ids: ["shot-issue"],
        page_ref: "/",
        viewport: { width: 375, height: 812 },
        recommendation: "Adjust the heading measure for a balanced wrap.",
        acceptance_criterion:
          "A new 375 x 812 screenshot shows the heading without an isolated word.",
      });
      expect(() => validateVisualQA(fixture.data, fixture.input)).toThrow(
        /finding needs a current matching screenshot/i,
      );
    },
  );

  it("does not impose the versioned rules on legacy QA inputs", () => {
    const { data, input } = current();
    delete (input as any).visual_contract_version;
    input.evidence = [];
    input.images = [];
    expect(() => validateVisualQA(data, input)).not.toThrow();
  });

  it("allows not_tested when the required screenshot was not supplied", () => {
    const { data, input } = current();
    data.checks[0].result = "not_tested";
    input.evidence = [];
    input.images = [];
    expect(() => validateVisualQA(data, input)).not.toThrow();
  });
});
