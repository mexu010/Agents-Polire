import { join } from "node:path";
import { collect, publicUrl } from "./crawler.js";
import { hash, now, validate, type JsonObject } from "./contracts.js";
import type { FactoryConfig } from "./config.js";
import type { SearchResult } from "./research.js";

// Starting points, not a quality ranking. Every run inspects the actual source;
// their assets and claims never enter the client's approved registry.
const CATALOG = {
  salon: [
    "https://www.georgenorthwood.com/",
    "https://www.hershesons.com/pages/stores",
  ],
  hospitality: ["https://www.themodernnyc.com/", "https://ottolenghi.co.uk/"],
  craft: ["https://normcph.com/", "https://www.vitsoe.com/"],
  garden: ["https://www.andy-sturgeon.com/", "https://normcph.com/"],
  general: ["https://normcph.com/", "https://www.pentagram.com/"],
};

export function designIndustry(profile: JsonObject): {
  key: keyof typeof CATALOG;
  label: string;
} {
  const facts = (profile.facts ?? []).filter(
    (fact: JsonObject) =>
      ["industry", "service"].includes(fact.field) &&
      typeof fact.value === "string" &&
      fact.verification !== "unknown" &&
      fact.verification !== "conflicting",
  );
  const text = facts.map((fact: JsonObject) => fact.value).join(" ");
  const label = String(
    facts.find((fact: JsonObject) => fact.field === "industry")?.value ??
      facts[0]?.value ??
      "Allgemeine Gestaltung",
  ).slice(0, 180);
  const key = /coiffeur|friseur|hair|barber|beauty|salon/i.test(text)
    ? "salon"
    : /restaurant|hotel|café|cafe|gastro|bäck|bake|pizzeria/i.test(text)
      ? "hospitality"
      : /garten|garden|landscap|paysag/i.test(text)
        ? "garden"
        : /schrein|holz|bau|sanitär|plumb|architekt|handwerk|maler|electr|elektr/i.test(
              text,
            )
          ? "craft"
          : "general";
  return { key, label };
}

export function fixtureDesignResearch(
  recentDesigns: JsonObject[] = [],
): JsonObject {
  return {
    research: validate("DesignResearch", {
      status: "fixture",
      industry: "SIMULATED",
      query: "SIMULATED design references",
      source_mode: "fixture",
      captured_at: now(),
      references: [],
      gaps: ["Synthetischer Funktionstest; keine echte Inspirationsrecherche."],
      recent_designs: recentDesigns.slice(0, 8),
    }),
    evidence: [],
    images: [],
  };
}

