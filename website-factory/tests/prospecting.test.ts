import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Store } from "../src/store.js";
import { runProspecting } from "../src/prospecting.js";

function setup() {
  const dataDir = mkdtempSync(join(tmpdir(), "prospect-"));
  const store = new Store(dataDir);
  let activeScreens = 0;
  let peakScreens = 0;
  let activeReviews = 0;
  let peakReviews = 0;
  const screened: string[] = [];
  const reviewed: Array<{ website: string; options: any }> = [];
  const screenWebsite = async (website: string) => {
    activeScreens++;
    peakScreens = Math.max(peakScreens, activeScreens);
    screened.push(website);
    await new Promise((resolve) => setTimeout(resolve, 1));
    activeScreens--;
    if (website.includes("broken")) throw new Error("screen blocked");
    return {
      website,
      checkedAt: new Date().toISOString(),
      status: "candidate" as const,
      priority: 10,
      signals: [
        {
          code: "title",
          observation: "Titel fehlt",
          sourceUrl: website,
          excerpt: "<head>",
        },
      ],
      contacts: [],
      limitations: [],
      crawl: {},
    };
  };
  const factory: any = {
    store,
    config: { dataDir, mode: "fixture", crawler: { parallelLeads: 2 } },
    runLead: async (website: string, options: any) => {
      activeReviews++;
      peakReviews = Math.max(peakReviews, activeReviews);
      reviewed.push({ website, options });
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeReviews--;
      return {
        id: options.runId,
        runId: options.runId,
        website,
        mode: "fixture",
        stage: "demo_review",
        status: "waiting_approval",
        context: {
          demoReview: {
            summary: {
              audit: {
                qualityScore: 40,
                issues: [
                  {
                    observation: "Titel fehlt",
                    recommendation: "Titel ergänzen",
                  },
                ],
              },
              qualification: { score: 75, coverage: 1 },
              eligibility: { canApprove: false, blockers: [] },
              businessStatus: { status: "unverified" },
            },
            reviewHash: "test",
          },
        },
      };
    },
    show: (runId: string) => ({ id: runId }),
  };
  return {
    dataDir,
    store,
    factory,
    screenWebsite,
    screened,
    reviewed,
    get peakScreens() {
      return peakScreens;
    },
    get peakReviews() {
      return peakReviews;
    },
  };
}

test("screens 100 unique hosts with bounded workers and persists every result", async () => {
  const s = setup();
  const websites = Array.from(
    { length: 100 },
    (_, i) => `https://firm${i}.ch/`,
  );
  const batch: any = await runProspecting(
    s.factory,
    { batchId: "hundred", websites, maxReviews: 6 },
    { screenWebsite: s.screenWebsite },
  );
  expect(batch.results).toHaveLength(100);
  expect(s.peakScreens).toBeLessThanOrEqual(6);
  expect(s.peakScreens).toBeGreaterThan(1);
  expect(s.peakReviews).toBeLessThanOrEqual(2);
  expect(s.reviewed).toHaveLength(6);
  expect(
    s.reviewed.every(({ options }) => options.requireDemoDecision === true),
  ).toBe(true);
  expect(JSON.parse(readFileSync(batch.jsonPath, "utf8")).results).toHaveLength(
    100,
  );
  expect(readFileSync(batch.reportPath, "utf8")).toContain(
    "Betriebsstatus nicht verifiziert",
  );
  s.store.close();
});

test("same host deduplicates, failed screen stays failed, resume does not rerun", async () => {
  const s = setup();
  const websites = [
    "http://www.good.ch/#top",
    "https://good.ch/",
    "https://broken.ch/",
    "https://sub.good.ch/",
  ];
  const options = { batchId: "resume", websites, maxReviews: 0 };
  const first: any = await runProspecting(s.factory, options, {
    screenWebsite: s.screenWebsite,
  });
  expect(first.results).toHaveLength(3);
  expect(first.results[0].website).toBe("http://www.good.ch/");
  expect(
    first.results.find((r: any) => r.website.includes("broken"))?.screenStatus,
  ).toBe("failed");
  expect(readFileSync(first.reportPath, "utf8")).toContain("broken.ch");
  expect(s.screened).toHaveLength(3);
  await runProspecting(s.factory, options, { screenWebsite: s.screenWebsite });
  expect(s.screened).toHaveLength(3);
  expect(s.reviewed).toHaveLength(0);
  await expect(
    runProspecting(
      s.factory,
      { ...options, maxReviews: 1 },
      { screenWebsite: s.screenWebsite },
    ),
  ).rejects.toThrow(/manifest/);
  await expect(
    runProspecting(
      s.factory,
      { ...options, websites: ["https://other.ch/"] },
      { screenWebsite: s.screenWebsite },
    ),
  ).rejects.toThrow(/manifest/);
  s.store.close();
});

