import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultConfig } from "../src/config.js";
import { Evaluation } from "../src/evaluation.js";
import {
  buildAgentInput,
  fixtureInput,
  fixtureOutput,
} from "../src/fixtures.js";
import { hash } from "../src/contracts.js";
import { Store } from "../src/store.js";

function setup() {
  const config = structuredClone(defaultConfig());
  config.dataDir = mkdtempSync(join(tmpdir(), "factory-eval-"));
  const store = new Store(config.dataDir);
  return { config, store, evaluation: new Evaluation(config, store) };
}
function writeCase(dir: string, overrides: Record<string, unknown> = {}) {
  const input = buildAgentInput("scout", fixtureInput());
  input.images = [];
  const value = {
    slot_number: 1,
    source_provenance: {
      description: "Controlled synthetic fixture",
      captured_at: "2026-09-11T10:00:00.000Z",
    },
    usage_permission_description: "Created locally for evaluation testing.",
    agent: "scout",
    input,
    input_hash: hash(input),
    human_reference: {
      reviewer_identity: "human-1",
      reviewed_at: "2026-09-11T10:00:00.000Z",
      expected: { company: "Alpina" },
      notes: "Synthetic reference.",
    },
    image_attachments: [],
    ...overrides,
  };
  const file = join(dir, `case-${Math.random()}.json`);
  writeFileSync(file, JSON.stringify(value));
  return file;
}

