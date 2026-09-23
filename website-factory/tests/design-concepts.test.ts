import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Factory } from "../src/orchestrator.js";
import { Store } from "../src/store.js";
import { defaultConfig } from "../src/config.js";
import { hash } from "../src/contracts.js";

describe("optional concept selection through the real local renderer", () => {
  it("renders three comparable previews, waits without dispatch, binds selection and invalidates revisions", async () => {
    const config = structuredClone(defaultConfig());
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-concepts-"));
    config.autoGenerate = true;
    config.designExploration.enabled = true;
    const store = new Store(config.dataDir);
    const factory = new Factory(config, store);
    try {
      let job = await factory.runLead(
        "https://fixture.alpina-service.example/",
      );
      expect(job.stage).toBe("concept_review");
      expect(job.status).toBe("waiting_approval");
      expect(job.context.siteSpec).toBeUndefined();
      const review = factory.conceptReview(job.id);
      expect(review.previews).toHaveLength(3);
      expect(
        new Set(review.previews.map((p: any) => hash(p.siteSpec.pages))).size,
      ).toBe(1);
      expect(
        new Set(
          review.previews.map((p: any) => p.siteSpec.theme.design_profile),
        ).size,
      ).toBe(3);
      const before = store.list("steps").length;
      expect((await factory.resume(job.id)).revision).toBe(job.revision);
      expect(store.list("steps")).toHaveLength(before);
      await expect(
        factory.selectConcept(
          job.id,
          review.previews[0].conceptId,
          job.revision - 1,
          review.reviewHash,
        ),
      ).rejects.toThrow(/version/i);
      await expect(
        factory.selectConcept(
          job.id,
          review.previews[0].conceptId,
          job.revision,
          "stale",
        ),
      ).rejects.toThrow(/hash/i);
      const picture = review.previews[0].browser.images[0].path;
      const bytes = readFileSync(picture);
      writeFileSync(picture, "tampered");
      expect(() => factory.conceptReview(job.id)).toThrow(/image|screenshot/i);
      writeFileSync(picture, bytes);
      const future = vi
        .spyOn(Date, "now")
        .mockReturnValue(Date.now() + 2 * 60 * 60_000);
      try {
        expect(() => factory.conceptReview(job.id)).toThrow(/expired/);
      } finally {
        future.mockRestore();
      }
      const selected = review.previews.find(
        (p: any) => p.concept.design_profile === "service-index",
      );
      job = await factory.selectConcept(
        job.id,
        selected.conceptId,
        job.revision,
        review.reviewHash,
      );
      expect(job.stage).toBe("preview_review");
      expect(job.context.siteSpec.theme.design_profile).toBe("service-index");
      expect(job.context.qa.decision).toBe("pass");
      expect(() => factory.conceptReview(job.id)).toThrow(/not waiting/);
      expect(
        store.list("steps").filter((s: any) => s.agent === "strategist"),
      ).toHaveLength(2);
      await expect(
        factory.selectConcept(
          job.id,
          selected.conceptId,
          job.revision,
          review.reviewHash,
        ),
      ).rejects.toThrow(/waiting review stage/);
      expect(
        store.list("steps").filter((s: any) => s.agent === "builder"),
      ).toHaveLength(1);
      const revised = factory.revise(job.id, job.revision, {
        refreshDesignReferences: true,
      });
      expect(revised.context.conceptSelection).toBeUndefined();
      expect(revised.context.conceptPreviews).toBeUndefined();
      expect(() => factory.conceptReview(job.id)).toThrow();
    } finally {
      store.close();
    }
  }, 180_000);

  it("rejects a saved exploration after dependencies change before rendering", async () => {
    const config = structuredClone(defaultConfig());
    config.dataDir = mkdtempSync(join(tmpdir(), "polire-concept-crash-"));
    config.autoGenerate = true;
    config.designExploration.enabled = true;
    const store = new Store(config.dataDir);
    const factory = new Factory(config, store, {
      renderer: async () => {
        throw new Error("simulated renderer interruption");
      },
    });
    try {
      await expect(
        factory.runLead("https://fixture.alpina-service.example/", {
          runId: "concept-crash",
        }),
      ).rejects.toThrow(/interruption/);
      const job = factory.show("concept-crash");
      expect(job.context.conceptSet).toBeDefined();
      expect(job.context.conceptGenerationHash).toBeTruthy();
      job.context.template.capabilities_version = "changed-after-generation";
      store.db
        .prepare("UPDATE factory_jobs SET value_json=? WHERE run_id=?")
        .run(JSON.stringify(job), job.id);
      const steps = store.list("steps").length;
      await expect(factory.resume(job.id)).rejects.toThrow(
        /generation dependencies changed/,
      );
      expect(store.list("steps")).toHaveLength(steps);
      const revised = factory.revise(job.id, factory.show(job.id).revision, {
        refreshDesignReferences: true,
      });
      expect(revised.context.conceptSet).toBeUndefined();
      expect(revised.context.conceptGenerationHash).toBeUndefined();
    } finally {
      store.close();
    }
  });
});