test("preserves the observed non-root path while deduplicating its host", async () => {
  const s = setup();
  const batch: any = await runProspecting(
    s.factory,
    {
      batchId: "path",
      websites: ["http://www.path.ch/landing/#part", "https://path.ch/other"],
      maxReviews: 0,
    },
    { screenWebsite: s.screenWebsite },
  );
  expect(batch.results).toHaveLength(1);
  expect(batch.results[0].website).toBe("http://www.path.ch/landing/");
  s.store.close();
});

test("concurrent prospect runs share lease and cannot dispatch twice", async () => {
  const s = setup();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const screenWebsite = async (website: string) => {
    calls++;
    await gate;
    return s.screenWebsite(website);
  };
  const options = {
    batchId: "locked",
    websites: ["https://lock.ch/"],
    maxReviews: 0,
  };
  const active = runProspecting(s.factory, options, { screenWebsite });
  await expect(
    runProspecting(s.factory, options, { screenWebsite }),
  ).rejects.toThrow(/already running/);
  expect(calls).toBe(1);
  release();
  await active;
  s.store.close();
});

test("reuses a recent complete review for the same host and mode", async () => {
  const s = setup();
  s.store.db.exec(
    "CREATE TABLE factory_jobs(run_id TEXT PRIMARY KEY, stage TEXT, status TEXT, value_json TEXT, updated_at TEXT)",
  );
  const old = {
    runId: "previous",
    website: "http://www.reuse.ch/old",
    mode: "fixture",
    stage: "demo_review",
    status: "waiting_approval",
    updatedAt: new Date().toISOString(),
    context: {
      demoReview: {
        reviewHash: "saved",
        summary: {
          audit: {
            qualityScore: 30,
            issues: [
              { observation: "Titel fehlt", recommendation: "Titel ergänzen" },
            ],
          },
          qualification: { score: 70, coverage: 1 },
          eligibility: { canApprove: false, blockers: [] },
          businessStatus: { status: "unverified" },
        },
      },
    },
  };
  s.store.db
    .prepare(
      "INSERT INTO factory_jobs(run_id,stage,status,value_json,updated_at) VALUES(?,?,?,?,?)",
    )
    .run(
      "previous",
      "demo_review",
      "waiting_approval",
      JSON.stringify(old),
      new Date().toISOString(),
    );
  const batch: any = await runProspecting(
    s.factory,
    {
      batchId: "reuse",
      websites: ["https://reuse.ch/"],
      maxReviews: 1,
    },
    { screenWebsite: s.screenWebsite },
  );
  expect(s.reviewed).toHaveLength(0);
  expect(batch.results[0].reusedReview).toBe(true);
  expect(batch.results[0].reviewStatus).toBe("complete");
  expect(batch.summary.modelCalls).toBe(0);
  s.store.close();
});

test("quota-blocked review keeps its run identity and prevents further dispatch", async () => {
  const s = setup();
  const calls: string[] = [];
  s.factory.runLead = async (_website: string, options: any) => {
    calls.push(options.runId);
    throw new Error("daily quota exhausted");
  };
  const options = {
    batchId: "quota",
    websites: [
      "https://a.ch/",
      "https://b.ch/",
      "https://c.ch/",
      "https://d.ch/",
    ],
    maxReviews: 4,
  };
  const first: any = await runProspecting(s.factory, options, {
    screenWebsite: s.screenWebsite,
  });
  expect(calls.length).toBeLessThanOrEqual(2);
  expect(first.summary.blockedReviews).toBe(4);
  expect(
    first.results.find((r: any) => r.reviewStatus === "blocked_review")
      ?.reviewError,
  ).toContain("quota");
  await runProspecting(s.factory, options, { screenWebsite: s.screenWebsite });
  expect(calls.length).toBeLessThanOrEqual(2);
  expect(
    s.store
      .get("prospect_batches", "quota")
      .results.find((r: any) => r.reviewStatus === "blocked_review")?.runId,
  ).toBe(calls[0]);
  s.store.close();
});

