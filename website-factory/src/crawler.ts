import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lookup as dnsLookup } from "node:dns/promises";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { decodeHTML as decodeEntities } from "entities";
import {
  connect as netConnect,
  createServer as createNetServer,
} from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import ipaddr from "ipaddr.js";
import { chromium, type Browser, type Page } from "playwright";
import robotsParser from "robots-parser";
import { hash, id, now, validate, type JsonObject } from "./contracts.js";

const USER_AGENT = "POLIRE-Research/1.0";
const DEFAULTS = {
  maxPages: 6,
  timeoutMs: 15_000,
  maxPageBytes: 2_000_000,
  maxTotalBytes: 30_000_000,
  maxRedirects: 3,
  minHostIntervalMs: 1_000,
  maxBrowserRequests: 150,
  maxDurationMs: 180_000,
};

export type ExtractedPage = {
  text: string;
  links: string[];
  title: string | null;
  metaDescription: string | null;
  hasForms: boolean;
  technologyHints: string[];
};

type ResolvedAddress = { address: string; family: number };
type FetchResult = {
  url: URL;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};
export type CrawlOptions = {
  outputDir?: string;
  browser?: boolean;
  maxPages?: number;
  maxHtmlPagesPerLead?: number;
  timeoutMs?: number;
  requestTimeoutMs?: number;
  maxPageBytes?: number;
  maxTotalBytes?: number;
  maxCrawlBytes?: number;
  maxCrawlBytesPerLead?: number;
  maxRedirects?: number;
  minHostIntervalMs?: number;
  requestsPerHost?: number;
  maxBrowserRequests?: number;
  maxBrowserRequestsPerLead?: number;
  maxDurationMs?: number;
  maxCrawlDurationMs?: number;
  lighthouse?: boolean;
  screenshotViewports?: "all" | "desktop";
};

type CrawlLimits = typeof DEFAULTS;

function bounded(
  values: Array<number | undefined>,
  fallback: number,
  ceiling: number,
): number {
  const supplied = values.filter(
    (value): value is number => value !== undefined,
  );
  if (supplied.some((value) => !Number.isSafeInteger(value) || value <= 0))
    throw new Error("Crawler limits must be positive integers");
  return Math.min(ceiling, ...(supplied.length ? supplied : [fallback]));
}

