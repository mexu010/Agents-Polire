import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hash, id, now, type JsonObject } from "./contracts.js";
import { publicUrl } from "./crawler.js";
import type { Factory } from "./orchestrator.js";
import {
  screenCollected,
  screenWebsite,
  type ScreeningResult,
} from "./screening.js";
import { writeReviewReport } from "./workflow.js";

type Options = {
  batchId: string;
  websites: string[];
  maxReviews?: number;
  screenConcurrency?: number;
  recheckScreening?: boolean;
};
type Dependencies = {
  screenWebsite?: typeof screenWebsite;
  screenCollected?: typeof screenCollected;
};
const KIND = "prospect_batches";
const LEASE_MS = 30 * 60_000;

function normalizedWebsite(input: string): string {
  const url = publicUrl(input);
  url.hash = "";
  return url.href;
}

function hostKey(input: string): string {
  const url = publicUrl(input);
  return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.port ? `:${url.port}` : ""}`;
}

function validCount(
  value: number,
  min: number,
  max: number,
  name: string,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

async function workers<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const outcomes = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await task(item);
      }
    }),
  );
  const failure = outcomes.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
}

function completed(job: JsonObject): boolean {
  return (
    job.stage === "demo_review" &&
    job.status === "waiting_approval" &&
    Boolean(job.context?.demoReview?.summary)
  );
}

function cachedReview(factory: Factory, website: string): JsonObject | null {
  const exists = factory.store.db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='factory_jobs'",
    )
    .get();
  if (!exists) return null;
  const rows = factory.store.db
    .prepare(
      "SELECT value_json, updated_at FROM factory_jobs WHERE stage='demo_review' AND status='waiting_approval' ORDER BY updated_at DESC",
    )
    .all() as Array<{ value_json: string; updated_at: string }>;
  const cutoff = Date.now() - 7 * 24 * 60 * 60_000;
  for (const row of rows) {
    const job = JSON.parse(row.value_json) as JsonObject;
    if (
      job.mode !== factory.config.mode ||
      hostKey(job.website) !== hostKey(website) ||
      !completed(job)
    )
      continue;
    const updated = Date.parse(
      job.context?.crawl?.observedAt ??
        (job.mode === "fixture" ? (job.updatedAt ?? row.updated_at) : ""),
    );
    if (Number.isFinite(updated) && updated >= cutoff) return job;
  }
  return null;
}

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>[\]`]/g, "");
}

function sourceLink(value: unknown): string | null {
  try {
    return publicUrl(String(value)).href;
  } catch {
    return null;
  }
}

function quotaBlocked(value: unknown): boolean {
  const error = value as {
    code?: string;
    message?: string;
    reason?: string;
  } | null;
  return (
    error?.code === "BUDGET_EXCEEDED" ||
    error?.code === "OAUTH_CALL_LIMIT" ||
    /(?:quota|budget|usage limit|rate limit|OAuth (?:day|total|run) call limit reached|limit erreicht)/i.test(
      String(error?.message ?? error?.reason ?? value ?? ""),
    )
  );
}

function syntheticScreen(website: string): ScreeningResult {
  return {
    website,
    checkedAt: now(),
    status: "candidate",
    priority: 0,
    signals: [],
    contacts: [],
    limitations: [
      "Synthetische Fixture-Vorprüfung; keine externe Website wurde abgerufen. Keine Aussage über diese Firma.",
    ],
    crawl: { synthetic: true },
  };
}

