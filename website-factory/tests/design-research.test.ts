import { describe, expect, it, vi } from "vitest";
import { researchDesign, designIndustry } from "../src/design-research.js";
import { defaultConfig } from "../src/config.js";
import { fixtureInput } from "../src/fixtures.js";

describe("bounded design reference research", () => {
  it("captures mobile and desktop for the first usable reference within one shared crawl budget", async () => {
    const config = structuredClone(defaultConfig());
    config.designResearch.referenceUrls = [
      "https://one.example/",
      "https://two.example/",
    ];
    const collector = vi.fn(async (_url: string, options: any) => {
      const crawl = fixtureInput();
      const views =
        options.screenshotViewports === "all" ? [375, 1440] : [1440];
      crawl.evidence.push(
        ...views.map((width) => ({
          ...crawl.evidence[0],
          evidence_id: `screen-${width}`,
          kind: "screenshot",
          locator: JSON.stringify({
            viewport: { width, height: 812 },
            full_page: true,
          }),
        })),
      );
      crawl.images = views.map((width) => ({
        ...crawl.images[0],
        evidence_id: `screen-${width}`,
        path: `${width}.png`,
        width,
      }));
      return crawl;
    });
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      collector,
    });
    expect(
      collector.mock.calls.map((call) => call[1].screenshotViewports),
    ).toEqual(["all", "desktop"]);
    expect(collector.mock.calls[0][1].maxBrowserRequestsPerLead).toBe(80);
    expect(collector.mock.calls[1][1].maxBrowserRequestsPerLead).toBe(80);
    expect(collector.mock.calls[0][1].maxCrawlBytesPerLead).toBe(12_000_000);
    expect(collector.mock.calls[0][1].maxCrawlDurationMs).toBe(45_000);
    expect(packet.images).toHaveLength(3);
    expect(packet.research.references[0].image_evidence_ids).toHaveLength(2);
    expect(packet.research.references[1].image_evidence_ids).toHaveLength(1);
  });
  it("records missing mobile evidence and source limits without inventing a view", async () => {
    const config = structuredClone(defaultConfig());
    config.designResearch.referenceUrls = ["https://one.example/"];
    const crawl = fixtureInput();
    crawl.evidence = [
      {
        ...crawl.evidence[0],
        evidence_id: "desktop",
        kind: "screenshot",
        locator: JSON.stringify({ viewport: { width: 1440, height: 1000 } }),
      },
    ];
    crawl.images = [
      {
        ...crawl.images[0],
        evidence_id: "desktop",
        path: "desktop.png",
        width: 1440,
      },
    ];
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      collector: async () => crawl,
    });
    expect(packet.research.references[0].image_evidence_ids).toHaveLength(1);
    expect(packet.research.references[0].capture_limitations).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Mobil/),
        expect.stringMatching(/Textquelle/),
      ]),
    );
    expect(packet.research.status).toBe("partial");
  });
  it("rotates curated industry candidates by project and supplies a reasoned contrast", async () => {
    const config = structuredClone(defaultConfig());
    const run = (website: string) =>
      researchDesign({
        profile: {
          facts: [
            {
              field: "industry",
              value: "Coiffeur",
              verification: "source_reported",
            },
          ],
        },
        website,
        config,
        outputDir: "work/test-design",
        collector: async () => ({ ...fixtureInput(), images: [] }),
      });
    const first = await run("https://salon-a.example/");
    expect(
      (await run("https://salon-a.example/")).research.references.map(
        (r: any) => r.url,
      ),
    ).toEqual(first.research.references.map((r: any) => r.url));
    const projects = await Promise.all(
      ["b", "c", "d", "e"].map((x) => run(`https://salon-${x}.example/`)),
    );
    expect(
      new Set([first, ...projects].map((x) => x.research.references[0].url))
        .size,
    ).toBeGreaterThan(1);
    expect(first.research.references[0].selection_role).toBe("industry");
    expect(first.research.references[1].selection_role).toBe("contrast");
    expect(first.research.references[1].selection_reason).toMatch(
      /fotoarm|Typografie|Struktur/i,
    );
  });
  it("keeps operator URLs ahead of catalog and disables discovery when search is off", async () => {
    const config = structuredClone(defaultConfig());
    config.designResearch.referenceUrls = ["https://chosen.example/"];
    const discover = vi.fn(async () => [{ url: "https://search.example/" }]);
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      discover,
      collector: async () => ({ ...fixtureInput(), images: [] }),
    });
    expect(discover).not.toHaveBeenCalled();
    expect(packet.research.references[0].url).toBe("https://chosen.example/");
    expect(packet.research.references[0].selection_role).toBe("operator");
    expect(packet.research.references[1].selection_role).toBe("contrast");
  });
  it("mixes successful search with a reasoned catalog contrast inside the same cap", async () => {
    const config = structuredClone(defaultConfig());
    config.research.enabled = true;
    config.designResearch.maxReferences = 3;
    const packet = await researchDesign({
      profile: {
        facts: [
          {
            field: "industry",
            value: "Coiffeur",
            verification: "source_reported",
          },
        ],
      },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      discover: async () => [
        { url: "https://search-one.example/" },
        { url: "https://search-two.example/" },
        { url: "https://search-three.example/" },
      ],
      collector: async () => ({ ...fixtureInput(), images: [] }),
    });
    expect(
      packet.research.references.map(
        (reference: any) => reference.selection_role,
      ),
    ).toEqual(["search", "contrast", "search"]);
    expect(packet.research.references[0].url).toBe(
      "https://search-one.example/",
    );
    expect(packet.research.references[2].url).toBe(
      "https://search-two.example/",
    );
    expect(packet.research.references[1].selection_reason).toMatch(
      /benachbart|branchenfremd/i,
    );
  });
  it("labels the craft catalog as adjacent rather than verified trade references", async () => {
    const config = structuredClone(defaultConfig());
    const packet = await researchDesign({
      profile: {
        facts: [
          {
            field: "industry",
            value: "Sanitärinstallationen",
            verification: "source_reported",
          },
        ],
      },
      website: "https://plumbing.example/",
      config,
      outputDir: "work/test-design",
      collector: async () => ({ ...fixtureInput(), images: [] }),
    });
    expect(
      packet.research.references.every(
        (reference: any) => reference.selection_role === "contrast",
      ),
    ).toBe(true);
    expect(packet.research.references[0].selection_reason).toMatch(
      /kein Branchennachweis/i,
    );
    expect(packet.research.gaps.join(" ")).toMatch(
      /keine direkte Branchenreferenz/i,
    );
  });
  it("limits three references to four image bindings", async () => {
    const config = structuredClone(defaultConfig());
    config.designResearch.maxReferences = 3;
    config.designResearch.referenceUrls = [
      "https://one.example/",
      "https://two.example/",
      "https://three.example/",
    ];
    const collector = vi.fn(async (_url: string, options: any) => {
      const crawl = fixtureInput();
      const widths =
        options.screenshotViewports === "all" ? [375, 1440] : [1440];
      crawl.evidence.push(
        ...widths.map((width) => ({
          ...crawl.evidence[0],
          evidence_id: `screen-${width}`,
          kind: "screenshot",
        })),
      );
      crawl.images = widths.map((width) => ({
        ...crawl.images[0],
        evidence_id: `screen-${width}`,
        path: `${width}.png`,
        width,
      }));
      return crawl;
    });
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      collector,
    });
    expect(packet.research.references).toHaveLength(3);
    expect(packet.images).toHaveLength(4);
  });
  it("uses catalog sources after invalid search results without increasing the crawl cap", async () => {
    const config = structuredClone(defaultConfig());
    config.research.enabled = true;
    const collector = vi.fn(async () => ({ ...fixtureInput(), images: [] }));
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      discover: async () => [
        { url: "http://127.0.0.1/" },
        { url: "https://lead.example/" },
      ],
      collector,
    });
    expect(packet.research.source_mode).toBe("catalog");
    expect(packet.research.references).toHaveLength(2);
    expect(collector).toHaveBeenCalledTimes(2);
  });
  it("uses the remaining capture slot for a catalog reference when the first search page fails", async () => {
    const config = structuredClone(defaultConfig());
    config.research.enabled = true;
    const collector = vi
      .fn()
      .mockResolvedValueOnce({ evidence: [], images: [] })
      .mockResolvedValue({ ...fixtureInput(), images: [] });
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      discover: async () => [
        { url: "https://dead.example/" },
        { url: "https://another.example/" },
      ],
      collector,
    });
    expect(packet.research.source_mode).toBe("catalog");
    expect(packet.research.references).toHaveLength(1);
    expect(collector).toHaveBeenCalledTimes(2);
    expect(
      collector.mock.calls.map((call) => call[1].screenshotViewports),
    ).toEqual(["all", "all"]);
    expect(packet.research.references[0].selection_role).toBe("contrast");
  });
  it("selects salon references using accepted business facts, not an arbitrary brand name", async () => {
    expect(
      designIndustry({
        facts: [
          {
            field: "industry",
            value: "Coiffeur",
            verification: "source_reported",
          },
        ],
      }).key,
    ).toBe("salon");
    expect(
      designIndustry({
        facts: [{ field: "company_name", value: "Salon Gardens" }],
      }).key,
    ).toBe("general");
    expect(
      designIndustry({
        facts: [
          { field: "industry", value: "Friseur", verification: "unknown" },
        ],
      }).key,
    ).toBe("general");
  });
  it("uses real collected evidence and images with a hard reference cap", async () => {
    const collect = vi.fn(async () => {
      const crawl = fixtureInput();
      crawl.evidence.push({
        ...crawl.evidence[0],
        evidence_id: "screen",
        kind: "screenshot",
      });
      crawl.images = [
        { ...crawl.images[0], evidence_id: "screen", path: "screenshot.png" },
      ];
      return { ...crawl, observedAt: new Date().toISOString() };
    });
    const config = structuredClone(defaultConfig());
    config.designResearch.referenceUrls = [
      "https://one.example/",
      "https://two.example/",
      "https://three.example/",
    ];
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      collector: collect,
    });
    expect(collect).toHaveBeenCalledTimes(2);
    expect(collect.mock.calls[0]).toEqual([
      "https://one.example/",
      expect.objectContaining({
        browser: true,
        lighthouse: false,
        maxHtmlPagesPerLead: 1,
      }),
    ]);
    expect(packet.research.references).toHaveLength(2);
    expect(packet.images).toHaveLength(2);
    expect(new Set(packet.images.map((x: any) => x.evidence_id)).size).toBe(2);
    expect(packet.research.source_mode).toBe("operator");
    expect(packet.research.status).toBe("partial");
  });
  it("never turns a search snippet or blocked crawl into visual evidence", async () => {
    const config = structuredClone(defaultConfig());
    config.research.enabled = true;
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      discover: async () => [
        {
          url: "https://other.example/",
          title: "Best website",
          snippet: "Amazing design",
        },
      ],
      collector: async () => ({ evidence: [], images: [], crawl_pages: [] }),
    });
    expect(packet.research.references).toEqual([]);
    expect(packet.images).toEqual([]);
    expect(packet.research.status).toBe("unavailable");
    expect(packet.research.gaps.length).toBeGreaterThan(0);
  });
  it("rejects internal and duplicate targets and leaves text-only sources explicitly partial", async () => {
    const config = structuredClone(defaultConfig());
    config.designResearch.referenceUrls = [
      "http://127.0.0.1/",
      "https://lead.example/",
      "https://other.example/",
    ];
    const collect = vi.fn(async () => ({ ...fixtureInput(), images: [] }));
    const packet = await researchDesign({
      profile: { facts: [] },
      website: "https://lead.example/",
      config,
      outputDir: "work/test-design",
      collector: collect,
    });
    expect(collect).toHaveBeenCalledTimes(2);
    expect(packet.research.status).toBe("partial");
    expect(packet.images).toEqual([]);
  });
});
