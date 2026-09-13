import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { renderSite, verifyArtifact } from "../src/renderer.js";
import { startPreview } from "../src/preview.js";
import { hash } from "../src/contracts.js";

const temporaryDirectories: string[] = [];
const closePreviewServers: Array<() => Promise<void>> = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "factory-renderer-"));
  temporaryDirectories.push(directory);
  return directory;
}

function copy(text: string, factIds: string[] = []) {
  return {
    text,
    kind: factIds.length > 0 ? "factual" : "editorial",
    fact_ids: factIds,
  };
}

function siteSpec(overrides: Record<string, unknown> = {}) {
  return {
    template_id: "local-service",
    template_version: "1.0.0",
    locale: "de-CH",
    theme: {
      font_pair: "sans",
      palette: "brand",
      accent_hex: "#176b5b",
      spacing: "comfortable",
      motion: "subtle",
    },
    navigation: [
      { label: copy("Start"), route: "/" },
      { label: copy("Leistungen"), route: "/leistungen" },
    ],
    pages: [
      {
        route: "/",
        title: copy("Muster Gartenpflege", ["fact-company"]),
        meta_description: copy("Gartenpflege in Bern", [
          "fact-service",
          "fact-place",
        ]),
        sections: [
          {
            section_id: "hero-main",
            component: "hero",
            variant: "split",
            heading: copy("Ihr Garten. Sorgfaeltig gepflegt."),
            body: [
              copy("Wir pflegen Gaerten in Bern.", [
                "fact-service",
                "fact-place",
              ]),
              copy("</p><script>globalThis.pwned=true</script>"),
            ],
            items: [],
            cta: {
              label: copy("Kontakt ansehen"),
              target: "contact",
              target_ref: "contact-phone",
            },
            asset_id: null,
            addressed_issue_ids: ["issue-mobile"],
          },
          {
            section_id: "contact-main",
            component: "contact",
            variant: "stacked",
            heading: copy("Kontakt"),
            body: [
              copy("Wir zeigen die Kontaktdaten in dieser Vorschau nur an."),
            ],
            items: [],
            cta: null,
            asset_id: null,
            addressed_issue_ids: [],
          },
        ],
      },
      {
        route: "/leistungen",
        title: copy("Leistungen"),
        meta_description: copy("Unsere Leistungen"),
        sections: [
          {
            section_id: "services-main",
            component: "services",
            variant: "cards",
            heading: copy("Was wir fuer Sie tun"),
            body: [],
            items: [
              {
                title: copy("Pflege"),
                text: copy("Regelmaessige Gartenpflege", ["fact-service"]),
              },
            ],
            cta: {
              label: copy("Zum Kontakt"),
              target: "section",
              target_ref: "contact-main",
            },
            asset_id: null,
            addressed_issue_ids: [],
          },
        ],
      },
    ],
    asset_ids: [],
    unresolved_requirements: [],
    ...overrides,
  };
}

const profile = {
  facts: [
    {
      fact_id: "fact-company",
      field: "company_name",
      value: "Muster Gartenpflege",
      evidence_ids: ["ev-1"],
      verification: "source_reported",
      valid_until: null,
    },
    {
      fact_id: "fact-service",
      field: "service",
      value: "Gartenpflege",
      evidence_ids: ["ev-2"],
      verification: "source_reported",
      valid_until: null,
    },
    {
      fact_id: "fact-place",
      field: "locality",
      value: "Bern",
      evidence_ids: ["ev-3"],
      verification: "source_reported",
      valid_until: null,
    },
  ],
  contacts: [
    {
      contact_id: "contact-phone",
      kind: "phone",
      value: "+41 31 555 01 02",
      evidence_ids: ["ev-4"],
    },
  ],
  agency: {
    status: "unknown",
    agency_name: null,
    evidence_ids: [],
    score: null,
  },
  technology_signals: [],
  contradictions: [],
};

