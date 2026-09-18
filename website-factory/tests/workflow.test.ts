import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vitest";
import { Store } from "../src/store.js";
import { runBatch, writeReviewReport } from "../src/workflow.js";
test("batch deduplicates, persists failures, resumes without rerunning completed leads and locks its manifest", async () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "workflow-")));
  let calls = 0;
  const factory: any = {
    store,
    config: { dataDir: tmpdir() },
    runLead: async (url: string) => {
      calls++;
      if (url.includes("bad")) throw new Error("blocked");
      return {
        id: url,
        website: url,
        status: "waiting_approval",
        stage: "demo_review",
        context: {},
      };
    },
  };
  const urls = ["https://good.ch", "https://good.ch/", "https://bad.ch"];
  const first = await runBatch(factory, { batchId: "a", websites: urls });
  expect(first.results).toHaveLength(2);
  expect(calls).toBe(2);
  await runBatch(factory, { batchId: "a", websites: urls });
  expect(calls).toBe(2);
  await expect(
    runBatch(factory, { batchId: "a", websites: ["https://other.ch"] }),
  ).rejects.toThrow(/manifest/);
  await runBatch(factory, { batchId: "a", websites: urls, retryFailed: true });
  expect(calls).toBe(3);
  store.close();
});
test("partial reports retain source link and clearly state missing review", () => {
  const dir = mkdtempSync(join(tmpdir(), "report-"));
  const file = writeReviewReport(dir, {
    id: "../unsafe",
    website: "https://example.ch/",
    stage: "scout",
    status: "failed",
    context: {},
  });
  expect(file.startsWith(dir)).toBe(true);
  expect(readFileSync(file, "utf8")).toContain("Unvollständig");
  expect(readFileSync(file, "utf8")).toContain("https://example.ch/");
});

test("concurrent batch wrapper cannot overwrite the active manifest or dispatch", async () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "batch-lock-")));
  let release!: () => void;
  let calls = 0;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const factory: any = {
    store,
    config: { dataDir: tmpdir() },
    runLead: async (website: string) => {
      calls++;
      await wait;
      return {
        id: "locked",
        website,
        status: "waiting_approval",
        stage: "demo_review",
        context: {},
      };
    },
  };
  const options = { batchId: "locked", websites: ["https://example.ch/"] };
  const active = runBatch(factory, options);
  await expect(runBatch(factory, options)).rejects.toThrow("already running");
  expect(calls).toBe(1);
  release();
  expect((await active).results).toHaveLength(1);
  store.close();
});

test("report never offers live demo approval from an expired cached review", () => {
  const dir = mkdtempSync(join(tmpdir(), "report-stale-"));
  const file = writeReviewReport(dir, {
    id: "stale",
    website: "https://example.ch/",
    mode: "live",
    revision: 1,
    context: {
      businessReview: {
        status: "operating",
        checkedAt: "2020-01-01",
        activityDate: "2020-01-01",
      },
      demoReview: {
        reviewHash: "old",
        summary: {
          audit: { qualityScore: 40, issues: [] },
          qualification: { score: 90, coverage: 1 },
          eligibility: { canApprove: true, blockers: [] },
          businessStatus: { status: "operating" },
        },
      },
    },
  });
  const report = readFileSync(file, "utf8");
  expect(report).toContain("Demo möglich: nein");
  expect(report).toContain("business_activity_stale");
});
