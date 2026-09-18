import { extractPage, guardedFetch, publicUrl } from "./crawler.js";
import { hash, now } from "./contracts.js";
import robotsParser from "robots-parser";
import type { BudgetLimits, Store } from "./store.js";

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const HARD_LIMITS = {
  queries: 5,
  results: 10,
  pages: 5,
  sourceChars: 12_000,
} as const;
const USER_AGENT = "POLIRE-Research/1.0";

export type SearchResult = { url: string; title?: string; snippet?: string };
export type SearchTransport = (request: {
  query: string;
  limit: number;
  apiKey: string;
}) => Promise<SearchResult[]>;
export type FetchTransport = (url: string) => Promise<{
  url: string;
  status: number;
  contentType?: string;
  body: string;
}>;

export interface ResearchOptions {
  store: Store;
  runId: string;
  apiKey?: string;
  searchTransport?: SearchTransport;
  /** A fixture seam. Production reads always call guardedFetch. */
  fetchTransport?: FetchTransport;
  maxQueriesPerRun?: number;
  maxResultsPerQuery?: number;
  maxPagesPerRun?: number;
  maxSourceChars?: number;
  /** Required only for a live Brave request; fixture transports are free. */
  billing?: {
    leadId: string;
    spendScopeId: string;
    limits: BudgetLimits;
    queryCostMicroUsd: number;
    dayKey?: string;
  };
}

export class ResearchLimitError extends Error {
  constructor(readonly limit: "queries" | "pages") {
    super(`Research ${limit} limit reached for this run`);
    this.name = "ResearchLimitError";
  }
}
export class ResearchOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchOperationError";
  }
}
export class ResearchTransportError extends Error {
  constructor(readonly code: "SEARCH_FAILED" | "FETCH_FAILED") {
    super(
      code === "SEARCH_FAILED"
        ? "Search request failed"
        : "Source request failed",
    );
    this.name = "ResearchTransportError";
  }
}

type Limits = {
  maxQueriesPerRun: number;
  maxResultsPerQuery: number;
  maxPagesPerRun: number;
  maxSourceChars: number;
};
type RunState = Limits & {
  queryCount: number;
  pageCount: number;
  queries: string[];
  pages: string[];
};

export class ResearchService {
  private readonly store: Store;
  private readonly runId: string;
  private readonly apiKey?: string;
  private readonly searchTransport?: SearchTransport;
  private readonly fetchTransport?: FetchTransport;
  private readonly requestedLimits: Limits;
  private readonly billing?: NonNullable<ResearchOptions["billing"]>;

  constructor(options: ResearchOptions) {
    if (!options.runId.trim()) throw new TypeError("runId is required");
    this.store = options.store;
    this.runId = options.runId;
    this.apiKey = options.apiKey ?? process.env.BRAVE_SEARCH_API_KEY;
    this.searchTransport = options.searchTransport;
    this.fetchTransport = options.fetchTransport;
    this.billing = options.billing;
    this.requestedLimits = {
      maxQueriesPerRun: bounded(options.maxQueriesPerRun, HARD_LIMITS.queries),
      maxResultsPerQuery: bounded(
        options.maxResultsPerQuery,
        HARD_LIMITS.results,
      ),
      maxPagesPerRun: bounded(options.maxPagesPerRun, HARD_LIMITS.pages),
      maxSourceChars: bounded(options.maxSourceChars, HARD_LIMITS.sourceChars),
    };
  }