export function writeProspectingReport(
  factory: Factory,
  batch: JsonObject,
): string {
  const dir = resolve(factory.config.dataDir, "prospecting");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${batch.batchId}.md`);
  const rows = batch.results as JsonObject[];
  const promising = rows.filter((r) => {
    const summary = r.review?.context?.demoReview?.summary;
    const score = summary?.audit?.qualityScore;
    return (
      r.reviewStatus === "complete" &&
      typeof score === "number" &&
      Number.isFinite(score) &&
      score <= 65 &&
      summary?.audit?.issues?.length > 0 &&
      summary?.businessStatus?.status !== "closed"
    );
  });
  const pending = rows.filter(
    (r) =>
      r.screening?.status === "uncertain" ||
      (r.screening?.status === "candidate" && r.reviewStatus !== "complete") ||
      r.screenStatus === "failed",
  );
  const lines = [
    `# Prospecting ${safeText(batch.batchId)}`,
    "",
    ...(batch.mode === "fixture"
      ? [
          "**TESTDATEN: Vorprüfung und Modellantworten sind synthetisch. Keine echte Firmenbewertung.**",
          "",
        ]
      : []),
    `Stand: ${now()}`,
    `Websites: ${rows.length}; vorgeprüft: ${batch.summary.screened}; vollständige Reviews: ${batch.summary.completeReviews}; Modellaufrufe: ${batch.summary.modelCalls}; Laufzeit: ${batch.summary.elapsedMs} ms.`,
    "Betriebsstatus nicht verifiziert. Vorprüfung ist kein visueller Audit und keine Betriebsprüfung.",
    "",
    "## Auswahl mit vollständigem Review",
    "",
  ];
  if (!promising.length)
    lines.push("Keine abgeschlossenen relevanten Reviews.", "");
  for (const row of promising) {
    const audit = row.review.context.demoReview.summary.audit;
    lines.push(
      `- ${safeText(row.website)} — Qualität ${audit.qualityScore}/100; [Einzelreview](<${resolve(row.reportPath)}>); Betriebsstatus nicht verifiziert.`,
    );
    for (const signal of row.screening?.signals ?? []) {
      const source = sourceLink(signal.sourceUrl);
      if (source)
        lines.push(
          `  - Vorprüfbeleg: ${safeText(signal.observation)} ([Quelle](${source})).`,
        );
    }
    for (const contact of row.screening?.contacts ?? []) {
      const source = sourceLink(contact.sourceUrl);
      if (source)
        lines.push(
          `  - Kontakt ${safeText(contact.kind)}: ${safeText(contact.value)} ([Quelle](${source})).`,
        );
    }
  }
  lines.push("", "## Warteschlange und unklare Fälle", "");
  if (!pending.length)
    lines.push("Keine offenen Kandidaten oder unklaren Fälle.");
  for (const row of pending)
    lines.push(
      `- ${safeText(row.website)} — ${safeText(row.screening?.status ?? row.screenStatus)}; ${safeText(row.reviewStatus ?? "kein Review")}`,
    );
  lines.push("", `Vollständige Ergebnisse: ${safeText(batch.jsonPath)}`, "");
  const staging = `${file}.${id()}.tmp`;
  writeFileSync(staging, lines.join("\n"));
  renameSync(staging, file);
  return file;
}

