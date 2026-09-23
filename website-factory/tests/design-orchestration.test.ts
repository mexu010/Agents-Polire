import { mkdtempSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Factory } from "../src/orchestrator.js";
import { Store } from "../src/store.js";
import { defaultConfig } from "../src/config.js";
import { fixtureDesignResearch } from "../src/design-research.js";
import { fixtureOutput } from "../src/fixtures.js";
import { designFingerprint } from "../src/design-policy.js";

function seedHistoryJob(
  store: Store,
  source: any,
  runId: string,
  website: string,
  brief: any,
  overrides: Record<string, unknown> = {},
) {
  const value = {
    ...structuredClone(source),
    ...overrides,
    id: runId,
    runId,
    leadId: `lead-${runId}`,
    website,
    revision: 0,
    stage: "done",
    status: "done",
    context: { ...structuredClone(source.context), brief },
  };
  store.db
    .prepare(
      "INSERT INTO factory_jobs(run_id,lead_id,revision,stage,status,value_json) VALUES(?,?,?,?,?,?)",
    )
    .run(runId, value.leadId, 0, "done", "done", JSON.stringify(value));
}

describe("design research orchestration", () => {
  it("waits for demo approval, persists research, and does not recollect on resume", async () => {
    const config = structuredClone(defaultConfig());
    config.autoGenerate = true;
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-design-"));
    const store = new Store(config.dataDir);
    const research = vi.fn(async () => fixtureDesignResearch());
    const factory = new Factory(config, store, {
      designResearch: research,
      browserRunner: async (args: any) => {
        mkdirSync(args.outputDir, { recursive: true });
        return fixtureOutput("browser", { siteSpec: args.siteSpec }) as any;
      },
    });
    try {
      const review = await factory.runLead(
        "https://fixture.alpina-service.example/",
        { requireDemoDecision: true, stopAfter: "strategist" },
      );
      expect(research).not.toHaveBeenCalled();
      const built = await factory.decideDemo(
        review.id,
        "approve",
        review.revision,
        factory.review(review.id).reviewHash,
      );
      expect(research).toHaveBeenCalledTimes(1);
      expect(built.context.brief.design_plan).toBeDefined();
      expect(built.context.brief.theme.composition).toBeDefined();
      await factory.resume(built.id);
      expect(research).toHaveBeenCalledTimes(1);
      const leadDir = join(config.dataDir, "crawl", built.leadId);
      expect(existsSync(leadDir)).toBe(true);
      await factory.deleteLead(built.leadId);
      expect(existsSync(leadDir)).toBe(false);
    } finally {
      store.close();
    }
  });
  it("stops before an LLM call when all reference sources are missing", async () => {
    const config = structuredClone(defaultConfig());
    config.autoGenerate = true;
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-design-missing-"));
    const store = new Store(config.dataDir);
    const research = vi.fn(async () => {
      const result = fixtureDesignResearch();
      result.research.status = "unavailable";
      return result;
    });
    const factory = new Factory(config, store, { designResearch: research });
    try {
      const job = await factory.runLead(
        "https://fixture.alpina-service.example/",
        { stopAfter: "strategist" },
      );
      expect(job).toMatchObject({
        stage: "design_research",
        status: "needs_input",
      });
      expect(
        store.list("steps").some((step) => step.agent === "strategist"),
      ).toBe(false);
      await factory.resume(job.id);
      expect(research).toHaveBeenCalledTimes(1);
      const before = store.list("steps").length;
      factory.revise(job.id, job.revision, { refreshDesignReferences: true });
      await factory.resume(job.id);
      expect(research).toHaveBeenCalledTimes(2);
      expect(store.list("steps")).toHaveLength(before);
    } finally {
      store.close();
    }
  });
  it("supplies prior comparable compositions without reusing another lead's facts", async () => {
    const config = structuredClone(defaultConfig());
    config.autoGenerate = true;
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-design-history-"));
    const store = new Store(config.dataDir);
    const factory = new Factory(config, store);
    try {
      const first = await factory.runLead("https://first.example/", {
        stopAfter: "strategist",
      });
      const second = await factory.runLead("https://second.example/", {
        stopAfter: "strategist",
      });
      const recent = second.context.designResearch.research.recent_designs;
      expect(recent[0].composition).toBe(first.context.brief.theme.composition);
      expect(second.context.brief.theme.composition).not.toBe(
        first.context.brief.theme.composition,
      );
      expect(Object.keys(recent[0]).sort()).toEqual([
        "composition",
        "font_pair",
        "section_order",
        "signature_gap",
      ]);
    } finally {
      store.close();
    }
  });
  it("uses only the newest design from repeated runs on the same host", async () => {
    const config = structuredClone(defaultConfig());
    config.autoGenerate = true;
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-design-same-host-"));
    const store = new Store(config.dataDir);
    const factory = new Factory(config, store);
    try {
      const template = await factory.runLead("https://template.example/", {
        stopAfter: "strategist",
      });
      store.db
        .prepare("DELETE FROM factory_jobs WHERE run_id=?")
        .run(template.id);
      const makeBrief = (composition: string) => ({
        ...structuredClone(template.context.brief),
        theme: { ...template.context.brief.theme, composition },
      });
      seedHistoryJob(
        store,
        template,
        "independent",
        "https://independent.example/",
        makeBrief("minimal"),
      );
      seedHistoryJob(
        store,
        template,
        "duplicate-old",
        "https://repeat.example/old",
        makeBrief("bold"),
      );
      seedHistoryJob(
        store,
        template,
        "duplicate-new",
        "https://www.repeat.example/new",
        makeBrief("editorial"),
      );

      const target = await factory.runLead("https://target.example/", {
        stopAfter: "strategist",
      });
      const recent = target.context.designResearch.research.recent_designs;
      expect(recent.map((item: any) => item.composition)).toEqual([
        "editorial",
        "minimal",
      ]);
    } finally {
      store.close();
    }
  });
  it("finds an older valid comparable design beyond forty newer irrelevant rows", async () => {
    const config = structuredClone(defaultConfig());
    config.autoGenerate = true;
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-design-crowding-"));
    const store = new Store(config.dataDir);
    const factory = new Factory(config, store);
    try {
      const template = await factory.runLead("https://template.example/", {
        stopAfter: "strategist",
      });
      store.db
        .prepare("DELETE FROM factory_jobs WHERE run_id=?")
        .run(template.id);
      const olderBrief = {
        ...structuredClone(template.context.brief),
        theme: { ...template.context.brief.theme, composition: "bold" },
      };
      seedHistoryJob(
        store,
        template,
        "older-comparable",
        "https://older.example/",
        olderBrief,
      );
      for (let index = 0; index < 45; index += 1)
        seedHistoryJob(
          store,
          template,
          `irrelevant-${index}`,
          `https://irrelevant-${index}.example/`,
          structuredClone(template.context.brief),
          { mode: "live" },
        );

      const target = await factory.runLead("https://target.example/", {
        stopAfter: "strategist",
      });
      const recent = target.context.designResearch.research.recent_designs;
      expect(recent).toHaveLength(1);
      expect(recent[0].composition).toBe("bold");
    } finally {
      store.close();
    }
  });
  it("preserves stored signature versions and never infers them for legacy profile briefs", async () => {
    const config = structuredClone(defaultConfig());
    config.autoGenerate = true;
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-design-snapshots-"));
    const store = new Store(config.dataDir);
    const factory = new Factory(config, store);
    try {
      const template = await factory.runLead("https://template.example/", {
        stopAfter: "strategist",
      });
      store.db
        .prepare("DELETE FROM factory_jobs WHERE run_id=?")
        .run(template.id);
      const profileBrief = {
        ...structuredClone(template.context.brief),
        theme: {
          ...template.context.brief.theme,
          composition: "editorial",
          font_pair: "editorial",
          design_profile: "editorial-spread",
        },
      };
      const oldSnapshot = designFingerprint(profileBrief);
      oldSnapshot.signature.capabilities_version = "0.8.0";
      const storedSource = structuredClone(template);
      storedSource.context.designSnapshot = oldSnapshot;
      seedHistoryJob(
        store,
        storedSource,
        "stored-old-signature",
        "https://stored.example/",
        profileBrief,
      );
      const legacySource = structuredClone(template);
      delete legacySource.context.designSnapshot;
      seedHistoryJob(
        store,
        legacySource,
        "legacy-with-profile",
        "https://legacy.example/",
        profileBrief,
      );

      const target = await factory.runLead("https://target.example/", {
        stopAfter: "strategist",
      });
      const recent = target.context.designResearch.research.recent_designs;
      const stored = recent.find(
        (item: any) => item.signature?.capabilities_version === "0.8.0",
      );
      const legacy = recent.find((item: any) => item.signature_gap);
      expect(stored.signature.capabilities_version).toBe("0.8.0");
      expect(legacy.signature).toBeUndefined();
      expect(legacy.signature_gap).toMatch(/Altbestand/);
      expect(target.context.designDiversity.gaps).toHaveLength(2);
    } finally {
      store.close();
    }
  });
  it("does not publish late research after a lead has been deleted", async () => {
    const config = structuredClone(defaultConfig());
    config.autoGenerate = true;
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-design-delete-"));
    const store = new Store(config.dataDir);
    let signal!: () => void;
    const started = new Promise<void>((done) => (signal = done));
    let release!: (packet: any) => void;
    const pending = new Promise<any>((done) => (release = done));
    const factory = new Factory(config, store, {
      designResearch: async () => {
        signal();
        return pending;
      },
    });
    try {
      const running = factory.runLead("https://delete.example/", {
        runId: "delete-design",
        stopAfter: "strategist",
      });
      const outcome = running.then(
        () => false,
        () => true,
      );
      await started;
      const job = factory.show("delete-design");
      await factory.deleteLead(job.leadId);
      release(fixtureDesignResearch());
      expect(await outcome).toBe(true);
      expect(existsSync(join(config.dataDir, "crawl", job.leadId))).toBe(false);
      expect(readdirSync(join(config.dataDir, ".staging"))).toEqual([]);
      expect(store.list("operations")).toEqual([]);
    } finally {
      store.close();
    }
  });
});
