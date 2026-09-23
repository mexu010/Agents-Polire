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
    "https://www.vitsoe.com/",
    "https://normcph.com/",
  ],
  hospitality: [
    "https://www.themodernnyc.com/",
    "https://ottolenghi.co.uk/",
    "https://www.vitsoe.com/",
    "https://normcph.com/",
  ],
  craft: [
    "https://normcph.com/",
    "https://www.vitsoe.com/",
    "https://www.pentagram.com/",
  ],
  garden: [
    "https://www.andy-sturgeon.com/",
    "https://normcph.com/",
    "https://www.vitsoe.com/",
  ],
  general: [
    "https://normcph.com/",
    "https://www.pentagram.com/",
    "https://www.vitsoe.com/",
  ],
};

type SelectionRole = "industry" | "contrast" | "operator" | "search";
type Candidate = { url: string; role: SelectionRole; reason: string };

function rotated<T>(items: T[], seed: string): T[] {
  if (items.length < 2) return [...items];
  const offset = Number.parseInt(hash(seed).slice(0, 8), 16) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function catalogCandidates(
  key: keyof typeof CATALOG,
  project: string,
): Candidate[] {
  const entries = CATALOG[key];
  const industryCount = {
    salon: 2,
    hospitality: 2,
    craft: 0,
    garden: 1,
    general: 0,
  }[key];
  const industry = rotated(
    entries.slice(0, industryCount),
    `${project}:industry`,
  );
  const contrastPool = entries.slice(industryCount);
  const contrasts = rotated(
    contrastPool.length ? contrastPool : entries,
    `${project}:contrast`,
  );
  return [
    ...industry.slice(0, 1).map((url) => ({
      url,
      role: "industry" as const,
      reason:
        "Katalogkandidat aus derselben Branche für Nutzeraufgabe, Leistungsstruktur und Hauptaktion; Eignung folgt erst aus dem Abruf.",
    })),
    ...contrasts.map((url) => ({
      url,
      role: "contrast" as const,
      reason:
        "Benachbarte oder branchenfremde Gestaltungsreferenz für eine fotoarme Übertragung mit Typografie, Raster und klarer Informationsstruktur; kein Branchennachweis.",
    })),
    ...industry.slice(1).map((url) => ({
      url,
      role: "industry" as const,
      reason:
        "Zusätzlicher Katalogkandidat aus derselben Branche; Eignung folgt erst aus dem Abruf.",
    })),
  ];
}

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
  const catalog = catalogCandidates(industry.key, options.website);
  let candidates: Candidate[] = config.designResearch.referenceUrls.length
    ? config.designResearch.referenceUrls.map((url) => ({
        url,
        role: "operator" as const,
        reason:
          "Vom Betreiber ausdrücklich vorgegebene Referenz; tatsächliche Quelle wird weiterhin geprüft.",
      }))
    : catalog;
  if (sourceMode === "catalog" && config.research.enabled && options.discover) {
    try {
      const results = await options.discover(query);
      if (results.length) {
        const searchCandidates = results.map((result) => ({
          url: result.url,
          role: "search" as const,
          reason:
            "Tatsächlicher Suchtreffer zur Branchenaufgabe; Eignung folgt nur aus dem geprüften Quellenbeleg.",
        }));
        const contrast = catalog.find(
          (candidate) => candidate.role === "contrast",
        );
        candidates = [
          searchCandidates[0],
          ...(contrast ? [contrast] : []),
          ...searchCandidates.slice(1),
        ];
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
  const selectCandidates = (
    entries: Candidate[],
    count: number,
  ): Candidate[] => {
    const chosen: Candidate[] = [];
    for (const candidate of entries.slice(0, 10)) {
      if (chosen.length === count) break;
      try {
        const url = publicUrl(candidate.url);
        url.hash = "";
        if (url.href.length > 400 || seen.has(host(url.href))) continue;
        seen.add(host(url.href));
        chosen.push({ ...candidate, url: url.href });
      } catch {
        gaps.push("Unsichere oder ungültige Referenzadresse übersprungen.");
      }
    }
    return chosen;
  };
  const useCatalog = (remaining: number): Candidate[] => {
    sourceMode = "catalog";
    gaps.push(
      "Unbrauchbare Suchtreffer; verbleibende Abrufe prüfen den Referenzkatalog.",
    );
    if (industry.key === "general")
      gaps.push(
        "Allgemeine Gestaltungsreferenzen, keine belegten Branchenvorbilder.",
      );
    return selectCandidates(catalog, remaining);
  };
  const selected = selectCandidates(candidates, limit);
  if (
    sourceMode === "search" &&
    !selected.some((candidate) => candidate.role === "search")
  ) {
    sourceMode = "catalog";
    gaps.push(
      "Unbrauchbare Suchtreffer; ausgewählte Abrufe prüfen nur den Referenzkatalog.",
    );
    selected.push(...selectCandidates(catalog, limit - selected.length));
  }
  if (sourceMode === "operator" && selected.length < limit) {
    gaps.push(
      "Weniger Betreiber-URLs als Referenzplätze; übrige Plätze verwenden begründete Katalogkandidaten.",
    );
    selected.push(...selectCandidates(catalog, limit - selected.length));
  }
  if (sourceMode === "search" && selected.length < limit) {
    gaps.push(
      "Zu wenige unterschiedliche Such- und Kontrastkandidaten; übrige Plätze verwenden weitere Katalogstartpunkte.",
    );
    selected.push(...selectCandidates(catalog, limit - selected.length));
  }
  if (
    industry.key === "craft" &&
    selected.some((candidate) => candidate.role === "contrast")
  )
    gaps.push(
      "Der Handwerk-/Architektur-Katalog enthält nur benachbarte oder branchenfremde Gestaltungsreferenzen und keine direkte Branchenreferenz für den konkreten Handwerksbetrieb.",
    );
  const references: JsonObject[] = [],
    evidence: JsonObject[] = [],
    images: JsonObject[] = [];
  let attempted = 0;
  let acceptedReference = false;
  for (const candidate of selected) {
    if (attempted >= limit) break;
    attempted++;
    const { url } = candidate;
    const refId = `design-${hash(url).slice(0, 20)}`;
    try {
      const crawled = await (options.collector ?? collect)(url, {
        ...config.crawler,
        outputDir: join(options.outputDir, refId),
        browser: true,
        lighthouse: false,
        screenshotViewports: acceptedReference ? "desktop" : "all",
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
      const imagePairs = [...(crawled.images ?? [])]
        .map((image: JsonObject) => ({
          image,
          evidence: (crawled.evidence ?? []).find(
            (e: JsonObject) =>
              e.kind === "screenshot" && e.evidence_id === image.evidence_id,
          ),
        }))
        .filter((pair) => pair.evidence)
        .sort((a, b) => Number(a.image.width) - Number(b.image.width));
      if (!html.length && !imagePairs.length) {
        gaps.push(`Referenz nicht lesbar: ${url}`);
        if (sourceMode === "search" && !references.length && attempted < limit)
          selected.splice(
            attempted,
            selected.length,
            ...useCatalog(limit - attempted),
          );
        continue;
      }
      const remap = (e: JsonObject) =>
        validate("Evidence", {
          ...e,
          evidence_id: `${refId}-${e.evidence_id}`,
        });
      const sources: JsonObject[] = html.map(remap);
      const selectedImages = acceptedReference
        ? imagePairs.slice(-1)
        : imagePairs.length > 1
          ? [imagePairs[0], imagePairs.at(-1)!]
          : imagePairs;
      for (const pair of selectedImages) {
        const bound = remap(pair.evidence!);
        sources.push(bound);
        images.push(
          validate("ImageBinding", {
            evidence_id: bound.evidence_id,
            attachment_ref: pair.image.path,
            sha256: pair.image.sha256,
            width: pair.image.width,
            height: pair.image.height,
          }),
        );
      }
      const captureLimitations: string[] = [];
      const viewportWidth = (pair: (typeof selectedImages)[number]): number => {
        try {
          const locator = JSON.parse(String(pair.evidence?.locator)) as {
            viewport?: { width?: number };
          };
          if (Number.isFinite(locator.viewport?.width))
            return Number(locator.viewport?.width);
        } catch {
          // Older collector fixtures do not always contain a JSON locator.
        }
        return Number(pair.image.width);
      };
      if (!html.length)
        captureLimitations.push(
          "Keine lesbare Textquelle verfügbar; nur die gebundene Ansicht wurde erfasst.",
        );
      if (!selectedImages.length)
        captureLimitations.push(
          "Kein Referenzbild verfügbar; nur Textbeobachtungen erlaubt.",
        );
      if (
        !acceptedReference &&
        !selectedImages.some((pair) => viewportWidth(pair) <= 600)
      )
        captureLimitations.push(
          "Keine mobile Ansicht verfügbar; Mobile-Komposition wurde nicht visuell geprüft.",
        );
      if (!selectedImages.some((pair) => viewportWidth(pair) > 600))
        captureLimitations.push(
          "Keine Desktopansicht verfügbar; Desktop-Komposition wurde nicht visuell geprüft.",
        );
      if (captureLimitations.length)
        gaps.push(...captureLimitations.map((gap) => `${url}: ${gap}`));
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
        selection_role: candidate.role,
        selection_reason: candidate.reason,
        capture_limitations: captureLimitations,
      });
      acceptedReference = true;
    } catch {
      gaps.push(`Referenzabruf fehlgeschlagen: ${url}`);
      if (sourceMode === "search" && !references.length && attempted < limit)
        selected.splice(
          attempted,
          selected.length,
          ...useCatalog(limit - attempted),
        );
    }
  }
  return {
    research: validate("DesignResearch", {
      status:
        references.length === 0
          ? "unavailable"
          : references.length === limit &&
              references.every(
                (reference) =>
                  (reference.image_evidence_ids as string[]).length > 0 &&
                  (reference.capture_limitations as string[]).length === 0,
              )
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