export function normalizeCrawlOptions(options: CrawlOptions = {}): CrawlLimits {
  if (options.requestsPerHost !== undefined && options.requestsPerHost !== 1)
    throw new Error("Crawler permits exactly one concurrent request per host");
  return {
    maxPages: bounded(
      [options.maxPages, options.maxHtmlPagesPerLead],
      DEFAULTS.maxPages,
      DEFAULTS.maxPages,
    ),
    timeoutMs: bounded(
      [options.timeoutMs, options.requestTimeoutMs],
      DEFAULTS.timeoutMs,
      DEFAULTS.timeoutMs,
    ),
    maxPageBytes: bounded(
      [options.maxPageBytes],
      DEFAULTS.maxPageBytes,
      DEFAULTS.maxPageBytes,
    ),
    maxTotalBytes: bounded(
      [
        options.maxTotalBytes,
        options.maxCrawlBytes,
        options.maxCrawlBytesPerLead,
      ],
      DEFAULTS.maxTotalBytes,
      DEFAULTS.maxTotalBytes,
    ),
    maxRedirects: bounded(
      [options.maxRedirects],
      DEFAULTS.maxRedirects,
      DEFAULTS.maxRedirects,
    ),
    minHostIntervalMs: Math.max(
      DEFAULTS.minHostIntervalMs,
      bounded(
        [options.minHostIntervalMs],
        DEFAULTS.minHostIntervalMs,
        Number.MAX_SAFE_INTEGER,
      ),
    ),
    maxBrowserRequests: bounded(
      [options.maxBrowserRequests, options.maxBrowserRequestsPerLead],
      DEFAULTS.maxBrowserRequests,
      DEFAULTS.maxBrowserRequests,
    ),
    maxDurationMs: bounded(
      [options.maxDurationMs, options.maxCrawlDurationMs],
      DEFAULTS.maxDurationMs,
      DEFAULTS.maxDurationMs,
    ),
  };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || png.toString("ascii", 1, 4) !== "PNG")
    throw new Error("Screenshot is not a valid PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export function isPublicAddress(ip: string): boolean {
  try {
    let parsed = ipaddr.parse(ip);
    if (
      parsed.kind() === "ipv6" &&
      (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    )
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

export function publicUrl(input: string | URL): URL {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Only public HTTP(S) URLs are allowed");
  if (url.username || url.password)
    throw new Error("URL credentials are not allowed");
  if (
    (url.protocol === "http:" && url.port && url.port !== "80") ||
    (url.protocol === "https:" && url.port && url.port !== "443")
  ) {
    throw new Error("Only standard HTTP(S) ports are allowed");
  }
  url.hash = "";
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (ipaddr.isValid(hostname) && !isPublicAddress(hostname))
  ) {
    throw new Error("Private or local destinations are not allowed");
  }
  if (url.href.length > 400)
    throw new Error("URL exceeds evidence contract limit");
  return url;
}

export function redirectTarget(location: string, current: string | URL): URL {
  return publicUrl(new URL(location, publicUrl(current)));
}

export async function resolvePublicHost(
  hostname: string,
  resolver: typeof dnsLookup = dnsLookup,
): Promise<ResolvedAddress[]> {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(normalized)) {
    if (!isPublicAddress(normalized))
      throw new Error("DNS destination is not public");
    const parsed = ipaddr.parse(normalized);
    return [{ address: normalized, family: parsed.kind() === "ipv4" ? 4 : 6 }];
  }
  const addresses = await resolver(normalized, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error("DNS destination is not exclusively public");
  return addresses.map(({ address, family }) => ({ address, family }));
}

export function pinnedLookup(pinned: ResolvedAddress) {
  return (
    _hostname: string,
    options: { all?: boolean },
    callback: (...args: any[]) => void,
  ): void => {
    if (options.all) callback(null, [pinned]);
    else callback(null, pinned.address, pinned.family);
  };
}

function cleanText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[^]*?-->/g, " ")
      .replace(
        /<(script|style|noscript|template|svg)\b[^>]*>[^]*?<\/\1\s*>/gi,
        " ",
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(
        /<\/(?:p|div|li|h[1-6]|section|article|header|footer|nav)>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attribute(html: string, expression: RegExp): string | null {
  const found = expression.exec(html);
  return found ? cleanText(found[1]) : null;
}

export function extractPage(html: string, base: string | URL): ExtractedPage {
  const baseUrl = publicUrl(base);
  const links = new Set<string>();
  const hrefPattern =
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (
      !href ||
      href.startsWith("#") ||
      /^(?:mailto|tel|javascript|data):/i.test(href)
    )
      continue;
    try {
      const resolved = publicUrl(new URL(href, baseUrl));
      links.add(resolved.href);
    } catch {
      /* Unsafe links are data, not crawl targets. */
    }
  }
  const hints: string[] = [];
  if (/\bwp-(?:content|includes)\b|wordpress/i.test(html))
    hints.push("WordPress");
  if (/\/_next\/|__NEXT_DATA__/i.test(html)) hints.push("Next.js");
  if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) hints.push("Shopify");
  return {
    text: cleanText(html),
    links: [...links],
    title: attribute(html, /<title\b[^>]*>([^]*?)<\/title\s*>/i),
    metaDescription: attribute(
      html,
      /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])(?=[^>]*\bcontent\s*=\s*["']([^"']*)["'])[^>]*>/i,
    ),
    hasForms: /<form\b/i.test(html),
    technologyHints: hints,
  };
}

export function lighthousePerformance(report: unknown): number | null {
  const score = (report as JsonObject | null)?.categories?.performance?.score;
  return typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 1
    ? Math.round(score * 100)
    : null;
}

function decompressor(encoding: string | undefined) {
  if (encoding === "gzip") return createGunzip();
  if (encoding === "deflate") return createInflate();
  if (encoding === "br") return createBrotliDecompress();
  return null;
}

async function readBounded(
  stream: NodeJS.ReadableStream,
  encoding: string | undefined,
  maxBytes: number,
): Promise<Buffer> {
  const source = decompressor(encoding?.toLowerCase()) ?? stream;
  if (source !== stream) stream.pipe(source as NodeJS.WritableStream);
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of source as AsyncIterable<Buffer | string>) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.byteLength;
      if (total > maxBytes)
        throw new Error("Decompressed response exceeds byte limit");
      chunks.push(bytes);
    }
  } finally {
    if (source !== stream) (source as { destroy: () => void }).destroy();
  }
  return Buffer.concat(chunks);
}

