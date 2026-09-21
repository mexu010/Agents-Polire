import { mkdtempSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Factory } from "../src/orchestrator.js";
import { Store } from "../src/store.js";
import { defaultConfig } from "../src/config.js";
import { fixtureDesignResearch } from "../src/design-research.js";
import { fixtureOutput } from "../src/fixtures.js";

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
      ]);
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