  async discover(
    query: string,
    options: { limit?: number } = {},
  ): Promise<{
    query: string;
    results: Array<{
      id: string;
      url: string;
      title: string | null;
      snippet: string | null;
    }>;
    cached: boolean;
  }> {
    const normalized = normalizeQuery(query);
    const id = discoveryId(this.runId, normalized);
    if (!this.searchTransport) this.assertLiveSearchPreflight();
    const limit = Math.min(
      bounded(options.limit, this.requestedLimits.maxResultsPerQuery),
      this.requestedLimits.maxResultsPerQuery,
    );
    const reserved = this.reserve("search", id, () => ({
      query: normalized,
      limit,
    }));
    if (reserved.cache)
      return {
        query: normalized,
        results: reserved.cache.results,
        cached: true,
      };
    try {
      const raw = await (this.searchTransport ?? braveSearch)(
        this.searchTransport
          ? { query: normalized, limit, apiKey: this.apiKey ?? "" }
          : this.searchRequest(normalized, limit),
      );
      const results = sanitizeResults(raw, limit);
      const record = {
        runId: this.runId,
        query: normalized,
        results,
        retrievedAt: now(),
      };
      this.finish(
        "search",
        id,
        reserved.reservationId,
        "research-discovery",
        record,
        {
          query: normalized,
          resultCount: results.length,
        },
      );
      return { query: normalized, results, cached: false };
    } catch {
      const safe = new ResearchTransportError("SEARCH_FAILED");
      this.fail("search", id, reserved.reservationId, {
        query: normalized,
        code: safe.code,
        error: safe.message,
      });
      throw safe;
    }
  }

  async read(input: string): Promise<{
    id: string;
    url: string;
    finalUrl: string;
    status: number;
    contentType: string | null;
    text: string;
    excerpt: string;
    evidence: {
      sourceUrl: string;
      capturedAt: string;
      contentHash: string;
      businessStatus: "unknown";
      truncated: boolean;
    };
    cached: boolean;
  }> {
    const url = publicUrl(input).href;
    const id = fetchId(this.runId, url);
    const reserved = this.reserve("fetch", id, () => ({ url }));
    if (reserved.cache) return { ...reserved.cache, cached: true };
    try {
      const response = this.fetchTransport
        ? await this.fetchTransport(url)
        : await productionFetch(url);
      if (response.status < 200 || response.status >= 300)
        throw new Error(`HTTP ${response.status}`);
      const finalUrl = publicUrl(response.url).href;
      const extracted = extractPage(response.body, finalUrl);
      const sourceText =
        extracted.text || response.body.replace(/\s+/g, " ").trim();
      const text = sourceText.slice(0, this.runState().maxSourceChars);
      const truncated = sourceText.length > text.length;
      const capturedAt = now();
      const record = {
        runId: this.runId,
        url,
        finalUrl,
        status: response.status,
        contentType: response.contentType ?? null,
        text,
        excerpt: text.slice(0, Math.min(600, text.length)),
        evidence: {
          sourceUrl: finalUrl,
          capturedAt,
          contentHash: hash(response.body),
          businessStatus: "unknown" as const,
          truncated,
        },
      };
      this.finish("fetch", id, undefined, "research-fetch", record, {
        url,
        finalUrl,
        status: response.status,
        contentHash: record.evidence.contentHash,
      });
      return { id, ...record, cached: false };
    } catch {
      const safe = new ResearchTransportError("FETCH_FAILED");
      this.fail("fetch", id, undefined, {
        url,
        code: safe.code,
        error: safe.message,
      });
      throw safe;
    }
  }

  private searchRequest(
    query: string,
    limit: number,
  ): { query: string; limit: number; apiKey: string } {
    if (!this.apiKey)
      throw new Error("BRAVE_SEARCH_API_KEY is required for Brave search");
    return { query, limit, apiKey: this.apiKey };
  }

  private assertLiveSearchPreflight(): void {
    if (!this.apiKey)
      throw new Error("BRAVE_SEARCH_API_KEY is required for Brave search");
    if (!this.billing || !validBilling(this.billing))
      throw new Error(
        "Live Brave search requires complete positive billing configuration",
      );
  }