export async function guardedFetch(
  input: string | URL,
  options: {
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
    resolver?: typeof dnsLookup;
  } = {},
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxPageBytes;
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;
  let current = publicUrl(input);
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const addresses = await resolvePublicHost(
      current.hostname,
      options.resolver ?? dnsLookup,
    );
    const pinned = addresses[0];
    const result = await new Promise<FetchResult>((resolve, reject) => {
      const request = (
        current.protocol === "https:" ? httpsRequest : httpRequest
      )(
        {
          protocol: current.protocol,
          hostname: current.hostname,
          port: current.port || undefined,
          path: `${current.pathname}${current.search}`,
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            Accept:
              "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
            "Accept-Encoding": "gzip, deflate, br",
          },
          lookup: pinnedLookup(pinned),
          servername:
            current.protocol === "https:" && !ipaddr.isValid(current.hostname)
              ? current.hostname
              : undefined,
        },
        async (response) => {
          try {
            const body = await readBounded(
              response,
              typeof response.headers["content-encoding"] === "string"
                ? response.headers["content-encoding"]
                : undefined,
              maxBytes,
            );
            resolve({
              url: current,
              status: response.statusCode ?? 0,
              headers: response.headers,
              body,
            });
          } catch (error) {
            request.destroy();
            reject(error);
          }
        },
      );
      request.setTimeout(timeoutMs, () =>
        request.destroy(new Error("Request timed out")),
      );
      request.once("error", reject);
      request.end();
    });
    if (
      [301, 302, 303, 307, 308].includes(result.status) &&
      typeof result.headers.location === "string"
    ) {
      if (redirect === maxRedirects) throw new Error("Redirect limit exceeded");
      current = redirectTarget(result.headers.location, current);
      continue;
    }
    return result;
  }
  throw new Error("Redirect limit exceeded");
}

function evidence(args: Omit<JsonObject, "evidence_id">): JsonObject {
  return validate("Evidence", { evidence_id: id(), ...args });
}

function crawlPage(
  url: URL,
  outcome: "ok" | "blocked" | "failed" | "not_fetched",
  evidenceIds: string[],
): JsonObject {
  return validate("CrawlPage", {
    page_ref: `page-${hash(url.href).slice(0, 24)}`,
    url: url.href,
    outcome,
    evidence_ids: evidenceIds,
  });
}

function usefulLink(url: URL): boolean {
  return /(?:kontakt|contact|impressum|imprint|about|ueber|uber|a-propos|chi-siamo|team|dienst|service|leistung)/i.test(
    url.pathname,
  );
}

/** Spend the bounded page allowance on identity and contact evidence first. */
export function prioritizeCrawlLinks(links: string[]): string[] {
  const priority = (link: string): number => {
    const pathname = new URL(link).pathname;
    if (/(?:kontakt|contact|contatti)/i.test(pathname)) return 0;
    if (/(?:impressum|imprint)/i.test(pathname)) return 1;
    if (/(?:about|ueber|uber|a-propos|chi-siamo|team)/i.test(pathname))
      return 2;
    return 3;
  };
  return [...links].sort((a, b) => priority(a) - priority(b));
}