test("real OAuth limit code and returned reason block remaining reviews", async () => {
  const s = setup();
  const calls: string[] = [];
  s.factory.runLead = async (website: string, options: any) => {
    calls.push(website);
    if (calls.length === 1) {
      const error = new Error("OAuth day call limit reached") as Error & {
        code: string;
      };
      error.code = "OAUTH_CALL_LIMIT";
      throw error;
    }
    return {
      id: options.runId,
      website,
      status: "needs_input",
      stage: "scout",
      reason: "OAuth total call limit reached",
      context: {},
    };
  };
  const result: any = await runProspecting(
    s.factory,
    {
      batchId: "oauth",
      websites: [
        "https://oauth1.ch/",
        "https://oauth2.ch/",
        "https://oauth3.ch/",
      ],
      maxReviews: 3,
    },
    { screenWebsite: s.screenWebsite },
  );
  expect(calls.length).toBeLessThanOrEqual(2);
  expect(result.summary.blockedReviews).toBe(3);
  s.store.close();
});

test("fixture screening uses labelled synthetic data and never calls live screening", async () => {
  const s = setup();
  const batch: any = await runProspecting(s.factory, {
    batchId: "fixture",
    websites: ["https://fixture.ch/"],
    maxReviews: 0,
  });
  expect(batch.results[0].screening.limitations.join(" ")).toMatch(
    /synthetisch/i,
  );
  expect(batch.results[0].screening.crawl.synthetic).toBe(true);
  s.store.close();
});

test("report requires a numeric quality score before listing a prospect", async () => {
  const s = setup();
  s.factory.runLead = async (website: string, options: any) => ({
    id: options.runId,
    website,
    mode: "fixture",
    stage: "demo_review",
    status: "waiting_approval",
    context: {
      demoReview: {
        reviewHash: "x",
        summary: {
          audit: {
            qualityScore: null,
            issues: [{ observation: "A", recommendation: "B" }],
          },
          qualification: { score: 1, coverage: 1 },
          eligibility: { canApprove: false, blockers: [] },
          businessStatus: { status: "unverified" },
        },
      },
    },
  });
  const batch: any = await runProspecting(
    s.factory,
    {
      batchId: "no_score",
      websites: ["https://noscore.ch/"],
      maxReviews: 1,
    },
    { screenWebsite: s.screenWebsite },
  );
  expect(readFileSync(batch.reportPath, "utf8")).toContain(
    "Keine abgeschlossenen relevanten Reviews",
  );
  s.store.close();
});

test("explicit recheck replays saved crawl without refetching or changing the manifest", async () => {
  const s = setup();
  const website = "https://recheck.ch/";
  const crawl = {
    observedAt: "2026-09-21T10:00:00.000Z",
    pages: [{ url: website, html: "<html></html>" }],
  };
  let networkCalls = 0;
  const first: any = await runProspecting(
    s.factory,
    {
      batchId: "recheck",
      websites: [website],
      maxReviews: 1,
      planOnly: true,
    },
    {
      screenWebsite: async (url: string) => {
        networkCalls++;
        return {
          website: url,
          checkedAt: "2026-09-21T10:00:01.000Z",
          status: "uncertain" as const,
          priority: 0,
          signals: [],
          contacts: [],
          limitations: ["old rule"],
          crawl,
        };
      },
    },
  );
  expect(s.reviewed).toHaveLength(0);
  let replayCalls = 0;
  const second: any = await runProspecting(
    s.factory,
    {
      batchId: "recheck",
      websites: [website],
      maxReviews: 1,
      recheckScreening: true,
    },
    {
      screenWebsite: async () => {
        throw new Error("network must stay unused");
      },
      screenCollected: async (url: string, raw: any) => {
        replayCalls++;
        expect(raw).toEqual(crawl);
        return {
          website: url,
          checkedAt: "2026-09-21T10:05:00.000Z",
          status: "candidate" as const,
          priority: 8,
          signals: [
            {
              code: "title",
              observation: "Titel fehlt",
              sourceUrl: url,
              excerpt: "<head>",
            },
          ],
          contacts: [],
          limitations: [],
          crawl: { altered: true },
        };
      },
    },
  );
  expect(networkCalls).toBe(1);
  expect(replayCalls).toBe(1);
  expect(second.manifestHash).toBe(first.manifestHash);
  expect(second.results[0].previousScreeningStatus).toBe("uncertain");
  expect(second.results[0].screening.crawl).toEqual(crawl);
  expect(second.results[0].screening.status).toBe("candidate");
  expect(second.results[0].recheckedAt).toBeTruthy();
  expect(s.reviewed).toHaveLength(1);
  s.store.close();
});