  private reserve(
    kind: "search" | "fetch",
    id: string,
    subject: () => Record<string, unknown>,
  ): { cache: any | null; reservationId?: string } {
    return this.store.transaction(() => {
      const cache = this.store.get(
        kind === "search" ? "research-discovery" : "research-fetch",
        id,
      );
      if (cache) return { cache };
      const prior = this.store.get("research-operation", id);
      if (prior)
        throw new ResearchOperationError(
          prior.state === "failed"
            ? "Research operation previously failed; resume does not resend it"
            : "Research operation already started; resume does not resend it",
        );
      const state = this.runState();
      const countKey = kind === "search" ? "queryCount" : "pageCount";
      const limitKey =
        kind === "search" ? "maxQueriesPerRun" : "maxPagesPerRun";
      if (state[countKey] >= state[limitKey])
        throw new ResearchLimitError(kind === "search" ? "queries" : "pages");
      this.saveRun({
        ...state,
        [countKey]: state[countKey] + 1,
        [kind === "search" ? "queries" : "pages"]: [
          ...state[kind === "search" ? "queries" : "pages"],
          String(subject()[kind === "search" ? "query" : "url"]),
        ],
      });
      let reservationId: string | undefined;
      if (kind === "search" && !this.searchTransport && this.billing) {
        const attemptId = `research-attempt-${id}`;
        reservationId = `research-reservation-${id}`;
        this.store.createAttempt({
          attemptId,
          stepId: id,
          runId: this.runId,
          leadId: this.billing.leadId,
          agent: "scout",
          model: "brave-search",
          kind: "initial",
        });
        this.store.reserveBudget({
          reservationId,
          attemptId,
          runId: this.runId,
          leadId: this.billing.leadId,
          spendScopeId: this.billing.spendScopeId,
          dayKey: this.billing.dayKey,
          amountMicroUsd: this.billing.queryCostMicroUsd,
          limits: this.billing.limits,
        });
        this.store.markDispatched(reservationId);
      }
      this.store.put("research-operation", id, {
        runId: this.runId,
        kind,
        state: "started",
        startedAt: now(),
        ...subject(),
        reservationId: reservationId ?? null,
      });
      this.event(kind, id, { state: "started", ...subject() });
      return { cache: null, reservationId };
    });
  }

  private finish(
    kind: "search" | "fetch",
    id: string,
    reservationId: string | undefined,
    cacheKind: "research-discovery" | "research-fetch",
    record: Record<string, unknown>,
    event: Record<string, unknown>,
  ): void {
    this.store.transaction(() => {
      this.store.put(cacheKind, id, record);
      this.store.put("research-operation", id, {
        ...(this.store.get("research-operation", id) ?? {}),
        state: "succeeded",
        completedAt: now(),
      });
      if (reservationId && this.billing)
        this.store.settleBudget(reservationId, {
          actualCostMicroUsd: this.billing.queryCostMicroUsd,
          rawUsage: {
            provider: "brave",
            chargedMicroUsd: this.billing.queryCostMicroUsd,
          },
        });
      this.event(kind, id, { state: "succeeded", ...event });
    });
  }

  private fail(
    kind: "search" | "fetch",
    id: string,
    reservationId: string | undefined,
    event: Record<string, unknown>,
  ): void {
    this.store.transaction(() => {
      this.store.put("research-operation", id, {
        ...(this.store.get("research-operation", id) ?? {}),
        state: "failed",
        completedAt: now(),
      });
      if (reservationId)
        this.store.markBudgetUncertain(
          reservationId,
          "research_request_failed",
        );
      this.event(kind, id, { state: "failed", ...event });
    });
  }

  private runState(): RunState {
    const existing = this.store.get(
      "research-run",
      this.runId,
    ) as RunState | null;
    if (existing) return existing;
    const initial: RunState = {
      ...this.requestedLimits,
      queryCount: 0,
      pageCount: 0,
      queries: [],
      pages: [],
    };
    this.saveRun(initial);
    return initial;
  }

  private saveRun(state: RunState): void {
    this.store.put("research-run", this.runId, state);
  }

  private event(
    kind: "search" | "fetch",
    subjectId: string,
    value: Record<string, unknown>,
  ): void {
    const state = typeof value.state === "string" ? value.state : "observed";
    const eventId = `event-${hash({ runId: this.runId, kind, subjectId, state }).slice(0, 32)}`;
    this.store.put("research-event", eventId, {
      runId: this.runId,
      kind,
      subjectId,
      at: now(),
      ...value,
    });
  }
}