function chunks(
  text: string,
  size = 1800,
  max = 5,
): { values: string[]; truncated: boolean } {
  const values: string[] = [];
  for (
    let offset = 0;
    offset < text.length && values.length < max;
    offset += size
  )
    values.push(text.slice(offset, offset + size));
  return {
    values: values.length ? values : [""],
    truncated: text.length > size * max,
  };
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type ProxyLimits = {
  timeoutMs: number;
  maxRequests: number;
  maxBytes: number;
  deadline: number;
  minHostIntervalMs?: number;
  maxRedirects?: number;
};

export async function startEgressProxy(
  limits: ProxyLimits,
): Promise<{ url: string; errors: JsonObject[]; close: () => Promise<void> }> {
  let requests = 0;
  let transferred = 0;
  const errors: JsonObject[] = [];
  const hostGates = new Map<string, Promise<void>>();
  const hostLastStart = new Map<string, number>();
  const acquireHost = async (hostname: string): Promise<() => void> => {
    const prior = hostGates.get(hostname) ?? Promise.resolve();
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    hostGates.set(
      hostname,
      prior.catch(() => undefined).then(() => turn),
    );
    await prior.catch(() => undefined);
    const remaining =
      (limits.minHostIntervalMs ?? DEFAULTS.minHostIntervalMs) -
      (Date.now() - (hostLastStart.get(hostname) ?? 0));
    if (remaining > 0) await pause(remaining);
    hostLastStart.set(hostname, Date.now());
    return release;
  };
  const server = (await import("node:http")).createServer(
    async (request, response) => {
      requests += 1;
      if (requests > limits.maxRequests || Date.now() > limits.deadline) {
        response.writeHead(429);
        return response.end();
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        return response.end();
      }
      try {
        const target = publicUrl(request.url ?? "");
        const release = await acquireHost(target.hostname);
        try {
          const fetched = await guardedFetch(target, {
            timeoutMs: limits.timeoutMs,
            maxBytes: Math.max(1, limits.maxBytes - transferred),
            maxRedirects: limits.maxRedirects,
          });
          transferred += fetched.body.byteLength;
          response.statusCode = fetched.status;
          const contentType = fetched.headers["content-type"];
          if (typeof contentType === "string")
            response.setHeader("Content-Type", contentType);
          response.setHeader("Cache-Control", "no-store");
          response.end(fetched.body);
        } finally {
          release();
        }
      } catch (error) {
        errors.push({
          code: "browser_proxy_request_failed",
          message: String(error),
        });
        response.writeHead(502);
        response.end();
      }
    },
  );
  const sockets = new Set<import("node:net").Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (_request, socket) => {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
  });
  server.on("connect", async (request, downstream, head) => {
    requests += 1;
    if (requests > limits.maxRequests || Date.now() > limits.deadline)
      return downstream.destroy();
    try {
      const target = publicUrl(`https://${request.url}`);
      const release = await acquireHost(target.hostname);
      const [pinned] = await resolvePublicHost(target.hostname);
      const upstream = netConnect({
        host: pinned.address,
        port: 443,
        family: pinned.family as 4 | 6,
      });
      const account = (chunk: Buffer) => {
        transferred += chunk.byteLength;
        if (transferred > limits.maxBytes || Date.now() > limits.deadline) {
          upstream.destroy();
          downstream.destroy();
        }
      };
      upstream.setTimeout(limits.timeoutMs, () => upstream.destroy());
      upstream.once("connect", () => {
        downstream.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.byteLength > 0) upstream.write(head);
        upstream.pipe(downstream);
        downstream.pipe(upstream);
      });
      upstream.on("data", account);
      downstream.on("data", account);
      upstream.on("error", (error) => {
        errors.push({
          code: "browser_proxy_connect_failed",
          message: String(error),
        });
        downstream.destroy();
      });
      upstream.once("close", release);
      downstream.on("error", () => upstream.destroy());
    } catch (error) {
      errors.push({
        code: "browser_proxy_connect_blocked",
        message: String(error),
      });
      downstream.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      downstream.destroy();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Proxy failed to bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    errors,
    close: () => {
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      for (const socket of sockets) socket.destroy();
      return closed;
    },
  };
}

async function availableLoopbackPort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Could not reserve Lighthouse debugging port");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function launchCrawlerBrowser(
  proxyUrl: string,
  debuggingPort: number,
): Promise<Browser> {
  const options = {
    headless: true,
    proxy: { server: proxyUrl, bypass: "<-loopback>" },
    args: [
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--disable-features=WebRtcHideLocalIpsWithMdns",
      `--remote-debugging-port=${debuggingPort}`,
      "--remote-debugging-address=127.0.0.1",
    ],
  };
  try {
    return await chromium.launch(options);
  } catch {
    return chromium.launch({ ...options, channel: "chrome" });
  }
}