test("reserves review places for uncertainty and a persistent random control sample", async () => {
  const s = setup();
  const websites = [
    "c1",
    "c2",
    "c3",
    "c4",
    "u1",
    "u2",
    "n1",
    "n2",
    "n3",
    "n4",
  ].map((n) => `https://${n}.ch/`);
  const options = { batchId: "balanced", websites, maxReviews: 6 };
  const screenWebsite = async (url: string) => ({
    ...(await s.screenWebsite(url)),
    status: new URL(url).hostname.startsWith("c")
      ? ("candidate" as const)
      : new URL(url).hostname.startsWith("u")
        ? ("uncertain" as const)
        : ("no_signal" as const),
    priority: 0,
  });
  const plan: any = await runProspecting(
    s.factory,
    { ...options, planOnly: true },
    { screenWebsite },
  );
  expect(s.reviewed).toHaveLength(0);
  const selected = plan.results.filter((r: any) => r.selectionReason);
  expect(
    selected.filter((r: any) => r.selectionReason === "candidate"),
  ).toHaveLength(3);
  expect(
    selected.filter((r: any) => r.selectionReason === "uncertain"),
  ).toHaveLength(2);
  expect(
    selected.filter((r: any) => r.selectionReason === "control_sample"),
  ).toHaveLength(1);
  expect(plan.summary.pendingReviews).toBe(10);
  expect(plan.selection.controlPopulation).toHaveLength(4);
  const result: any = await runProspecting(s.factory, options, {
    screenWebsite,
  });
  expect(s.screened).toHaveLength(10);
  expect(result.selection.seed).toBe(plan.selection.seed);
  expect(
    result.results
      .filter((r: any) => r.selectionReason)
      .map((r: any) => r.website),
  ).toEqual(selected.map((r: any) => r.website));
  expect(s.reviewed).toHaveLength(6);
  expect(result.summary.pendingReviews).toBe(4);
  expect(result.summary.controlSample).toMatchObject({
    population: 4,
    selected: 1,
    completed: 1,
    assessable: 1,
    promising: 1,
  });
  expect(s.reviewed[0].website).toBe(
    selected.find((r: any) => r.selectionReason === "control_sample").website,
  );
  expect(readFileSync(result.reportPath, "utf8")).toContain(
    "Zufallsstichprobe",
  );
  for (const row of result.results.filter((r: any) => !r.reviewStatus))
    expect(readFileSync(result.reportPath, "utf8")).toContain(row.website);
  await runProspecting(s.factory, options, { screenWebsite });
  expect(s.reviewed).toHaveLength(6);
  s.store.close();
});

test("unknown and failed screens get full reviews while no-signal sites stay eligible", async () => {
  const s = setup();
  const result: any = await runProspecting(
    s.factory,
    {
      batchId: "unclear",
      websites: [
        "https://broken.ch/",
        "https://unknown.ch/",
        "https://quiet.ch/",
      ],
      maxReviews: 3,
    },
    {
      screenWebsite: async (url: string) => ({
        ...(await s.screenWebsite(url)),
        status: url.includes("unknown")
          ? ("uncertain" as const)
          : ("no_signal" as const),
      }),
    },
  );
  expect(result.summary.completeReviews).toBe(3);
  expect(
    result.results.find((r: any) => r.website.includes("broken"))
      .selectionReason,
  ).toBe("uncertain");
  expect(
    result.results.find((r: any) => r.website.includes("quiet"))
      .selectionReason,
  ).toBe("control_sample");
  expect(result.summary.pendingReviews).toBe(0);
  s.store.close();
});

test("legacy batches use only remaining slots without replacing reviews or run identities", async () => {
  const s = setup();
  const options = {
    batchId: "legacy",
    websites: ["https://old.ch/", "https://unknown.ch/", "https://quiet.ch/"],
    maxReviews: 2,
  };
  await runProspecting(
    s.factory,
    { ...options, planOnly: true },
    { screenWebsite: s.screenWebsite },
  );
  const saved = s.store.get("prospect_batches", "legacy");
  delete saved.selection;
  saved.results.forEach((row: any, i: number) => {
    delete row.selectionReason;
    row.screening.status =
      i === 0 ? "candidate" : i === 1 ? "uncertain" : "no_signal";
  });
  saved.results[0].reviewStatus = "blocked_review";
  saved.results[0].runId = "original-run";
  s.store.put("prospect_batches", "legacy", saved);
  const result: any = await runProspecting(s.factory, options, {
    screenWebsite: s.screenWebsite,
  });
  expect(s.reviewed).toHaveLength(1);
  expect(result.results[0].runId).toBe("original-run");
  expect(result.results[0].reviewStatus).toBe("blocked_review");
  expect(result.summary.controlSample.completed).toBe(1);
  expect(result.summary.pendingReviews).toBe(2);
  s.store.close();
});