export async function researchDesign(options: {
  profile: JsonObject;
  website: string;
  config: FactoryConfig;
  outputDir: string;
  recentDesigns?: JsonObject[];
  discover?: (query: string) => Promise<SearchResult[]>;
  collector?: (website: string, options: JsonObject) => Promise<JsonObject>;
}): Promise<JsonObject> {
  const { config, profile } = options;
  const industry = designIndustry(profile);
  const query =
    `${industry.label} website design studio official website`.slice(0, 400);
  const limit = Math.max(1, Math.min(3, config.designResearch.maxReferences));
  const gaps: string[] = [];
  let sourceMode = config.designResearch.referenceUrls.length
    ? "operator"
    : "catalog";
  let candidates = config.designResearch.referenceUrls.length
    ? config.designResearch.referenceUrls
    : CATALOG[industry.key];
  if (sourceMode === "catalog" && config.research.enabled && options.discover) {
    try {
      const results = await options.discover(query);
      if (results.length) {
        candidates = results.map((result) => result.url);
        sourceMode = "search";
      } else
        gaps.push(
          "Suche ohne Treffer; Referenzkatalog als Startpunkt verwendet.",
        );
    } catch {
      gaps.push(
        "Suchanbindung nicht verfügbar oder Budget ausgeschöpft; nur kostenlose Katalogabrufe.",
      );
    }
  } else if (sourceMode === "catalog") {
    gaps.push(
      "Keine offene Websuche konfiguriert; branchenbezogener Referenzkatalog wird live geprüft.",
    );
  }
  if (industry.key === "general" && sourceMode === "catalog")
    gaps.push(
      "Kein passender Branchenkatalog: allgemeine Gestaltungsreferenzen, keine belegten Branchenvorbilder.",
    );
  const host = (url: string) =>
    new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  const seen = new Set([host(options.website)]);
  const selectUrls = (entries: string[], count: number): string[] => {
    const chosen: string[] = [];
    for (const candidate of entries.slice(0, 10)) {
      if (chosen.length === count) break;
      try {
        const url = publicUrl(candidate);
        url.hash = "";
        if (url.href.length > 400 || seen.has(host(url.href))) continue;
        seen.add(host(url.href));
        chosen.push(url.href);
      } catch {
        gaps.push("Unsichere oder ungültige Referenzadresse übersprungen.");
      }
    }
    return chosen;
  };
  const useCatalog = (remaining: number): string[] => {
    sourceMode = "catalog";
    gaps.push(
      "Unbrauchbare Suchtreffer; verbleibende Abrufe prüfen den Referenzkatalog.",
    );
    if (industry.key === "general")
      gaps.push(
        "Allgemeine Gestaltungsreferenzen, keine belegten Branchenvorbilder.",
      );
    return selectUrls(CATALOG[industry.key], remaining);
  };
  const urls = selectUrls(candidates, limit);
  if (sourceMode === "search" && !urls.length) urls.push(...useCatalog(limit));
  const references: JsonObject[] = [],
    evidence: JsonObject[] = [],
    images: JsonObject[] = [];
  let attempted = 0;
  for (const url of urls) {
    if (attempted >= limit) break;
    attempted++;
    const refId = `design-${hash(url).slice(0, 20)}`;
    try {
      const crawled = await (options.collector ?? collect)(url, {
        ...config.crawler,
        outputDir: join(options.outputDir, refId),
        browser: true,
        lighthouse: false,
        screenshotViewports: "desktop",
        maxHtmlPagesPerLead: 1,
        maxCrawlDurationMs: Math.min(
          config.crawler.maxCrawlDurationMs,
          config.designResearch.maxDurationMsPerReference,
          60_000,
        ),
        maxCrawlBytesPerLead: Math.min(
          config.crawler.maxCrawlBytesPerLead,
          12_000_000,
        ),
        maxBrowserRequestsPerLead: Math.min(
          config.crawler.maxBrowserRequestsPerLead,
          80,
        ),
      });
      const html = (crawled.evidence ?? [])
        .filter((e: JsonObject) => e.kind === "html" && e.excerpt)
        .slice(0, 2);
      const image = [...(crawled.images ?? [])].sort(
        (a: JsonObject, b: JsonObject) => b.width - a.width,
      )[0];
      const screenshot =
        image &&
        (crawled.evidence ?? []).find(
          (e: JsonObject) =>
            e.kind === "screenshot" && e.evidence_id === image.evidence_id,
        );
      if (!html.length && !screenshot) {
        gaps.push(`Referenz nicht lesbar: ${url}`);
        if (sourceMode === "search" && !references.length && attempted < limit)
          urls.splice(attempted, urls.length, ...useCatalog(limit - attempted));
        continue;
      }
      const remap = (e: JsonObject) =>
        validate("Evidence", {
          ...e,
          evidence_id: `${refId}-${e.evidence_id}`,
        });
      const sources: JsonObject[] = html.map(remap);
      if (screenshot) {
        const bound = remap(screenshot);
        sources.push(bound);
        images.push(
          validate("ImageBinding", {
            evidence_id: bound.evidence_id,
            attachment_ref: image.path,
            sha256: image.sha256,
            width: image.width,
            height: image.height,
          }),
        );
      } else
        gaps.push(
          `Kein Referenzbild verfügbar: ${url}. Nur Textbeobachtungen erlaubt.`,
        );
      evidence.push(...sources);
      references.push({
        reference_id: refId,
        url,
        title: new URL(url).hostname,
        excerpt: html
          .map((e: JsonObject) => e.excerpt)
          .join("\n")
          .slice(0, 2000),
        evidence_ids: sources
          .filter((e) => e.kind === "html")
          .map((e) => e.evidence_id),
        image_evidence_ids: sources
          .filter((e) => e.kind === "screenshot")
          .map((e) => e.evidence_id),
      });
    } catch {
      gaps.push(`Referenzabruf fehlgeschlagen: ${url}`);
      if (sourceMode === "search" && !references.length && attempted < limit)
        urls.splice(attempted, urls.length, ...useCatalog(limit - attempted));
    }
  }
  return {
    research: validate("DesignResearch", {
      status:
        references.length === 0
          ? "unavailable"
          : references.length === limit && images.length === references.length
            ? "complete"
            : "partial",
      industry: industry.label,
      query,
      source_mode: sourceMode,
      captured_at: now(),
      references,
      gaps: gaps.slice(0, 12),
      recent_designs: (options.recentDesigns ?? []).slice(0, 8),
    }),
    evidence,
    images,
  };
}
