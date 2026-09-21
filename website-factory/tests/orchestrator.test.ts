import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultConfig, type FactoryConfig } from "../src/config.js";
import { Factory } from "../src/orchestrator.js";
import { Store } from "../src/store.js";
import { renderSite } from "../src/renderer.js";
import { runBrowserTests } from "../src/browser-tests.js";
import { fixtureInput, fixtureOutput } from "../src/fixtures.js";

function harness() {
  const dataDir = mkdtempSync(join(tmpdir(), "factory-orchestrator-"));
  const config = structuredClone(defaultConfig()) as FactoryConfig;
  config.dataDir = dataDir;
  config.autoGenerate = true;
  config.agency = {
    name: "POLIRE",
    sender_name: "POLIRE",
    signature: "POLIRE",
    required_notice: "Unverbindlicher Entwurf",
  };
  const store = new Store(dataDir);
  return { factory: new Factory(config, store), store };
}
async function fastBrowser(args: { outputDir: string; siteSpec: any }) {
  mkdirSync(args.outputDir, { recursive: true });
  return fixtureOutput("browser", { siteSpec: args.siteSpec }) as any;
}
function liveReviewHarness(override?: (agent: any, input: any) => any) {
  const dataDir = mkdtempSync(join(tmpdir(), "factory-live-review-"));
  const config = structuredClone(defaultConfig()) as FactoryConfig;
  config.dataDir = dataDir;
  config.mode = "live";
  config.autoGenerate = true;
  config.agency = {
    name: "POLIRE",
    sender_name: "POLIRE",
    signature: "POLIRE",
    required_notice: "Unverbindlicher Entwurf",
  };
  const store = new Store(dataDir);
  const collector = async (_website: string, options: any) => {
    mkdirSync(options.outputDir, { recursive: true });
    return { ...fixtureInput(), observedAt: new Date().toISOString() };
  };
  const agentOutput = (agent: any, input: any) =>
    override?.(agent, input) ?? fixtureOutput(agent, input);
  return {
    factory: new Factory(config, store, {
      provider: {} as any,
      collector,
      agentOutput,
      browserRunner: fastBrowser,
    }),
    store,
  };
}