async function installBrowserReadOnlyPolicy(
  debuggingPort: number,
  allowRequest: (method: string, url: string) => boolean,
): Promise<() => Promise<void>> {
  const versionResponse = await fetch(
    `http://127.0.0.1:${debuggingPort}/json/version`,
  );
  if (!versionResponse.ok)
    throw new Error(
      `Browser debugging endpoint returned ${versionResponse.status}`,
    );
  const webSocketDebuggerUrl = ((await versionResponse.json()) as JsonObject)
    .webSocketDebuggerUrl;
  if (typeof webSocketDebuggerUrl !== "string")
    throw new Error("Browser debugging endpoint omitted its WebSocket URL");
  const session = new WebSocket(webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    session.addEventListener("open", () => resolve(), { once: true });
    session.addEventListener(
      "error",
      () => reject(new Error("Could not connect browser policy session")),
      { once: true },
    );
  });
  let messageId = 0;
  const send = (
    method: string,
    params: JsonObject = {},
    sessionId?: string,
  ) => {
    const commandId = ++messageId;
    session.send(
      JSON.stringify({
        id: commandId,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }),
    );
    return commandId;
  };
  session.addEventListener("message", (message) => {
    let event: JsonObject;
    try {
      event = JSON.parse(String(message.data)) as JsonObject;
    } catch {
      return;
    }
    const sessionId =
      typeof event.sessionId === "string" ? event.sessionId : undefined;
    if (
      event.method === "Target.attachedToTarget" &&
      event.params &&
      typeof event.params === "object"
    ) {
      const attached = event.params as JsonObject;
      const attachedSessionId = String(attached.sessionId);
      const targetInfo = attached.targetInfo as JsonObject;
      if (
        ["page", "iframe", "worker", "shared_worker"].includes(
          String(targetInfo.type),
        )
      ) {
        send(
          "Fetch.enable",
          { patterns: [{ urlPattern: "*", requestStage: "Request" }] },
          attachedSessionId,
        );
      }
      send("Runtime.runIfWaitingForDebugger", {}, attachedSessionId);
    }
    if (event.method !== "Fetch.requestPaused" || !sessionId) return;
    const params = event.params as JsonObject;
    const request = params.request as JsonObject;
    const method = String(request.method ?? "").toUpperCase();
    const url = String(request.url ?? "");
    const allowed = allowRequest(method, url);
    send(
      allowed ? "Fetch.continueRequest" : "Fetch.failRequest",
      allowed
        ? { requestId: params.requestId }
        : { requestId: params.requestId, errorReason: "BlockedByClient" },
      sessionId,
    );
  });
  await new Promise<void>((resolve, reject) => {
    let commandId = -1;
    const timer = setTimeout(() => {
      session.removeEventListener("message", receive);
      reject(new Error("Browser policy setup timed out"));
    }, 2_000);
    const receive = (message: MessageEvent) => {
      let response: JsonObject;
      try {
        response = JSON.parse(String(message.data)) as JsonObject;
      } catch {
        return;
      }
      if (response.id !== commandId) return;
      clearTimeout(timer);
      session.removeEventListener("message", receive);
      if (response.error)
        reject(
          new Error(
            `Browser policy setup failed: ${JSON.stringify(response.error)}`,
          ),
        );
      else resolve();
    };
    session.addEventListener("message", receive);
    commandId = send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
    });
  });
  return async () => {
    session.close();
  };
}

export async function navigateForCapture(
  page: Page,
  website: string,
  timeoutMs: number,
): Promise<{
  domContentLoadedTimedOut: boolean;
  networkIdleTimedOut: boolean;
}> {
  let domContentLoadedTimedOut = false;
  try {
    await page.goto(website, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
    let currentUrl: URL;
    try {
      currentUrl = publicUrl(page.url());
    } catch {
      throw error;
    }
    const readyState = await page
      .evaluate(() => document.readyState)
      .catch(() => "loading");
    if (
      (readyState !== "interactive" && readyState !== "complete") ||
      !["http:", "https:"].includes(currentUrl.protocol)
    )
      throw error;
    domContentLoadedTimedOut = true;
  }

  let networkIdleTimedOut = false;
  try {
    await page.waitForLoadState("networkidle", {
      timeout: Math.min(2_000, timeoutMs),
    });
  } catch {
    networkIdleTimedOut = true;
  }
  return { domContentLoadedTimedOut, networkIdleTimedOut };
}

export type LighthouseWorkerOptions = {
  website: string;
  debuggingPort: number;
  timeoutMs: number;
  maxWaitForLoadMs?: number;
  reportPath: string;
  workerPath?: string;
};

export async function runLighthouseWorker(
  options: LighthouseWorkerOptions,
): Promise<string> {
  const workerPath =
    options.workerPath ??
    fileURLToPath(new URL("./lighthouse-worker.mjs", import.meta.url));
  const payload = JSON.stringify({
    website: options.website,
    debuggingPort: options.debuggingPort,
    timeoutMs: options.timeoutMs,
    maxWaitForLoadMs: options.maxWaitForLoadMs ?? options.timeoutMs,
    reportPath: options.reportPath,
  });

  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, payload], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let settled = false;
    let timedOut = false;
    let stderr = "";
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < 8_192)
        stderr += chunk.slice(0, 8_192 - stderr.length);
    });
    child.once("error", (error) => settle(() => reject(error)));
    child.once("close", (code, signal) => {
      if (timedOut) {
        settle(() =>
          reject(new Error("Lighthouse worker timed out and was terminated")),
        );
        return;
      }
      if (code !== 0) {
        const detail =
          stderr.trim() || `exit ${String(code)} (${String(signal)})`;
        settle(() => reject(new Error(`Lighthouse worker failed: ${detail}`)));
        return;
      }
      clearTimeout(timer);
      void readFile(options.reportPath, "utf8").then(
        (report) => settle(() => resolve(report)),
        (error) => settle(() => reject(error)),
      );
    });
  });
}

