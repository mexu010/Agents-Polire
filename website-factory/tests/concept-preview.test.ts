import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { processAgentOutput } from "../src/agents.js";
import { startConceptPreview } from "../src/concept-preview.js";
import {
  buildAgentInput,
  fixtureInput,
  fixtureOutput,
} from "../src/fixtures.js";
import { renderSite } from "../src/renderer.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function reviewFixture() {
  const outputDir = await mkdtemp(path.join(tmpdir(), "concept-preview-"));
  cleanups.push(() => rm(outputDir, { recursive: true, force: true }));
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
  const builderInput = buildAgentInput("builder", { ...root, profile, brief });
  const siteSpec = processAgentOutput(
    "builder",
    fixtureOutput("builder", builderInput),
    builderInput,
  );
  const rendered = await renderSite({
    leadId: "concept-preview",
    siteSpec,
    profile,
    assets: [],
    outputDir,
    mode: "fixture",
  });
  const previews = [];
  for (let index = 1; index <= 3; index += 1) {
    const desktopPath = path.join(outputDir, `desktop-${index}.png`);
    const mobilePath = path.join(outputDir, `mobile-${index}.png`);
    const desktop = Buffer.from(`desktop screenshot ${index}`);
    const mobile = Buffer.from(`mobile screenshot ${index}`);
    await writeFile(desktopPath, desktop);
    await writeFile(mobilePath, mobile);
    previews.push({
      conceptId: `direction-${index}`,
      concept: {
        title: `Direction ${index}`,
        rationale: `Rationale ${index}`,
        tradeoff: `Tradeoff ${index}`,
        design_profile: ["editorial-spread", "service-index", "type-poster"][
          index - 1
        ],
      },
      siteSpec,
      render: rendered,
      browser: {
        images: [
          {
            path: desktopPath,
            evidence_id: `desktop-${index}`,
            width: 1440,
            height: 1000,
            sha256: createHash("sha256").update(desktop).digest("hex"),
          },
          {
            path: mobilePath,
            evidence_id: `mobile-${index}`,
            width: 375,
            height: 812,
            sha256: createHash("sha256").update(mobile).digest("hex"),
          },
        ],
      },
    });
  }
  return {
    review: {
      runId: "run-123",
      revision: 4,
      reviewHash: "review-hash",
      mode: "fixture",
      previews,
    },
    outputDir,
  };
}

describe("protected concept comparison", () => {
  it("requires admission, serves a noindex read-only gallery and opens protected artifact links", async () => {
    const { review } = await reviewFixture();
    const gallery = await startConceptPreview({ review });
    cleanups.push(gallery.close);
    const bare = new URL(gallery.url);
    bare.search = "";
    expect((await fetch(bare)).status).toBe(401);
    const admission = await fetch(gallery.url, { redirect: "manual" });
    expect(admission.status).toBe(303);
    const cookie = admission.headers.get("set-cookie")!.split(";", 1)[0];
    const response = await fetch(bare, { headers: { cookie } });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action 'none'",
    );
    expect(html).toContain("Fixture-Vorschau");
    expect(html.match(/class="concept-card"/g)).toHaveLength(3);
    expect(html).toContain("Direction 1");
    expect(html).toContain("Im bestehenden CLI auswählen");
    expect(html).not.toContain("<form");
    expect(
      (await fetch(bare, { method: "POST", headers: { cookie } })).status,
    ).toBe(405);
  });

  it("serves only declared screenshots and rejects traversal", async () => {
    const { review } = await reviewFixture();
    const gallery = await startConceptPreview({ review });
    cleanups.push(gallery.close);
    const admission = await fetch(gallery.url, { redirect: "manual" });
    const cookie = admission.headers.get("set-cookie")!.split(";", 1)[0];
    const base = new URL(gallery.url);
    base.search = "";
    expect(
      (
        await fetch(new URL("/screens/direction-1/desktop", base), {
          headers: { cookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(new URL("/%2e%2e%2fpackage.json", base), {
          headers: { cookie },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await fetch(new URL("/screens/direction-1/unknown", base), {
          headers: { cookie },
        })
      ).status,
    ).toBe(404);
  });

  it("rejects a screenshot changed after startup", async () => {
    const { review } = await reviewFixture();
    const gallery = await startConceptPreview({ review });
    cleanups.push(gallery.close);
    await writeFile(review.previews[0].browser.images[0].path, "tampered");
    const admission = await fetch(gallery.url, { redirect: "manual" });
    const cookie = admission.headers.get("set-cookie")!.split(";", 1)[0];
    const imageUrl = new URL("/screens/direction-1/desktop", gallery.url);
    expect((await fetch(imageUrl, { headers: { cookie } })).status).toBe(409);
  });

  it("rejects an artifact changed after startup", async () => {
    const { review } = await reviewFixture();
    const gallery = await startConceptPreview({ review });
    cleanups.push(gallery.close);
    await writeFile(
      path.join(review.previews[0].render.artifactDir, "index.html"),
      "tampered",
    );
    expect((await fetch(gallery.url)).status).toBe(409);
  });
});