afterEach(async () => {
  await Promise.all(closePreviewServers.splice(0).map((close) => close()));
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("renderSite", () => {
  test("escapes supplied text and emits a noindex preview with no executable actions", async () => {
    const outputDir = await temporaryDirectory();
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir,
      mode: "fixture",
    });
    const html = await readFile(
      path.join(rendered.artifactDir, "index.html"),
      "utf8",
    );

    expect(html).toContain(
      "&lt;/p&gt;&lt;script&gt;globalThis.pwned=true&lt;/script&gt;",
    );
    expect(html).not.toContain("<script");
    expect(html).toContain(
      'name="robots" content="noindex, nofollow, noarchive"',
    );
    expect(html).toContain("Unverbindlicher Gestaltungsvorschlag");
    expect(html).toContain('href="/leistungen"');
    expect(html).not.toMatch(/(?:mailto:|tel:|https?:\/\/)/);
    expect(html).toContain("Es wird nichts versendet");
    expect(rendered.build.result).toBe("pass");
    expect(rendered.manifest.lead_id).toBe("lead-renderer-test");
    expect(html).not.toMatch(
      /<p class="eyebrow">(?:hero|services|contact)<\/p>/i,
    );
  });

  test("produces identical content hashes for identical inputs", async () => {
    const first = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const second = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });

    expect(second.contentHash).toBe(first.contentHash);
    expect(second.manifest.site_spec_hash).toBe(first.manifest.site_spec_hash);
    expect(first.hash).toBe(hash(first.manifest));
    expect(first.build.artifact_hash).toBe(first.hash);
  });

  test("rejects traversal routes before writing a site", async () => {
    const malicious = siteSpec({
      navigation: [{ label: copy("Geheim"), route: "/../geheim" }],
      pages: [
        {
          ...(siteSpec().pages as Array<Record<string, unknown>>)[0],
          route: "/../geheim",
        },
      ],
    });

    await expect(
      renderSite({
        leadId: "lead-renderer-test",
        siteSpec: malicious,
        profile,
        assets: [],
        outputDir: await temporaryDirectory(),
        mode: "fixture",
      }),
    ).rejects.toThrow(/route/i);
  });

  test("rejects factual copy that refers to a foreign fact", async () => {
    const invalid = siteSpec();
    (invalid.pages[0].sections[0].body[0] as { fact_ids: string[] }).fact_ids =
      ["fact-from-another-lead"];

    await expect(
      renderSite({
        leadId: "lead-renderer-test",
        siteSpec: invalid,
        profile,
        assets: [],
        outputDir: await temporaryDirectory(),
        mode: "fixture",
      }),
    ).rejects.toThrow(/fact/i);
  });

  test("detects any change to a rendered file", async () => {
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    await writeFile(
      path.join(rendered.artifactDir, "index.html"),
      "tampered",
      "utf8",
    );
    expect(() =>
      verifyArtifact({
        artifactDir: rendered.artifactDir,
        expectedHash: rendered.hash,
      }),
    ).toThrow(/integrity/i);
  });
});

describe("startPreview", () => {
  test("requires the token and establishes a protected viewer session", async () => {
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const preview = await startPreview({
      artifactDir: rendered.artifactDir,
      token: "a private token",
    });
    closePreviewServers.push(preview.close);

    const unprotectedUrl = new URL(preview.url);
    unprotectedUrl.search = "";
    const denied = await fetch(unprotectedUrl);
    expect(denied.status).toBe(401);

    const admitted = await fetch(preview.url, { redirect: "manual" });
    expect(admitted.status).toBe(303);
    expect(admitted.headers.get("set-cookie")).toContain("factory_preview=");
    expect(admitted.headers.get("location")).toBe("/");

    const cookie = admitted.headers.get("set-cookie")!.split(";", 1)[0];
    const viewed = await fetch(unprotectedUrl, { headers: { cookie } });
    expect(viewed.status).toBe(200);
    expect(viewed.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    const manifestResponse = await fetch(
      new URL("/manifest.json", unprotectedUrl),
      { headers: { cookie } },
    );
    expect(hash(await manifestResponse.json())).toBe(rendered.hash);
  });

  test("refuses access after its configured expiry", async () => {
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const preview = await startPreview({
      artifactDir: rendered.artifactDir,
      token: "expired",
      expiresAt: "2000-01-01T00:00:00.000Z",
    });
    closePreviewServers.push(preview.close);

    expect((await fetch(preview.url)).status).toBe(410);
  });

  test("never extends the expiry recorded in the artifact manifest", async () => {
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const expiredManifest = {
      ...rendered.manifest,
      expires_at: "2000-01-01T00:00:00.000Z",
    };
    const expiredHash = hash(expiredManifest);
    await writeFile(
      path.join(rendered.artifactDir, "manifest.json"),
      `${JSON.stringify(expiredManifest, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(rendered.artifactDir, "build.json"),
      `${JSON.stringify({ ...rendered.build, artifact_hash: expiredHash }, null, 2)}\n`,
      "utf8",
    );
    const preview = await startPreview({
      artifactDir: rendered.artifactDir,
      token: "manifest-expired",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    closePreviewServers.push(preview.close);

    expect((await fetch(preview.url)).status).toBe(410);
  });

  test("blocks a viewer request when an artifact changes after startup", async () => {
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec(),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const preview = await startPreview({
      artifactDir: rendered.artifactDir,
      token: "integrity",
    });
    closePreviewServers.push(preview.close);
    await writeFile(
      path.join(rendered.artifactDir, "assets", "site.css"),
      "changed",
      "utf8",
    );
    expect((await fetch(preview.url)).status).toBe(409);
  });
});