test("null audit scores do not count as good websites or a valid sample outcome", async () => {
  const s = setup();
  const original = s.factory.runLead;
  s.factory.runLead = async (url: string, options: any) => {
    const job = await original(url, options);
    job.context.demoReview.summary.audit.qualityScore = null;
    return job;
  };
  const result: any = await runProspecting(
    s.factory,
    {
      batchId: "inconclusive",
      websites: ["https://no-signal.ch/"],
      maxReviews: 1,
    },
    {
      screenWebsite: async (url: string) => ({
        ...(await s.screenWebsite(url)),
        status: "no_signal" as const,
      }),
    },
  );
  expect(result.summary.controlSample).toMatchObject({
    selected: 1,
    completed: 1,
    assessable: 0,
    inconclusive: 1,
    promising: 0,
  });
  expect(result.summary.controlSample.promisingRate).toBeNull();
  expect(result.summary.assessableReviews).toBe(0);
  expect(result.summary.pendingReviews).toBe(1);
  expect(readFileSync(result.reportPath, "utf8")).toContain(
    "abgeschlossen, aber nicht auswertbar",
  );
  s.store.close();
});

test("explicit recheck preserves an existing complete review and does not rerun model work", async () => {
  const s = setup();
  const website = "https://reviewed.ch/";
  const options = { batchId: "reviewed", websites: [website], maxReviews: 1 };
  const first: any = await runProspecting(s.factory, options, {
    screenWebsite: async (url: string) => ({
      website: url,
      checkedAt: "2026-09-21T10:00:00Z",
      status: "candidate" as const,
      priority: 10,
      signals: [],
      contacts: [],
      limitations: [],
      crawl: { observedAt: "2026-09-21T10:00:00Z" },
    }),
  });
  const originalReview = first.results[0].review;
  expect(s.reviewed).toHaveLength(1);
  const second: any = await runProspecting(
    s.factory,
    { ...options, recheckScreening: true },
    {
      screenWebsite: async () => {
        throw new Error("unexpected refetch");
      },
      screenCollected: async (url: string, crawl: any) => ({
        website: url,
        checkedAt: "2026-09-21T10:05:00Z",
        status: "no_signal" as const,
        priority: 0,
        signals: [],
        contacts: [],
        limitations: [],
        crawl,
      }),
    },
  );
  expect(second.results[0].review).toEqual(originalReview);
  expect(second.results[0].reviewStatus).toBe("complete");
  expect(s.reviewed).toHaveLength(1);
  s.store.close();
});

test("recheck cannot exceed the original review cap when rankings change", async () => {
  const s = setup();
  const websites = ["https://old.ch/", "https://new.ch/"];
  const options = { batchId: "cap_recheck", websites, maxReviews: 1 };
  await runProspecting(s.factory, options, {
    screenWebsite: async (website: string) => ({
      website,
      checkedAt: new Date().toISOString(),
      status: website.includes("old")
        ? ("candidate" as const)
        : ("uncertain" as const),
      priority: 10,
      signals: [],
      contacts: [],
      limitations: [],
      crawl: { observedAt: "2026-09-21T10:00:00Z" },
    }),
  });
  expect(s.reviewed).toHaveLength(1);
  const batch: any = await runProspecting(
    s.factory,
    { ...options, recheckScreening: true },
    {
      screenWebsite: async () => {
        throw new Error("unexpected refetch");
      },
      screenCollected: async (website: string, crawl: any) => ({
        website,
        checkedAt: new Date().toISOString(),
        status: website.includes("new")
          ? ("candidate" as const)
          : ("no_signal" as const),
        priority: 20,
        signals: [],
        contacts: [],
        limitations: [],
        crawl,
      }),
    },
  );
  expect(s.reviewed).toHaveLength(1);
  expect(
    batch.results.find((r: any) => r.website === s.reviewed[0].website)
      .reviewStatus,
  ).toBe("complete");
  expect(
    batch.results.filter((r: any) => r.reviewStatus === "complete"),
  ).toHaveLength(1);
  s.store.close();
});
