import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodeHTML as decodeEntities } from "entities";
import { collect, extractPage } from "./crawler.js";
import { now, type JsonObject } from "./contracts.js";

type Signal = {
  code: string;
  observation: string;
  sourceUrl: string;
  excerpt: string;
};

type Contact = {
  kind: "phone" | "email";
  value: string;
  sourceUrl: string;
  excerpt: string;
};

export type ScreeningResult = {
  website: string;
  checkedAt: string;
  status: "candidate" | "no_signal" | "uncertain";
  priority: number;
  signals: Signal[];
  contacts: Contact[];
  limitations: string[];
  crawl: JsonObject;
};

type HtmlEvidence = {
  sourceUrl: string;
  locator: string;
  artifactHash?: string;
};

function attribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(
      `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`,
      "i",
    ),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function hasMeta(html: string, expectedName: string): boolean {
  return (
    /<meta\b[^>]*>/gi.test(html) &&
    [...html.matchAll(/<meta\b[^>]*>/gi)].some(
      (tag) =>
        attribute(tag[0], "name")?.toLowerCase() === expectedName &&
        Boolean(attribute(tag[0], "content")?.trim()),
    )
  );
}

function scanHtml(html: string): string {
  return html.replace(
    /<!--[\s\S]*?-->|<(?:script|style|template)\b[^>]*>[\s\S]*?<\/(?:script|style|template)\s*>/gi,
    (match) => " ".repeat(match.length),
  );
}

function headHtml(html: string): string {
  return html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)?.[0] ?? "";
}

function htmlEvidence(crawl: JsonObject): HtmlEvidence[] {
  const evidence = Array.isArray(crawl.evidence) ? crawl.evidence : [];
  return evidence.flatMap((item: JsonObject) => {
    if (
      item?.kind !== "html" ||
      typeof item.source_url !== "string" ||
      typeof item.locator !== "string"
    )
      return [];
    return [
      {
        sourceUrl: item.source_url,
        locator: item.locator,
        artifactHash:
          typeof item.artifact_hash === "string"
            ? item.artifact_hash
            : undefined,
      },
    ];
  });
}

function rawPath(locator: string): string | null {
  const raw = locator.slice(
    0,
    locator.indexOf("#") === -1 ? undefined : locator.indexOf("#"),
  );
  if (!raw || !path.isAbsolute(raw)) return null;
  const resolved = path.resolve(raw);
  if (
    path.extname(resolved).toLowerCase() !== ".html" ||
    path.basename(path.dirname(resolved)) !== "raw"
  )
    return null;
  return resolved;
}

async function retrievedHtml(
  crawl: JsonObject,
): Promise<Array<{ sourceUrl: string; html: string }>> {
  const pages: Array<{ sourceUrl: string; html: string }> = [];
  const seen = new Set<string>();
  for (const evidence of htmlEvidence(crawl)) {
    const filename = rawPath(evidence.locator);
    if (!filename || seen.has(filename)) continue;
    seen.add(filename);
    try {
      const raw = await readFile(filename);
      const artifactHash = createHash("sha256").update(raw).digest("hex");
      if (evidence.artifactHash && evidence.artifactHash !== artifactHash)
        continue;
      const html = raw.toString("utf8");
      pages.push({ sourceUrl: evidence.sourceUrl, html });
    } catch {
      // The replay result records the unavailable source below.
    }
  }
  return pages;
}

function crawlIsUnavailable(
  crawl: JsonObject,
  pages: Array<{ sourceUrl: string; html: string }>,
): boolean {
  const crawlPages = Array.isArray(crawl.crawl_pages) ? crawl.crawl_pages : [];
  const hasOkPage = crawlPages.some(
    (page: JsonObject) => page?.outcome === "ok",
  );
  const expectedSources = new Set(
    crawlPages
      .filter((page: JsonObject) => page?.outcome === "ok")
      .map((page: JsonObject) => page.url)
      .filter((url: unknown): url is string => typeof url === "string"),
  );
  const loadedSources = new Set(pages.map((page) => page.sourceUrl));
  return (
    !hasOkPage ||
    pages.length === 0 ||
    crawlPages.some((page: JsonObject) => page?.outcome !== "ok") ||
    expectedSources.size !== loadedSources.size ||
    [...expectedSources].some((source) => !loadedSources.has(source))
  );
}

function javascriptShell(html: string, sourceUrl: string): boolean {
  if (!/<script\b/i.test(html)) return false;
  try {
    return extractPage(html, new URL(sourceUrl)).text.trim().length < 80;
  } catch {
    return true;
  }
}

function decoded(value: string): string {
  try {
    return decodeEntities(decodeURIComponent(value));
  } catch {
    return decodeEntities(value);
  }
}