export async function runProspecting(
  factory: Factory,
  options: Options,
  dependencies: Dependencies = {},
): Promise<JsonObject> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(options.batchId))
    throw new Error("invalid prospect batch ID");
  if (!Array.isArray(options.websites))
    throw new Error("websites must be an array");
  const seenHosts = new Set<string>();
  const websites = options.websites.map(normalizedWebsite).filter((website) => {
    const key = hostKey(website);
    if (seenHosts.has(key)) return false;
    seenHosts.add(key);
    return true;
  });
  validCount(websites.length, 1, 100, "unique websites");
  const maxReviews = validCount(options.maxReviews ?? 6, 0, 100, "maxReviews");
  const screenConcurrency = validCount(
    options.screenConcurrency ?? 6,
    1,
    8,
    "screenConcurrency",
  );
  const reviewConcurrency = validCount(
    factory.config.crawler.parallelLeads,
    1,
    2,
    "crawler.parallelLeads",
  );
  const manifestHash = hash({
    websites,
    maxReviews,
    screenConcurrency,
    mode: factory.config.mode,
  });
  const store = factory.store;
  const key = options.batchId;
  const lockKey = `prospect:${key}`;
  const owner = id();
  const ensureLease = () => {
    const lock = store.get("workflow_locks", lockKey);
    if (lock?.owner !== owner || Date.parse(lock.expiresAt) <= Date.now())
      throw new Error("prospect lease lost");
  };
  store.transaction(() => {
    const lock = store.get("workflow_locks", lockKey);
    if (lock && Date.parse(lock.expiresAt) > Date.now())
      throw new Error("prospect already running");
    const saved = store.get(KIND, key);
    if (saved && saved.manifestHash !== manifestHash)
      throw new Error("prospect manifest changed");
    store.put(
      KIND,
      key,
      saved ?? {
        batchId: key,
        manifestHash,
        websites,
        maxReviews,
        screenConcurrency,
        mode: factory.config.mode,
        createdAt: now(),
        results: websites.map((website) => ({ website })),
        elapsedMs: 0,
      },
    );
    store.put("workflow_locks", lockKey, {
      owner,
      expiresAt: new Date(Date.now() + LEASE_MS).toISOString(),
    });
  });
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    try {
      store.transaction(() => {
        ensureLease();
        store.put("workflow_locks", lockKey, {
          owner,
          expiresAt: new Date(Date.now() + LEASE_MS).toISOString(),
        });
      });
    } catch {
      leaseLost = true;
    }
  }, 60_000);
  heartbeat.unref();
  const started = Date.now();
  const update = (website: string, patch: JsonObject) =>
    store.transaction(() => {
      if (leaseLost) throw new Error("prospect lease lost");
      ensureLease();
      const batch = store.get(KIND, key);
      const index = batch.results.findIndex(
        (row: JsonObject) => row.website === website,
      );
      batch.results[index] = { ...batch.results[index], ...patch };
      batch.updatedAt = now();
      store.put(KIND, key, batch);
    });
  try {
    const screen =
      dependencies.screenWebsite ??
      (factory.config.mode === "fixture"
        ? async (website: string) => syntheticScreen(website)
        : screenWebsite);
    let batch = store.get(KIND, key);
    if (options.recheckScreening) {
      const replay =
        dependencies.screenCollected ??
        (factory.config.mode === "fixture"
          ? async (website: string) => syntheticScreen(website)
          : screenCollected);
      await workers(
        (batch.results as JsonObject[]).filter(
          (r) => r.screenStatus === "complete" && r.screening?.crawl,
        ),
        screenConcurrency,
        async (row) => {
          try {
            ensureLease();
            const rawCrawl = row.screening.crawl as JsonObject;
            const result = await replay(row.website, rawCrawl);
            update(row.website, {
              previousScreeningStatus: row.screening.status,
              screening: { ...result, crawl: rawCrawl },
              recheckedAt: now(),
              recheckError: null,
            });
          } catch (error) {
            update(row.website, {
              recheckedAt: now(),
              recheckError: String(error),
            });
          }
        },
      );
      batch = store.get(KIND, key);
    }
    await workers(
      (batch.results as JsonObject[]).filter((r) => !r.screenStatus),
      screenConcurrency,
      async (row) => {
        try {
          ensureLease();
          const result: ScreeningResult = await screen(row.website, {
            outputDir: join(
              factory.config.dataDir,
              "screening",
              hash([key, row.website]).slice(0, 20),
            ),
          });
          update(row.website, {
            screenStatus: "complete",
            screening: result,
            screenedAt: now(),
          });
        } catch (error) {
          update(row.website, {
            screenStatus: "failed",
            screenError: String(error),
            screenedAt: now(),
          });
        }
      },
    );
    batch = store.get(KIND, key);
    const reviewSlots = Math.max(
      0,
      maxReviews -
        (batch.results as JsonObject[]).filter((row) => row.reviewStatus)
          .length,
    );
    const candidates = (batch.results as JsonObject[])
      .map((row, index) => ({ row, index }))
      .filter(
        ({ row }) => row.screening?.status === "candidate" && !row.reviewStatus,
      )
      .sort(
        (a, b) =>
          b.row.screening.priority - a.row.screening.priority ||
          a.index - b.index,
      )
      .slice(0, reviewSlots);
    let quotaStopped = false;
    await workers(candidates, reviewConcurrency, async ({ row }) => {
      if (row.reviewStatus) return;
      const runId = `prospect-${key}-${hash(row.website).slice(0, 16)}`;
      if (quotaStopped) {
        update(row.website, {
          runId,
          reviewStatus: "blocked_review",
          reviewError: "Quota or budget limit reached earlier in this batch",
          reviewedAt: now(),
        });
        return;
      }
      try {
        ensureLease();
        const cached = cachedReview(factory, row.website);
        const job =
          cached ??
          (await factory.runLead(row.website, {
            runId,
            requireDemoDecision: true,
          }));
        const reportPath = resolve(
          writeReviewReport(factory.config.dataDir, job),
        );
        const reviewStatus = completed(job)
          ? "complete"
          : quotaBlocked(job.reason)
            ? "blocked_review"
            : job.status;
        if (reviewStatus === "blocked_review") quotaStopped = true;
        update(row.website, {
          runId: job.runId ?? job.id ?? runId,
          reviewStatus,
          review: job,
          reportPath,
          reusedReview: Boolean(cached),
          reviewedAt: now(),
        });
      } catch (error) {
        const blocked = quotaBlocked(error);
        if (blocked) quotaStopped = true;
        update(row.website, {
          runId,
          reviewStatus: blocked ? "blocked_review" : "failed",
          reviewError: String(error),
          reviewedAt: now(),
        });
      }
    });
    batch = store.get(KIND, key);
    batch.elapsedMs = (batch.elapsedMs ?? 0) + Date.now() - started;
    const rows = batch.results as JsonObject[];
    const runIds = rows
      .filter((r) => r.runId && !r.reusedReview)
      .map((r) => r.runId);
    const modelCalls = runIds.length
      ? (
          store.db
            .prepare(
              `SELECT COUNT(*) AS n FROM agent_attempts WHERE run_id IN (${runIds.map(() => "?").join(",")}) AND state IN ('dispatched','succeeded','failed','uncertain','blocked')`,
            )
            .get(...runIds) as { n: number }
        ).n
      : 0;
    batch.summary = {
      total: rows.length,
      screened: rows.filter((r) => r.screenStatus === "complete").length,
      screenFailed: rows.filter((r) => r.screenStatus === "failed").length,
      candidates: rows.filter((r) => r.screening?.status === "candidate")
        .length,
      uncertain: rows.filter((r) => r.screening?.status === "uncertain").length,
      completeReviews: rows.filter((r) => r.reviewStatus === "complete").length,
      reviewFailed: rows.filter((r) => r.reviewStatus === "failed").length,
      blockedReviews: rows.filter((r) => r.reviewStatus === "blocked_review")
        .length,
      modelCalls,
      elapsedMs: batch.elapsedMs,
    };
    const dir = resolve(factory.config.dataDir, "prospecting");
    mkdirSync(dir, { recursive: true });
    batch.jsonPath = join(dir, `${key}.json`);
    batch.reportPath = writeProspectingReport(factory, batch);
    batch.updatedAt = now();
    store.transaction(() => {
      ensureLease();
      store.put(KIND, key, batch);
    });
    const staging = `${batch.jsonPath}.${id()}.tmp`;
    writeFileSync(staging, JSON.stringify(batch, null, 2));
    renameSync(staging, batch.jsonPath);
    return batch;
  } finally {
    clearInterval(heartbeat);
    store.transaction(() => {
      if (store.get("workflow_locks", lockKey)?.owner === owner)
        store.db
          .prepare("DELETE FROM records WHERE kind='workflow_locks' AND id=?")
          .run(lockKey);
    });
  }
}
