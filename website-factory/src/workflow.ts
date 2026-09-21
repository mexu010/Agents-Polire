import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { hash, id, now, type JsonObject } from "./contracts.js";
import { publicUrl } from "./crawler.js";
import type { Factory } from "./orchestrator.js";
import { businessBlocker } from "./business.js";

/** Sequential by design: each lead is budgeted by Factory; interruption retains the same run identity. */
export async function runBatch(
  factory: Factory,
  options: { batchId: string; websites: string[]; retryFailed?: boolean },
): Promise<JsonObject> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(options.batchId))
    throw new Error(
      "batch ID must contain 1-80 letters, digits, underscores or hyphens",
    );
  if (
    !Array.isArray(options.websites) ||
    options.websites.length < 1 ||
    options.websites.length > 50
  )
    throw new Error("batch requires 1-50 websites");
  const websites = [
    ...new Set(
      options.websites.map((u) => {
        const url = publicUrl(u);
        url.hash = "";
        return url.href;
      }),
    ),
  ];
  const manifestHash = hash(websites);
  const store = factory.store;
  const key = options.batchId;
  let batch!: JsonObject;
  // A lease prevents two wrappers overwriting each other's results. Individual jobs also have leases.
  const owner = id();
  const lockKey = `batch:${key}`;
  store.transaction(() => {
    const lock = store.get("workflow_locks", lockKey);
    if (lock && Date.parse(lock.expiresAt) > Date.now())
      throw new Error("batch already running");
    const saved = store.get("batches", key);
    if (saved && saved.manifestHash !== manifestHash)
      throw new Error("batch manifest changed; use the original URLs");
    batch = saved ?? {
      batchId: key,
      manifestHash,
      websites,
      results: [],
      createdAt: now(),
    };
    store.put("batches", key, batch);
    store.put("workflow_locks", lockKey, {
      owner,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
  });
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    try {
      store.transaction(() => {
        if (store.get("workflow_locks", lockKey)?.owner !== owner) {
          leaseLost = true;
          return;
        }
        store.put("workflow_locks", lockKey, {
          owner,
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        });
      });
    } catch {
      leaseLost = true;
    }
  }, 60_000);
  heartbeat.unref();
  try {
    for (const website of websites) {
      const previous = batch.results.find(
        (r: JsonObject) => r.website === website,
      );
      if (previous && (!options.retryFailed || previous.status !== "failed"))
        continue;
      const lock = store.get("workflow_locks", lockKey);
      if (leaseLost || lock?.owner !== owner)
        throw new Error("batch lease lost");
      store.put("workflow_locks", lockKey, {
        owner,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
      const runId = `batch-${key}-${hash(website).slice(0, 16)}`;
      let result: JsonObject;
      try {
        const job = await factory.runLead(website, {
          runId,
          requireDemoDecision: true,
        });
        result = {
          website,
          runId,
          status: job.status,
          stage: job.stage,
          report: writeReviewReport(factory.config.dataDir, job),
        };
      } catch {
        result = {
          website,
          runId,
          status: "failed",
          error: "Lead analysis failed; inspect the persisted run status",
        };
      }
      store.transaction(() => {
        if (leaseLost || store.get("workflow_locks", lockKey)?.owner !== owner)
          throw new Error("batch lease lost");
        batch.results = batch.results.filter(
          (r: JsonObject) => r.website !== website,
        );
        batch.results.push(result);
        batch.updatedAt = now();
        store.put("batches", key, batch);
      });
    }
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

const plain = (s: unknown) =>
  String(s ?? "unbekannt")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>[\]`]/g, "");
export const scoreText = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100
    ? `${Math.round(value)} von 100 Punkten`
    : "Noch nicht bewertbar";
const coverageText = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1
    ? `${Math.round(value * 100)} %`
    : "unbekannt";
export function writeReviewReport(dataDir: string, job: JsonObject): string {
  const review = job.context?.demoReview?.summary;
  const lines = [
    `# Website-Review`,
    "",
    `Website: ${publicUrl(job.website).href}`,
    `Lauf: ${plain(job.id ?? job.runId)}`,
    `Stand: ${now()}`,
    `Status: ${plain(job.status)} / ${plain(job.stage)}`,
    "",
  ];
  if (job.mode === "fixture")
    lines.push(
      "**TESTDATEN: Modellantworten simuliert; keine echte Firmenbewertung.**",
      "",
    );
  if (!review)
    lines.push(
      "**Unvollständig:** Es liegt noch kein vollständiges Analyse-Review vor. Kein Score wird erfunden.",
      plain(job.reason ?? ""),
      "",
    );
  else {
    const blocker =
      job.mode === "live" ? businessBlocker(job.context?.businessReview) : null;
    const blockers = [
      ...new Set([
        ...review.eligibility.blockers,
        ...(blocker ? [blocker] : []),
      ]),
    ];
    const quality = scoreText(review.audit.qualityScore);
    const businessStatus =
      {
        operating: "Aktivität belegt; Aktualität der Quelle beachten",
        closed: "Als geschlossen erfasst",
        uncertain: "Aktueller Betrieb noch zu bestätigen",
        unverified: "Aktueller Betrieb noch zu bestätigen",
      }[String(review.businessStatus?.status)] ??
      "Aktueller Betrieb noch zu bestätigen";
    const next =
      quality === "Noch nicht bewertbar"
        ? "Prüfgrundlagen ergänzen: fehlende Quellen oder Ansichten prüfen. Noch keine Aussage zur Websitequalität."
        : blocker
          ? "Aktuellen Betrieb und offene Voraussetzungen klären, bevor eine Demo freigegeben wird."
          : "Review ansehen, Bedarf und Interesse klären; eine Demo braucht deine ausdrückliche Freigabe.";
    lines.push(
      `**Bestehende Website: ${quality}.**`,
      "0 = sehr schwach, 100 = sehr gut. Je niedriger die Zahl, desto mehr beobachtete Schwächen. Das ist keine Kaufwahrscheinlichkeit und keine Bewertung einer Demo.",
      `Prüfumfang: ${coverageText(review.audit.coverage)} des Bewertungsgewichts abgedeckt. Das beschreibt den Umfang der Prüfung, nicht ihre Sicherheit. Nicht untersuchte Bereiche bleiben offen.`,
      "",
      `**Eignung als Auftrag: ${scoreText(review.qualification.score)}.**`,
      `Hier geht es um die wirtschaftliche Priorität für POLIRE, nicht um die Websitequalität oder eine Zusage der Firma. Informationsabdeckung: ${coverageText(review.qualification.coverage)}. Fehlende Angaben werden nicht als null Punkte gewertet.`,
      `Betriebsstatus: ${businessStatus}.`,
      "",
      `**Nächster Schritt:** ${next}`,
      `Demo möglich: ${review.eligibility.canApprove && !blocker ? "ja, nach ausdrücklicher Freigabe" : "nein"}.`,
      ...blockers.map((b: string) => `- Offene Voraussetzung: ${plain(b)}`),
      "",
      "## Konkrete Beobachtungen",
      "",
    );
    if (!review.audit.issues.length)
      lines.push(
        "Keine belegten Einzelbefunde im Bericht. Bei fehlenden Prüfgrundlagen bedeutet das nicht, dass die Website gut ist.",
      );
    for (const issue of review.audit.issues)
      lines.push(
        `- ${plain(issue.observation)} → ${plain(issue.recommendation)}`,
      );
    lines.push(
      "",
      `Review-Hash: ${plain(job.context.demoReview.reviewHash)}`,
      `Revision: ${job.revision}`,
      "Keine Demo-Freigabe durch diesen Bericht. Kein Versand.",
    );
  }
  const dir = join(dataDir, "reviews");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${hash(job.id ?? job.runId).slice(0, 24)}.md`);
  const staging = `${file}.${id()}.tmp`;
  writeFileSync(staging, lines.join("\n"));
  renameSync(staging, file);
  return file;
}

export function runTrace(factory: Factory, runId: string): JsonObject {
  const job = factory.show(runId);
  const select = (kind: string) =>
    factory.store.list(kind).filter((r: JsonObject) => r.runId === runId);
  const usage = factory.store.db
    .prepare(
      "SELECT agent,provider,requested_model,reported_model,reasoning,state,normalized_usage_json,actual_cost_micro_usd,billing_status,error_type,created_at FROM agent_attempts WHERE run_id=? ORDER BY created_at",
    )
    .all(runId)
    .map((row: any) => {
      const { normalized_usage_json, ...attempt } = row;
      return {
        ...attempt,
        usage: normalized_usage_json ? JSON.parse(normalized_usage_json) : null,
      };
    });
  return {
    runId,
    website: job.website,
    status: job.status,
    stage: job.stage,
    events: select("factory_events"),
    steps: select("steps"),
    usage,
    limitations: job.reason ?? null,
  };
}
