import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { renderSite, verifyArtifact } from "../src/renderer.js";
import { startPreview } from "../src/preview.js";
import { hash } from "../src/contracts.js";
import { chromium } from "playwright";

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
  test("keeps the page heading before a later hero without reordering sections", async () => {
    const base = siteSpec();
    const home = base.pages[0];
    const laterHero = {
      ...home,
      sections: [home.sections[1], home.sections[0]],
    };
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec({
        theme: { ...base.theme, composition: "editorial" },
        pages: [laterHero, base.pages[1]],
      }),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const html = await readFile(
      path.join(rendered.artifactDir, "index.html"),
      "utf8",
    );
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(
      /<h1>Muster Gartenpflege<\/h1>[\s\S]*id="contact-main"[\s\S]*id="hero-main"/,
    );
    expect(html).toContain("<h2>Ihr Garten. Sorgfaeltig gepflegt.</h2>");
  });

  test("keeps theme palette, spacing, font choice and long headings usable in the browser", async () => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    }
    try {
      const page = await browser.newPage({
        viewport: { width: 375, height: 812 },
      });
      for (const composition of [
        "atelier",
        "editorial",
        "bold",
        "minimal",
      ] as const) {
        const measurements: number[] = [];
        for (const spacing of ["compact", "generous"] as const) {
          const base = siteSpec();
          base.pages[0].sections[0].heading = copy(
            "SehrLangerUntrennbarerFirmennameOhneLeerzeichenDerTrotzdemSichtbarBleibenMuss",
          );
          const rendered = await renderSite({
            leadId: "lead-renderer-test",
            siteSpec: siteSpec({
              ...base,
              theme: {
                ...base.theme,
                composition,
                palette: "dark",
                accent_hex: null,
                spacing,
                font_pair: "sans",
              },
            }),
            profile,
            assets: [],
            outputDir: await temporaryDirectory(),
            mode: "fixture",
          });
          const html = await readFile(
            path.join(rendered.artifactDir, "index.html"),
            "utf8",
          );
          const css = await readFile(
            path.join(rendered.artifactDir, "assets", "site.css"),
            "utf8",
          );
          await page.setContent(
            html
              .replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, "")
              .replace(
                '<link rel="stylesheet" href="/assets/site.css"/>',
                `<style>${css}</style>`,
              ),
          );
          const actual = await page.evaluate(() => {
            const root = getComputedStyle(document.documentElement);
            const section = document.querySelector(".designed-section")!;
            const heading = section.querySelector("h1")!;
            return {
              paper: root.backgroundColor,
              padding: Number.parseFloat(getComputedStyle(section).paddingTop),
              font: getComputedStyle(heading).fontFamily,
              fits:
                heading.getBoundingClientRect().right <= innerWidth &&
                document.documentElement.scrollWidth <= innerWidth,
            };
          });
          expect(actual.paper).toMatch(
            /^rgb\((?:[0-6]?\d), (?:[0-6]?\d), (?:[0-6]?\d)\)$/,
          );
          expect(actual.font).not.toMatch(/Georgia|Times New Roman/);
          expect(actual.fits).toBe(true);
          measurements.push(actual.padding);
        }
        expect(measurements[1]).toBeGreaterThan(measurements[0] + 20);
        for (const width of [768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
        await page.setViewportSize({ width: 375, height: 812 });
      }
      const base = siteSpec();
      const rendered = await renderSite({
        leadId: "lead-renderer-test",
        siteSpec: siteSpec({
          theme: {
            ...base.theme,
            composition: "atelier",
            font_pair: "editorial",
          },
        }),
        profile,
        assets: [],
        outputDir: await temporaryDirectory(),
        mode: "fixture",
      });
      const html = await readFile(
        path.join(rendered.artifactDir, "index.html"),
        "utf8",
      );
      const css = await readFile(
        path.join(rendered.artifactDir, "assets", "site.css"),
        "utf8",
      );
      await page.setContent(
        html
          .replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, "")
          .replace(
            '<link rel="stylesheet" href="/assets/site.css"/>',
            `<style>${css}</style>`,
          ),
      );
      expect(
        await page
          .locator("h1")
          .evaluate((element) => getComputedStyle(element).fontFamily),
      ).toMatch(/Georgia|Times New Roman/);
    } finally {
      await browser.close();
    }
  }, 20000);

  test("chooses a truly legible ink for a middle-grey brand accent", async () => {
    const base = siteSpec();
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec({
        theme: { ...base.theme, composition: "bold", accent_hex: "#777777" },
      }),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const css = await readFile(
      path.join(rendered.artifactDir, "assets", "site.css"),
      "utf8",
    );
    expect(css).toContain("--accent:#777777;--accent-ink:#000000");
  });

  test("keeps ordinary bold hero words and contact labels intact on desktop", async () => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    }
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      for (const composition of ["bold", "atelier"] as const) {
        const base = siteSpec();
        base.pages[0].sections[0].heading = copy("Haarschnitte in Zürich");
        const rendered = await renderSite({
          leadId: "lead-renderer-test",
          siteSpec: siteSpec({
            ...base,
            theme: {
              ...base.theme,
              composition,
              font_pair: composition === "atelier" ? "editorial" : "sans",
            },
          }),
          profile: {
            ...profile,
            contacts: [
              ...profile.contacts,
              {
                contact_id: "contact-page",
                kind: "contact_page",
                value: "https://fixture.alpina-service.example/kontakt",
                evidence_ids: ["ev-5"],
              },
            ],
          },
          assets: [],
          outputDir: await temporaryDirectory(),
          mode: "fixture",
        });
        const html = await readFile(
          path.join(rendered.artifactDir, "index.html"),
          "utf8",
        );
        const css = await readFile(
          path.join(rendered.artifactDir, "assets", "site.css"),
          "utf8",
        );
        await page.setContent(
          html
            .replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, "")
            .replace(
              '<link rel="stylesheet" href="/assets/site.css"/>',
              `<style>${css}</style>`,
            ),
        );
        const result = await page.evaluate(() => {
          const rectCount = (element: Element, length: number) => {
            const range = document.createRange();
            range.setStart(element.firstChild!, 0);
            range.setEnd(element.firstChild!, length);
            return range.getClientRects().length;
          };
          const headline = document.querySelector("h1")!;
          const label = Array.from(
            document.querySelectorAll(".contact span"),
          ).find((element) => element.textContent === "Kontaktseite")!;
          return {
            wordLines: rectCount(headline, "Haarschnitte".length),
            labelLines: rectCount(label, "Kontaktseite".length),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        if (composition === "bold") expect(result.wordLines).toBe(1);
        expect(result.labelLines).toBe(1);
        expect(result.overflow).toBe(false);
      }
    } finally {
      await browser.close();
    }
  }, 15000);

  test.each(["atelier", "editorial", "bold", "minimal"] as const)(
    "renders %s as a distinct composition with one heading and no invented imagery",
    async (composition) => {
      const base = siteSpec();
      const rendered = await renderSite({
        leadId: "lead-renderer-test",
        siteSpec: siteSpec({ theme: { ...base.theme, composition } }),
        profile,
        assets: [],
        outputDir: await temporaryDirectory(),
        mode: "fixture",
      });
      const home = await readFile(
        path.join(rendered.artifactDir, "index.html"),
        "utf8",
      );
      const services = await readFile(
        path.join(rendered.artifactDir, "leistungen", "index.html"),
        "utf8",
      );
      expect(home.match(/<h1\b/g)).toHaveLength(1);
      expect(services.match(/<h1\b/g)).toHaveLength(1);
      expect(home).toContain(
        '<a class="brand title-medium-word" href="/">Muster Gartenpflege</a>',
      );
      expect(home).toContain("Ihr Garten. Sorgfaeltig gepflegt.");
      expect(home).toContain(`composition-${composition}`);
      expect(home).not.toMatch(/<img\b|placeholder|placehold\.co/i);
      expect(home).not.toMatch(/(?:mailto:|tel:|https?:\/\/|<script\b)/);
      expect(services).toContain("Regelmaessige Gartenpflege");
      expect(services).toContain('id="services-main"');
      expect(() =>
        verifyArtifact({
          artifactDir: rendered.artifactDir,
          expectedHash: rendered.hash,
        }),
      ).not.toThrow();
    },
  );

  test("composition changes header, hero and service markup rather than only a class", async () => {
    const signatures = new Set<string>();
    for (const composition of [
      "atelier",
      "editorial",
      "bold",
      "minimal",
    ] as const) {
      const base = siteSpec();
      const rendered = await renderSite({
        leadId: "lead-renderer-test",
        siteSpec: siteSpec({ theme: { ...base.theme, composition } }),
        profile,
        assets: [],
        outputDir: await temporaryDirectory(),
        mode: "fixture",
      });
      const home = await readFile(
        path.join(rendered.artifactDir, "index.html"),
        "utf8",
      );
      const services = await readFile(
        path.join(rendered.artifactDir, "leistungen", "index.html"),
        "utf8",
      );
      const header = home.match(
        /<header class="site-header[\s\S]*?<\/header>/,
      )?.[0];
      const hero = home.match(
        /<section id="hero-main"[\s\S]*?<\/section>/,
      )?.[0];
      const list = services.match(
        /<section id="services-main"[\s\S]*?<\/section>/,
      )?.[0];
      expect(header).toBeTruthy();
      expect(hero).toBeTruthy();
      expect(list).toBeTruthy();
      signatures.add(
        `${header?.replace(/composition-[a-z]+/g, "composition")}\n${hero?.replace(/composition-[a-z]+/g, "composition")}\n${list?.replace(/composition-[a-z]+/g, "composition")}`,
      );
    }
    expect(signatures.size).toBe(4);
  });

  test.each([
    [
      "editorial-spread",
      "editorial",
      "editorial",
      "spread-hero",
      "spread-services",
    ],
    ["service-index", "minimal", "sans", "index-hero", "index-services"],
    ["type-poster", "bold", "sans", "poster-hero", "poster-services"],
  ] as const)(
    "renders %s as a genuine photo-free structure",
    async (
      design_profile,
      composition,
      font_pair,
      heroStructure,
      serviceStructure,
    ) => {
      const base = siteSpec();
      const rendered = await renderSite({
        leadId: "lead-renderer-test",
        siteSpec: siteSpec({
          theme: { ...base.theme, design_profile, composition, font_pair },
        }),
        profile,
        assets: [],
        outputDir: await temporaryDirectory(),
        mode: "fixture",
      });
      const home = await readFile(
        path.join(rendered.artifactDir, "index.html"),
        "utf8",
      );
      const services = await readFile(
        path.join(rendered.artifactDir, "leistungen", "index.html"),
        "utf8",
      );
      const css = await readFile(
        path.join(rendered.artifactDir, "assets", "site.css"),
        "utf8",
      );
      expect(home).toContain(`profile-${design_profile}`);
      expect(home).toContain(heroStructure);
      expect(services).toContain(serviceStructure);
      expect(home.match(/<h1\b/g)).toHaveLength(1);
      expect(services.match(/<h1\b/g)).toHaveLength(1);
      expect(home).not.toMatch(/<img\b|<script\b|(?:mailto:|tel:|https?:\/\/)/);
      expect(css).toContain(`.profile-${design_profile}`);
      expect(() =>
        verifyArtifact({
          artifactDir: rendered.artifactDir,
          expectedHash: rendered.hash,
        }),
      ).not.toThrow();
    },
  );

  test("rejects a contradictory selected profile before creating an artifact", async () => {
    const base = siteSpec();
    const outputDir = await temporaryDirectory();
    await expect(
      renderSite({
        leadId: "lead-renderer-test",
        siteSpec: siteSpec({
          theme: {
            ...base.theme,
            design_profile: "type-poster",
            composition: "minimal",
            font_pair: "sans",
          },
        }),
        profile,
        assets: [],
        outputDir,
        mode: "fixture",
      }),
    ).rejects.toThrow(/composition/i);
    expect(
      await (await import("node:fs/promises")).readdir(outputDir),
    ).toHaveLength(0);
  });

  test("profile heroes use distinct desktop grids and deliberate mobile stacks without overflow", async () => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    }
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      const desktopGrids = new Set<string>();
      for (const [design_profile, composition, font_pair, selector] of [
        ["editorial-spread", "editorial", "editorial", ".spread-hero"],
        ["service-index", "minimal", "sans", ".index-hero"],
        ["type-poster", "bold", "sans", ".poster-hero"],
      ] as const) {
        const base = siteSpec();
        base.pages[0].sections[0].heading = copy(
          "Sanitärinstallationen in Zürich",
        );
        base.pages[1].sections[0].items[0].title = copy(
          "Sanitärinstallationen",
        );
        const rendered = await renderSite({
          leadId: "lead-renderer-test",
          siteSpec: siteSpec({
            ...base,
            theme: {
              ...base.theme,
              design_profile,
              composition,
              font_pair,
            },
          }),
          profile,
          assets: [],
          outputDir: await temporaryDirectory(),
          mode: "fixture",
        });
        const html = await readFile(
          path.join(rendered.artifactDir, "index.html"),
          "utf8",
        );
        const servicesHtml = await readFile(
          path.join(rendered.artifactDir, "leistungen", "index.html"),
          "utf8",
        );
        const css = await readFile(
          path.join(rendered.artifactDir, "assets", "site.css"),
          "utf8",
        );
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.setContent(
          html
            .replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, "")
            .replace(
              '<link rel="stylesheet" href="/assets/site.css"/>',
              `<style>${css}</style>`,
            ),
        );
        desktopGrids.add(
          await page
            .locator(selector)
            .evaluate(
              (element) => getComputedStyle(element).gridTemplateColumns,
            ),
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (design_profile === "editorial-spread") {
          expect(
            await page
              .locator(".profile-section.is-hero")
              .evaluate((element) => element.getBoundingClientRect().height),
          ).toBeLessThan(620);
        }
        await page.setViewportSize({ width: 375, height: 812 });
        expect(
          await page
            .locator(selector)
            .evaluate(
              (element) =>
                getComputedStyle(element).gridTemplateColumns.split(" ").length,
            ),
        ).toBe(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const inspectWord = async (headingSelector: string) =>
          page.locator(headingSelector).evaluate((element) => {
            const range = document.createRange();
            range.setStart(element.firstChild!, 0);
            range.setEnd(element.firstChild!, "Sanitärinstallationen".length);
            const rects = Array.from(range.getClientRects());
            return {
              lines: rects.length,
              fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
              overflowWrap: getComputedStyle(element).overflowWrap,
            };
          });
        const heroWord = await inspectWord("h1");
        expect(heroWord.lines).toBe(1);
        expect(heroWord.fontSize).toBeGreaterThanOrEqual(26);
        expect(heroWord.overflowWrap).toBe("normal");
        await page.setContent(
          servicesHtml
            .replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, "")
            .replace(
              '<link rel="stylesheet" href="/assets/site.css"/>',
              `<style>${css}</style>`,
            ),
        );
        const serviceWord = await inspectWord(
          ".profile-section.component-services h3",
        );
        for (const word of [serviceWord]) {
          expect(word.lines).toBe(1);
          expect(word.fontSize).toBeGreaterThanOrEqual(16);
          expect(word.overflowWrap).toBe("normal");
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        const serviceSeparation = await page
          .locator(".profile-section.component-services article")
          .evaluate((article) => {
            const textRect = (element: Element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              return range.getBoundingClientRect();
            };
            const title = textRect(article.querySelector("h3")!);
            const description = textRect(article.querySelector("p")!);
            return {
              separated:
                title.right <= description.left ||
                title.bottom <= description.top ||
                description.right <= title.left ||
                description.bottom <= title.top,
            };
          });
        expect(serviceSeparation.separated).toBe(true);
      }
      expect(desktopGrids.size).toBe(3);
    } finally {
      await browser.close();
    }
  }, 15000);

  test("does not repeat the company name as both brand and home navigation label", async () => {
    const base = siteSpec();
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec({
        theme: {
          ...base.theme,
          design_profile: "type-poster",
          composition: "bold",
          font_pair: "sans",
        },
        navigation: [
          { label: copy("Muster Gartenpflege", ["fact-company"]), route: "/" },
        ],
      }),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const home = await readFile(
      path.join(rendered.artifactDir, "index.html"),
      "utf8",
    );
    const header =
      home.match(/<header class="site-header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header.match(/Muster Gartenpflege/g)).toHaveLength(1);
    expect(header).not.toContain("bold-nav-frame");
    expect(header).not.toContain("<nav");
  });

  test.each([
    ["editorial-spread", "editorial", "editorial"],
    ["service-index", "minimal", "sans"],
    ["type-poster", "bold", "sans"],
  ] as const)(
    "%s keeps the medium-length hero word Haarschnitte intact on mobile",
    async (design_profile, composition, font_pair) => {
      let browser;
      try {
        browser = await chromium.launch({ headless: true });
      } catch {
        browser = await chromium.launch({ headless: true, channel: "chrome" });
      }
      try {
        const base = siteSpec();
        base.pages[0].sections[0].heading = copy("Haarschnitte in Zürich");
        const rendered = await renderSite({
          leadId: "lead-renderer-test",
          siteSpec: siteSpec({
            ...base,
            theme: {
              ...base.theme,
              design_profile,
              composition,
              font_pair,
            },
          }),
          profile,
          assets: [],
          outputDir: await temporaryDirectory(),
          mode: "fixture",
        });
        const html = await readFile(
          path.join(rendered.artifactDir, "index.html"),
          "utf8",
        );
        const css = await readFile(
          path.join(rendered.artifactDir, "assets", "site.css"),
          "utf8",
        );
        const page = await browser.newPage({
          viewport: { width: 375, height: 812 },
        });
        await page.setContent(
          html
            .replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, "")
            .replace(
              '<link rel="stylesheet" href="/assets/site.css"/>',
              `<style>${css}</style>`,
            ),
        );
        const word = await page.locator("h1").evaluate((heading) => {
          const range = document.createRange();
          range.setStart(heading.firstChild!, 0);
          range.setEnd(heading.firstChild!, "Haarschnitte".length);
          return {
            lines: Array.from(range.getClientRects()).length,
            fontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
            lineHeight: Number.parseFloat(getComputedStyle(heading).lineHeight),
            overflowWrap: getComputedStyle(heading).overflowWrap,
            className: heading.className,
          };
        });
        expect(word.lines).toBe(1);
        expect(word.fontSize).toBeGreaterThanOrEqual(32);
        expect(word.overflowWrap).toBe("normal");
        expect(word.className).toContain("title-medium-word");
        if (design_profile === "type-poster") {
          expect(word.lineHeight / word.fontSize).toBeGreaterThanOrEqual(0.95);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      } finally {
        await browser.close();
      }
    },
    15000,
  );

  test("profile section spacing follows compact, comfortable and generous themes", async () => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    }
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      for (const [design_profile, composition, font_pair] of [
        ["editorial-spread", "editorial", "editorial"],
        ["service-index", "minimal", "sans"],
        ["type-poster", "bold", "sans"],
      ] as const) {
        const paddings: number[] = [];
        for (const spacing of ["compact", "comfortable", "generous"] as const) {
          const base = siteSpec();
          const rendered = await renderSite({
            leadId: "lead-renderer-test",
            siteSpec: siteSpec({
              ...base,
              theme: {
                ...base.theme,
                design_profile,
                composition,
                font_pair,
                spacing,
              },
            }),
            profile,
            assets: [],
            outputDir: await temporaryDirectory(),
            mode: "fixture",
          });
          const html = await readFile(
            path.join(rendered.artifactDir, "index.html"),
            "utf8",
          );
          const css = await readFile(
            path.join(rendered.artifactDir, "assets", "site.css"),
            "utf8",
          );
          await page.setContent(
            html
              .replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, "")
              .replace(
                '<link rel="stylesheet" href="/assets/site.css"/>',
                `<style>${css}</style>`,
              ),
          );
          paddings.push(
            await page
              .locator(".profile-section:not(.is-hero)")
              .first()
              .evaluate((section) =>
                Number.parseFloat(getComputedStyle(section).paddingTop),
              ),
          );
        }
        expect(paddings[0]).toBeLessThan(paddings[1]);
        expect(paddings[1]).toBeLessThan(paddings[2]);
      }
    } finally {
      await browser.close();
    }
  }, 15000);

  test("writes a validated brand accent with readable button text and reduced motion CSS", async () => {
    const base = siteSpec();
    const rendered = await renderSite({
      leadId: "lead-renderer-test",
      siteSpec: siteSpec({
        theme: { ...base.theme, composition: "bold", accent_hex: "#FFE500" },
      }),
      profile,
      assets: [],
      outputDir: await temporaryDirectory(),
      mode: "fixture",
    });
    const css = await readFile(
      path.join(rendered.artifactDir, "assets", "site.css"),
      "utf8",
    );
    expect(css).toContain("--accent:#FFE500");
    expect(css).toContain("--accent-ink:#000000");
    expect(css).toMatch(/\.motion-subtle[^}]*animation:/);
    expect(css).toMatch(/prefers-reduced-motion:reduce/);
    expect(css).toMatch(/animation:none!important/);
    expect(css).not.toMatch(/@import|url\(https?:/);
  });

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