describe("Evaluation", () => {
  test("initialises exactly twenty explicitly unfilled category slots without reviews", () => {
    const { evaluation, store } = setup();
    const suite = evaluation.initSuite();
    expect(suite.slots).toHaveLength(20);
    expect(
      suite.slots.filter((slot: any) => slot.category === "simple_ch_service"),
    ).toHaveLength(5);
    expect(
      suite.slots.filter(
        (slot: any) =>
          slot.category === "incomplete_conflicting_identity_contact",
      ),
    ).toHaveLength(4);
    expect(suite.slots.every((slot: any) => slot.filled === false)).toBe(true);
    expect(store.list("evaluation_reviews")).toEqual([]);
    store.close();
  });

  test("rejects missing provenance, invalid strict input, and mismatched input hashes", () => {
    const { evaluation, config, store } = setup();
    evaluation.initSuite();
    expect(() =>
      evaluation.importCase(
        "representative-20",
        writeCase(config.dataDir, { usage_permission_description: "" }),
      ),
    ).toThrow(/permission/i);
    expect(() =>
      evaluation.importCase(
        "representative-20",
        writeCase(config.dataDir, {
          input: { invalid: true },
          input_hash: hash({ invalid: true }),
        }),
      ),
    ).toThrow(/ScoutInput/);
    expect(() =>
      evaluation.importCase(
        "representative-20",
        writeCase(config.dataDir, { input_hash: "0".repeat(64) }),
      ),
    ).toThrow(/input hash/i);
    store.close();
  });

  test("compares the same frozen input blindly and reuses finished results on resume", async () => {
    const { evaluation, config, store } = setup();
    evaluation.initSuite();
    evaluation.importCase("representative-20", writeCase(config.dataDir));
    const first = await evaluation.runSuite("representative-20");
    const second = await evaluation.runSuite("representative-20");
    expect(first.results).toHaveLength(2);
    expect(second.reused).toBe(2);
    expect(
      new Set(first.results.map((result: any) => result.inputHash)).size,
    ).toBe(1);
    expect(first.results.map((result: any) => result.label).sort()).toEqual([
      "A",
      "B",
    ]);
    expect(
      first.results.every(
        (result: any) =>
          result.model === undefined &&
          result.review === null &&
          result.synthetic === true,
      ),
    ).toBe(true);
    store.close();
  });

  test("requires a dedicated live evaluation budget before any dispatch", async () => {
    const { config, store } = setup();
    config.mode = "live";
    config.authentication = "api_key";
    config.budgets = {
      leadMicroUsd: 2_000_000,
      runMicroUsd: 2_000_000,
      dayMicroUsd: 2_000_000,
      spendScopeId: "single-lead-test",
      totalMicroUsd: 2_000_000,
      evaluationScopeId: null,
      evaluationMicroUsd: null,
    };
    let factories = 0;
    const evaluation = new Evaluation(config, store, () => {
      factories++;
      throw new Error("must not construct provider");
    });
    evaluation.initSuite();
    await expect(evaluation.runSuite("representative-20")).rejects.toThrow(
      /dedicated evaluation budget/i,
    );
    expect(factories).toBe(0);
    store.close();
  });

  test("runs capability checks inside the dedicated evaluation scope before live variants", async () => {
    const { config, store } = setup();
    const fixtureEvaluation = new Evaluation(config, store);
    fixtureEvaluation.initSuite();
    const imported = fixtureEvaluation.importCase(
      "representative-20",
      writeCase(config.dataDir),
    );
    const suite = store.get("evaluation_suites", "representative-20");
    suite.slots = suite.slots.map((slot: any) => ({
      ...slot,
      filled: true,
      caseId: imported.caseId,
    }));
    store.put("evaluation_suites", "representative-20", suite);
    config.mode = "live";
    config.authentication = "api_key";
    config.budgets = {
      leadMicroUsd: 2_000_000,
      runMicroUsd: 2_000_000,
      dayMicroUsd: 2_000_000,
      spendScopeId: "lead-only",
      totalMicroUsd: 2_000_000,
      evaluationScopeId: "evaluation-only",
      evaluationMicroUsd: 2_000_000,
    };
    const scopes: string[] = [];
    let doctors = 0,
      invokes = 0;
    const evaluation = new Evaluation(config, store, (variant) => {
      scopes.push(variant.budgets.spendScopeId!);
      return {
        doctor: async () => {
          doctors++;
          return { ok: true };
        },
        invoke: async (args) => {
          invokes++;
          return fixtureOutput(args.agent, args.input);
        },
      };
    });
    const run = await evaluation.runSuite("representative-20");
    expect(doctors).toBe(2);
    expect(invokes).toBe(2);
    expect(run.results).toHaveLength(40);
    expect(run.results[0].error).toBeNull();
    expect(new Set(scopes)).toEqual(new Set(["evaluation-only"]));
    config.authentication = "chatgpt_oauth";
    const oauthRun = await evaluation.runSuite("representative-20");
    expect(invokes).toBe(4);
    expect(oauthRun.results[0].resultId).not.toBe(run.results[0].resultId);
    const savedOAuth = store.get(
      "evaluation_results",
      oauthRun.results[0].resultId,
    );
    expect(savedOAuth.costMicroUsd).toBeNull();
    await evaluation.runSuite("representative-20");
    expect(invokes).toBe(4);
    store.close();
  });

  test("binds human reviews to the blinded output hash and reports zero accepted cost as null", async () => {
    const { evaluation, config, store } = setup();
    evaluation.initSuite();
    evaluation.importCase("representative-20", writeCase(config.dataDir));
    const run = await evaluation.runSuite("representative-20");
    const result = run.results[0];
    const review = {
      human_identity: "reviewer-1",
      accepted: false,
      reason: "Unsupported claim.",
      fact_errors: 1,
      unsupported_claims: 1,
      schema_errors: 0,
      missed_qa_issues: 0,
      false_positive_qa_issues: 0,
      correction_minutes: 3,
      output_hash: result.outputHash,
    };
    expect(() =>
      evaluation.review(result.resultId, { ...review, output_hash: "stale" }),
    ).toThrow(/stale/i);
    evaluation.review(result.resultId, review);
    const report = evaluation.report("representative-20");
    expect(report.complete).toBe(false);
    expect(report.pendingReviews).toBe(1);
    expect(report.unfilledSlots).toBe(19);
    expect(
      Object.values(report.models).every(
        (model: any) => model.costPerAcceptedMicroUsd === null,
      ),
    ).toBe(true);
    expect(
      Object.values(report.models).reduce(
        (total: number, model: any) => total + model.reviewMetrics.fact_errors,
        0,
      ),
    ).toBe(1);
    store.close();
  });
});