describe("Factory orchestration", () => {
  test("fast profile collects real screenshots but disables the slow performance measurement", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "factory-fast-crawl-"));
    const config = structuredClone(defaultConfig());
    config.dataDir = dataDir;
    config.mode = "live";
    config.crawler.lighthouse = false;
    const store = new Store(dataDir);
    let capture: any;
    const factory = new Factory(config, store, {
      provider: {} as any,
      collector: async (_website, options) => {
        capture = options;
        mkdirSync(options.outputDir, { recursive: true });
        return { ...fixtureInput(), observedAt: new Date().toISOString() };
      },
      agentOutput: (agent, input) => fixtureOutput(agent, input),
    });
    try {
      const result = await factory.runLead(
        "https://fixture.alpina-service.example/",
        { requireDemoDecision: true },
      );
      expect(capture).toMatchObject({ browser: true, lighthouse: false });
      expect(result.stage).toBe("demo_review");
      expect(result.status).toBe("waiting_approval");
    } finally {
      store.close();
    }
  });
  test("live analysis always waits for a hash-bound demo decision despite generation bypass flags", async () => {
    const { factory, store } = liveReviewHarness();
    let reviewed = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    expect(reviewed).toMatchObject({
      stage: "demo_review",
      status: "waiting_approval",
    });
    expect(factory.review(reviewed.id).summary.eligibility.blockers).toContain(
      "business_activity_unverified",
    );
    await expect(
      factory.decideDemo(
        reviewed.id,
        "approve",
        reviewed.revision,
        factory.review(reviewed.id).reviewHash,
      ),
    ).rejects.toThrow(/not eligible/);
    const originalReviewHash = factory.review(reviewed.id).reviewHash;
    reviewed = factory.recordBusinessReview(reviewed.id, reviewed.revision, {
      status: "operating",
      reason: "Explicit synthetic operator review for test",
      sourceUrl: "https://company.ch/news",
      excerpt: "Synthetic current project",
      activityDate: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
    });
    expect(factory.review(reviewed.id).reviewHash).not.toBe(originalReviewHash);
    const review = factory.review(reviewed.id);
    expect(review.summary.website).toBe(
      "https://fixture.alpina-service.example/",
    );
    expect(review.summary.audit.issues.length).toBeGreaterThan(0);
    expect(review.summary.qualification).toHaveProperty("uncertain");
    expect(
      store.list("steps").some((step) => step.agent === "strategist"),
    ).toBe(false);
    await expect(
      factory.decideDemo(reviewed.id, "approve", reviewed.revision, "stale"),
    ).rejects.toThrow(/hash/i);
    const built = await factory.decideDemo(
      reviewed.id,
      "approve",
      reviewed.revision,
      review.reviewHash,
    );
    expect(built.stage).toBe("preview_review");
    store.close();
  }, 15_000);

  test("hard missing country can be reviewed and rejected but cannot be approved", async () => {
    const { factory, store } = liveReviewHarness((agent, input) => {
      const output = fixtureOutput(agent, input);
      if (agent === "scout") {
        const country = output.data.facts.find(
          (fact: any) => fact.field === "country",
        );
        country.value = null;
        country.evidence_ids = [];
        country.interpretation = "unknown";
      }
      return output;
    });
    const reviewed = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    const review = factory.review(reviewed.id);
    expect(review.summary.eligibility).toMatchObject({ canApprove: false });
    expect(review.summary.eligibility.blockers).toContain(
      "ch_location_missing",
    );
    await expect(
      factory.decideDemo(
        reviewed.id,
        "approve",
        reviewed.revision,
        review.reviewHash,
      ),
    ).rejects.toThrow(/not eligible/i);
    const rejected = await factory.decideDemo(
      reviewed.id,
      "reject",
      reviewed.revision,
      review.reviewHash,
    );
    expect(rejected).toMatchObject({ stage: "done", status: "done" });
    expect(
      store.list("steps").some((step) => step.agent === "strategist"),
    ).toBe(false);
    const decisionId = rejected.context.demoDecision.decisionId;
    await factory.deleteLead(rejected.leadId);
    expect(store.get("demo_decisions", decisionId)).toBeNull();
    store.close();
  }, 15_000);

  test("demo approval rechecks current source bindings and expiry", async () => {
    const { factory, store } = liveReviewHarness();
    const reviewed = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    const review = factory.review(reviewed.id);
    const changed = factory.show(reviewed.id);
    changed.context.profile.facts.find(
      (fact: any) => fact.field === "country",
    ).valid_until = "2000-01-01T00:00:00.000Z";
    store.db
      .prepare("UPDATE factory_jobs SET value_json=? WHERE run_id=?")
      .run(JSON.stringify(changed), reviewed.id);
    await expect(
      factory.decideDemo(
        reviewed.id,
        "approve",
        reviewed.revision,
        review.reviewHash,
      ),
    ).rejects.toThrow(/review hash/i);
    store.close();
  }, 15_000);

  test("stale business evidence revokes an approved demo before resume dispatches postapproval work", async () => {
    const { factory, store } = liveReviewHarness();
    let job = await factory.runLead("https://fixture.alpina-service.example/", {
      experimental: true,
    });
    job = factory.recordBusinessReview(job.id, job.revision, {
      status: "operating",
      reason: "Explicit synthetic operator review for resume safety",
      sourceUrl: "https://company.ch/news",
      excerpt: "Synthetic current project",
      activityDate: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
    });
    const waiting = factory.show(job.id);
    waiting.stopAfter = "qualifier";
    store.db
      .prepare("UPDATE factory_jobs SET value_json=? WHERE run_id=?")
      .run(JSON.stringify(waiting), job.id);
    const review = factory.review(job.id);
    const paused = await factory.decideDemo(
      job.id,
      "approve",
      job.revision,
      review.reviewHash,
    );
    expect(paused.status).toBe("paused");
    const decisionId = paused.context.demoDecision.decisionId;
    const stale = factory.show(job.id);
    stale.context.businessReview.checkedAt = "2000-01-01T00:00:00.000Z";
    store.db
      .prepare("UPDATE factory_jobs SET value_json=? WHERE run_id=?")
      .run(JSON.stringify(stale), job.id);

    const reset = await factory.resume(job.id, stale.revision);

    expect(reset).toMatchObject({
      stage: "demo_review",
      status: "waiting_approval",
      reason: "business_activity_stale",
    });
    expect(reset.context.demoDecision).toBeUndefined();
    expect(reset.context.demoReview.summary.eligibility.blockers).toContain(
      "business_activity_stale",
    );
    expect(
      store.list("steps").some((step) => step.agent === "strategist"),
    ).toBe(false);
    expect(store.get("demo_decisions", decisionId)).toMatchObject({
      revokedReason: "business_activity_stale",
    });

    const refreshed = factory.recordBusinessReview(reset.id, reset.revision, {
      status: "operating",
      reason: "Explicit refreshed operator review after stale evidence",
      sourceUrl: "https://company.ch/news",
      excerpt: "Synthetic current project remains active",
      activityDate: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
    });
    const refreshedReview = factory.review(refreshed.id);
    const built = await factory.decideDemo(
      refreshed.id,
      "approve",
      refreshed.revision,
      refreshedReview.reviewHash,
    );
    expect(built.stage).toBe("preview_review");
    store.close();
  }, 15_000);

  test("preview approval returns to demo review when the approved business is now closed", async () => {
    const { factory, store } = liveReviewHarness();
    let job = await factory.runLead("https://fixture.alpina-service.example/", {
      experimental: true,
    });
    job = factory.recordBusinessReview(job.id, job.revision, {
      status: "operating",
      reason: "Explicit synthetic operator review before build",
      sourceUrl: "https://company.ch/news",
      excerpt: "Synthetic current project",
      activityDate: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
    });
    const review = factory.review(job.id);
    const built = await factory.decideDemo(
      job.id,
      "approve",
      job.revision,
      review.reviewHash,
    );
    const decisionId = built.context.demoDecision.decisionId;
    const closed = factory.show(job.id);
    closed.context.businessReview.status = "closed";
    store.db
      .prepare("UPDATE factory_jobs SET value_json=? WHERE run_id=?")
      .run(JSON.stringify(closed), job.id);

    const reset = factory.approvePreview(
      job.id,
      built.artifactHash,
      closed.revision,
    );

    expect(reset).toMatchObject({
      stage: "demo_review",
      status: "waiting_approval",
      reason: "business_closed",
    });
    expect(reset.previewApproval).toBeUndefined();
    expect(reset.context.demoDecision).toBeUndefined();
    expect(reset.context.demoReview.summary.eligibility.blockers).toContain(
      "business_closed",
    );
    expect(store.get("demo_decisions", decisionId)).toMatchObject({
      revokedReason: "business_closed",
    });
    expect(store.list("approvals")).toHaveLength(0);
    store.close();
  }, 15_000);

  test("runs all production validators, real rendering and browser checks before preview approval", async () => {
    const { factory, store } = harness();
    const job = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    expect(job).toMatchObject({
      stage: "preview_review",
      status: "waiting_approval",
      mode: "fixture",
    });
    expect(job.fixtureDisclosure).toMatch(/simulated/i);
    expect(job.context.qa.decision).toBe("pass");
    expect(job.context.browser.results.length).toBeGreaterThan(10);
    expect(
      readFileSync(
        join(job.context.render.artifactDir, "manifest.json"),
        "utf8",
      ),
    ).toContain("manifest_id");
    expect(job.context.render.manifest.lead_id).toBe(job.leadId);
    expect(
      store
        .list("steps")
        .filter((step) => step.runId === job.id)
        .map((step) => step.agent),
    ).toEqual(
      expect.arrayContaining([
        "scout",
        "audit",
        "qualifier",
        "strategist",
        "builder",
        "qa",
      ]),
    );
    store.close();
  }, 30_000);

  test("keeps preview and outreach approvals separate and hash-bound", async () => {
    const { factory, store } = harness();
    const job = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    expect(() => factory.approvePreview(job.id, "stale")).toThrow(/hash/i);
    factory.approvePreview(job.id, job.artifactHash);
    factory.attachExternalPreview(
      job.id,
      "https://preview.fixture.test/customer",
      job.artifactHash,
      true,
    );
    await expect(factory.draftSales(job.id)).rejects.toThrow(/contact/i);
    factory.setContact(
      job.id,
      "approved",
      "Fixture operator approved this synthetic recipient context.",
    );
    const drafted = await factory.draftSales(job.id);
    expect(drafted.status).toBe("waiting_approval");
    expect(() => factory.approveOutreach(job.id, "stale")).toThrow(/hash/i);
    factory.approveOutreach(job.id, drafted.draftHash);
    const exported = await factory.exportDraft(job.id, "ready");
    expect(JSON.parse(readFileSync(exported.path, "utf8")).can_send).toBe(
      false,
    );
    store.close();
  }, 30_000);

  test("resumes the same run without redispatch and isolates caches between provisional leads", async () => {
    const { factory, store } = harness();
    const first = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "qualifier" },
    );
    const second = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "qualifier" },
    );
    expect(second.cacheHits).toBe(0);
    factory.pause(first.id);
    await expect(factory.resume(first.id, first.revision)).rejects.toThrow(
      /revision/i,
    );
    const paused = factory.show(first.id);
    expect((await factory.resume(first.id, paused.revision)).status).not.toBe(
      "paused",
    );
    expect(
      store
        .list("steps")
        .filter((step) => step.runId === first.id && step.agent === "scout"),
    ).toHaveLength(1);
    store.close();
  }, 30_000);

  test("revises only the dependency chain affected by an offer change", async () => {
    const { factory, store } = harness();
    const job = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "qualifier" },
    );
    const revised = factory.revise(job.id, job.revision, {
      offer: {
        ...job.context.offer,
        services: ["Website für Sanitärbetriebe"],
      },
    });
    expect(revised.context.profile).toEqual(job.context.profile);
    expect(revised.context.audit).toEqual(job.context.audit);
    expect(revised.context.qualification).toBeUndefined();
    expect(revised.stage).toBe("qualifier");
    expect(revised.inputVersion).toBe(2);
    await expect(
      Promise.resolve().then(() =>
        factory.revise(job.id, job.revision, { recrawl: true }),
      ),
    ).rejects.toThrow(/version/i);
    store.close();
  }, 15_000);

  test("recrawl invalidates source-dependent outputs while an unchanged revision is a no-op", async () => {
    const { factory, store } = harness();
    const job = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "qualifier" },
    );
    const unchanged = factory.revise(job.id, job.revision, {
      offer: job.context.offer,
    });
    expect(unchanged.revision).toBe(job.revision);
    const revised = factory.revise(job.id, job.revision, { recrawl: true });
    expect(revised.context.crawl).toBeUndefined();
    expect(revised.context.profile).toBeUndefined();
    expect(revised.context.audit).toBeUndefined();
    expect(revised.context.qualification).toBeUndefined();
    expect(revised.stage).toBe("collect");
    store.close();
  }, 15_000);

  test("a cancelled render cannot publish or write cache and its staging operation is removed", async () => {
    const { factory: base, store } = harness();
    const config = base.config;
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const factory = new Factory(config, store, {
      renderer: async (args) => {
        entered();
        await gate;
        return renderSite(args);
      },
    });
    const running = factory.runLead("https://fixture.alpina-service.example/", {
      experimental: true,
    });
    await started;
    const job = store.db
      .prepare("SELECT run_id FROM factory_jobs WHERE status='running'")
      .get() as { run_id: string };
    factory.cancel(job.run_id);
    release();
    const stopped = await running;
    expect(stopped.status).toBe("cancelled");
    expect(store.list("operations")).toHaveLength(0);
    expect(store.list("cache").some((item) => item.artifactDir)).toBe(false);
    expect(existsSync(join(config.dataDir, "artifacts", stopped.leadId))).toBe(
      false,
    );
    store.close();
  }, 30_000);

  test("deleting a lead while browser output is pending leaves no published tests or cache", async () => {
    const { factory: base, store } = harness();
    const config = base.config;
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const factory = new Factory(config, store, {
      browserRunner: async (args) => {
        const result = await runBrowserTests(args);
        entered();
        await gate;
        return result;
      },
    });
    const running = factory.runLead("https://fixture.alpina-service.example/", {
      experimental: true,
    });
    await started;
    const job = store.db
      .prepare("SELECT run_id,lead_id FROM factory_jobs WHERE status='running'")
      .get() as { run_id: string; lead_id: string };
    await factory.deleteLead(job.lead_id);
    release();
    await expect(running).rejects.toThrow(/Unknown run|superseded/);
    expect(store.list("operations")).toHaveLength(0);
    expect(store.list("cache").some((item) => Array.isArray(item.images))).toBe(
      false,
    );
    expect(existsSync(join(config.dataDir, "tests", job.lead_id))).toBe(false);
    expect(store.get("tombstones", job.lead_id)).toBeTruthy();
    store.close();
  }, 30_000);

  test("a delayed provider result cannot recreate steps or cache after lead deletion", async () => {
    const { factory: fixtureFactory, store } = harness();
    const paused = await fixtureFactory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "scout" },
    );
    const config = structuredClone(fixtureFactory.config);
    config.mode = "live";
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider = {
      invoke: async ({ agent, input }: { agent: "audit"; input: any }) => {
        entered();
        await gate;
        return fixtureOutput(agent, input);
      },
    };
    const liveFactory = new Factory(config, store, {
      provider: provider as any,
    });
    const pending = (liveFactory as any).agent(
      liveFactory.show(paused.id),
      "audit",
    );
    await started;
    await liveFactory.deleteLead(paused.leadId);
    release();
    await expect(pending).rejects.toThrow(/superseded/);
    expect(
      store.list("steps").filter((item) => item.leadId === paused.leadId),
    ).toHaveLength(0);
    expect(
      store.list("cache_index").filter((item) => item.leadId === paused.leadId),
    ).toHaveLength(0);
    store.close();
  }, 15_000);

  test("a delayed collector cannot recreate crawl files after lead deletion", async () => {
    const { factory: base, store } = harness();
    const config = structuredClone(base.config);
    config.mode = "live";
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const collector = async (_website: string, options: any) => {
      mkdirSync(options.outputDir, { recursive: true });
      writeFileSync(join(options.outputDir, "source.html"), "staged");
      entered();
      await gate;
      return fixtureInput();
    };
    const factory = new Factory(config, store, { collector });
    const running = factory.runLead("https://fixture.alpina-service.example/");
    await started;
    const row = store.db
      .prepare("SELECT lead_id FROM factory_jobs WHERE status='running'")
      .get() as { lead_id: string };
    await factory.deleteLead(row.lead_id);
    release();
    await expect(running).rejects.toThrow(/Unknown run|superseded/);
    expect(existsSync(join(config.dataDir, "crawl", row.lead_id))).toBe(false);
    expect(store.list("operations")).toHaveLength(0);
    store.close();
  }, 15_000);

  test("startup removes orphan staging but preserves a matching active foreign lease", () => {
    const { factory, store } = harness();
    const orphan = join(
      factory.config.dataDir,
      ".staging",
      "missing",
      "render-orphan",
    );
    mkdirSync(orphan, { recursive: true });
    store.put("operations", "render-orphan", {
      operationId: "render-orphan",
      runId: "missing",
      leadId: "lead-missing",
      kind: "render",
      stagingRoot: orphan,
      leaseOwner: "gone",
      fencingToken: 1,
      createdAt: new Date().toISOString(),
    });
    new Factory(factory.config, store);
    expect(existsSync(orphan)).toBe(false);
    expect(store.get("operations", "render-orphan")).toBeNull();
    const runId = "foreign-run";
    const activeDir = join(
      factory.config.dataDir,
      ".staging",
      runId,
      "render-active",
    );
    mkdirSync(activeDir, { recursive: true });
    const active = {
      runId,
      leadId: "lead-active",
      revision: 0,
      stage: "render",
      status: "running",
      context: {},
    };
    store.db
      .prepare(
        "INSERT INTO factory_jobs(run_id,lead_id,revision,stage,status,value_json,lease_owner,lease_expires_at,fencing_token) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        runId,
        "lead-active",
        0,
        "render",
        "running",
        JSON.stringify(active),
        "foreign",
        new Date(Date.now() + 60_000).toISOString(),
        4,
      );
    store.put("operations", "render-active", {
      operationId: "render-active",
      runId,
      leadId: "lead-active",
      kind: "render",
      stagingRoot: activeDir,
      leaseOwner: "foreign",
      fencingToken: 4,
      createdAt: new Date().toISOString(),
    });
    new Factory(factory.config, store);
    expect(existsSync(activeDir)).toBe(true);
    expect(store.get("operations", "render-active")).toBeTruthy();
    store.close();
  });

  test("repairs one concrete site-spec QA issue and reruns the complete build checks", async () => {
    const { factory: base, store } = harness();
    let qaCalls = 0;
    const agentOutput = (agent: any, input: any) => {
      const output = fixtureOutput(agent, input);
      if (agent === "qa" && qaCalls++ === 0)
        output.data.issues = [
          {
            category: "conversion",
            severity: "major",
            observation: "Der Kontaktaufruf ist im Hero nicht klar genug.",
            evidence_ids: [input.images[0].evidence_id],
            page_ref: "/",
            viewport: { width: 375, height: 800 },
            impact_hypothesis: "Kontaktweg bleibt unklar.",
            recommendation: "Kontaktaufruf klarer beschriften.",
            suggested_fix_target: "site_spec",
            reproduction: ["Route / bei 375 px prüfen."],
          },
        ];
      return output;
    };
    const factory = new Factory(base.config, store, {
      agentOutput,
      browserRunner: fastBrowser,
    });
    const job = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    expect(job.status).toBe("waiting_approval");
    expect(job.repairRounds).toBe(1);
    expect(job.context.repairHistory).toHaveLength(1);
    expect(qaCalls).toBe(2);
    expect(job.context.repairTasks).toBeUndefined();
    store.close();
  }, 15_000);

  test("does not send renderer or missing-input QA failures to Builder repair", async () => {
    const { factory: base, store } = harness();
    const agentOutput = (agent: any, input: any) => {
      const output = fixtureOutput(agent, input);
      if (agent === "qa")
        output.data.issues = [
          {
            category: "performance",
            severity: "major",
            observation: "Renderer infrastructure failed with missing input.",
            evidence_ids: [input.images[0].evidence_id],
            page_ref: "/",
            viewport: null,
            impact_hypothesis: null,
            recommendation: "Renderer prüfen.",
            suggested_fix_target: "renderer",
            reproduction: ["Build prüfen."],
          },
        ];
      return output;
    };
    const factory = new Factory(base.config, store, {
      agentOutput,
      browserRunner: fastBrowser,
    });
    const job = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    expect(job.status).toBe("manual_review");
    expect(job.repairRounds).toBe(0);
    expect(job.context.repairHistory).toBeUndefined();
    store.close();
  }, 15_000);

  test("persists the two-round repair cap and resume cannot bypass it", async () => {
    const { factory: base, store } = harness();
    const agentOutput = (agent: any, input: any) => {
      const output = fixtureOutput(agent, input);
      if (agent === "qa")
        output.data.issues = [
          {
            category: "conversion",
            severity: "major",
            observation: "Kontaktaufruf bleibt unklar.",
            evidence_ids: [input.images[0].evidence_id],
            page_ref: "/",
            viewport: { width: 375, height: 800 },
            impact_hypothesis: "Kontaktweg bleibt unklar.",
            recommendation: "Kontaktaufruf klarer beschriften.",
            suggested_fix_target: "site_spec",
            reproduction: ["Route / prüfen."],
          },
        ];
      return output;
    };
    const factory = new Factory(base.config, store, {
      agentOutput,
      browserRunner: fastBrowser,
    });
    const job = await factory.runLead(
      "https://fixture.alpina-service.example/",
      { experimental: true },
    );
    expect(job.status).toBe("manual_review");
    expect(job.repairRounds).toBe(2);
    expect(job.context.repairHistory).toHaveLength(2);
    const resumed = await factory.resume(job.id, job.revision);
    expect(resumed.repairRounds).toBe(2);
    expect(resumed.status).toBe("manual_review");
    store.close();
  }, 15_000);

  test("binds a prompt-version cache miss to the same logical provider step", async () => {
    const { factory: fixtureFactory, store } = harness();
    const paused = await fixtureFactory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "scout" },
    );
    const stepIds: string[] = [];
    const provider = {
      invoke: async (args: any) => {
        stepIds.push(args.stepId);
        return fixtureOutput(args.agent, args.input);
      },
    };
    const firstConfig = structuredClone(fixtureFactory.config);
    firstConfig.mode = "live";
    await (
      new Factory(firstConfig, store, { provider: provider as any }) as any
    ).agent(fixtureFactory.show(paused.id), "audit");
    const changedConfig = structuredClone(firstConfig);
    changedConfig.models.audit.max_output_tokens--;
    await (
      new Factory(changedConfig, store, {
        provider: provider as any,
      }) as any
    ).agent(fixtureFactory.show(paused.id), "audit");
    expect(stepIds).toHaveLength(1);
    const auditSteps = store
      .list("logical_steps")
      .filter((step) => step.agent === "audit");
    expect(auditSteps).toHaveLength(1);
    expect(auditSteps[0].stepId).toBe(stepIds[0]);
    store.close();
  });

  test("persists a schema-valid semantic failure and revalidates it without a call", async () => {
    const { factory: fixtureFactory, store } = harness();
    const paused = await fixtureFactory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "scout" },
    );
    let calls = 0;
    let valid: any;
    const invalidFactory = new Factory(fixtureFactory.config, store, {
      agentOutput: (agent, input) => {
        calls++;
        valid = fixtureOutput(agent, input);
        const invalid = structuredClone(valid);
        invalid.data.issues[0].evidence_ids = ["ev-does-not-exist"];
        return invalid;
      },
    });
    await expect(
      (invalidFactory as any).agent(fixtureFactory.show(paused.id), "audit"),
    ).rejects.toThrow(/evidence/i);
    const diagnostic = store
      .list("agent_raw_outputs")
      .find((item) => item.agent === "audit");
    expect(diagnostic).toMatchObject({
      agent: "audit",
      semanticStatus: "rejected",
    });
    expect(diagnostic.semanticError).toMatch(/evidence/i);
    store.put("agent_raw_outputs", diagnostic.rawId, {
      ...diagnostic,
      raw: valid,
      semanticStatus: "rejected",
    });
    const result = await (invalidFactory as any).agent(
      fixtureFactory.show(paused.id),
      "audit",
    );
    expect(result.issues).toBeTruthy();
    expect(calls).toBe(1);
    expect(
      store.list("steps").find((step) => step.agent === "audit")?.status,
    ).toBe("succeeded");
    store.close();
  });

  test("legacy exhausted dispatches fail before a paid call after prompt changes", async () => {
    const { factory: fixtureFactory, store } = harness();
    const paused = await fixtureFactory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "scout" },
    );
    const legacyStep = "step-legacy-strategist";
    for (let attempt = 0; attempt < 3; attempt++)
      store.db
        .prepare(
          "INSERT INTO agent_attempts(attempt_id,step_id,run_id,lead_id,agent,requested_model,kind,state) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          `attempt-${attempt}`,
          legacyStep,
          paused.id,
          paused.leadId,
          "audit",
          "gpt-5.6-luna",
          "initial",
          "failed",
        );
    let calls = 0;
    const config = structuredClone(fixtureFactory.config);
    config.mode = "live";
    const factory = new Factory(config, store, {
      provider: {
        invoke: async () => {
          calls++;
          throw new Error("must not dispatch");
        },
      } as any,
    });
    await expect(
      (factory as any).agent(factory.show(paused.id), "audit"),
    ).rejects.toThrow(/exhausted.*historical raw/i);
    expect(calls).toBe(0);
    expect(
      store.list("logical_steps").find((step) => step.agent === "audit")
        ?.stepId,
    ).toBe(legacyStep);
    store.close();
  });

  test("repair-limit errors retain the original semantic reason", async () => {
    const { factory: fixtureFactory, store } = harness();
    const paused = await fixtureFactory.runLead(
      "https://fixture.alpina-service.example/",
      { stopAfter: "scout" },
    );
    let calls = 0;
    const config = structuredClone(fixtureFactory.config);
    config.mode = "live";
    const factory = new Factory(config, store, {
      provider: {
        invoke: async (args: any) => {
          calls++;
          if (calls > 1)
            throw new Error(
              "The step has exhausted its output repair allowance",
            );
          const invalid = fixtureOutput(args.agent, args.input);
          invalid.data.issues[0].evidence_ids = ["ev-does-not-exist"];
          return invalid;
        },
      } as any,
    });
    await expect(
      (factory as any).agent(factory.show(paused.id), "audit"),
    ).rejects.toThrow(
      /Semantic validation failed:.*evidence.*repair allowance/i,
    );
    expect(calls).toBe(2);
    store.close();
  });
});