function contactsFrom(
  html: string,
  sourceUrl: string,
  originalHtml = html,
): Contact[] {
  const contacts: Contact[] = [];
  for (const anchor of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = anchor[0];
    const hrefMatch = tag.match(/\bhref\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    const value = href.replace(/^['"]|['"]$/g, "");
    const excerpt = originalHtml.slice(
      (anchor.index ?? 0) + hrefMatch.index!,
      (anchor.index ?? 0) + hrefMatch.index! + hrefMatch[0].length,
    );
    if (/^mailto:/i.test(value)) {
      const email = decoded(
        value.slice("mailto:".length).split("?", 1)[0],
      ).trim();
      if (email)
        contacts.push({ kind: "email", value: email, sourceUrl, excerpt });
    }
    if (/^tel:/i.test(value)) {
      const phone = decoded(value.slice("tel:".length)).trim();
      if (phone)
        contacts.push({ kind: "phone", value: phone, sourceUrl, excerpt });
    }
  }
  return contacts;
}

function uniqueContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = `${contact.kind}\u0000${contact.value}\u0000${contact.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function screenCollected(
  website: string,
  crawl: JsonObject,
): Promise<ScreeningResult> {
  const pages = await retrievedHtml(crawl);
  const limitations: string[] = [];
  if (crawlIsUnavailable(crawl, pages)) {
    limitations.push(
      "Abruf nicht vollständig verfügbar, blockiert oder fehlgeschlagen.",
    );
    return {
      website,
      checkedAt: now(),
      status: "uncertain",
      priority: 0,
      signals: [],
      contacts: [],
      limitations,
      crawl,
    };
  }
  if (pages.some((page) => javascriptShell(page.html, page.sourceUrl))) {
    limitations.push("Javascript-Hülle verhindert eine statische Vorprüfung.");
    return {
      website,
      checkedAt: now(),
      status: "uncertain",
      priority: 0,
      signals: [],
      contacts: uniqueContacts(
        pages.flatMap((page) =>
          contactsFrom(scanHtml(page.html), page.sourceUrl, page.html),
        ),
      ),
      limitations,
      crawl,
    };
  }

  const signals: Signal[] = [];
  let priority = 0;
  for (const page of pages.slice(0, 1)) {
    const scanned = scanHtml(page.html);
    const scannedHead = headHtml(scanned);
    const head =
      page.html.match(/<head\b[^>]*>/i)?.[0] ??
      page.html.match(/<html\b[^>]*>/i)?.[0] ??
      page.html.slice(0, 200);
    if (!hasMeta(scannedHead, "viewport")) {
      signals.push({
        code: "missing_viewport",
        observation: "Kein viewport-Meta-Tag im abgerufenen HTML.",
        sourceUrl: page.sourceUrl,
        excerpt: head,
      });
      priority += 2;
    }
    if (!/<title\b[^>]*>\s*\S[\s\S]*?<\/title\s*>/i.test(scannedHead)) {
      signals.push({
        code: "missing_title",
        observation: "Kein Titel im abgerufenen HTML.",
        sourceUrl: page.sourceUrl,
        excerpt: head,
      });
      priority += 1;
    }
    if (!hasMeta(scannedHead, "description")) {
      signals.push({
        code: "missing_description",
        observation: "Keine Description-Metadaten im abgerufenen HTML.",
        sourceUrl: page.sourceUrl,
        excerpt: head,
      });
      priority += 1;
    }
    for (const frame of scanned.matchAll(/<(?:frame|frameset)\b[^>]*>/gi)) {
      signals.push({
        code: "frame_present",
        observation: "Frame-Element im abgerufenen HTML.",
        sourceUrl: page.sourceUrl,
        excerpt: page.html.slice(frame.index!, frame.index! + frame[0].length),
      });
      priority += 3;
    }
  }
  const contacts = uniqueContacts(
    pages.flatMap((page) =>
      contactsFrom(scanHtml(page.html), page.sourceUrl, page.html),
    ),
  );
  if (contacts.length) {
    for (const contact of contacts)
      signals.push({
        code: "contact_present",
        observation: "Kontaktmöglichkeit im abgerufenen HTML.",
        sourceUrl: contact.sourceUrl,
        excerpt: contact.excerpt,
      });
  } else {
    const firstPage = pages[0];
    signals.push({
      code: "missing_contact",
      observation:
        "Keine verlinkte Kontaktmöglichkeit im abgerufenen HTML gefunden.",
      sourceUrl: firstPage.sourceUrl,
      excerpt:
        firstPage.html.match(/<body\b[^>]*>/i)?.[0] ??
        firstPage.html.match(/<html\b[^>]*>/i)?.[0] ??
        firstPage.html.slice(0, 200),
    });
  }
  return {
    website,
    checkedAt: now(),
    status: priority >= 2 ? "candidate" : "no_signal",
    priority,
    signals,
    contacts,
    limitations,
    crawl,
  };
}

export async function screenWebsite(
  website: string,
  options: { outputDir: string },
): Promise<ScreeningResult> {
  const crawl = await collect(website, {
    outputDir: path.resolve(options.outputDir),
    browser: false,
    maxPages: 2,
    maxDurationMs: 20_000,
    timeoutMs: 5_000,
  });
  return screenCollected(website, crawl);
}