async function captureScreenshots(
  website: URL,
  outputDir: string,
  limits: ProxyLimits,
  runLighthouse: boolean,
  screenshotViewports: "all" | "desktop" = "all",
): Promise<{
  evidence: JsonObject[];
  images: Array<{
    path: string;
    evidence_id: string;
    width: number;
    height: number;
    sha256: string;
  }>;
  errors: JsonObject[];
  performanceScore: number | null;
}> {
  const proxy = await startEgressProxy(limits);
  const evidenceItems: JsonObject[] = [];
  const images: Array<{
    path: string;
    evidence_id: string;
    width: number;
    height: number;
    sha256: string;
  }> = [];
  let performanceScore: number | null = null;
  let browser: Browser | undefined;
  let removeBrowserPolicy: (() => Promise<void>) | undefined;
  try {
    const debuggingPort = await availableLoopbackPort();
    browser = await launchCrawlerBrowser(proxy.url, debuggingPort);
    let inspectedRequests = 0;
    const allowBrowserRequest = (method: string, url: string): boolean => {
      inspectedRequests += 1;
      return (
        inspectedRequests <= limits.maxRequests &&
        Date.now() <= limits.deadline &&
        (method === "GET" || method === "HEAD") &&
        !/^wss?:/i.test(url)
      );
    };
    for (const viewport of screenshotViewports === "desktop"
      ? [{ width: 1440, height: 1000 }]
      : [
          { width: 375, height: 812 },
          { width: 1440, height: 1000 },
        ]) {
      const context = await browser.newContext({
        viewport,
        serviceWorkers: "block",
        acceptDownloads: false,
        reducedMotion: "reduce",
      });
      await context.route("**/*", async (route) => {
        const method = route.request().method().toUpperCase();
        if (allowBrowserRequest(method, route.request().url()))
          await route.continue();
        else await route.abort("blockedbyclient");
      });
      await context.routeWebSocket("**/*", (socket) =>
        socket.close({ code: 1008, reason: "Crawler is read-only" }),
      );
      const page = await context.newPage();
      page.on("popup", (popup) => {
        void popup.close();
      });
      page.on("requestfailed", (request) => {
        let source = "external request";
        try {
          const url = new URL(request.url());
          source = `${url.origin}${url.pathname}`;
        } catch {
          /* Keep sanitized fallback. */
        }
        proxy.errors.push({
          code: "browser_request_failed",
          source,
          message: request.failure()?.errorText ?? "request failed",
        });
      });
      try {
        const navigation = await navigateForCapture(
          page,
          website.href,
          Math.max(1, Math.min(limits.timeoutMs, limits.deadline - Date.now())),
        );
        if (navigation.domContentLoadedTimedOut)
          proxy.errors.push({
            code: "browser_dom_ready_timeout",
            viewport,
            message:
              "Navigation timed out after producing a usable document; capture continued",
          });
        if (navigation.networkIdleTimedOut)
          proxy.errors.push({
            code: "browser_network_idle_timeout",
            viewport,
            message:
              "Document did not become network-idle; bounded capture continued",
          });
        await page.evaluate(async () => {
          await Promise.race([
            document.fonts.ready,
            new Promise((resolve) => setTimeout(resolve, 750)),
          ]);
          const step = Math.max(300, Math.floor(window.innerHeight * 0.75));
          const maximumScrolls = Math.min(
            40,
            Math.ceil(document.documentElement.scrollHeight / step),
          );
          for (let index = 0; index < maximumScrolls; index += 1) {
            const y = index * step;
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 40));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(250);
        const file = path.join(outputDir, `homepage-${viewport.width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const screenshotBytes = await readFile(file);
        const screenshotHash = sha256(screenshotBytes);
        const screenshotSize = pngDimensions(screenshotBytes);
        const item = evidence({
          kind: "screenshot",
          source_url: website.href,
          observed_at: now(),
          artifact_hash: screenshotHash,
          locator: JSON.stringify({ viewport, full_page: true }),
          excerpt: null,
          numeric_value: null,
          unit: null,
        });
        evidenceItems.push(item);
        images.push({
          path: file,
          evidence_id: item.evidence_id,
          width: screenshotSize.width,
          height: screenshotSize.height,
          sha256: screenshotHash,
        });
        if (screenshotSize.width !== viewport.width)
          proxy.errors.push({
            code: "screenshot_width_differs_from_viewport",
            viewport,
            actual_width: screenshotSize.width,
            message:
              "Full-page screenshot includes horizontal overflow; viewport remains recorded in evidence locator",
          });
      } catch (error) {
        proxy.errors.push({
          code: "browser_capture_failed",
          viewport,
          message: String(error),
        });
      } finally {
        await context.close();
      }
    }
    if (runLighthouse)
      try {
        removeBrowserPolicy = await installBrowserReadOnlyPolicy(
          debuggingPort,
          allowBrowserRequest,
        );
        const remaining = Math.max(
          1,
          Math.min(60_000, limits.deadline - Date.now()),
        );
        const reportPath = path.join(outputDir, "lighthouse-mobile.json");
        const reportText = await runLighthouseWorker({
          website: website.href,
          debuggingPort,
          timeoutMs: remaining,
          maxWaitForLoadMs: Math.min(limits.timeoutMs, remaining),
          reportPath,
        });
        const report = JSON.parse(reportText) as unknown;
        performanceScore = lighthousePerformance(report);
        if (performanceScore === null)
          throw new Error("Lighthouse returned no finite performance score");
        const reportHash = sha256(reportText);
        evidenceItems.push(
          evidence({
            kind: "metric",
            source_url: website.href,
            observed_at: now(),
            artifact_hash: reportHash,
            locator: reportPath,
            excerpt: "Lighthouse mobile performance",
            numeric_value: performanceScore,
            unit: "lighthouse_mobile",
          }),
        );
      } catch (error) {
        proxy.errors.push({
          code: "lighthouse_failed",
          message: String(error),
        });
        performanceScore = null;
      }
    else
      proxy.errors.push({
        code: "lighthouse_not_requested",
        message: "Lighthouse was explicitly disabled",
      });
  } catch (error) {
    proxy.errors.push({ code: "browser_unavailable", message: String(error) });
  } finally {
    if (removeBrowserPolicy) await removeBrowserPolicy();
    if (browser) await browser.close();
    await proxy.close();
  }
  return {
    evidence: evidenceItems,
    images,
    errors: proxy.errors,
    performanceScore,
  };
}

export async function collect(
  website: string,
  options: CrawlOptions = {},
): Promise<JsonObject> {
  const started = Date.now();
  const limits = normalizeCrawlOptions(options);
  const observedAt = now();
  const homepage = publicUrl(website);
  const outputDir =
    options.outputDir ?? (await mkdtemp(path.join(tmpdir(), "polire-crawl-")));
  const maxPages = limits.maxPages;
  const timeoutMs = limits.timeoutMs;
  await mkdir(path.join(outputDir, "raw"), { recursive: true });
  const evidenceItems: JsonObject[] = [];
  const crawlPages: JsonObject[] = [];
  const technology: JsonObject[] = [];
  const errors: JsonObject[] = [];
  const queue: URL[] = [homepage];
  const seen = new Set<string>();
  let totalBytes = 0;
  let lastRequestAt = 0;

  const fetchWithGap = async (url: URL, maxBytes = limits.maxPageBytes) => {
    if (
      Date.now() >= started + limits.maxDurationMs ||
      totalBytes >= limits.maxTotalBytes
    )
      throw new Error("Crawl safety limit reached");
    const gap = limits.minHostIntervalMs - (Date.now() - lastRequestAt);
    if (gap > 0) await pause(gap);
    lastRequestAt = Date.now();
    return guardedFetch(url, {
      timeoutMs,
      maxBytes: Math.min(maxBytes, limits.maxTotalBytes - totalBytes),
      maxRedirects: limits.maxRedirects,
    });
  };

  try {
    const robotsUrl = new URL("/robots.txt", homepage);
    const robotsResponse = await fetchWithGap(
      robotsUrl,
      Math.min(512_000, limits.maxPageBytes),
    );
    totalBytes += robotsResponse.body.byteLength;
    if (robotsResponse.status !== 404) {
      if (robotsResponse.status < 200 || robotsResponse.status >= 300)
        throw new Error(`robots.txt returned ${robotsResponse.status}`);
      const parseRobots = robotsParser as unknown as (
        url: string,
        contents: string,
      ) => {
        isAllowed: (url: string, userAgent: string) => boolean | undefined;
      };
      const rules = parseRobots(
        robotsResponse.url.href,
        robotsResponse.body.toString("utf8"),
      );
      if (!rules.isAllowed(homepage.href, USER_AGENT)) {
        crawlPages.push(crawlPage(homepage, "blocked", []));
        errors.push({
          code: "robots_blocked",
          url: homepage.href,
          message: "robots.txt disallows this crawler",
        });
        return {
          evidence: evidenceItems,
          images: [],
          crawl_pages: crawlPages,
          technology_observations: technology,
          metrics: { performance_score: null },
          errors,
          observedAt,
          website: homepage.href,
        };
      }
    }
  } catch (error) {
    crawlPages.push(crawlPage(homepage, "blocked", []));
    errors.push({
      code: "robots_unavailable",
      url: homepage.href,
      message: String(error),
    });
    return {
      evidence: evidenceItems,
      images: [],
      crawl_pages: crawlPages,
      technology_observations: technology,
      metrics: { performance_score: null },
      errors,
      observedAt,
      website: homepage.href,
    };
  }

  while (
    queue.length > 0 &&
    crawlPages.length < maxPages &&
    Date.now() - started < limits.maxDurationMs
  ) {
    const url = queue.shift()!;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    try {
      const response = await fetchWithGap(url);
      totalBytes += response.body.byteLength;
      if (response.status < 200 || response.status >= 300)
        throw new Error(`HTTP ${response.status}`);
      const contentType =
        typeof response.headers["content-type"] === "string"
          ? response.headers["content-type"]
          : "";
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType))
        throw new Error(`Unsupported content type ${contentType || "unknown"}`);
      const html = response.body.toString("utf8");
      const extracted = extractPage(html, response.url);
      const pageRef = `page-${hash(response.url.href).slice(0, 24)}`;
      const htmlPath = path.join(outputDir, "raw", `${pageRef}.html`);
      const textPath = path.join(outputDir, "raw", `${pageRef}.txt`);
      await writeFile(htmlPath, response.body);
      await writeFile(textPath, extracted.text, "utf8");
      const artifactHash = sha256(response.body);
      const excerptChunks = chunks(extracted.text);
      const pageEvidence: JsonObject[] = excerptChunks.values.map(
        (excerpt, index) =>
          evidence({
            kind: "html",
            source_url: response.url.href,
            observed_at: observedAt,
            artifact_hash: artifactHash,
            locator: `${htmlPath}#text-chunk-${index + 1}${excerptChunks.truncated ? "; full text persisted" : ""}`,
            excerpt,
            numeric_value: null,
            unit: null,
          }),
      );
      evidenceItems.push(...pageEvidence);
      crawlPages.push(
        crawlPage(
          response.url,
          "ok",
          pageEvidence.map((item) => item.evidence_id),
        ),
      );
      if (excerptChunks.truncated)
        errors.push({
          code: "evidence_excerpt_bounded",
          url: response.url.href,
          message:
            "Evidence excerpts are bounded; full HTML and text were persisted",
        });
      for (const hint of extracted.technologyHints) {
        if (!technology.some((signal) => signal.technology === hint))
          technology.push(
            validate("TechSignal", {
              technology: hint,
              certainty: "medium",
              evidence_ids: [pageEvidence[0].evidence_id],
            }),
          );
      }
      for (const link of prioritizeCrawlLinks(extracted.links)) {
        const target = publicUrl(link);
        if (
          target.origin === homepage.origin &&
          usefulLink(target) &&
          !seen.has(target.href) &&
          !queue.some((queued) => queued.href === target.href)
        )
          queue.push(target);
      }
    } catch (error) {
      crawlPages.push(crawlPage(url, "failed", []));
      errors.push({
        code: "page_fetch_failed",
        url: url.href,
        message: String(error),
      });
    }
    if (totalBytes >= limits.maxTotalBytes) {
      errors.push({
        code: "crawl_byte_limit",
        message: "Crawl byte limit reached",
      });
      break;
    }
  }

  let images: Array<{
    path: string;
    evidence_id: string;
    width: number;
    height: number;
    sha256: string;
  }> = [];
  let performanceScore: number | null = null;
  if (options.browser) {
    const captured = await captureScreenshots(
      homepage,
      outputDir,
      {
        timeoutMs,
        maxRequests: limits.maxBrowserRequests,
        maxBytes: Math.max(1, limits.maxTotalBytes - totalBytes),
        deadline: started + limits.maxDurationMs,
        minHostIntervalMs: limits.minHostIntervalMs,
        maxRedirects: limits.maxRedirects,
      },
      options.lighthouse !== false,
      options.screenshotViewports,
    );
    evidenceItems.push(...captured.evidence);
    images = captured.images;
    errors.push(...captured.errors);
    performanceScore = captured.performanceScore;
  }
  if (!options.browser)
    errors.push({
      code: "lighthouse_not_requested",
      message: "Browser collection was disabled, so Lighthouse was not run",
    });
  return {
    evidence: evidenceItems,
    images,
    crawl_pages: crawlPages,
    technology_observations: technology,
    metrics: { performance_score: performanceScore },
    errors,
    observedAt,
    website: homepage.href,
  };
}
