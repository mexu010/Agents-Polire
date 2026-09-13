import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { runBrowserTests } from "../src/browser-tests.js";
import { renderSite } from "../src/renderer.js";

const copy = (text: string) => ({ text, kind: "editorial", fact_ids: [] });

test("runs real required browser checks while leaving visual judgement to QA", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "factory-browser-"));
  try {
    const siteSpec = {
      template_id: "local-service",
      template_version: "1",
      locale: "de-CH",
      theme: {
        font_pair: "sans",
        palette: "light",
        accent_hex: null,
        spacing: "comfortable",
        motion: "none",
      },
      navigation: [{ label: copy("Start"), route: "/" }],
      pages: [
        {
          route: "/",
          title: copy("Gartenraum"),
          meta_description: copy("Gartenraum Vorschau"),
          sections: [
            {
              section_id: "hero",
              component: "hero",
              variant: "stacked",
              heading: copy("Gartenraum"),
              body: [copy("Gute Pflege fuer gruene Raeume.")],
              items: [],
              cta: null,
              asset_id: null,
              addressed_issue_ids: [],
            },
          ],
        },
      ],
      asset_ids: [],
      unresolved_requirements: [],
    };
    const profile = {
      facts: [],
      contacts: [],
      agency: {
        status: "unknown",
        agency_name: null,
        evidence_ids: [],
        score: null,
      },
      technology_signals: [],
      contradictions: [],
    };
    const rendered = await renderSite({
      leadId: "lead-browser-test",
      siteSpec,
      profile,
      assets: [],
      outputDir: path.join(root, "render"),
      mode: "fixture",
    });
    const report = await runBrowserTests({
      artifactDir: rendered.artifactDir,
      siteSpec,
      profile,
      outputDir: path.join(root, "checks"),
    });

    expect(
      report.images.map((image) => path.basename(image.path)).sort(),
    ).toEqual(["root-1440.png", "root-375.png", "root-768.png"]);
    const pngSizes = await Promise.all(
      report.images.map(async (image) => {
        const png = await readFile(image.path);
        return [png.readUInt32BE(16), png.readUInt32BE(20)];
      }),
    );
    expect(report.images.map(({ width, height }) => [width, height])).toEqual(
      pngSizes,
    );
    expect(
      report.images.every((image) => /^[a-f0-9]{64}$/.test(image.sha256)),
    ).toBe(true);
    expect(
      report.requiredChecks.filter((check) => check.category === "visual"),
    ).toHaveLength(3);
    expect(
      report.requiredChecks
        .filter((check) => check.category === "visual")
        .every((check) => check.executor === "qa_model"),
    ).toBe(true);
    const visualIds = new Set(
      report.requiredChecks
        .filter((check) => check.category === "visual")
        .map((check) => check.check_id),
    );
    expect(
      report.results.some((result) => visualIds.has(result.check_id)),
    ).toBe(false);
    expect(
      report.results.filter((result) => result.result === "not_tested"),
    ).toEqual([]);
    expect(
      report.results.every((result) => result.evidence_ids.length > 0),
    ).toBe(true);
    expect(
      new Set(report.requiredChecks.map((check) => check.category)),
    ).toEqual(
      new Set([
        "build",
        "links",
        "assets",
        "runtime",
        "keyboard",
        "overflow",
        "visual",
        "facts",
        "preview_safety",
      ]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
