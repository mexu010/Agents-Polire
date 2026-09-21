import { describe, expect, it, vi } from "vitest";
import { researchDesign, designIndustry } from "../src/design-research.js";
import { defaultConfig } from "../src/config.js";
import { fixtureInput } from "../src/fixtures.js";

describe("bounded design reference research", () => {
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
    expect(collector.mock.calls[1][0]).toBe("https://normcph.com/");
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
    expect(packet.research.status).toBe("complete");
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
    expect(collect).toHaveBeenCalledTimes(1);
    expect(packet.research.status).toBe("partial");
    expect(packet.images).toEqual([]);
  });
});
