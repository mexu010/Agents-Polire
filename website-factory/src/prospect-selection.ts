import { hash, id, now, type JsonObject } from "./contracts.js";

export function hasAssessableReview(row: JsonObject): boolean {
  const audit = row.review?.context?.demoReview?.summary?.audit;
  return (
    row.reviewStatus === "complete" &&
    typeof audit?.qualityScore === "number" &&
    Number.isFinite(audit.qualityScore) &&
    Array.isArray(audit.issues)
  );
}

export function promisingReview(row: JsonObject): boolean {
  const summary = row.review?.context?.demoReview?.summary;
  return (
    hasAssessableReview(row) &&
    summary.audit.qualityScore <= 65 &&
    summary.audit.issues.length > 0 &&
    summary.businessStatus?.status !== "closed"
  );
}

/** Persist the draw before dispatch. Existing attempts and reservations consume the same cap. */
export function planProspectReviews(batch: JsonObject): void {
  const rows = batch.results as JsonObject[];
  batch.selection ??= {
    version: 2,
    seed: id(),
    createdAt: now(),
    controlPopulation: rows
      .filter((r) => r.screening?.status === "no_signal" && !r.reviewStatus)
      .map((r) => r.website),
  };
  const population = new Set<string>(batch.selection.controlPopulation);
  const reserved = rows.filter((r) => r.reviewStatus || r.selectionReason);
  let free = Math.max(0, batch.maxReviews - reserved.length);
  const randomOrder = (a: JsonObject, b: JsonObject) =>
    hash([batch.selection.seed, a.website]).localeCompare(
      hash([batch.selection.seed, b.website]),
    );
  const available = rows.filter((r) => !r.reviewStatus && !r.selectionReason);
  const controls = available
    .filter(
      (r) => r.screening?.status === "no_signal" && population.has(r.website),
    )
    .sort(randomOrder);
  const uncertain = available
    .filter(
      (r) => r.screening?.status === "uncertain" || r.screenStatus === "failed",
    )
    .sort(randomOrder);
  const candidates = available
    .filter((r) => r.screening?.status === "candidate")
    .sort(
      (a, b) =>
        (b.screening.priority ?? 0) - (a.screening.priority ?? 0) ||
        rows.indexOf(a) - rows.indexOf(b),
    );
  const followups = available
    .filter(
      (r) => r.screening?.status === "no_signal" && !population.has(r.website),
    )
    .sort(randomOrder);
  let order = rows.reduce((max, r) => Math.max(max, r.selectionOrder ?? 0), 0);
  const take = (pool: JsonObject[], amount: number, reason: string) => {
    for (const row of pool
      .filter((r) => !r.selectionReason)
      .slice(0, Math.min(free, amount))) {
      row.selectionReason = reason;
      row.selectionScreeningStatus = row.screening?.status ?? row.screenStatus;
      row.selectionOrder = ++order;
      row.selectedAt = now();
      free--;
    }
  };
  // At the standard six slots: one control, two unclear cases, three static candidates.
  const controlTarget = batch.maxReviews
    ? Math.max(1, Math.floor(batch.maxReviews * 0.2))
    : 0;
  const uncertainTarget = batch.maxReviews
    ? Math.max(1, Math.floor(batch.maxReviews / 3))
    : 0;
  take(
    controls,
    Math.max(
      0,
      controlTarget -
        reserved.filter((r) => r.selectionReason === "control_sample").length,
    ),
    "control_sample",
  );
  take(
    uncertain,
    Math.max(
      0,
      uncertainTarget -
        reserved.filter((r) => r.selectionReason === "uncertain").length,
    ),
    "uncertain",
  );
  take(candidates, free, "candidate");
  take(uncertain, free, "uncertain");
  take(controls, free, "control_sample");
  take(followups, free, "followup");
}

export function controlSampleSummary(batch: JsonObject): JsonObject {
  const rows = (batch.results as JsonObject[]).filter(
    (r) => r.selectionReason === "control_sample",
  );
  const completed = rows.filter((r) => r.reviewStatus === "complete");
  const assessable = completed.filter(hasAssessableReview);
  const promising = assessable.filter(promisingReview);
  return {
    population: batch.selection?.controlPopulation?.length ?? 0,
    selected: rows.length,
    completed: completed.length,
    assessable: assessable.length,
    inconclusive: rows.length - assessable.length,
    promising: promising.length,
    promisingRate: assessable.length
      ? promising.length / assessable.length
      : null,
  };
}