function bounded(value: number | undefined, ceiling: number): number {
  if (value === undefined) return ceiling;
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new TypeError("Research limits must be positive integers");
  return Math.min(value, ceiling);
}
function normalizeQuery(query: string): string {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 300)
    throw new TypeError("Research query must contain 1 to 300 characters");
  return normalized;
}
function discoveryId(runId: string, query: string): string {
  return `discovery-${hash({ runId, query }).slice(0, 32)}`;
}
function fetchId(runId: string, url: string): string {
  return `fetch-${hash({ runId, url }).slice(0, 32)}`;
}
function validBilling(value: NonNullable<ResearchOptions["billing"]>): boolean {
  if (!value.leadId.trim() || !value.spendScopeId.trim()) return false;
  if (value.limits.totalMicroUsd === undefined) return false;
  const amounts = [
    value.queryCostMicroUsd,
    value.limits.runMicroUsd,
    value.limits.leadMicroUsd,
    value.limits.dayMicroUsd,
    value.limits.totalMicroUsd,
  ];
  return amounts.every((amount) => Number.isSafeInteger(amount) && amount > 0);
}
function sanitizeResults(raw: SearchResult[], limit: number) {
  const seen = new Set<string>();
  const results: Array<{
    id: string;
    url: string;
    title: string | null;
    snippet: string | null;
  }> = [];
  for (const result of raw) {
    if (results.length === limit || !result?.url) break;
    try {
      const url = publicUrl(result.url).href;
      if (seen.has(url)) continue;
      seen.add(url);
      results.push({
        id: `result-${hash(url).slice(0, 24)}`,
        url,
        title: cleanString(result.title),
        snippet: cleanString(result.snippet),
      });
    } catch {
      /* Search output is untrusted; unsafe results are evidence-less. */
    }
  }
  return results;
}
function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 1_000);
  return cleaned || null;
}
async function braveSearch(request: {
  query: string;
  limit: number;
  apiKey: string;
}): Promise<SearchResult[]> {
  const endpoint = new URL(BRAVE_SEARCH_ENDPOINT);
  endpoint.searchParams.set("q", request.query);
  endpoint.searchParams.set("count", String(request.limit));
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": request.apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`Brave search failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { web?: { results?: unknown[] } };
  return (payload.web?.results ?? []).flatMap((value): SearchResult[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    return typeof row.url === "string"
      ? [
          {
            url: row.url,
            title: typeof row.title === "string" ? row.title : undefined,
            snippet:
              typeof row.description === "string" ? row.description : undefined,
          },
        ]
      : [];
  });
}
async function productionFetch(url: string): Promise<{
  url: string;
  status: number;
  contentType?: string;
  body: string;
}> {
  const target = publicUrl(url);
  const robotsUrl = new URL("/robots.txt", target);
  const robots = await guardedFetch(robotsUrl, {
    maxBytes: 512_000,
    timeoutMs: 15_000,
    maxRedirects: 3,
  });
  if (robots.status !== 404) {
    if (robots.status < 200 || robots.status >= 300)
      throw new Error(`robots.txt returned ${robots.status}`);
    const parseRobots = robotsParser as unknown as (
      source: string,
      contents: string,
    ) => {
      isAllowed: (checkedUrl: string, userAgent: string) => boolean | undefined;
    };
    if (
      !parseRobots(robots.url.href, robots.body.toString("utf8")).isAllowed(
        target.href,
        USER_AGENT,
      )
    )
      throw new Error("robots.txt disallows this crawler");
  }
  const response = await guardedFetch(url, {
    maxBytes: 2_000_000,
    timeoutMs: 15_000,
    maxRedirects: 3,
  });
  const type = response.headers["content-type"];
  return {
    url: response.url.href,
    status: response.status,
    contentType: typeof type === "string" ? type : undefined,
    body: response.body.toString("utf8"),
  };
}
