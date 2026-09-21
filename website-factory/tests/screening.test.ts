import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { collect } from "../src/crawler.js";
import { screenCollected, screenWebsite } from "../src/screening.js";

vi.mock("../src/crawler.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/crawler.js")>()),
  collect: vi.fn(),
}));

async function collected(
  html: string,
  overrides: Record<string, unknown> = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), "polire-screening-"));
  const rawDirectory = path.join(directory, "raw");
  await mkdir(rawDirectory);
  const rawPath = path.join(rawDirectory, "raw.html");
  await writeFile(rawPath, html, "utf8");
  const evidenceId = "e-page";
  return {
    website: "https://example.test/",
    crawl_pages: [
      {
        page_ref: "page-test",
        url: "https://example.test/",
        outcome: "ok",
        evidence_ids: [evidenceId],
      },
    ],
    evidence: [
      {
        evidence_id: evidenceId,
        kind: "html",
        source_url: "https://example.test/",
        artifact_hash: createHash("sha256").update(html).digest("hex"),
        locator: `${rawPath}#text-chunk-1`,
        excerpt: "Persisted page excerpt",
      },
    ],
    errors: [],
    ...overrides,
  };
}

describe("screenCollected", () => {
  it("keeps a near-empty static page uncertain even when its metadata is complete", async () => {
    const crawl = await collected(
      "<html><head><title>Firma</title><meta name=viewport content=width-device><meta name=description content=Firma></head><body>Willkommen</body></html>",
    );
    const result = await screenCollected("https://example.test/", crawl);
    expect(result.status).toBe("uncertain");
    expect(result.limitations.join(" ")).toMatch(/wenig lesbarer Inhalt/i);
  });
  it("grounds static signals in exact homepage markup and ranks strong signals", async () => {
    const crawl = await collected(
      '<html><head></head><body><frame src="https://widget.example/"></body></html>',
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("candidate");
    expect(result.priority).toBeGreaterThanOrEqual(2);
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_viewport",
          sourceUrl: "https://example.test/",
          excerpt: "<head>",
        }),
        expect.objectContaining({
          code: "frame_present",
          excerpt: '<frame src="https://widget.example/">',
        }),
      ]),
    );
  });

  it("does not rank a modern iframe as a legacy frame signal", async () => {
    const crawl = await collected(
      '<html><head><title>Example</title><meta name=viewport content=width-device><meta name=description content=Example></head><body>Unsere Werkstatt in Zürich zeigt hier Leistungen, Kontakt und aktuelle Öffnungszeiten für Kundinnen und Kunden.<iframe src="https://maps.example/"></iframe></body></html>',
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("no_signal");
    expect(result.priority).toBe(0);
    expect(result.signals.map((signal) => signal.code)).not.toContain(
      "frame_present",
    );
  });

  it("ignores commented markup and metadata outside the actual head", async () => {
    const crawl = await collected(
      "<html><head><!-- <meta name=viewport content=width-device><title>Ignored</title><frame src=bad> --><title>Actual title</title><meta name=description content=Actual></head><body><meta name=viewport content=body><!-- <frame src=bad> --></body></html>",
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_viewport" }),
      ]),
    );
    expect(result.signals.map((signal) => signal.code)).not.toContain(
      "missing_title",
    );
    expect(result.signals.map((signal) => signal.code)).not.toContain(
      "frame_present",
    );
  });

  it("recognizes title, description and viewport despite attribute quote and order variations", async () => {
    const crawl = await collected(
      "<html><head><meta content='width=device-width, initial-scale=1' name=viewport><meta content=nope name=description><title>Example</title></head><body>Unsere Werkstatt in Zürich zeigt hier Leistungen, Kontakt und aktuelle Öffnungszeiten für Kundinnen und Kunden.</body></html>",
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("no_signal");
    expect(result.signals).toEqual([
      expect.objectContaining({ code: "missing_contact" }),
    ]);
  });

  it("requires nonempty viewport and description content", async () => {
    const crawl = await collected(
      '<html><head><title>Example</title><meta name=viewport content=""><meta content="" name=description></head><body></body></html>',
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_viewport" }),
        expect.objectContaining({ code: "missing_description" }),
      ]),
    );
  });

  it("decodes and grounds email and phone contacts from retrieved markup", async () => {
    const crawl = await collected(
      '<html><head><title>Example</title><meta name="viewport" content="width=device-width"><meta name="description" content="Contact"></head><body><a href="mailto:info&#64;example.test">info&#64;example.test</a><a href="tel:+41%2044%20555%2001%2002">+41 44 555 01 02</a></body></html>',
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.contacts).toEqual([
      {
        kind: "email",
        value: "info@example.test",
        sourceUrl: "https://example.test/",
        excerpt: 'href="mailto:info&#64;example.test"',
      },
      {
        kind: "phone",
        value: "+41 44 555 01 02",
        sourceUrl: "https://example.test/",
        excerpt: 'href="tel:+41%2044%20555%2001%2002"',
      },
    ]);
  });

  it("removes a mailto query before recording the address", async () => {
    const crawl = await collected(
      '<html><head><title>Example</title><meta name=viewport content=width-device><meta name=description content=Example></head><body><a href="mailto:info@example.test?subject=Hallo">write</a></body></html>',
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.contacts[0]?.value).toBe("info@example.test");
  });

  it("reads repeated evidence chunks for one raw page only once", async () => {
    const crawl = await collected(
      '<html><head><title>Example</title><meta name=viewport content=width-device><meta name=description content=Example></head><body><frame src="https://widget.example/"></body></html>',
    );
    crawl.evidence.push({
      ...crawl.evidence[0],
      locator: `${crawl.evidence[0].locator}#text-chunk-2`,
    });

    const result = await screenCollected("https://example.test/", crawl);

    expect(
      result.signals.filter((signal) => signal.code === "frame_present"),
    ).toHaveLength(1);
  });

  it("does not turn a missing description on two pages into a candidate", async () => {
    const html =
      "<html><head><title>Example</title><meta name=viewport content=width-device></head><body>Unsere Werkstatt in Zürich zeigt hier Leistungen, Kontakt und aktuelle Öffnungszeiten für Kundinnen und Kunden.</body></html>";
    const crawl = await collected(html);
    const contactPath = path.join(
      path.dirname(crawl.evidence[0].locator.split("#", 1)[0]),
      "contact.html",
    );
    await writeFile(contactPath, html, "utf8");
    crawl.crawl_pages.push({
      page_ref: "page-contact",
      url: "https://example.test/contact",
      outcome: "ok",
      evidence_ids: ["e-contact"],
    });
    crawl.evidence.push({
      ...crawl.evidence[0],
      evidence_id: "e-contact",
      source_url: "https://example.test/contact",
      artifact_hash: createHash("sha256").update(html).digest("hex"),
      locator: `${contactPath}#text-chunk-1`,
    });

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("no_signal");
    expect(result.priority).toBe(1);
  });

  it.each([
    ["blocked", [{ code: "robots_blocked", message: "blocked" }]],
    ["failed", [{ code: "page_fetch_failed", message: "timeout" }]],
  ])(
    "keeps a %s crawl uncertain instead of giving a verdict",
    async (outcome, errors) => {
      const crawl = await collected("", {
        crawl_pages: [{ url: "https://example.test/", outcome }],
        evidence: [],
        errors,
      });

      const result = await screenCollected("https://example.test/", crawl);

      expect(result.status).toBe("uncertain");
      expect(result.priority).toBe(0);
      expect(result.signals).toEqual([]);
      expect(result.limitations.join(" ")).toMatch(
        /verfügbar|blockiert|fehlgeschlagen/i,
      );
    },
  );

  it("keeps a crawl with a failed child page uncertain", async () => {
    const crawl = await collected("<html><head></head><body></body></html>", {
      crawl_pages: [
        { url: "https://example.test/", outcome: "ok" },
        { url: "https://example.test/contact", outcome: "failed" },
      ],
    });

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("uncertain");
  });

  it("keeps a Javascript shell uncertain rather than treating absent metadata as a candidate", async () => {
    const crawl = await collected(
      '<html><head><script src="/app.js"></script></head><body><div id="root"></div></body></html>',
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("uncertain");
    expect(result.signals).toEqual([]);
    expect(result.limitations.join(" ")).toMatch(/Javascript/i);
  });

  it("does not make a candidate from a contact or a Swiss-looking domain", async () => {
    const crawl = await collected(
      '<html><head><title>Example</title><meta name=viewport content=width-device><meta name=description content=Example></head><body>Unsere Werkstatt in Zürich zeigt hier Leistungen, Kontakt und aktuelle Öffnungszeiten für Kundinnen und Kunden.<a href="mailto:hello@example.ch">hello@example.ch</a></body></html>',
      { website: "https://example.ch/" },
    );

    const result = await screenCollected("https://example.ch/", crawl);

    expect(result.status).toBe("no_signal");
    expect(result.priority).toBe(0);
    expect(result.signals).toEqual([
      expect.objectContaining({
        code: "contact_present",
        excerpt: 'href="mailto:hello@example.ch"',
      }),
    ]);
    expect(result.contacts).toHaveLength(1);
  });

  it("does not read an evidence locator without a persisted absolute raw path", async () => {
    const crawl = await collected("<html></html>", {
      evidence: [
        {
          kind: "html",
          source_url: "https://example.test/",
          locator: "raw/page.html#text-chunk-1",
        },
      ],
    });

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("uncertain");
    expect(result.signals).toEqual([]);
  });

  it("does not read an absolute locator outside the crawler raw directory", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "polire-screening-"));
    const outside = path.join(directory, "outside.html");
    await writeFile(outside, "<html></html>", "utf8");
    const crawl = await collected("", {
      evidence: [
        {
          kind: "html",
          source_url: "https://example.test/",
          locator: `${outside}#text-chunk-1`,
        },
      ],
    });

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("uncertain");
  });

  it("normalizes the collection output directory before starting a crawl", async () => {
    vi.mocked(collect).mockResolvedValueOnce({
      crawl_pages: [{ url: "https://example.test/", outcome: "failed" }],
      evidence: [],
      errors: [],
    });

    await screenWebsite("https://example.test/", {
      outputDir: "relative-output",
    });

    expect(collect).toHaveBeenCalledWith(
      "https://example.test/",
      expect.objectContaining({ outputDir: path.resolve("relative-output") }),
    );
  });

  it("replays a hermetic CrawlPage outcome contract", async () => {
    const crawl = await collected(
      "<html><head><title>Example</title><meta name=viewport content=width-device><meta name=description content=Example></head><body>Unsere Werkstatt in Zürich zeigt hier Leistungen, Kontakt und aktuelle Öffnungszeiten für Kundinnen und Kunden.</body></html>",
    );

    const result = await screenCollected("https://example.test/", crawl);

    expect(crawl.crawl_pages[0]).toMatchObject({
      page_ref: "page-test",
      url: "https://example.test/",
      outcome: "ok",
      evidence_ids: ["e-page"],
    });
    expect(result.status).not.toBe("uncertain");
  });

  it("keeps the result uncertain when a successful homepage cannot be verified", async () => {
    const crawl = await collected(
      "<html><head><title>Home</title><meta name=viewport content=width-device><meta name=description content=Home></head><body></body></html>",
    );
    const contactHtml =
      "<html><head><title>Contact</title><meta name=viewport content=width-device><meta name=description content=Contact></head><body></body></html>";
    const rawPath = crawl.evidence[0].locator.split("#", 1)[0];
    const contactPath = path.join(path.dirname(rawPath), "contact.html");
    await writeFile(contactPath, contactHtml, "utf8");
    crawl.evidence[0].artifact_hash = "0".repeat(64);
    crawl.evidence.push({
      evidence_id: "e-contact",
      kind: "html",
      source_url: "https://example.test/contact",
      artifact_hash: createHash("sha256").update(contactHtml).digest("hex"),
      locator: `${contactPath}#text-chunk-1`,
      excerpt: "Contact",
    });
    crawl.crawl_pages.push({
      page_ref: "page-contact",
      url: "https://example.test/contact",
      outcome: "ok",
      evidence_ids: ["e-contact"],
    });

    const result = await screenCollected("https://example.test/", crawl);

    expect(result.status).toBe("uncertain");
  });
});
